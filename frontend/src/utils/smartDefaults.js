/**
 * Smart defaults for RELION job parameters.
 * Pure calculation functions — no side effects, no API calls.
 */

/**
 * Suggest particle box size from particle diameter and pixel size.
 * Rule: box = ceil(1.5 * diameter_px), rounded up to nearest even number.
 * @param {number} particleDiameterA - Particle diameter in Angstroms
 * @param {number} pixelSizeA - Pixel size in Angstroms/pixel
 * @returns {number|null} Suggested box size (pixels, even), or null if inputs invalid
 */
export function suggestBoxSize(particleDiameterA, pixelSizeA) {
  if (!particleDiameterA || !pixelSizeA || particleDiameterA <= 0 || pixelSizeA <= 0) return null;
  const diameterPx = particleDiameterA / pixelSizeA;
  const raw = Math.ceil(1.5 * diameterPx);
  // Round up to nearest even
  return raw % 2 === 0 ? raw : raw + 1;
}

/**
 * Suggest mask diameter from particle diameter.
 * Rule: mask = round(diameter * 1.1), ensures some padding.
 * @param {number} particleDiameterA - Particle diameter in Angstroms
 * @returns {number|null} Suggested mask diameter in Angstroms, or null
 */
export function suggestMaskDiameter(particleDiameterA) {
  if (!particleDiameterA || particleDiameterA <= 0) return null;
  return Math.round(particleDiameterA * 1.1);
}

