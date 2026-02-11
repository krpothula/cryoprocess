/**
 * MRC File Parser
 *
 * Pure Node.js parser for MRC/MRC2014 files (cryo-EM standard format).
 * Reads headers and extracts frame data for visualization.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// MRC data type mapping
const MRC_MODE = {
  0: { type: 'int8', bytes: 1 },      // signed 8-bit
  1: { type: 'int16', bytes: 2 },     // signed 16-bit
  2: { type: 'float32', bytes: 4 },   // 32-bit float
  3: { type: 'complex16', bytes: 4 }, // complex 16-bit
  4: { type: 'complex32', bytes: 8 }, // complex 32-bit
  6: { type: 'uint16', bytes: 2 },    // unsigned 16-bit
  12: { type: 'float16', bytes: 2 },  // 16-bit float (half precision)
};

/**
 * Convert IEEE 754 half-precision float16 to float32
 * @param {number} h - 16-bit unsigned integer representing a float16
 * @returns {number} float32 value
 */
const float16ToFloat32 = (h) => {
  const sign = (h >> 15) & 0x1;
  const exponent = (h >> 10) & 0x1f;
  const mantissa = h & 0x3ff;

  if (exponent === 0) {
    // Subnormal or zero
    if (mantissa === 0) return sign ? -0 : 0;
    // Subnormal: (-1)^sign * 2^-14 * (mantissa / 1024)
    return (sign ? -1 : 1) * Math.pow(2, -14) * (mantissa / 1024);
  }
  if (exponent === 0x1f) {
    // Infinity or NaN
    return mantissa === 0 ? (sign ? -Infinity : Infinity) : NaN;
  }
  // Normal: (-1)^sign * 2^(exponent-15) * (1 + mantissa/1024)
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + mantissa / 1024);
};

/**
 * Read MRC file header
 * @param {string} filepath - Path to MRC file
 * @returns {Object} Header information
 */
const readMrcHeader = (filepath) => {
  const fd = fs.openSync(filepath, 'r');
  const headerBuffer = Buffer.alloc(1024);
  fs.readSync(fd, headerBuffer, 0, 1024, 0);
  fs.closeSync(fd);

  // Parse header fields (MRC2014 format)
  const header = {
    // Dimensions
    nx: headerBuffer.readInt32LE(0),      // columns
    ny: headerBuffer.readInt32LE(4),      // rows
    nz: headerBuffer.readInt32LE(8),      // sections (frames for movies)

    // Data type
    mode: headerBuffer.readInt32LE(12),

    // Start indices
    nxstart: headerBuffer.readInt32LE(16),
    nystart: headerBuffer.readInt32LE(20),
    nzstart: headerBuffer.readInt32LE(24),

    // Grid size
    mx: headerBuffer.readInt32LE(28),
    my: headerBuffer.readInt32LE(32),
    mz: headerBuffer.readInt32LE(36),

    // Cell dimensions (Angstroms)
    cella_x: headerBuffer.readFloatLE(40),
    cella_y: headerBuffer.readFloatLE(44),
    cella_z: headerBuffer.readFloatLE(48),

    // Cell angles
    cellb_alpha: headerBuffer.readFloatLE(52),
    cellb_beta: headerBuffer.readFloatLE(56),
    cellb_gamma: headerBuffer.readFloatLE(60),

    // Axis mapping
    mapc: headerBuffer.readInt32LE(64),
    mapr: headerBuffer.readInt32LE(68),
    maps: headerBuffer.readInt32LE(72),

    // Statistics
    dmin: headerBuffer.readFloatLE(76),
    dmax: headerBuffer.readFloatLE(80),
    dmean: headerBuffer.readFloatLE(84),

    // Space group and extended header
    ispg: headerBuffer.readInt32LE(88),
    nsymbt: headerBuffer.readInt32LE(92),  // Extended header size in bytes

    // Origin
    origin_x: headerBuffer.readFloatLE(196),
    origin_y: headerBuffer.readFloatLE(200),
    origin_z: headerBuffer.readFloatLE(204),

    // MAP and machine stamp
    map: headerBuffer.toString('ascii', 208, 212),
    machst: headerBuffer.readUInt32LE(212),

    // RMS
    rms: headerBuffer.readFloatLE(216),

    // Labels
    nlabl: headerBuffer.readInt32LE(220),
  };

  // Calculate derived values
  const modeInfo = MRC_MODE[header.mode] || MRC_MODE[2];
  header.dataType = modeInfo.type;
  header.bytesPerPixel = modeInfo.bytes;
  header.dataOffset = 1024 + header.nsymbt;
  header.frameSize = header.nx * header.ny * header.bytesPerPixel;
  header.numFrames = header.nz;

  // Calculate pixel size
  if (header.mx > 0) {
    header.pixelSize = header.cella_x / header.mx;
  } else {
    header.pixelSize = header.cella_x / header.nx;
  }

  return header;
};

/**
 * Get MRC file info without loading data
 * @param {string} filepath - Path to MRC file
 * @returns {Object} File info
 */
const getMrcInfo = (filepath) => {
  try {
    const header = readMrcHeader(filepath);
    return {
      num_frames: header.numFrames,
      width: header.nx,
      height: header.ny,
      mode: header.mode,
      dataType: header.dataType,
      pixelSize: header.pixelSize,
      fileSize: fs.statSync(filepath).size
    };
  } catch (error) {
    logger.error(`[MRC] Error reading header: ${error.message}`);
    return null;
  }
};

/**
 * Read a single frame from MRC file
 * @param {string} filepath - Path to MRC file
 * @param {number} frameIndex - Frame index (0-based)
 * @returns {Float32Array} Frame data as float array
 */
const readMrcFrame = (filepath, frameIndex = 0) => {
  try {
    const header = readMrcHeader(filepath);
    const frameSize = header.nx * header.ny;
    const bytesPerFrame = header.frameSize;

    // Clamp frame index
    const actualFrame = Math.min(Math.max(0, frameIndex), header.numFrames - 1);

    // Calculate offset
    const offset = header.dataOffset + (actualFrame * bytesPerFrame);

    // Read frame data
    const fd = fs.openSync(filepath, 'r');
    const buffer = Buffer.alloc(bytesPerFrame);
    fs.readSync(fd, buffer, 0, bytesPerFrame, offset);
    fs.closeSync(fd);

    // Convert to float array based on data type
    const frameData = new Float32Array(frameSize);

    switch (header.mode) {
      case 0: // int8
        for (let i = 0; i < frameSize; i++) {
          frameData[i] = buffer.readInt8(i);
        }
        break;
      case 1: // int16
        for (let i = 0; i < frameSize; i++) {
          frameData[i] = buffer.readInt16LE(i * 2);
        }
        break;
      case 2: // float32
        for (let i = 0; i < frameSize; i++) {
          frameData[i] = buffer.readFloatLE(i * 4);
        }
        break;
      case 6: // uint16
        for (let i = 0; i < frameSize; i++) {
          frameData[i] = buffer.readUInt16LE(i * 2);
        }
        break;
      case 12: // float16 (half precision)
        for (let i = 0; i < frameSize; i++) {
          frameData[i] = float16ToFloat32(buffer.readUInt16LE(i * 2));
        }
        break;
      default:
        logger.warn(`[MRC] Unsupported mode: ${header.mode}, treating as float32`);
        for (let i = 0; i < frameSize; i++) {
          frameData[i] = buffer.readFloatLE(i * 4);
        }
    }

    return {
      data: frameData,
      width: header.nx,
      height: header.ny
    };
  } catch (error) {
    logger.error(`[MRC] Error reading frame: ${error.message}`);
    return null;
  }
};

/**
 * Read and average multiple frames
 * @param {string} filepath - Path to MRC file
 * @param {number} maxFrames - Maximum frames to average
 * @returns {Object} Averaged frame data
 */
const readAveragedFrame = (filepath, maxFrames = 10) => {
  try {
    const header = readMrcHeader(filepath);
    const frameSize = header.nx * header.ny;

    // Determine which frames to use
    const numFrames = header.numFrames;
    let frameIndices;
    if (numFrames <= maxFrames) {
      frameIndices = Array.from({ length: numFrames }, (_, i) => i);
    } else {
      const step = numFrames / maxFrames;
      frameIndices = Array.from({ length: maxFrames }, (_, i) => Math.floor(i * step));
    }

    // Average frames
    const avgData = new Float32Array(frameSize);

    for (const frameIdx of frameIndices) {
      const frame = readMrcFrame(filepath, frameIdx);
      if (frame) {
        for (let i = 0; i < frameSize; i++) {
          avgData[i] += frame.data[i];
        }
      }
    }

    // Divide by count
    const count = frameIndices.length;
    for (let i = 0; i < frameSize; i++) {
      avgData[i] /= count;
    }

    return {
      data: avgData,
      width: header.nx,
      height: header.ny,
      framesAveraged: count
    };
  } catch (error) {
    logger.error(`[MRC] Error averaging frames: ${error.message}`);
    return null;
  }
};

/**
 * Convert frame data to normalized 8-bit for PNG
 * @param {Float32Array} data - Frame data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Buffer} 8-bit grayscale buffer
 */
const normalizeToUint8 = (data, width, height) => {
  // Find min/max
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }

  // Normalize to 0-255
  const range = max - min || 1;
  const output = Buffer.alloc(width * height);

  for (let i = 0; i < data.length; i++) {
    output[i] = Math.round(((data[i] - min) / range) * 255);
  }

  return output;
};

/**
 * Convert frame to PNG using sharp
 * @param {string} filepath - Path to MRC file
 * @param {number} frameIndex - Frame index
 * @param {number} targetSize - Target thumbnail size
 * @returns {Buffer} PNG buffer
 */
const frameToPng = async (filepath, frameIndex = 0, targetSize = 512) => {
  const sharp = require('sharp');

  const frame = readMrcFrame(filepath, frameIndex);
  if (!frame) return null;

  const uint8Data = normalizeToUint8(frame.data, frame.width, frame.height);

  // Create PNG with sharp
  const png = await sharp(uint8Data, {
    raw: {
      width: frame.width,
      height: frame.height,
      channels: 1
    }
  })
    .resize(targetSize, targetSize, { fit: 'inside' })
    .png()
    .toBuffer();

  return png;
};

/**
 * Convert averaged frame to PNG
 * @param {string} filepath - Path to MRC file
 * @param {number} maxFrames - Max frames to average
 * @param {number} targetSize - Target size
 * @returns {Buffer} PNG buffer
 */
const averagedFrameToPng = async (filepath, maxFrames = 10, targetSize = 512) => {
  const sharp = require('sharp');

  const frame = readAveragedFrame(filepath, maxFrames);
  if (!frame) return null;

  const uint8Data = normalizeToUint8(frame.data, frame.width, frame.height);

  const png = await sharp(uint8Data, {
    raw: {
      width: frame.width,
      height: frame.height,
      channels: 1
    }
  })
    .resize(targetSize, targetSize, { fit: 'inside' })
    .png()
    .toBuffer();

  return png;
};

/**
 * Read all frames from MRCS stack
 * @param {string} filepath - Path to MRCS file
 * @param {number} maxFrames - Maximum frames to read
 * @returns {Array<{data: Float32Array, width: number, height: number}>} Array of frames
 */
const readAllFrames = (filepath, maxFrames = 100) => {
  try {
    const header = readMrcHeader(filepath);
    const numFrames = Math.min(header.numFrames, maxFrames);
    const frames = [];

    for (let i = 0; i < numFrames; i++) {
      const frame = readMrcFrame(filepath, i);
      if (frame) {
        frames.push(frame);
      }
    }

    return frames;
  } catch (error) {
    logger.error(`[MRC] Error reading all frames: ${error.message}`);
    return [];
  }
};

/**
 * Create a grid image from multiple frames
 * @param {Array} frames - Array of frame objects with data, width, height
 * @param {number} cols - Number of columns in grid
 * @param {number} padding - Padding between images
 * @returns {Object} Grid data with combined image
 */
const framesToGrid = (frames, cols = 10, padding = 2) => {
  if (!frames || frames.length === 0) return null;

  const imgW = frames[0].width;
  const imgH = frames[0].height;
  const numImages = frames.length;
  const rows = Math.ceil(numImages / cols);

  // Create grid dimensions
  const gridW = cols * (imgW + padding) + padding;
  const gridH = rows * (imgH + padding) + padding;
  const gridData = new Float32Array(gridW * gridH);

  // Fill with background value (dark gray)
  gridData.fill(-1000); // Will normalize to dark gray

  // Place each frame in the grid
  for (let idx = 0; idx < numImages; idx++) {
    const frame = frames[idx];
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const startX = col * (imgW + padding) + padding;
    const startY = row * (imgH + padding) + padding;

    // Copy frame data to grid
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const srcIdx = y * imgW + x;
        const dstIdx = (startY + y) * gridW + (startX + x);
        gridData[dstIdx] = frame.data[srcIdx];
      }
    }
  }

  return {
    data: gridData,
    width: gridW,
    height: gridH,
    numImages: numImages,
    cols: cols,
    rows: rows,
    imageWidth: imgW,
    imageHeight: imgH
  };
};

/**
 * Normalize frame data using percentile-based contrast
 * @param {Float32Array} data - Frame data
 * @param {number} lowPercentile - Low percentile for clipping
 * @param {number} highPercentile - High percentile for clipping
 * @returns {Buffer} 8-bit grayscale buffer
 */
const normalizeWithPercentile = (data, lowPercentile = 1, highPercentile = 99) => {
  // Sort a sample of values to find percentiles (for efficiency)
  const sampleSize = Math.min(data.length, 10000);
  const step = Math.floor(data.length / sampleSize);
  const sample = [];
  for (let i = 0; i < data.length; i += step) {
    if (!isNaN(data[i]) && isFinite(data[i])) {
      sample.push(data[i]);
    }
  }
  sample.sort((a, b) => a - b);

  const lowIdx = Math.floor(sample.length * lowPercentile / 100);
  const highIdx = Math.floor(sample.length * highPercentile / 100);
  const min = sample[lowIdx] || sample[0];
  const max = sample[highIdx] || sample[sample.length - 1];

  const range = max - min || 1;
  const output = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i++) {
    let val = data[i];
    // Clip to range
    val = Math.max(min, Math.min(max, val));
    output[i] = Math.round(((val - min) / range) * 255);
  }

  return output;
};

/**
 * Convert MRCS stack to grid PNG
 * @param {string} filepath - Path to MRCS file
 * @param {number} maxImages - Maximum images to include
 * @param {number} cols - Number of columns
 * @param {number} maxWidth - Maximum output width
 * @returns {Buffer} PNG buffer
 */
const stackToGridPng = async (filepath, maxImages = 100, cols = 10, maxWidth = 1200, invert = true) => {
  const sharp = require('sharp');

  // Read all frames
  const frames = readAllFrames(filepath, maxImages);
  if (frames.length === 0) return null;

  const imgW = frames[0].width;
  const imgH = frames[0].height;
  const numImages = frames.length;
  const rows = Math.ceil(numImages / cols);
  const padding = 4;

  // Create grid dimensions
  const gridW = cols * (imgW + padding) + padding;
  const gridH = rows * (imgH + padding) + padding;

  // Create RGBA buffer (4 channels) - transparent background for empty cells
  const gridData = Buffer.alloc(gridW * gridH * 4);
  // Fill with transparent black (R=0, G=0, B=0, A=0)
  gridData.fill(0);

  // Normalize each frame individually and place in grid
  for (let idx = 0; idx < numImages; idx++) {
    const frame = frames[idx];
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const startX = col * (imgW + padding) + padding;
    const startY = row * (imgH + padding) + padding;

    // Normalize this frame with percentile contrast
    const normalizedFrame = normalizeWithPercentile(frame.data, 1, 99);

    // Copy normalized frame to grid (with optional inversion)
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const srcIdx = y * imgW + x;
        const dstIdx = ((startY + y) * gridW + (startX + x)) * 4;
        // Invert for cryo-EM: protein appears white on dark background
        const val = invert ? (255 - normalizedFrame[srcIdx]) : normalizedFrame[srcIdx];
        gridData[dstIdx] = val;     // R
        gridData[dstIdx + 1] = val; // G
        gridData[dstIdx + 2] = val; // B
        gridData[dstIdx + 3] = 255; // A (fully opaque)
      }
    }
  }

  // Create PNG with sharp
  let image = sharp(gridData, {
    raw: {
      width: gridW,
      height: gridH,
      channels: 4
    }
  });

  // Resize if too large
  if (gridW > maxWidth) {
    const ratio = maxWidth / gridW;
    const newHeight = Math.round(gridH * ratio);
    image = image.resize(maxWidth, newHeight, { fit: 'inside' });
  }

  const png = await image.png().toBuffer();

  return {
    buffer: png,
    numImages: numImages,
    cols: cols,
    rows: rows,
    imageWidth: imgW,
    imageHeight: imgH
  };
};

/**
 * Read entire MRC volume (3D data)
 * @param {string} filepath - Path to MRC file
 * @returns {Object} Volume data with dimensions
 */
const readMrcVolume = (filepath) => {
  try {
    const header = readMrcHeader(filepath);
    if (!header) return null;

    const totalSize = header.nx * header.ny * header.nz;
    const totalBytes = totalSize * header.bytesPerPixel;

    // Read all data
    const fd = fs.openSync(filepath, 'r');
    const buffer = Buffer.alloc(totalBytes);
    fs.readSync(fd, buffer, 0, totalBytes, header.dataOffset);
    fs.closeSync(fd);

    // Convert to float array based on data type
    const volumeData = new Float32Array(totalSize);

    switch (header.mode) {
      case 0: // int8
        for (let i = 0; i < totalSize; i++) {
          volumeData[i] = buffer.readInt8(i);
        }
        break;
      case 1: // int16
        for (let i = 0; i < totalSize; i++) {
          volumeData[i] = buffer.readInt16LE(i * 2);
        }
        break;
      case 2: // float32
        for (let i = 0; i < totalSize; i++) {
          volumeData[i] = buffer.readFloatLE(i * 4);
        }
        break;
      case 6: // uint16
        for (let i = 0; i < totalSize; i++) {
          volumeData[i] = buffer.readUInt16LE(i * 2);
        }
        break;
      case 12: // float16 (half precision)
        for (let i = 0; i < totalSize; i++) {
          volumeData[i] = float16ToFloat32(buffer.readUInt16LE(i * 2));
        }
        break;
      default:
        logger.warn(`[MRC] Unsupported mode: ${header.mode}, treating as float32`);
        for (let i = 0; i < totalSize; i++) {
          volumeData[i] = buffer.readFloatLE(i * 4);
        }
    }

    return {
      data: volumeData,
      width: header.nx,
      height: header.ny,
      depth: header.nz,
      pixelSize: header.cella_x / header.mx || 1
    };
  } catch (error) {
    logger.error(`[MRC] Error reading volume: ${error.message}`);
    return null;
  }
};

/**
 * Get individual frame as PNG
 * @param {string} filepath - Path to MRCS file
 * @param {number} frameIndex - Frame index
 * @param {number} targetSize - Target size
 * @returns {Buffer} PNG buffer
 */
const getFramePng = async (filepath, frameIndex, targetSize = 256) => {
  const sharp = require('sharp');

  const frame = readMrcFrame(filepath, frameIndex);
  if (!frame) return null;

  const uint8Data = normalizeWithPercentile(frame.data, 2, 98);

  const png = await sharp(uint8Data, {
    raw: {
      width: frame.width,
      height: frame.height,
      channels: 1
    }
  })
    .resize(targetSize, targetSize, { fit: 'inside' })
    .png()
    .toBuffer();

  return png;
};

/**
 * Compute 3 orthogonal projections of a 3D MRC volume using Maximum Intensity
 * Projection (MIP). MIP takes the brightest voxel along each ray, giving clean
 * contrast without summing artifacts. Standard for cryo-EM volume previews.
 * @param {string} filepath - Path to MRC volume file
 * @returns {Object} { xy: {data, width, height}, xz: {data, width, height}, yz: {data, width, height} }
 */
const getOrthogonalSlices = (filepath) => {
  const volume = readMrcVolume(filepath);
  if (!volume) return null;

  const { data, width: nx, height: ny, depth: nz } = volume;

  // XY MIP: max along Z axis (top view)
  const xyData = new Float32Array(nx * ny).fill(-Infinity);
  for (let z = 0; z < nz; z++) {
    const zOffset = z * nx * ny;
    for (let i = 0; i < nx * ny; i++) {
      if (data[zOffset + i] > xyData[i]) xyData[i] = data[zOffset + i];
    }
  }

  // XZ MIP: max along Y axis (front view)
  const xzData = new Float32Array(nx * nz).fill(-Infinity);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      const rowOffset = z * nx * ny + y * nx;
      for (let x = 0; x < nx; x++) {
        const idx = z * nx + x;
        if (data[rowOffset + x] > xzData[idx]) xzData[idx] = data[rowOffset + x];
      }
    }
  }

  // YZ MIP: max along X axis (side view)
  const yzData = new Float32Array(ny * nz).fill(-Infinity);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      const rowOffset = z * nx * ny + y * nx;
      let maxVal = -Infinity;
      for (let x = 0; x < nx; x++) {
        if (data[rowOffset + x] > maxVal) maxVal = data[rowOffset + x];
      }
      const idx = z * ny + y;
      if (maxVal > yzData[idx]) yzData[idx] = maxVal;
    }
  }

  return {
    xy: { data: xyData, width: nx, height: ny },
    xz: { data: xzData, width: nx, height: nz },
    yz: { data: yzData, width: ny, height: nz },
  };
};

module.exports = {
  readMrcHeader,
  getMrcInfo,
  readMrcFrame,
  readMrcVolume,
  readAveragedFrame,
  normalizeToUint8,
  normalizeWithPercentile,
  frameToPng,
  averagedFrameToPng,
  readAllFrames,
  framesToGrid,
  stackToGridPng,
  getFramePng,
  getOrthogonalSlices
};
