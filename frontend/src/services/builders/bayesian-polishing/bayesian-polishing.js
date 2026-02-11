import axiosInstance from "../../config";

const bayesianPolishingAPI = (payload = {}) => {
  // Map frontend field names to backend field names expected by PolishSerializer
  const mappedPayload = {
    project_id: payload.project_id,
    // Input files - map frontend names to backend names
    inputParticles: payload.particlesFile || "",
    inputMovies: payload.micrographsFile || "",
    postprocessStar: payload.postProcessStarFile || "",
    // Frame parameters
    firstFrame: payload.firstMovieFrame ?? 1,
    lastFrame: payload.lastMovieFrame ?? -1,
    // Motion parameters
    trainOptimalBfactors: payload.optimalParameters || "No",
    sigmaVelocity: payload.sigmaVelocity ?? 0.2,
    sigmaDivergence: payload.sigmaDivergence ?? 5000,
    sigmaAcceleration: payload.sigmaAcceleration ?? 2,
    // Output options / B-factor weighting
    performBfactorWeighting: payload.particlePolishing || "Yes",
    saveSummedMovie: "No",
    minResolutionBfac: payload.minResolutionBfac ?? 20,   // Min resolution for B-factor fit (A)
    maxResolutionBfac: payload.maxResolutionBfac ?? -1,   // Max resolution (-1 = auto from FSC)
    // Running parameters
    mpiProcs: payload.mpiProcs ?? 1,
    threads: payload.threads ?? 1,
    useGPU: payload.GpuAcceleration || "No",
    gpuToUse: payload.gpuTouse || "0",
    // Queue parameters
    submitToQueue: payload.submitToQueue || "No",
    queueName: payload.queueName || "",
    queueSubmitCommand: payload.queueSubmitCommand || "",
    additionalArguments: payload.addArguments || "",
  };

  return axiosInstance.post(`/api/jobs/polish/`, mappedPayload);
};

export { bayesianPolishingAPI };
