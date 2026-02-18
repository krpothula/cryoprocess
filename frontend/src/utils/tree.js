import { getStatusColor as getSharedStatusColor } from './jobStatus';

// Color palette grouped by processing stage (no green/orange/red — reserved for status)
const jobTypeColors = {
  // Micrograph Processing — Blue family (wide spread)
  Import:      { bg: "#93c5fd", border: "#60a5fa" },  // blue-300
  Motion:      { bg: "#3b82f6", border: "#2563eb" },  // blue-500
  CTF:         { bg: "#1d4ed8", border: "#1e40af" },  // blue-700

  // Particle Processing — Violet family (wide spread)
  AutoPick:    { bg: "#c4b5fd", border: "#a78bfa" },  // violet-300
  Extract:     { bg: "#8b5cf6", border: "#7c3aed" },  // violet-500
  Class2D:     { bg: "#6d28d9", border: "#5b21b6" },  // violet-700
  Select:      { bg: "#a855f7", border: "#9333ea" },  // purple-500

  // Volume / 3D Processing — Cyan & Teal family (wide spread)
  Class3D:     { bg: "#67e8f9", border: "#22d3ee" },  // cyan-300
  Refine:      { bg: "#06b6d4", border: "#0891b2" },  // cyan-500
  Polish:      { bg: "#5eead4", border: "#2dd4bf" },  // teal-300
  PostProcess: { bg: "#14b8a6", border: "#0d9488" },  // teal-500
  Mask:        { bg: "#0f766e", border: "#115e59" },  // teal-700
  LocalRes:    { bg: "#0e7490", border: "#155e75" },  // cyan-700

  // File Operations — Slate family (wide spread)
  Subtract:    { bg: "#94a3b8", border: "#64748b" },  // slate-400
  JoinStar:    { bg: "#475569", border: "#334155" },  // slate-600

  // AI Tools — Fuchsia family (wide spread)
  ModelAngelo: { bg: "#e879f9", border: "#d946ef" },  // fuchsia-400
  Dynamight:   { bg: "#a21caf", border: "#86198f" },  // fuchsia-700

  default:     { bg: "#64748b", border: "#475569" },  // slate-500
};

const getJobColor = (jobType) => {
  if (!jobType) return jobTypeColors.default;
  const type = jobType.toLowerCase();
  if (type.includes("import") || type === "linkmovies") return jobTypeColors.Import;
  if (type.includes("motion")) return jobTypeColors.Motion;
  if (type.includes("ctffind") || type === "ctffind") return jobTypeColors.CTF;
  if (type.includes("ctfrefine")) return jobTypeColors.Refine;
  if (type.includes("ctf")) return jobTypeColors.CTF;
  if (type.includes("pick") || type.includes("manualpick")) return jobTypeColors.AutoPick;
  if (type.includes("extract")) return jobTypeColors.Extract;
  if (type.includes("class2") || type === "class2d") return jobTypeColors.Class2D;
  if (type.includes("class3") || type === "class3d") return jobTypeColors.Class3D;
  if (type.includes("initialmodel")) return jobTypeColors.Class3D;
  if (type.includes("autorefine") || type.includes("multibody")) return jobTypeColors.Refine;
  if (type.includes("polish")) return jobTypeColors.Polish;
  if (type.includes("postprocess")) return jobTypeColors.PostProcess;
  if (type.includes("select") || type.includes("manual") || type.includes("subset")) return jobTypeColors.Select;
  if (type.includes("mask")) return jobTypeColors.Mask;
  if (type.includes("localres")) return jobTypeColors.LocalRes;
  if (type.includes("modelangelo")) return jobTypeColors.ModelAngelo;
  if (type.includes("dynamight")) return jobTypeColors.Dynamight;
  if (type.includes("subtract")) return jobTypeColors.Subtract;
  if (type.includes("joinstar") || type.includes("join")) return jobTypeColors.JoinStar;
  return jobTypeColors.default;
};

// Status colors — uses shared utility for canonical status values
const getStatusColor = (status) => {
  if (!status) return '#94a3b8';
  return getSharedStatusColor(status);
};

export const transformApiResponseToTree = (apiResponse) => {
  if (!apiResponse || !Array.isArray(apiResponse.data)) {
    return { id: "root", label: "No Data", children: [] };
  }

  // Recursive builder
  const buildNode = (node) => {
    if (!node || !node.id) return null;

    const children = Array.isArray(node.children)
      ? node.children.map(buildNode).filter(Boolean)
      : [];

    const color = getJobColor(node.jobType);

    return {
      id: node.id,
      label: node.jobName || "Unnamed",
      jobType: node.jobType || "",
      status: node.status || "",
      children,
      style: {
        backgroundColor: color.bg,
        borderColor: color.border,
      },
      statusColor: getStatusColor(node.status),
    };
  };

  // Each item in data is already a ROOT JOB (parent_id === "")
  const trees = apiResponse.data
    .filter((item) => item.parentId === "")
    .map(buildNode)
    .filter(Boolean);

  return {
    id: "root",
    label: "Pipeline",
    children: trees,
    style: {
      backgroundColor: "var(--color-text)",
      borderColor: "var(--color-text-heading)",
    },
  };
};
