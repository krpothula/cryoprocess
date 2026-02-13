import axiosInstance from "../../config";

const bayesianPolishingAPI = (payload = {}) => {
  // Map frontend field names to backend field names expected by PolishBuilder.
  // Also pass through SLURM fields from SlurmRunningConfig (runningmpi, threads, etc.)
  const mappedPayload = {
    project_id: payload.project_id,
    // Input files - keep both frontend and mapped names for paramHelper fallback
    particlesFile: payload.particlesFile || "",
    inputParticles: payload.particlesFile || "",
    micrographsFile: payload.micrographsFile || "",
    inputMovies: payload.micrographsFile || "",
    postProcessStarFile: payload.postProcessStarFile || "",
    postprocessStar: payload.postProcessStarFile || "",
    // Frame parameters
    firstMovieFrame: payload.firstMovieFrame ?? 1,
    lastMovieFrame: payload.lastMovieFrame ?? -1,
    // Extraction/rescaling
    extractionSize: payload.extractionSize ?? -1,
    rescaledSize: payload.rescaledSize ?? -1,
    float16: payload.float16 || "Yes",
    // Training parameters
    trainOptimalBfactors: payload.optimalParameters || "No",
    fractionFourierPixels: payload.fractionFourierPixels ?? 0.5,
    useParticles: payload.useParticles ?? 10000,
    sigmaVelocity: payload.sigmaVelocity ?? 0.2,
    sigmaDivergence: payload.sigmaDivergence ?? 5000,
    sigmaAcceleration: payload.sigmaAcceleration ?? 2,
    // Output options / B-factor weighting
    performBfactorWeighting: payload.particlePolishing || "Yes",
    minResolutionBfac: payload.minResolutionBfac ?? 20,
    maxResolutionBfac: payload.maxResolutionBfac ?? -1,
    // SLURM / Running parameters - use names from SlurmRunningConfig
    runningmpi: payload.runningmpi ?? payload.mpiProcs ?? 1,
    threads: payload.threads ?? 1,
    gres: payload.gres ?? 0,
    clustername: payload.clustername || "",
    // Queue parameters - SlurmRunningConfig uses lowercase 'queuename'
    submitToQueue: payload.submitToQueue || "No",
    queuename: payload.queuename || payload.queueName || "",
    additionalArguments: payload.addArguments || payload.additionalArguments || "",
  };

  return axiosInstance.post(`/api/jobs/polish/`, mappedPayload);
};

export { bayesianPolishingAPI };
