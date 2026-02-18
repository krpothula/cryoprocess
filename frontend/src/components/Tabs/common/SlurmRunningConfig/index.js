import React, { useState, useEffect } from "react";
import { getSlurmPartitions, getSlurmNodes, getSlurmStatus, getSlurmConnectionInfo, getResourceLimits } from "../../../../services/slurmApi";
import { useBuilder } from "../../../../context/BuilderContext";
import PixelSizeInput from "../PixelSizeInput";
import CustomDropdown from "../Dropdown";
import SimpleInput from "../SimpleInput";
import "./SlurmRunningConfig.css";

/**
 * SlurmRunningConfig - Reusable SLURM configuration component for Running tabs
 *
 * Adapts its UI based on the job's compute profile tier:
 *   'gpu'   — Full config: MPI, threads, GPU, partition, node, arguments
 *   'mpi'   — MPI config without GPU field
 *   'local' — Info banner + threads; SLURM collapsed under "Advanced"
 *
 * Props:
 * - formData: Form state object
 * - handleInputChange: Handler for input changes
 * - handleRangeChange: Handler for numeric range changes
 * - dropdownOptions: Yes/No options for submit to queue
 * - computeProfile: { tier, defaultMpi, defaultGpu, defaultThreads }
 */
const SlurmRunningConfig = ({
  formData,
  handleInputChange,
  handleRangeChange,
  dropdownOptions,
  computeProfile,
  disableMpi,
  requireOddMpi = false,
}) => {
  const { resourceError, setResourceError } = useBuilder();
  const [partitions, setPartitions] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [rawNodes, setRawNodes] = useState([]);
  const [clusterStatus, setClusterStatus] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [resourceLimits, setResourceLimits] = useState(null);

  const tier = computeProfile?.tier || 'gpu';
  const isLocal = tier === 'local';
  const showGpu = tier === 'gpu';

  // Custom handler for numeric inputs that allows empty string during typing
  // and properly handles the number conversion
  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    // Allow empty string or valid numbers
    if (value === "" || value === "-") {
      // Keep as string temporarily during typing
      handleInputChange({ target: { name, value: "" } });
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        handleRangeChange({ target: { name, value: numValue } });
      }
    }
  };

  // Use standardized lowercase field names
  const isSubmitToQueueYes = formData.submitToQueue === "Yes";
  const submitToQueueFieldName = 'submitToQueue';
  const queueNameFieldName = 'queueName';

  // Fetch host machine resource limits and connection info on mount
  useEffect(() => {
    getResourceLimits().then(res => {
      if (res.success) setResourceLimits(res.data);
    });
    getSlurmConnectionInfo().then(res => {
      if (res.success) setConnectionInfo(res.connection);
    });
  }, []);

  // Dynamic max values: use host limits for local, generous defaults for SLURM cluster
  const maxMpi = (!isSubmitToQueueYes && resourceLimits)
    ? resourceLimits.availableCpus : 128;
  const maxThreads = (!isSubmitToQueueYes && resourceLimits)
    ? resourceLimits.availableCpus : 64;
  const maxGpus = (!isSubmitToQueueYes && resourceLimits)
    ? resourceLimits.gpuCount : 8;

  // Resource validation for three execution scenarios
  const mpiVal = parseInt(formData.mpiProcs || 1, 10) || 1;
  const threadsVal = parseInt(formData.threads || 1, 10) || 1;

  useEffect(() => {
    // Auto-Refine requires odd MPI (1 master + even workers for two half-sets)
    if (requireOddMpi && mpiVal > 1 && mpiVal % 2 === 0) {
      setResourceError(
        `MPI procs must be odd for Auto-Refine (1 master + even split for half-sets). Use ${mpiVal - 1} or ${mpiVal + 1}.`
      );
      return;
    }

    if (!isSubmitToQueueYes) {
      // Scenario 2: No SLURM, Local execution — max 2 threads
      const maxLocalThreads = 2;
      if (threadsVal > maxLocalThreads) {
        setResourceError(`Threads should not exceed ${maxLocalThreads} for local execution`);
        return;
      }
    } else if (connectionInfo && connectionInfo.mode !== 'ssh') {
      // Scenario 1: SLURM + Local (no SSH to cluster)
      if (resourceLimits) {
        const total = mpiVal * threadsVal;
        const maxCpus = resourceLimits.availableCpus;
        if (total > maxCpus) {
          setResourceError(
            `MPI (${mpiVal}) \u00D7 Threads (${threadsVal}) = ${total} exceeds this system\u2019s limit of ${maxCpus} CPUs`
          );
          return;
        }
      }
    } else if (connectionInfo && connectionInfo.mode === 'ssh') {
      // Scenario 3: SLURM + Cluster — check node resources
      const selectedNodeName = formData.clusterName;
      if (selectedNodeName && rawNodes.length > 0) {
        const node = rawNodes.find(n => n.name === selectedNodeName);
        if (node) {
          const total = mpiVal * threadsVal;
          if (total > node.cpusTotal) {
            setResourceError(
              `MPI (${mpiVal}) \u00D7 Threads (${threadsVal}) = ${total} exceeds node ${node.name}\u2019s resources (${node.cpusTotal} CPUs)`
            );
            return;
          }
        }
      }
    }

    setResourceError(null);
  }, [mpiVal, threadsVal, isSubmitToQueueYes, connectionInfo, resourceLimits, rawNodes, formData.clusterName, setResourceError, requireOddMpi]);

  // Determine which fields are in error (for red highlighting)
  const isMpiOddError = requireOddMpi && mpiVal > 1 && mpiVal % 2 === 0;
  const isCpuExceeded = !!resourceError && !isMpiOddError;

  // Clear resource error on unmount
  useEffect(() => {
    return () => setResourceError(null);
  }, [setResourceError]);

  // Fetch SLURM info when component mounts or submit to queue changes
  useEffect(() => {
    if (isSubmitToQueueYes) {
      fetchSlurmInfo();
    }
  }, [isSubmitToQueueYes]);

  // Fetch nodes when partition changes
  const currentQueueName = formData.queueName || "";
  useEffect(() => {
    if (isSubmitToQueueYes && currentQueueName) {
      fetchNodes(currentQueueName);
    }
  }, [currentQueueName, isSubmitToQueueYes]);

  const fetchSlurmInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch partitions, status, and connection info in parallel
      const [partitionsRes, statusRes, connectionRes] = await Promise.all([
        getSlurmPartitions(),
        getSlurmStatus(),
        getSlurmConnectionInfo()
      ]);

      if (connectionRes.success) {
        setConnectionInfo(connectionRes.connection);
      }

      if (partitionsRes.success) {
        const partitionOptions = partitionsRes.partitions.map(p => ({
          label: `${p.name}${p.default ? ' (default)' : ''} - ${p.state}`,
          value: p.name
        }));
        setPartitions(partitionOptions);

        // Set default partition if not already set
        if (!currentQueueName && partitionsRes.partitions.length > 0) {
          const defaultPartition = partitionsRes.partitions.find(p => p.default)
            || partitionsRes.partitions[0];
          handleInputChange({
            target: { name: queueNameFieldName, value: defaultPartition.name }
          });
        }
      }

      if (statusRes.success) {
        setClusterStatus(statusRes.data);
      }
    } catch (err) {
      setError("Failed to fetch SLURM information");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodes = async (partition) => {
    try {
      const nodesRes = await getSlurmNodes(partition);
      if (nodesRes.success) {
        setRawNodes(nodesRes.nodes || []);
        const nodeOptions = [
          { label: "Any available node", value: "", color: "#333" },
          ...nodesRes.nodes.map(n => {
            const isAvailable = n.state === 'idle' || n.state === 'mix';
            const isDown = n.state === 'down' || n.state === 'drain';
            const color = isDown ? '#9ca3af' : (isAvailable ? '#16a34a' : '#dc2626');

            return {
              label: `${n.name} (${n.cpusTotal - n.cpusAlloc}/${n.cpusTotal} CPUs, ${n.gpus} GPUs)`,
              value: n.name,
              disabled: isDown,
              color: color
            };
          })
        ];
        setNodes(nodeOptions);
      }
    } catch (err) {
      console.error("Failed to fetch nodes:", err);
    }
  };

  // SLURM fields shared between all tiers (when visible)
  const slurmFields = (
    <>
      <CustomDropdown
        label="Submit to queue:"
        options={dropdownOptions}
        value={formData.submitToQueue || "Yes"}
        name={submitToQueueFieldName}
        onChange={handleInputChange}
        tooltipText="Submit job to SLURM queue instead of running locally"
      />

      <CustomDropdown
        label="SLURM Partition:"
        options={partitions.length > 0 ? partitions : [{ label: "Select partition...", value: "" }]}
        value={currentQueueName}
        name={queueNameFieldName}
        onChange={handleInputChange}
        tooltipText="SLURM partition/queue to submit the job to"
        disabled={loading || !isSubmitToQueueYes}
      />

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <CustomDropdown
            label="Run on node:"
            options={nodes.length > 0 ? nodes : [{ label: "Any available node", value: "" }]}
            value={formData.clusterName || ""}
            name="clusterName"
            onChange={handleInputChange}
            tooltipText="Specific node to run on (optional, leave empty for any available)"
            disabled={loading || !isSubmitToQueueYes}
          />
        </div>
        {isSubmitToQueueYes && formData.clusterName && nodes.length > 0 && (() => {
          const selectedNode = nodes.find(n => n.value === formData.clusterName);
          if (!selectedNode) return null;
          return (
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: selectedNode.color || '#9ca3af',
                flexShrink: 0,
                marginTop: '4px',
              }}
              title={
                selectedNode.color === '#16a34a' ? 'Node available' :
                selectedNode.color === '#dc2626' ? 'Node busy/allocated' :
                'Node unavailable'
              }
            />
          );
        })()}
      </div>

      <PixelSizeInput
        label="Number of MPI procs:"
        placeholder={String(computeProfile?.defaultMpi || 4)}
        min={1}
        max={maxMpi}
        value={formData.mpiProcs !== undefined && formData.mpiProcs !== "" ? formData.mpiProcs : ""}
        name="mpiProcs"
        onChange={handleNumericChange}
        handleInputChange={handleNumericChange}
        tooltipText="Number of MPI processes. Must be odd for Auto-Refine (1 master + even split for two half-sets, e.g. 3, 5, 7). Maps to SLURM --ntasks."
        disabled={disableMpi}
        error={isMpiOddError || isCpuExceeded}
      />

      <PixelSizeInput
        label="Number of threads:"
        placeholder={String(computeProfile?.defaultThreads || 1)}
        min={1}
        max={maxThreads}
        value={formData.threads !== undefined && formData.threads !== "" ? formData.threads : ""}
        name="threads"
        onChange={handleNumericChange}
        handleInputChange={handleNumericChange}
        tooltipText="Number of threads per MPI process (maps to SLURM --cpus-per-task)"
        error={isCpuExceeded}
      />

      {showGpu && (
        <PixelSizeInput
          label="Number of GPUs:"
          placeholder={String(computeProfile?.defaultGpu || 0)}
          min={0}
          max={maxGpus}
          value={formData.gres !== undefined && formData.gres !== "" ? formData.gres : ""}
          name="gres"
          onChange={handleNumericChange}
          handleInputChange={handleNumericChange}
          tooltipText="Number of GPUs to request (maps to SLURM --gres=gpu:N)"
          disabled={!isSubmitToQueueYes}
        />
      )}

      <SimpleInput
        label={isSubmitToQueueYes ? "Additional SLURM arguments:" : "Additional arguments:"}
        placeholder={isSubmitToQueueYes ? "e.g., --mem=64G --time=48:00:00" : ""}
        name="additionalArguments"
        value={formData.additionalArguments || ""}
        onChange={handleInputChange}
        tooltipText={isSubmitToQueueYes ? "Additional arguments passed directly to sbatch" : "Additional command-line arguments"}
      />

    </>
  );

  // Tier: local — simplified view with collapsible SLURM override
  if (isLocal) {
    return (
      <div className="slurm-running-config">
        <PixelSizeInput
          label="Number of threads:"
          placeholder={String(computeProfile?.defaultThreads || 1)}
          min={1}
          max={resourceLimits ? resourceLimits.availableCpus : 64}
          value={formData.threads !== undefined && formData.threads !== "" ? formData.threads : ""}
          name="threads"
          onChange={handleNumericChange}
          handleInputChange={handleNumericChange}
          tooltipText="Number of CPU threads to use"
        />

        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setAdvancedOpen(!advancedOpen)}
        >
          {advancedOpen ? "\u25BC" : "\u25B6"} Advanced: SLURM Override
        </button>

        {advancedOpen && (
          <div className="advanced-slurm-section">
            {error && (
              <div className="slurm-error">
                {error}
                <button onClick={fetchSlurmInfo} className="retry-btn">Retry</button>
              </div>
            )}
            {slurmFields}
          </div>
        )}
      </div>
    );
  }

  // Tier: gpu or mpi — full SLURM config
  return (
    <div className="slurm-running-config">
      {error && (
        <div className="slurm-error">
          {error}
          <button onClick={fetchSlurmInfo} className="retry-btn">Retry</button>
        </div>
      )}
      {slurmFields}
    </div>
  );
};

export default SlurmRunningConfig;
