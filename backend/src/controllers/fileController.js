/**
 * File Controller
 *
 * Handles file browsing and access.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const logger = require('../utils/logger');
const Project = require('../models/Project');
const Job = require('../models/Job');
const settings = require('../config/settings');
const { getProjectPath } = require('../utils/pathUtils');
const { parseStarFile } = require('../utils/starParser');
const response = require('../utils/responseHelper');
const { checkProjectAccess } = require('./projectMemberController');

// Stage configuration for file browsing
const STAGE_CONFIG = {
  0: { stage: 'LinkMovies', patterns: ['*.tif', '*.tiff', '*.mrc', '*.eer'] },
  1: { stage: 'Import', patterns: ['*.tif', '*.tiff', '*.mrc', '*.eer'] },
  2: { stage: 'Import', output: ['movies.star', 'micrographs.star'] },
  3: { stage: 'MotionCorr', output: ['corrected_micrographs.star'] },
  4: { stage: 'CtfFind', output: ['micrographs_ctf.star'] },
  5: { stage: 'CtfFind', output: ['micrographs_ctf.star'] },
  6: { stage: 'AutoPick', output: ['*.star'] },
  7: { stages: ['Extract', 'Select'], output: ['particles.star'] },
  8: { stages: ['Extract', 'Class2D', 'Select'], output: ['particles.star', '*_data.star'] },
  9: { stages: ['Extract', 'Class2D', 'InitialModel', 'Select'], output: ['particles.star', '*_data.star'] },
  10: { stages: ['Class3D', 'InitialModel'], output: ['*_data.star', '*.mrc'] },
  // Extension-based browsing
  'pdb': { browse_all: true, patterns: ['*.pdb', '*.ent'] },
  'map': { browse_all: true, patterns: ['*.mrc', '*.map', '*.ccp4'] },
  'ligand': { browse_all: true, patterns: ['*.sdf', '*.mol', '*.mol2', '*.smi', '*.smiles'] }
};

const MAX_FILES = 5000;

/**
 * Browse files for job input
 * GET /api/files
 */
exports.browseFiles = async (req, res) => {
  try {
    const {
      project_id: projectId,
      type: jobTypeParam = '1',
      page = 1,
      page_size: pageSize = 100
    } = req.query;

    if (!projectId) {
      return response.badRequest(res, 'project_id is required');
    }

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Verify access (owner, member, or staff/superuser)
    const access = await checkProjectAccess(projectId, req.user.id, 'viewer');
    if (!access.hasAccess && !req.user.is_staff && !req.user.is_superuser) {
      return response.forbidden(res, 'Access denied');
    }

    const projectPath = getProjectPath(project);

    // Parse job type (can be number or string)
    let jobType;
    try {
      jobType = parseInt(jobTypeParam, 10);
    } catch {
      jobType = jobTypeParam;
    }

    const config = STAGE_CONFIG[jobType] || {};
    const files = [];
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedPageSize = Math.min(500, Math.max(1, parseInt(pageSize, 10) || 100));

    // Browse all (extension-based)
    if (config.browse_all) {
      const patterns = config.patterns || [];
      for (const pattern of patterns) {
        const matches = glob.sync(path.join(projectPath, '**', pattern));
        for (const match of matches.slice(0, MAX_FILES - files.length)) {
          const relPath = path.relative(projectPath, match);
          const stats = fs.statSync(match);
          files.push({
            name: path.basename(match),
            path: relPath,
            type: 'file',
            size: stats.size
          });
        }
        if (files.length >= MAX_FILES) break;
      }
    }
    // Browse Movies folder (for Import)
    else if ([0, 1].includes(jobType)) {
      const moviesFolder = path.join(projectPath, 'Movies');
      if (fs.existsSync(moviesFolder)) {
        // Resolve symlink to get actual path
        let realMoviesFolder = moviesFolder;
        try {
          const lstats = fs.lstatSync(moviesFolder);
          if (lstats.isSymbolicLink()) {
            realMoviesFolder = fs.realpathSync(moviesFolder);
            logger.info(`[Files] Movies is symlink: ${moviesFolder} -> ${realMoviesFolder}`);
          }
        } catch (e) {
          logger.warn(`[Files] Error checking symlink: ${e.message}`);
        }

        const patterns = ['*.tif', '*.tiff', '*.mrc', '*.eer', '*.mrcs'];
        for (const pattern of patterns) {
          const matches = glob.sync(path.join(realMoviesFolder, '**', pattern), { follow: true });
          for (const match of matches) {
            // Use Movies/ prefix for relative path regardless of symlink
            const relPath = 'Movies/' + path.relative(realMoviesFolder, match);
            try {
              const stats = fs.statSync(match);
              files.push({
                name: path.basename(match),
                path: relPath,
                type: 'file',
                size: stats.size
              });
            } catch (e) {
              // Skip files we can't stat
            }
          }
        }
      }

      // If no movies found, check root
      if (files.length === 0) {
        for (const pattern of ['*.tif', '*.tiff', '*.mrc', '*.eer']) {
          const matches = glob.sync(path.join(projectPath, '**', pattern)).slice(0, 100);
          for (const match of matches) {
            const relPath = path.relative(projectPath, match);
            if (!relPath.startsWith('Import/') && !relPath.startsWith('Motion/') && !relPath.startsWith('CTF/')) {
              const stats = fs.statSync(match);
              files.push({
                name: path.basename(match),
                path: relPath,
                type: 'file',
                size: stats.size
              });
            }
          }
        }
      }
    }
    // Browse output files from previous stages
    else {
      const outputPatterns = config.output || ['*.star'];
      let stages = config.stages || [];
      if (!stages.length && config.stage) {
        stages = [config.stage];
      }
      if (!stages.length) {
        stages = ['Import'];
      }

      for (const stage of stages) {
        const stageDir = path.join(projectPath, stage);
        if (!fs.existsSync(stageDir)) continue;

        const jobFolders = fs.readdirSync(stageDir).sort().reverse();
        for (const jobFolder of jobFolders) {
          const jobPath = path.join(stageDir, jobFolder);
          if (!fs.statSync(jobPath).isDirectory()) continue;

          for (const pattern of outputPatterns) {
            const matches = glob.sync(path.join(jobPath, pattern));
            for (const match of matches) {
              const relPath = path.relative(projectPath, match);
              files.push({
                name: path.basename(match),
                path: relPath,
                type: 'file',
                jobFolder: jobFolder,
                stage
              });
            }
          }
        }
      }
    }

    // Pagination
    const totalFiles = Math.min(files.length, MAX_FILES);
    const totalPages = Math.ceil(totalFiles / parsedPageSize);
    const startIdx = (parsedPage - 1) * parsedPageSize;
    const endIdx = startIdx + parsedPageSize;
    const paginatedFiles = files.slice(startIdx, endIdx);

    return response.successData(res, {
      projectId: projectId,
      jobType: jobType,
      totalFiles: totalFiles,
      pagination: {
        page: parsedPage,
        pageSize: parsedPageSize,
        totalPages: totalPages,
        totalItems: totalFiles
      },
      files: paginatedFiles
    });
  } catch (error) {
    logger.error('[Files] browseFiles error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get file info
 * GET /api/files/info
 */
exports.getFileInfo = async (req, res) => {
  try {
    const { path: filePath, project_id: projectId } = req.query;

    if (!filePath || !projectId) {
      return response.badRequest(res, 'path and project_id are required');
    }

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Verify access (owner, member, or staff/superuser)
    const access = await checkProjectAccess(projectId, req.user.id, 'viewer');
    if (!access.hasAccess && !req.user.is_staff && !req.user.is_superuser) {
      return response.forbidden(res, 'Access denied');
    }

    const projectPath = getProjectPath(project);
    const fullPath = path.join(projectPath, filePath);

    // Security: verify path is within project
    const realPath = fs.realpathSync(fullPath);
    const realProjectPath = fs.realpathSync(projectPath);
    if (!realPath.startsWith(realProjectPath + path.sep)) {
      return response.forbidden(res, 'Access denied');
    }

    if (!fs.existsSync(fullPath)) {
      return response.notFound(res, 'File not found');
    }

    const stats = fs.statSync(fullPath);

    return response.successData(res, {
      name: path.basename(fullPath),
      path: filePath,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime
    });
  } catch (error) {
    logger.error('[Files] getFileInfo error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Browse folder contents
 * GET /api/files/browse
 */
exports.browseFolder = async (req, res) => {
  try {
    const {
      project_id: projectId,
      path: browsePath = '',
      extensions = '',
      show_files: showFiles = 'true',
      prefix = '',
      suffix = ''
    } = req.query;

    if (!projectId) {
      return response.badRequest(res, 'project_id is required');
    }

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Verify access (owner, member, or staff/superuser)
    const access = await checkProjectAccess(projectId, req.user.id, 'viewer');
    if (!access.hasAccess && !req.user.is_staff && !req.user.is_superuser) {
      return response.forbidden(res, 'Access denied');
    }

    const projectPath = getProjectPath(project);
    let targetPath = projectPath;

    // Handle relative path
    if (browsePath && browsePath !== '') {
      targetPath = path.join(projectPath, browsePath);
    }

    // Resolve symlinks
    let realTargetPath = targetPath;
    try {
      const lstats = fs.lstatSync(targetPath);
      if (lstats.isSymbolicLink()) {
        realTargetPath = fs.realpathSync(targetPath);
        logger.info(`[Files] Path is symlink: ${targetPath} -> ${realTargetPath}`);
      }
    } catch (e) {
      // Path doesn't exist yet, that's ok
    }

    if (!fs.existsSync(realTargetPath)) {
      return response.notFound(res, 'Folder not found');
    }

    const stats = fs.statSync(realTargetPath);
    if (!stats.isDirectory()) {
      return response.badRequest(res, 'Path is not a directory');
    }

    // Pagination params
    const limit = parseInt(req.query.limit) || 500;
    const offset = parseInt(req.query.offset) || 0;

    // Parse extensions filter
    const extFilter = extensions ? extensions.split(',').map(e => e.toLowerCase().trim()) : [];
    const shouldShowFiles = showFiles === 'true' || showFiles === true;

    // Read directory with file types (avoids statSync per entry)
    const dirents = fs.readdirSync(realTargetPath, { withFileTypes: true });
    const folderNames = [];
    const fileNames = [];

    for (const dirent of dirents) {
      let isDir = dirent.isDirectory();
      let isFile = dirent.isFile();

      // Resolve symlinks to check target type
      if (dirent.isSymbolicLink()) {
        try {
          const resolved = fs.statSync(path.join(realTargetPath, dirent.name));
          isDir = resolved.isDirectory();
          isFile = resolved.isFile();
        } catch (e) {
          // Broken symlink, skip
          continue;
        }
      }

      if (isDir) {
        folderNames.push(dirent.name);
      } else if (isFile && shouldShowFiles) {
        const ext = path.extname(dirent.name).toLowerCase();
        // Extension filter
        if (extFilter.length > 0 && !extFilter.includes(ext)) continue;
        // Prefix filter
        if (prefix && !dirent.name.startsWith(prefix)) continue;
        // Suffix filter
        if (suffix && !dirent.name.endsWith(suffix)) continue;
        fileNames.push(dirent.name);
      }
    }

    // Sort alphabetically
    folderNames.sort((a, b) => a.localeCompare(b));
    fileNames.sort((a, b) => a.localeCompare(b));

    const totalFolders = folderNames.length;
    const totalFiles = fileNames.length;
    const totalItems = totalFolders + totalFiles;

    // Build combined list (folders first) and apply pagination
    // Only statSync the items in the current page (for file sizes)
    const pageItems = [];
    for (let i = offset; i < Math.min(offset + limit, totalItems); i++) {
      if (i < totalFolders) {
        // Folder entry (no stat needed)
        const name = folderNames[i];
        pageItems.push({
          name,
          path: browsePath ? path.join(browsePath, name) : name,
          isDir: true,
          size: null,
          extension: null
        });
      } else {
        // File entry (stat only this page's files for size)
        const name = fileNames[i - totalFolders];
        let size = null;
        try {
          const fileStat = fs.statSync(path.join(realTargetPath, name));
          size = fileStat.size;
        } catch (e) { /* skip */ }
        pageItems.push({
          name,
          path: browsePath ? path.join(browsePath, name) : name,
          isDir: false,
          size,
          extension: path.extname(name).toLowerCase()
        });
      }
    }

    // Get project folder name from path
    const projectFolderName = path.basename(projectPath);

    return response.successData(res, {
      currentPath: browsePath || '',
      projectRoot: projectFolderName,
      items: pageItems,
      totalFolders: totalFolders,
      totalFiles: totalFiles,
      totalItems: totalItems,
      offset,
      limit,
      hasMore: (offset + limit) < totalItems
    });
  } catch (error) {
    logger.error('[Files] browseFolder error:', error);
    return response.serverError(res, error.message);
  }
};

// Stage name to output file patterns mapping
const STAGE_OUTPUT_FILES = {
  'Import': ['movies.star', 'micrographs.star'],
  'LinkMovies': ['movies.star'],
  'MotionCorr': ['corrected_micrographs.star'],
  'CtfFind': ['micrographs_ctf.star', 'filtered_micrographs_ctf_*.star'],
  'AutoPick': ['autopick.star', 'coords_suffix_autopick.star'],
  'Extract': ['particles.star'],
  'Select': ['particles.star', 'micrographs.star'],
  'Class2D': ['*_it*_data.star', 'run_it*_data.star'],
  'Class3D': ['*_it*_data.star', 'run_it*_data.star'],
  'InitialModel': ['initial_model.mrc', '*_it*_data.star', 'run_it*_data.star'],
  'AutoRefine': ['run_data.star', 'run_class001.mrc'],
  'PostProcess': ['postprocess.star'],
  'Polish': ['shiny.star'],
  'CtfRefine': ['particles_ctf_refine.star'],
  'MaskCreate': ['mask.mrc'],
  'LocalRes': ['relion_locres.mrc'],
  'Subtract': ['subtracted.star'],
  'JoinStar': ['join_*.star'],
  'Subset': ['particles.star'],
  'ManualSelect': ['particles.star', 'micrographs.star'],
  'Multibody': ['run_data.star'],
  'Dynamight': ['*.mrc'],
  'ModelAngelo': ['*.pdb', '*.cif']
};

/**
 * Get STAR files from a specific pipeline stage with job metadata
 * GET /api/stage-files?project_id=...&stage=...
 */
exports.getStageStarFiles = async (req, res) => {
  try {
    const { project_id: projectId, stage } = req.query;

    if (!projectId || !stage) {
      return response.badRequest(res, 'project_id and stage are required');
    }

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Check access (owner, member, staff, or superuser)
    const ProjectMember = require('../models/ProjectMember');
    const isMember = await ProjectMember.findOne({
      project_id: projectId,
      user_id: req.user.id
    });
    const hasAccess = project.created_by_id === req.user.id ||
                      isMember ||
                      req.user.is_staff ||
                      req.user.is_superuser;

    if (!hasAccess) {
      return response.forbidden(res, 'Access denied');
    }

    const projectPath = getProjectPath(project);

    // Get jobs for this stage
    const jobs = await Job.find({
      project_id: projectId,
      job_type: stage
    }).sort({ created_at: -1 }).lean();

    const files = [];
    let jobSummary = { totalJobs: jobs.length, message: null };

    if (jobs.length === 0) {
      jobSummary.message = `No ${stage} jobs found. Run a ${stage} job first.`;
    }

    // Get output patterns for this stage
    const outputPatterns = STAGE_OUTPUT_FILES[stage] || ['*.star'];

    for (const job of jobs) {
      // Handle both absolute and relative paths
      const jobDir = path.isAbsolute(job.output_file_path)
        ? job.output_file_path
        : path.join(projectPath, job.output_file_path);
      if (!jobDir || !fs.existsSync(jobDir)) continue;

      let allMatches = [];
      for (const pattern of outputPatterns) {
        const matches = glob.sync(path.join(jobDir, pattern));
        allMatches = allMatches.concat(matches);
      }

      // For Class2D/Class3D/InitialModel, filter to only show the final iteration's _data.star file
      if ((stage === 'Class2D' || stage === 'Class3D' || stage === 'InitialModel') && allMatches.length > 0) {
        // Get the expected final iteration from job parameters
        const expectedIter = job.parameters?.numberEMIterations || job.parameters?.numberOfIterations || 25;

        // Find the highest iteration number among matched files
        const iterationFiles = allMatches.filter(f => path.basename(f).includes('_data.star'));
        if (iterationFiles.length > 0) {
          // Extract iteration numbers and find the highest
          let highestIter = 0;
          let highestIterFile = null;

          for (const f of iterationFiles) {
            const match = path.basename(f).match(/_it(\d+)_data\.star$/);
            if (match) {
              const iterNum = parseInt(match[1]);
              if (iterNum > highestIter) {
                highestIter = iterNum;
                highestIterFile = f;
              }
            }
          }

          // Only keep the final iteration file
          if (highestIterFile) {
            allMatches = [highestIterFile];
          }
        }
      }

      for (const match of allMatches) {
        const fileName = path.basename(match);
        const filePath = path.relative(projectPath, match);

        // Try to get entry count from STAR file
        let entryCount = 0;
        try {
          const starData = await parseStarFile(match, 0); // Just get count, no rows
          entryCount = starData.total || 0;
        } catch (e) {
          // Ignore parse errors
        }

        files.push({
          fileName: fileName,
          filePath: filePath,
          id: job.id,
          jobName: job.job_name,
          jobStatus: job.status,
          entryCount: entryCount,
          createdAt: job.created_at
        });
      }
    }

    return response.successData(res, {
      projectId: projectId,
      stage,
      files,
      jobSummary: jobSummary
    });
  } catch (error) {
    logger.error('[Files] getStageStarFiles error:', error);
    return response.serverError(res, error.message);
  }
};

// Stage name to MRC file patterns mapping
const STAGE_MRC_FILES = {
  'Import': ['*.mrc'],
  'InitialModel': ['initial_model.mrc', 'run_it*_class*.mrc'],
  'Class3D': ['run_it*_class*.mrc', '*_it*_class*.mrc'],
  // AutoRefine: include iteration half-maps and final unfiltered half-maps
  // PostProcess needs ONE of the half-maps, the other is auto-derived
  'AutoRefine': ['run_it*_half*_class*.mrc', '*_it*_half*_class*.mrc', 'run_half*_class*_unfil.mrc', '*_half*_class*_unfil.mrc', 'run_class*.mrc'],
  'PostProcess': ['postprocess.mrc', 'postprocess_masked.mrc'],
  'MaskCreate': ['mask.mrc'],
  'LocalRes': ['relion_locres.mrc', 'relion_locres_filtered.mrc']
};

/**
 * Get MRC files from a specific pipeline stage with job metadata
 * GET /api/stage-mrc-files?project_id=...&stage=...
 */
exports.getStageMrcFiles = async (req, res) => {
  try {
    const { project_id: projectId, stage } = req.query;

    if (!projectId || !stage) {
      return response.badRequest(res, 'project_id and stage are required');
    }

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Check access
    const ProjectMember = require('../models/ProjectMember');
    const isMember = await ProjectMember.findOne({
      project_id: projectId,
      user_id: req.user.id
    });
    const hasAccess = project.created_by_id === req.user.id ||
                      isMember ||
                      req.user.is_staff ||
                      req.user.is_superuser;

    if (!hasAccess) {
      return response.forbidden(res, 'Access denied');
    }

    const projectPath = getProjectPath(project);

    // Get jobs for this stage
    const jobs = await Job.find({
      project_id: projectId,
      job_type: stage
    }).sort({ created_at: -1 }).lean();

    const files = [];
    let jobSummary = { totalJobs: jobs.length, message: null };

    if (jobs.length === 0) {
      jobSummary.message = `No ${stage} jobs found. Run a ${stage} job first.`;
    }

    // Get MRC patterns for this stage
    const mrcPatterns = STAGE_MRC_FILES[stage] || ['*.mrc'];

    for (const job of jobs) {
      const jobDir = job.output_file_path;
      if (!jobDir || !fs.existsSync(jobDir)) continue;

      const jobFiles = [];
      for (const pattern of mrcPatterns) {
        const matches = glob.sync(path.join(jobDir, pattern));
        for (const match of matches) {
          const fileName = path.basename(match);
          const filePath = path.relative(projectPath, match);

          // Extract iteration/class info from filename
          let iteration = null;
          let classNum = null;
          const iterMatch = fileName.match(/it(\d+)/);
          const classMatch = fileName.match(/class(\d+)/);
          if (iterMatch) iteration = parseInt(iterMatch[1]);
          if (classMatch) classNum = parseInt(classMatch[1]);

          jobFiles.push({
            fileName: fileName,
            filePath: filePath,
            id: job.id,
            jobName: job.job_name,
            jobStatus: job.status,
            iteration,
            classNum: classNum,
            createdAt: job.created_at
          });
        }
      }

      // Filter to only the last iteration per job (like star files)
      const maxIter = jobFiles.reduce((max, f) => f.iteration > max ? f.iteration : max, 0);
      if (maxIter > 0) {
        // Only keep files from the last iteration (or files without iteration like initial_model.mrc)
        files.push(...jobFiles.filter(f => f.iteration === null || f.iteration === maxIter));
      } else {
        files.push(...jobFiles);
      }
    }

    return response.successData(res, {
      projectId: projectId,
      stage,
      files,
      jobSummary: jobSummary
    });
  } catch (error) {
    logger.error('[Files] getStageMrcFiles error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get optimiser files for continuing stalled jobs
 * GET /api/stage-optimiser-files?project_id=...&stage=...
 */
exports.getStageOptimiserFiles = async (req, res) => {
  try {
    const { project_id: projectId, stage } = req.query;

    if (!projectId || !stage) {
      return response.badRequest(res, 'project_id and stage are required');
    }

    const project = await Project.findOne({ id: projectId }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Check access
    const ProjectMember = require('../models/ProjectMember');
    const isMember = await ProjectMember.findOne({
      project_id: projectId,
      user_id: req.user.id
    });
    const hasAccess = project.created_by_id === req.user.id ||
                      isMember ||
                      req.user.is_staff ||
                      req.user.is_superuser;

    if (!hasAccess) {
      return response.forbidden(res, 'Access denied');
    }

    const projectPath = getProjectPath(project);

    // Get jobs for this stage (supports comma-separated stages e.g. "AutoRefine,Class3D")
    const stages = stage.split(',').map(s => s.trim()).filter(Boolean);
    const jobs = await Job.find({
      project_id: projectId,
      job_type: stages.length > 1 ? { $in: stages } : stages[0]
    }).sort({ created_at: -1 }).lean();

    const files = [];
    let message = null;

    if (jobs.length === 0) {
      message = `No ${stage} jobs found.`;
    }

    for (const job of jobs) {
      const jobDir = job.output_file_path;
      if (!jobDir || !fs.existsSync(jobDir)) continue;

      // Find optimiser files (run_it*_optimiser.star or *_optimiser.star)
      const optimiserFiles = glob.sync(path.join(jobDir, '*_optimiser.star'));

      if (optimiserFiles.length > 0) {
        // Sort by iteration number and get the latest
        optimiserFiles.sort((a, b) => {
          const iterA = parseInt(path.basename(a).match(/it(\d+)/)?.[1] || '0');
          const iterB = parseInt(path.basename(b).match(/it(\d+)/)?.[1] || '0');
          return iterB - iterA;
        });

        const latestOptimiser = optimiserFiles[0];
        const fileName = path.basename(latestOptimiser);
        const filePath = path.relative(projectPath, latestOptimiser);
        const iterMatch = fileName.match(/it(\d+)/);
        const iteration = iterMatch ? parseInt(iterMatch[1]) : null;

        files.push({
          fileName,
          filePath,
          id: job.id,
          jobName: job.job_name,
          jobStatus: job.status,
          iteration,
          createdAt: job.created_at
        });
      }
    }

    return response.successData(res, {
      projectId: projectId,
      stage,
      files,
      message: files.length === 0 ? `No optimiser files found for ${stage} jobs.` : message
    });
  } catch (error) {
    logger.error('[Files] getStageOptimiserFiles error:', error);
    return response.serverError(res, error.message);
  }
};
