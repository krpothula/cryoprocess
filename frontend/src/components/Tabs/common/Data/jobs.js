export const JobTypes = {
    "import": 1,
    "motion_correction": 2,
    "ctf_estimation": 3,
    "manual_picking": 4,
    "auto_picking": 5,
    "particle_extraction": 6,
    "2d_classification": 7,
    "manual_class_selection": 8,
    "3d_initial_model": 9,
    "3d_classification": 10,
    "3d_auto_refine": 11,
    "3d_multi_body": 12,
    "subset_selection": 13,
    "ctf_refinement": 14,
    "bayesian_polishing": 15,
    "dynamight_flexibility": 16,
    "mask_creation": 17,
    "join_star_files": 18,
    "particle_subtraction": 19,
    "post_processing": 20,
    "local_resolution": 21,
    "modelangelo_building": 22
};

/**
 * Job Compute Profiles
 *
 * Defines compute requirements per job type so the Running tab
 * can auto-configure SLURM vs host-machine execution.
 *
 * Tiers:
 *   'gpu'   — GPU + MPI, full SLURM config (heavy, long-running)
 *   'mpi'   — MPI only, no GPU field shown (medium, benefits from cluster)
 *   'local' — Runs on host machine, SLURM collapsed under Advanced (fast, lightweight)
 */
export const JOB_COMPUTE_PROFILES = {
  // Tier 1: GPU + SLURM
  class_2d:         { tier: 'gpu',   defaultMpi: 4, defaultGpu: 1, defaultThreads: 4 },
  class_3d:         { tier: 'gpu',   defaultMpi: 4, defaultGpu: 1, defaultThreads: 4 },
  auto_refine:      { tier: 'gpu',   defaultMpi: 3, defaultGpu: 1, defaultThreads: 4 },
  initial_model:    { tier: 'gpu',   defaultMpi: 1, defaultGpu: 1, defaultThreads: 4 },
  multibody:        { tier: 'gpu',   defaultMpi: 4, defaultGpu: 1, defaultThreads: 4 },
  dynamight:        { tier: 'gpu',   defaultMpi: 4, defaultGpu: 1, defaultThreads: 4 },
  model_angelo:     { tier: 'gpu',   defaultMpi: 1, defaultGpu: 1, defaultThreads: 1 },
  // Tier 2: MPI only
  import:           { tier: 'mpi',   defaultMpi: 1, defaultGpu: 0, defaultThreads: 4 },
  motion_corr:      { tier: 'mpi',   defaultMpi: 4, defaultGpu: 0, defaultThreads: 4 },
  ctf_estimation:   { tier: 'mpi',   defaultMpi: 4, defaultGpu: 0, defaultThreads: 1 },
  auto_picking:     { tier: 'mpi',   defaultMpi: 4, defaultGpu: 0, defaultThreads: 1 },
  polish:           { tier: 'mpi',   defaultMpi: 4, defaultGpu: 0, defaultThreads: 4 },
  ctf_refine:       { tier: 'mpi',   defaultMpi: 4, defaultGpu: 0, defaultThreads: 4 },
  extract:          { tier: 'mpi',   defaultMpi: 4, defaultGpu: 0, defaultThreads: 1 },
  // Tier 3: Local (host machine)
  mask_create:      { tier: 'local', defaultMpi: 1, defaultGpu: 0, defaultThreads: 1 },
  postprocess:      { tier: 'local', defaultMpi: 1, defaultGpu: 0, defaultThreads: 1 },
  local_resolution: { tier: 'local', defaultMpi: 1, defaultGpu: 0, defaultThreads: 1 },
  subtract:         { tier: 'mpi',   defaultMpi: 4, defaultGpu: 0, defaultThreads: 1 },
  subset:           { tier: 'local', defaultMpi: 1, defaultGpu: 0, defaultThreads: 1 },
  join_star:        { tier: 'local', defaultMpi: 1, defaultGpu: 0, defaultThreads: 1 },
  manual_select:    { tier: 'local', defaultMpi: 1, defaultGpu: 0, defaultThreads: 1 },
};
