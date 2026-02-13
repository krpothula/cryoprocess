/**
 * RELION CLI Flag Registry
 *
 * Valid command-line flags for each RELION program.
 * Used to validate user-entered "Additional Arguments" before submission.
 *
 * Sources:
 * - `relion_<program> --help` output
 * - RELION 4.x / 5.x source code
 *
 * To update: run `relion_<program> --help` and add any new flags.
 * Unknown flags produce a warning but are still passed through,
 * so this list doesn't need to be exhaustive — it's for user guidance.
 */

const RELION_FLAGS = {

  // ─── Import ────────────────────────────────────────────────────────
  relion_import: new Set([
    '--do_movies', '--do_micrographs', '--do_coordinates', '--do_halfmaps',
    '--do_other', '--do_particles',
    '--i', '--odir', '--ofile', '--pipeline_control',
    '--optics_group_name', '--optics_group_mtf', '--particles_optics_group_name',
    '--angpix', '--kV', '--Cs', '--Q0',
    '--beamtilt_x', '--beamtilt_y',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Motion Correction ────────────────────────────────────────────
  relion_run_motioncorr: new Set([
    '--i', '--o', '--pipeline_control',
    '--first_frame_sum', '--last_frame_sum',
    '--bin_factor', '--bfactor', '--dose_per_frame', '--preexposure',
    '--patch_x', '--patch_y', '--eer_grouping',
    '--gainref', '--gain_rot', '--gain_flip', '--defect_file',
    '--float16', '--dose_weighting', '--save_noDW', '--grouping_for_ps',
    '--j', '--gpu',
    '--use_own', '--use_motioncor2', '--motioncor2_exe',
    '--angpix', '--voltage', '--Cs',
    '--only_do_unfinished', '--version',
  ]),

  // ─── CTF Estimation ───────────────────────────────────────────────
  relion_run_ctffind: new Set([
    '--i', '--o', '--pipeline_control',
    '--ctffind_exe', '--is_ctffind4', '--use_gctf', '--gctf_exe',
    '--ctfWin', '--Box', '--ResMin', '--ResMax',
    '--dFMin', '--dFMax', '--FStep', '--dAst',
    '--use_given_ps', '--use_noDW',
    '--fast_search', '--do_phaseshift', '--phase_min', '--phase_max', '--phase_step',
    '--gpu', '--j',
    '--only_do_unfinished', '--version',
  ]),

  // ─── AutoPick ─────────────────────────────────────────────────────
  relion_autopick: new Set([
    '--i', '--odir', '--pickname', '--pipeline_control',
    '--shrink', '--lowpass',
    // LoG picking
    '--LoG', '--LoG_diam_min', '--LoG_diam_max',
    '--LoG_adjust_threshold', '--LoG_upper_threshold', '--LoG_invert',
    // Topaz picking
    '--topaz_extract', '--topaz_model', '--topaz_particle_diameter',
    '--topaz_train', '--topaz_train_parts', '--topaz_train_picks',
    '--topaz_nr_particles', '--topaz_exe', '--extra_topaz_args',
    // Reference-based picking
    '--ref', '--ref3d', '--angpix_ref', '--ang', '--invert', '--ctf',
    '--threshold', '--min_distance', '--max_stddev_noise', '--min_avg_noise',
    '--write_fom_maps', '--read_fom_maps',
    // Helical picking
    '--helix', '--helical_tube_outer_diameter', '--helical_tube_length_min',
    '--gpu', '--j',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Extract / Preprocess ─────────────────────────────────────────
  relion_preprocess: new Set([
    '--i', '--part_dir', '--part_star', '--pipeline_control',
    '--extract', '--extract_size',
    '--coord_dir', '--coord_suffix',
    '--reextract_data_star', '--reset_offsets',
    '--recenter', '--recenter_x', '--recenter_y', '--recenter_z',
    '--float16', '--invert_contrast',
    '--norm', '--bg_radius', '--white_dust', '--black_dust',
    '--scale', '--minimum_pick_fom',
    // Helical extraction
    '--helix', '--helical_outer_diameter', '--helical_bimodal_angular_priors',
    '--helical_tubes', '--helical_cut_into_segments',
    '--helical_nr_asu', '--helical_rise',
    '--j',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Refine (Class2D, Class3D, AutoRefine, InitialModel, MultiBody) ──
  relion_refine: new Set([
    '--o', '--i', '--continue', '--pipeline_control',
    '--dont_combine_weights_via_disc', '--pool', '--j',
    '--ctf', '--ctf_intact_first_peak',
    '--iter', '--tau2_fudge', '--particle_diameter',
    '--K', '--flatten_solvent', '--zero_mask', '--center_classes',
    '--oversampling', '--psi_step', '--offset_range', '--offset_step',
    '--norm', '--scale',
    // Initial model (SGD)
    '--grad', '--class_inactivity_threshold', '--grad_write_iter', '--grad_ini_subset',
    '--strict_highres_exp',
    // Reference
    '--ref', '--trust_ref_size', '--ini_high', '--sym',
    '--solvent_mask', '--solvent_mask2', '--firstiter_cc', '--fast_subsets',
    // GPU / Blush
    '--gpu', '--blush', '--preread_images', '--scratch_dir',
    '--skip_align', '--no_parallel_disc_io',
    // Auto-refine specific
    '--auto_refine', '--split_random_halves', '--auto_local_healpix_order',
    '--low_resol_join_halves', '--auto_ignore_angles', '--auto_resol_angles',
    '--relax_sym', '--solvent_correct_fsc',
    '--sigma_tilt', '--sigma_psi', '--sigma_rot', '--sigma_ang',
    '--healpix_order', '--allow_coarser_sampling', '--pad',
    // Helical
    '--helix', '--helical_inner_diameter', '--helical_outer_diameter',
    '--helical_nr_asu', '--helical_twist_initial', '--helical_rise_initial',
    '--helical_z_percentage', '--helical_keep_tilt_prior_fixed',
    '--helical_symmetry_search', '--helical_twist_min', '--helical_twist_max',
    '--helical_twist_inistep', '--helical_rise_min', '--helical_rise_max',
    '--helical_rise_inistep', '--helical_sigma_distance',
    '--helical_offset_step', '--bimodal_psi', '--helical_rise',
    // Multi-body
    '--multibody_masks', '--reconstruct_subtracted_bodies',
    '--perturb',
    // Expert / misc
    '--free_gpu_memory', '--skip_gridding', '--onthefly_lowpass',
    '--do_em', '--do_sgd', '--write_iter', '--subset_size',
    '--max_subsets', '--sgd_ini_subset', '--sgd_fin_subset',
    '--sgd_ini_resol', '--sgd_fin_resol',
    '--sgd_ini_iter', '--sgd_fin_iter', '--sgd_inbetween_iter',
    '--sgd_write_iter', '--sgd_sigma2fudge_ini', '--sgd_sigma2fudge_halflife',
    '--sgd_skip_anneal', '--sgd_subset_size', '--sgd_stepsize',
    '--external_reconstruct', '--auto_iter_max',
    '--only_do_unfinished', '--version',
  ]),

  // ─── CTF Refinement ───────────────────────────────────────────────
  relion_ctf_refine: new Set([
    '--i', '--o', '--f', '--j', '--pipeline_control',
    '--fit_aniso', '--kmin_mag',
    '--fit_defocus', '--kmin_defocus',
    '--fit_mode',
    '--fit_beamtilt', '--kmin_tilt',
    '--odd_aberr_max_n', '--fit_aberr',
    '--angpix', '--mask',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Polish (Bayesian Polishing / Motion Refine) ──────────────────
  // Complete list from relion_motion_refine --help
  relion_motion_refine: new Set([
    // General
    '--i', '--o', '--f', '--m1', '--m2', '--a1', '--a2',
    '--angpix_ref', '--mask', '--pad',
    '--first_frame', '--last_frame',
    '--only_do_unfinished', '--verb',
    // Motion fit (basic)
    '--fdose', '--s_vel', '--s_div', '--s_acc',
    '--params_file', '--only_group', '--diag',
    // Motion fit (advanced)
    '--cc_pad', '--dmg_a', '--dmg_b', '--dmg_c',
    '--max_iters', '--eps',
    '--no_whiten', '--unreg_glob', '--glob_off', '--glob_off_max',
    '--absolute_params', '--debug_opt', '--gi', '--sq_exp_ker',
    '--max_ed', '--out_cut',
    // Parameter estimation
    '--params2', '--params3', '--align_frac', '--eval_frac',
    '--min_p', '--par_group',
    '--s_vel_0', '--s_div_0', '--s_acc_0',
    '--in_step', '--conv', '--par_iters', '--mot_range', '--seed',
    // Combine frames
    '--combine_frames', '--float16', '--scale', '--window', '--crop',
    '--ctf_multiply', '--bfac_minfreq', '--bfac_maxfreq', '--bfactors',
    '--diag_bfactor', '--suffix',
    '--recenter', '--recenter_x', '--recenter_y', '--recenter_z',
    // Computational
    '--j', '--B_parts', '--min_MG', '--max_MG', '--sbs',
    // Expert
    '--corr_mic', '--find_shortest', '--debug',
    '--mps', '--cps', '--hot', '--debug_mov',
    '--mov_toReplace', '--mov_replaceBy',
    '--eer_upsampling', '--eer_grouping',
    '--pipeline_control', '--version',
  ]),

  // ─── Post-Processing ──────────────────────────────────────────────
  relion_postprocess: new Set([
    '--i', '--i2', '--o', '--angpix', '--pipeline_control',
    '--mask', '--auto_mask',
    '--inimask_threshold', '--extend_inimask', '--width_mask_edge',
    '--auto_bfac', '--autob_lowres', '--autob_highres',
    '--adhoc_bfac', '--mtf',
    '--skip_fsc_weighting', '--low_pass',
    // Local resolution
    '--locres', '--locres_sampling', '--locres_minres',
    '--locres_maskrad',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Mask Create ──────────────────────────────────────────────────
  relion_mask_create: new Set([
    '--i', '--o', '--pipeline_control',
    '--ini_threshold', '--extend_inimask', '--width_soft_edge',
    '--angpix', '--lowpass', '--invert', '--fill',
    '--sphere_radius',
    '--helix', '--z_percentage', '--helical_z_percentage',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Star Handler (Subset, JoinStar) ──────────────────────────────
  relion_star_handler: new Set([
    '--i', '--o', '--pipeline_control',
    '--combine', '--select', '--minval', '--maxval',
    '--discard_on_stats', '--discard_label', '--discard_sigma',
    '--split', '--random_order', '--nr_split', '--size_split',
    '--remove_duplicates', '--image_angpix',
    '--compare', '--center', '--regroup', '--nr_groups',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Class Ranker (Subset) ────────────────────────────────────────
  relion_class_ranker: new Set([
    '--opt', '--o', '--pipeline_control',
    '--auto_select', '--min_score',
    '--select_min_nr_particles', '--select_min_nr_classes',
    '--fn_sel_parts', '--fn_sel_classavgs', '--fn_root',
    '--python_exe', '--do_granularity_features',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Particle Subtract ────────────────────────────────────────────
  relion_particle_subtract: new Set([
    '--i', '--mask', '--o', '--pipeline_control',
    '--new_box', '--float16', '--data',
    '--recenter_on_mask', '--center_x', '--center_y', '--center_z',
    '--revert', '--ctf',
    '--angpix', '--maxres',
    '--only_do_unfinished', '--version',
  ]),

  // ─── Manual Pick ──────────────────────────────────────────────────
  relion_manualpick: new Set([
    '--i', '--odir', '--pipeline_control',
    '--allow_save', '--fast_save', '--selection',
    '--particle_diameter', '--scale', '--sigma_contrast',
    '--black', '--white',
    '--pick_start_end', '--minimum_pick_fom',
    '--topaz_denoise',
    '--color_label', '--color_star', '--blue', '--red',
    '--only_do_unfinished', '--version',
  ]),
};

/**
 * Get known flags for a RELION program.
 * @param {string} program - RELION program name (e.g., 'relion_refine')
 * @returns {Set<string>|null} Set of valid flags, or null if program unknown
 */
function getKnownFlags(program) {
  return RELION_FLAGS[program] || null;
}

/**
 * Validate a flag against a RELION program's known flags.
 * @param {string} flag - The flag to check (e.g., '--angpix')
 * @param {string} program - RELION program name
 * @returns {{valid: boolean, known: boolean}} valid=syntax ok, known=in registry
 */
function validateFlag(flag, program) {
  // Must be a valid flag format
  const validFormat = /^--?[\w][\w-]*$/.test(flag);
  if (!validFormat) {
    return { valid: false, known: false };
  }

  const knownFlags = RELION_FLAGS[program];
  if (!knownFlags) {
    // Unknown program — can't validate, assume ok
    return { valid: true, known: true };
  }

  return { valid: true, known: knownFlags.has(flag) };
}

module.exports = {
  RELION_FLAGS,
  getKnownFlags,
  validateFlag,
};
