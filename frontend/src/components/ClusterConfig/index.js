import React, { useState, useEffect, useCallback } from "react";
import {
  getSlurmPartitions,
  getSlurmNodes,
  getSlurmStatus,
  getSlurmQueue,
  getSlurmConnectionInfo,
} from "../../services/slurmApi";
import "./ClusterConfig.css";

const ClusterConfig = () => {
  // Tab state - subtabs for dashboard sections
  const [activeTab, setActiveTab] = useState("overview");

  // SLURM dashboard state
  const [slurmStatus, setSlurmStatus] = useState(null);
  const [slurmPartitions, setSlurmPartitions] = useState([]);
  const [slurmNodes, setSlurmNodes] = useState([]);
  const [slurmQueue, setSlurmQueue] = useState([]);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [slurmLoading, setSlurmLoading] = useState(false);
  const [slurmError, setSlurmError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load SLURM data on mount
  useEffect(() => {
    loadSlurmData();
  }, []);

  // Auto-refresh SLURM data
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadSlurmData, 30000); // 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadSlurmData = useCallback(async () => {
    setSlurmLoading(true);
    setSlurmError(null);

    try {
      const [statusRes, partitionsRes, nodesRes, queueRes, connRes] = await Promise.all([
        getSlurmStatus(),
        getSlurmPartitions(),
        getSlurmNodes(),
        getSlurmQueue(true), // Show all jobs
        getSlurmConnectionInfo(),
      ]);

      if (statusRes.success) setSlurmStatus(statusRes.data);
      if (partitionsRes.success) setSlurmPartitions(partitionsRes.partitions);
      if (nodesRes.success) setSlurmNodes(nodesRes.nodes);
      if (queueRes.success) setSlurmQueue(queueRes.jobs);
      if (connRes.success) setConnectionInfo(connRes.connection);

      if (!statusRes.success) {
        setSlurmError("SLURM is not available or not configured");
      }
    } catch (err) {
      setSlurmError("Failed to connect to SLURM cluster");
      console.error(err);
    } finally {
      setSlurmLoading(false);
    }
  }, []);

  const getNodeStateClass = (state) => {
    if (state.includes("idle")) return "state-idle";
    if (state.includes("mix")) return "state-mixed";
    if (state.includes("alloc")) return "state-allocated";
    if (state.includes("down") || state.includes("drain")) return "state-down";
    return "state-unknown";
  };

  const getJobStateClass = (state) => {
    if (state === "RUNNING") return "job-running";
    if (state === "PENDING") return "job-pending";
    if (state === "COMPLETED") return "job-completed";
    if (state === "FAILED" || state === "CANCELLED") return "job-failed";
    return "";
  };

  // Render Overview Tab
  const renderOverview = () => (
    <div className="dashboard-section cluster-overview-section">
      {slurmError && (
        <div className="slurm-error-banner">
          {slurmError}
          <button onClick={loadSlurmData}>Retry</button>
        </div>
      )}

      {slurmStatus && (
        <div className="overview-grid">
          {/* Connection & Status Row */}
          <div className="overview-row">
            <div className="overview-item">
              <span className="overview-label">Connection</span>
              <span className="overview-value">
                {connectionInfo ? (
                  connectionInfo.mode === "ssh"
                    ? `SSH (${connectionInfo.ssh_user}@${connectionInfo.ssh_host})`
                    : "Local"
                ) : "—"}
              </span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Status</span>
              <span className={`overview-value status-badge ${slurmStatus.available ? "online" : "offline"}`}>
                {slurmStatus.available ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          {/* Nodes Row */}
          <div className="overview-row">
            <div className="overview-item">
              <span className="overview-label">Total Nodes</span>
              <span className="overview-value">{slurmStatus.total_nodes}</span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Idle</span>
              <span className="overview-value">{slurmStatus.idle_nodes}</span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Busy</span>
              <span className="overview-value">{slurmStatus.busy_nodes}</span>
            </div>
          </div>

          {/* Jobs Row */}
          <div className="overview-row">
            <div className="overview-item">
              <span className="overview-label">Running Jobs</span>
              <span className="overview-value">{slurmStatus.running_jobs}</span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Pending Jobs</span>
              <span className="overview-value">{slurmStatus.pending_jobs}</span>
            </div>
          </div>
        </div>
      )}

      {!slurmStatus && !slurmLoading && (
        <p className="no-data">No cluster data available</p>
      )}
      {slurmLoading && !slurmStatus && (
        <p className="loading-text">Loading cluster status...</p>
      )}
    </div>
  );

  // Render Partitions Tab
  const renderPartitions = () => (
    <div className="dashboard-section">
      {slurmPartitions.length > 0 ? (
        <div className="partitions-grid">
          {slurmPartitions.map((partition) => (
            <div
              key={partition.name}
              className={`partition-card ${partition.state === "up" ? "up" : "down"}`}
            >
              <div className="partition-header">
                <span className="partition-name">
                  {partition.name}
                  {partition.default && <span className="default-badge">default</span>}
                </span>
                <span className={`partition-state ${partition.state}`}>
                  {partition.state}
                </span>
              </div>
              <div className="partition-details">
                <div className="partition-detail">
                  <span className="detail-label">Nodes:</span>
                  <span className="detail-value">{partition.nodes}</span>
                </div>
                <div className="partition-detail">
                  <span className="detail-label">Time Limit:</span>
                  <span className="detail-value">{partition.timelimit}</span>
                </div>
                <div className="partition-detail">
                  <span className="detail-label">Node List:</span>
                  <span className="detail-value nodelist">{partition.nodelist}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-data">No partitions available</p>
      )}
    </div>
  );

  // Render Nodes Tab
  const renderNodes = () => (
    <div className="dashboard-section">
      {slurmNodes.length > 0 ? (
        <div className="nodes-table-container">
          <table className="nodes-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>State</th>
                <th>CPUs (Used/Total)</th>
                <th>Memory</th>
                <th>GPUs</th>
                <th>Partitions</th>
              </tr>
            </thead>
            <tbody>
              {slurmNodes.map((node) => (
                <tr key={node.name} className={getNodeStateClass(node.state)}>
                  <td className="node-name">{node.name}</td>
                  <td>
                    <span className={`state-badge ${getNodeStateClass(node.state)}`}>
                      {node.state}
                    </span>
                  </td>
                  <td>
                    <div className="cpu-bar">
                      <div
                        className="cpu-used"
                        style={{
                          width: `${(node.cpus_alloc / node.cpus_total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="cpu-text">
                      {node.cpus_alloc}/{node.cpus_total}
                    </span>
                  </td>
                  <td>{node.memory_total}</td>
                  <td>{node.gpus}</td>
                  <td>{node.partitions?.join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-data">No nodes available</p>
      )}
    </div>
  );

  // Render Job Queue Tab
  const renderJobQueue = () => (
    <div className="dashboard-section">
      {slurmQueue.length > 0 ? (
        <div className="queue-table-container">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Name</th>
                <th>User</th>
                <th>Partition</th>
                <th>State</th>
                <th>Time</th>
                <th>Nodes</th>
                <th>Node List</th>
              </tr>
            </thead>
            <tbody>
              {slurmQueue.map((job) => (
                <tr key={job.id} className={getJobStateClass(job.state)}>
                  <td className="job-id">{job.id}</td>
                  <td className="job-name">{job.name}</td>
                  <td>{job.user}</td>
                  <td>{job.partition}</td>
                  <td>
                    <span className={`job-state-badge ${getJobStateClass(job.state)}`}>
                      {job.state}
                    </span>
                  </td>
                  <td>{job.time}</td>
                  <td>{job.nodes}</td>
                  <td>{job.nodelist || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-data">No jobs in queue</p>
      )}
    </div>
  );

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "partitions":
        return renderPartitions();
      case "nodes":
        return renderNodes();
      case "queue":
        return renderJobQueue();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="cluster-config">
      {/* Header with refresh controls */}
      <div className="cluster-config-header">
        <h2>SLURM Cluster</h2>
        <div className="header-controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
          <button
            className="btn-refresh"
            onClick={loadSlurmData}
            disabled={slurmLoading}
          >
            {slurmLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="cluster-tabs">
        <button
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === "partitions" ? "active" : ""}`}
          onClick={() => setActiveTab("partitions")}
        >
          Partitions ({slurmPartitions.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "nodes" ? "active" : ""}`}
          onClick={() => setActiveTab("nodes")}
        >
          Nodes ({slurmNodes.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          Job Queue ({slurmQueue.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="slurm-dashboard">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ClusterConfig;
