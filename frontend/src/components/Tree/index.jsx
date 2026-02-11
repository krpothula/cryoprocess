import { useState, useCallback, useEffect, memo } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  Background,
  Controls,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getJobsTreeApi } from "../../services/builders/jobs";
import { transformApiResponseToTree } from "../../utils/tree";
import { BiLoader } from "react-icons/bi";
import { FiGitBranch, FiDownload } from "react-icons/fi";

// Map job_type (PascalCase) to display names
const JOB_TYPE_DISPLAY_NAMES = {
  LinkMovies: "Link Movies",
  Import: "Import",
  MotionCorr: "Motion Correction",
  CtfFind: "CTF Estimation",
  ManualPick: "Manual Picking",
  AutoPick: "Auto-Picking",
  Extract: "Particle Extraction",
  Class2D: "2D Classification",
  Class3D: "3D Classification",
  InitialModel: "3D Initial Model",
  AutoRefine: "3D Auto-Refine",
  Multibody: "3D Multi-Body",
  Subset: "Subset Selection",
  CtfRefine: "CTF Refinement",
  Polish: "Bayesian Polishing",
  MaskCreate: "Mask Creation",
  PostProcess: "Post-Processing",
  JoinStar: "Join Star Files",
  Subtract: "Particle Subtraction",
  LocalRes: "Local Resolution",
  Dynamight: "DynaMight",
  ModelAngelo: "ModelAngelo",
  ManualSelect: "Select Classes",
};

const getJobTypeDisplayName = (jobType) => {
  return JOB_TYPE_DISPLAY_NAMES[jobType] || jobType;
};

// Card-style node with status indicator
const JobNode = memo(({ data, selected }) => {
  const isRunning = data.status === "running";
  const isFailed = data.status === "failed" || data.status === "error";
  return (
    <div className={`job-node-wrapper ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="job-handle-top" />
      <div
        className={`job-node-card ${isFailed ? "job-node-failed" : ""} ${isRunning ? "job-node-running" : ""}`}
        style={{
          "--node-color": data.bgColor || "#3b82f6",
          "--status-color": data.statusColor || "#94a3b8",
        }}
      >
        <div className="job-node-header">
          <span
            className={`job-status-dot ${isRunning ? "job-status-pulse" : ""}`}
          />
          <span className="job-name-text">{data.label}</span>
          <span className="job-populate-icon" title="Populate inputs from this job">
            <FiDownload size={10} />
          </span>
        </div>
        <span className="job-type-text">{getJobTypeDisplayName(data.jobType) || "Job"}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="job-handle-bottom" />
    </div>
  );
});

// Pipeline root node
const RootNode = memo(({ data }) => {
  return (
    <div className="root-node-wrapper">
      <div className="root-node-card">
        <FiGitBranch size={14} />
        <span className="root-node-text">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="job-handle-bottom" />
    </div>
  );
});

// Custom node types registry
const nodeTypes = {
  jobNode: JobNode,
  rootNode: RootNode,
};

// Edge styles
const defaultEdgeOptions = {
  type: "smoothstep",
  pathOptions: {
    borderRadius: 8,
    offset: 0,
  },
  animated: false,
  style: {
    stroke: "#94a3b8",
    strokeWidth: 1.5,
  },
};

// Calculate the width of a subtree (number of leaf nodes or 1 if leaf)
function getSubtreeWidth(node) {
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + getSubtreeWidth(child), 0);
}

function buildFlowData(
  tree,
  x = 0,
  y = 0,
  level = 0,
  nodes = [],
  edges = [],
  isRoot = true
) {
  // Add current node
  const style = tree.style || {};
  const nodeType = isRoot ? "rootNode" : "jobNode";

  nodes.push({
    id: tree.id,
    type: nodeType,
    data: {
      label: tree.label,
      jobType: tree.jobType || "",
      status: tree.status || "",
      bgColor: style.backgroundColor,
      borderColor: style.borderColor,
      statusColor: tree.statusColor,
    },
    position: { x, y },
  });

  // If has children, space them based on subtree widths to avoid overlap
  if (tree.children && tree.children.length > 0) {
    const nodeWidth = 170; // card width + horizontal gap
    const verticalGap = 90; // vertical distance between levels
    const childY = y + verticalGap;

    // Calculate total width needed and position each child
    const childWidths = tree.children.map(child => getSubtreeWidth(child) * nodeWidth);
    const totalWidth = childWidths.reduce((sum, w) => sum + w, 0);

    let currentX = x - totalWidth / 2;

    tree.children.forEach((child, index) => {
      const childWidth = childWidths[index];
      const childX = currentX + childWidth / 2;

      buildFlowData(
        child,
        childX,
        childY,
        level + 1,
        nodes,
        edges,
        false
      );

      // Edge uses child's job type color; animate if running
      const isRunning = child.status === "running";
      const edgeColor = child.style?.backgroundColor || "#94a3b8";

      edges.push({
        id: `${tree.id}-${child.id}`,
        source: tree.id,
        target: child.id,
        ...defaultEdgeOptions,
        animated: isRunning,
        style: {
          ...defaultEdgeOptions.style,
          stroke: edgeColor,
        },
      });

      currentX += childWidth;
    });
  }

  return { nodes, edges };
}

export default function TreeView({ projectId, expanded, setSelectedTreeJob, onPopulateJob, refreshKey }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setViewport } = useReactFlow();

  const onNodesChange = useCallback(
    (changes) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );
  const onEdgesChange = useCallback(
    (changes) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );

  async function fetchTree() {
    setLoading(true);
    setError(null);
    getJobsTreeApi(projectId)
      .then((response) => {
        if (response?.status === 200 || response.status === 201) {
          const apiResponse = response.data || {};
          if (apiResponse && apiResponse.data) {
            const treesData = transformApiResponseToTree(apiResponse);
            if (treesData) {
              const { nodes, edges } = buildFlowData(treesData);
              setNodes(nodes);
              setEdges(edges);
            }
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Tree] Error:", err);
        setError("Failed to load job tree");
        setLoading(false);
      });
  }

  useEffect(() => {
    if (projectId) {
      fetchTree();
    }
  }, [projectId]);

  // Re-fetch tree when jobs change (same refreshKey as Meta/job list)
  useEffect(() => {
    if (refreshKey > 0 && projectId) {
      fetchTree();
    }
  }, [refreshKey]);

  useEffect(() => {
    if (expanded) {
      setViewport({ x: 200, y: 100, zoom: 0.8 }, { duration: 300 });
    } else {
      setViewport({ x: 100, y: 100, zoom: 0.4 }, { duration: 300 });
    }
  }, [expanded]);

  if (loading) {
    return (
      <div className="tree-loading">
        <div className="tree-loading-content">
          <BiLoader className="tree-loading-icon" />
          <p className="tree-loading-text">Building pipeline tree...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tree-error">
        <div className="tree-error-content">
          <FiGitBranch className="tree-error-icon" />
          <p className="tree-error-text">{error}</p>
          <button onClick={fetchTree} className="tree-retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (edges.length < 1 && nodes?.length < 1) {
    return (
      <div className="tree-empty">
        <div className="tree-empty-content">
          <FiGitBranch className="tree-empty-icon" />
          <p className="tree-empty-title">No jobs yet</p>
          <p className="tree-empty-subtitle">
            Submit a job to start building your pipeline
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tree-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(e, node) => {
          if (!node?.id || node.id === "root") return;
          // Check if the populate icon was clicked
          const isPopulate = e.target.closest('.job-populate-icon');
          if (isPopulate && onPopulateJob) {
            onPopulateJob(node.id);
          } else {
            setSelectedTreeJob(node.id);
          }
        }}
        onInit={(reactFlowInstance) => {
          setTimeout(() => {
            reactFlowInstance.fitView({ padding: 0.3 });
          }, 100);
        }}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesConnectable={false}
        nodesDraggable={true}
        fitView
        fitViewOptions={{ padding: 0.3, includeHiddenNodes: false }}
        defaultViewport={{ x: 0, y: 20, zoom: 0.8 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls
          position="top-right"
          showInteractive={false}
        />
      </ReactFlow>
      <style>{`
        .tree-container {
          width: 100%;
          height: calc(100vh - 48px);
          min-height: 400px;
          background: #fafbfc;
        }

        /* Root pipeline node */
        .root-node-wrapper {
          position: relative;
        }

        .root-node-card {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #3b82f6;
          border: 2px solid #2563eb;
          border-radius: 8px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
          cursor: default;
        }

        .root-node-text {
          letter-spacing: 0.5px;
        }

        /* Card-style job node with status indicator */
        .job-node-wrapper {
          position: relative;
        }

        .job-node-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 8px 12px;
          background: white;
          border-radius: 8px;
          border-left: 4px solid var(--node-color);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
          cursor: pointer;
          transition: all 0.15s ease;
          min-width: 120px;
          max-width: 150px;
        }

        .job-node-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
          transform: translateY(-1px);
        }

        .job-node-wrapper.selected .job-node-card {
          box-shadow: 0 0 0 2px var(--node-color), 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .job-node-failed {
        }

        .job-node-running {
        }

        .job-node-header {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
        }

        .job-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--status-color);
          flex-shrink: 0;
        }

        .job-status-pulse {
          animation: statusPulse 2s ease-in-out infinite;
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(245, 158, 11, 0); }
        }

        .job-name-text {
          font-size: 12px;
          font-weight: 600;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .job-type-text {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        .job-populate-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          color: #94a3b8;
          opacity: 0;
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .job-node-card:hover .job-populate-icon {
          opacity: 1;
          color: #3b82f6;
          background: #eff6ff;
        }

        .job-populate-icon:hover {
          background: #3b82f6 !important;
          color: white !important;
          transform: scale(1.1);
        }

        .job-handle-top,
        .job-handle-bottom {
          width: 6px !important;
          height: 6px !important;
          background: #cbd5e1 !important;
          border: 1.5px solid white !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
        }

        .job-handle-top {
          top: -3px !important;
        }

        .job-handle-bottom {
          bottom: -3px !important;
        }

        /* State screens */
        .tree-loading,
        .tree-error,
        .tree-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 300px;
          background: #fafbfc;
        }

        .tree-loading-content,
        .tree-error-content,
        .tree-empty-content {
          text-align: center;
          padding: 32px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .tree-loading-icon {
          font-size: 36px;
          color: #3b82f6;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .tree-loading-text {
          color: #475569;
          font-size: 14px;
          font-weight: 500;
          margin: 0;
        }

        .tree-error-icon,
        .tree-empty-icon {
          font-size: 48px;
          color: #94a3b8;
          margin-bottom: 16px;
        }

        .tree-error-text {
          color: #ef4444;
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 16px 0;
        }

        .tree-retry-btn {
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 600;
          color: white;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tree-retry-btn:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .tree-empty-title {
          color: #1e293b;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .tree-empty-subtitle {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        /* ReactFlow controls */
        .react-flow__controls {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
          border: none;
          background: white;
        }

        .react-flow__controls-button {
          background: white;
          border: none;
          border-bottom: 1px solid #f1f5f9;
          width: 28px;
          height: 28px;
        }

        .react-flow__controls-button:hover {
          background: #f8fafc;
        }

        .react-flow__controls-button svg {
          fill: #64748b;
        }
      `}</style>
    </div>
  );
}
