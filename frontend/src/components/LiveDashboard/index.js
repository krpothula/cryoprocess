import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiPause,
  FiPlay,
  FiSquare,
  FiRefreshCw,
  FiArrowLeft,
  FiChevronRight,
  FiFilm,
  FiCrosshair,
  FiGrid,
  FiBox,
  FiImage,
  FiCopy,
  FiInfo,
  FiAlertTriangle,
  FiChevronDown,
  FiSearch,
  FiFilter,
  FiSettings,
  FiX,
  FiSave,
  FiLayers,
} from "react-icons/fi";
import * as liveApi from "../../services/liveSession";
import { getClass2DIndividualImagesApi } from "../../services/builders/2d-classification/2d-classification";
import { getProjectByIdApi } from "../../services/projects/projects";


// ---------- helpers ----------

const STATUS_COLORS = {
  running: "var(--color-warning)",
  paused: "var(--color-warning)",
  stopped: "var(--color-text-secondary)",
  completed: "var(--color-success-text)",
  error: "var(--color-danger-text)",
};

const STATUS_ICONS = {
  running: FiActivity,
  paused: FiPause,
  stopped: FiSquare,
  completed: FiCheckCircle,
  error: FiAlertCircle,
};

const PIPELINE_STAGES = [
  { key: "import", label: "Import", icon: FiFilm },
  { key: "motion", label: "Motion", icon: FiRefreshCw },
  { key: "ctf", label: "CTF", icon: FiCrosshair },
  { key: "filter", label: "Filter", icon: FiFilter },
  { key: "pick", label: "Pick", icon: FiGrid },
  { key: "extract", label: "Extract", icon: FiBox },
  { key: "class2d", label: "2D Class", icon: FiImage },
  { key: "select", label: "Select", icon: FiCheckCircle },
  { key: "inimodel", label: "3D Model", icon: FiBox },
];

// WebSocket URL — configurable via env vars, auto-detects wss for HTTPS
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsHost = process.env.REACT_APP_WS_HOST || window.location.hostname;
const wsPort = process.env.REACT_APP_WS_PORT || '8001';
const WS_URL = `${wsProtocol}://${wsHost}:${wsPort}/ws`;

// Map orchestrator stage types (stored in DB) to dashboard stage keys
const STAGE_TYPE_TO_KEY = {
  Import: "import",
  MotionCorr: "motion",
  CtfFind: "ctf",
  AutoPick: "pick",
  Extract: "extract",
  Class2D: "class2d",
  QualityFilter: "filter",
  Select: "select",
  InitialModel: "inimodel",
  starting: "import",
};

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleString();
}

// ---------- settings modal ----------

const SETTINGS_SECTIONS = [
  {
    label: "Processing", fields: [
      { key: "batchSize", label: "Batch Size", type: "number" },
    ]
  },
  {
    label: "Quality Thresholds", fields: [
      { key: "ctfResolutionMax", label: "Max CTF Resolution (\u00C5)", type: "number", step: "0.1", group: "thresholds" },
      { key: "totalMotionMax", label: "Max Total Motion (\u00C5)", type: "number", step: "0.1", group: "thresholds" },
    ]
  },
  {
    label: "Motion Correction", fields: [
      { key: "binFactor", label: "Bin Factor", type: "number", group: "motionConfig" },
      { key: "dosePerFrame", label: "Dose Per Frame (e/\u00C5\u00B2)", type: "number", step: "0.1", group: "motionConfig" },
      { key: "patchX", label: "Patch X", type: "number", group: "motionConfig" },
      { key: "patchY", label: "Patch Y", type: "number", group: "motionConfig" },
    ]
  },
  {
    label: "CTF Estimation", fields: [
      { key: "defocusMin", label: "Defocus Min (\u00C5)", type: "number", group: "ctfConfig" },
      { key: "defocusMax", label: "Defocus Max (\u00C5)", type: "number", group: "ctfConfig" },
      { key: "defocusStep", label: "Defocus Step (\u00C5)", type: "number", group: "ctfConfig" },
    ]
  },
  {
    label: "Particle Picking", fields: [
      { key: "minDiameter", label: "Min Diameter (\u00C5)", type: "number", group: "pickingConfig" },
      { key: "maxDiameter", label: "Max Diameter (\u00C5)", type: "number", group: "pickingConfig" },
      { key: "threshold", label: "Threshold", type: "number", step: "0.01", group: "pickingConfig" },
    ]
  },
  {
    label: "Extraction", fields: [
      { key: "boxSize", label: "Box Size (px)", type: "number", group: "extractionConfig" },
      { key: "rescaledSize", label: "Rescaled Size (px)", type: "number", group: "extractionConfig" },
    ]
  },
  {
    label: "2D Classification", fields: [
      { key: "enabled", label: "Enabled", type: "toggle", group: "class2dConfig" },
      { key: "numClasses", label: "Number of Classes", type: "number", group: "class2dConfig" },
      { key: "particleThreshold", label: "Particle Threshold", type: "number", group: "class2dConfig" },
      { key: "particleDiameter", label: "Particle Diameter (\u00C5)", type: "number", group: "class2dConfig" },
    ]
  },
  {
    label: "Auto Select 2D", fields: [
      { key: "enabled", label: "Enabled", type: "toggle", group: "autoSelectConfig" },
      { key: "minScore", label: "Min Score", type: "number", step: "0.05", group: "autoSelectConfig" },
      { key: "minParticles", label: "Min Particles", type: "number", step: "500", group: "autoSelectConfig" },
    ]
  },
  {
    label: "3D Initial Model", fields: [
      { key: "enabled", label: "Enabled", type: "toggle", group: "inimodelConfig" },
      { key: "symmetry", label: "Symmetry", type: "text", group: "inimodelConfig" },
      { key: "numClasses", label: "Number of Classes", type: "number", group: "inimodelConfig" },
      { key: "maskDiameter", label: "Mask Diameter (\u00C5)", type: "number", group: "inimodelConfig" },
    ]
  },
  {
    label: "SLURM / Compute", fields: [
      { key: "threads", label: "Threads", type: "number", group: "slurmConfig" },
      { key: "mpiProcs", label: "MPI Processes", type: "number", group: "slurmConfig" },
      { key: "gpuCount", label: "GPU Count", type: "number", group: "slurmConfig" },
    ]
  },
];

/**
 * Build the initial settings form state from a session object.
 * Maps snake_case DB fields back to the camelCase form keys.
 */
function buildSettingsForm(session) {
  if (!session) return {};
  const form = { batchSize: session.batchSize ?? 25 };

  // Map nested configs back to flat form keys
  const configMappings = {
    thresholds: session.thresholds,
    motionConfig: session.motionConfig,
    ctfConfig: session.ctfConfig,
    pickingConfig: session.pickingConfig,
    extractionConfig: session.extractionConfig,
    class2dConfig: session.class2dConfig,
    autoSelectConfig: session.autoSelectConfig,
    inimodelConfig: session.inimodelConfig,
    slurmConfig: session.slurmConfig,
  };

  for (const [group, cfg] of Object.entries(configMappings)) {
    if (!cfg) continue;
    for (const [k, v] of Object.entries(cfg)) {
      // Store as group.key for later reconstruction
      form[`${group}.${k}`] = v;
    }
  }
  return form;
}

/**
 * Convert the flat form state back into the API payload structure.
 * Only includes fields that differ from the original session.
 */
function buildConfigPayload(form, originalForm) {
  const payload = {};

  // Check batchSize
  if (form.batchSize !== originalForm.batchSize) {
    payload.batchSize = form.batchSize;
  }

  // Check grouped fields
  const groups = new Set();
  for (const key of Object.keys(form)) {
    if (key.includes('.')) groups.add(key.split('.')[0]);
  }

  for (const group of groups) {
    const groupPayload = {};
    let hasChange = false;
    for (const [key, val] of Object.entries(form)) {
      if (!key.startsWith(group + '.')) continue;
      const field = key.split('.')[1];
      if (val !== originalForm[key]) {
        hasChange = true;
      }
      groupPayload[field] = val;
    }
    if (hasChange) {
      payload[group] = groupPayload;
    }
  }

  return payload;
}

function SettingsModal({ form, setForm, onSave, onClose, saving }) {
  const handleChange = (key, value, type) => {
    let parsed = value;
    if (type === "number") {
      parsed = value === "" ? "" : Number(value);
    }
    setForm(prev => ({ ...prev, [key]: parsed }));
  };

  const handleToggle = (key) => {
    setForm(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.5)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "40px 20px", overflow: "auto",
    }} onClick={onClose}>
      <div style={{
        background: "var(--color-bg)", borderRadius: 12,
        border: "1px solid var(--color-border)",
        width: "100%", maxWidth: 520, maxHeight: "85vh", overflow: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid var(--color-border)",
          position: "sticky", top: 0, background: "var(--color-bg)", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiSettings size={16} style={{ color: "var(--color-primary)" }} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Session Settings</span>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)", padding: 4,
          }}><FiX size={18} /></button>
        </div>

        {/* Sections */}
        <div style={{ padding: "12px 20px 20px" }}>
          {SETTINGS_SECTIONS.map(section => (
            <div key={section.label} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                color: "var(--color-text-secondary)", marginBottom: 8,
                letterSpacing: "0.5px",
              }}>{section.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {section.fields.map(field => {
                  const formKey = field.group ? `${field.group}.${field.key}` : field.key;
                  const val = form[formKey];
                  return (
                    <div key={formKey} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0",
                    }}>
                      <label style={{ fontSize: 13, color: "var(--color-text)" }}>{field.label}</label>
                      {field.type === "toggle" ? (
                        <button
                          onClick={() => handleToggle(formKey)}
                          style={{
                            width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                            background: val ? "var(--color-primary)" : "var(--color-border)",
                            position: "relative", transition: "background 0.2s",
                          }}
                        >
                          <span style={{
                            position: "absolute", top: 2, left: val ? 20 : 2,
                            width: 18, height: 18, borderRadius: "50%",
                            background: "#fff", transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          }} />
                        </button>
                      ) : (
                        <input
                          type={field.type}
                          step={field.step || undefined}
                          value={val ?? ""}
                          onChange={e => handleChange(formKey, e.target.value, field.type)}
                          style={{
                            width: 100, padding: "4px 8px", borderRadius: 6,
                            border: "1px solid var(--color-border)",
                            background: "var(--color-bg)", color: "var(--color-text)",
                            fontSize: 13, textAlign: "right",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "12px 20px", borderTop: "1px solid var(--color-border)",
          position: "sticky", bottom: 0, background: "var(--color-bg)",
        }}>
          <button onClick={onClose} style={{
            padding: "6px 16px", borderRadius: 6, border: "1px solid var(--color-border)",
            background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", fontSize: 13,
          }}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={{
            padding: "6px 16px", borderRadius: 6, border: "none",
            background: "var(--color-primary)", color: "#fff", cursor: "pointer", fontSize: 13,
            opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6,
          }}>
            <FiSave size={13} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- component ----------

const LiveDashboard = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // core state
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // job IDs from session stats
  const [jobsByType, setJobsByType] = useState({});

  // tab data
  const [activity, setActivity] = useState([]);

  // 2D class gallery
  const [classData, setClassData] = useState(null);
  const [classLoading, setClassLoading] = useState(false);

  // Selected 2D class gallery (from class_ranker)
  const [selectData, setSelectData] = useState(null);
  const [selectLoading, setSelectLoading] = useState(false);

  // activity filters + expand state
  const [activityFilters, setActivityFilters] = useState({ level: null, stage: null, search: "" });
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activityTotal, setActivityTotal] = useState(0);

  // project name for header
  const [projectName, setProjectName] = useState("");

  // stop confirmation
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [settingsSaving, setSettingsSaving] = useState(false);

  // refs for cleanup
  const wsRef = useRef(null);
  const wsReconnectRef = useRef(null);
  const pollRef = useRef(null);
  const activityEndRef = useRef(null);

  // ---------- data fetching ----------

  const fetchSession = useCallback(async () => {
    try {
      const res = await liveApi.getSession(sessionId);
      const data = res.data?.data || res.data;
      setSession(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch session:", err);
      setSession((prev) => {
        if (!prev) setError("Session not found or failed to load.");
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Fetch session stats to get job IDs by type
  const fetchStats = useCallback(async () => {
    try {
      const res = await liveApi.getSessionStats(sessionId);
      const data = res.data?.data || res.data;
      if (data?.jobs) {
        setJobsByType(data.jobs);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [sessionId]);

  const fetchActivity = useCallback(async () => {
    try {
      const filters = {};
      if (activityFilters.level) filters.level = activityFilters.level;
      if (activityFilters.stage) filters.stage = activityFilters.stage;
      if (activityFilters.search) filters.search = activityFilters.search;
      filters.limit = 200;
      const res = await liveApi.getSessionActivity(sessionId, filters);
      const payload = res.data;
      setActivity(payload?.data || []);
      setActivityTotal(payload?.unfilteredTotal ?? payload?.data?.length ?? 0);
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    }
  }, [sessionId, activityFilters]);

  // Fetch 2D class images
  const fetchClassData = useCallback(async () => {
    // Get class2d job ID from session or jobsByType
    const class2dJob = jobsByType.Class2D;
    const class2dIds = session?.jobs?.class2dIds;
    const class2dJobId = class2dJob?.id || (class2dIds?.length ? class2dIds[class2dIds.length - 1] : null);

    if (!class2dJobId) {
      setClassData(null);
      return;
    }

    setClassLoading(true);
    try {
      const res = await getClass2DIndividualImagesApi(class2dJobId, "latest");
      const data = res.data?.data || res.data;
      setClassData(data);
    } catch (err) {
      console.error("Failed to fetch class2d data:", err);
      setClassData(null);
    } finally {
      setClassLoading(false);
    }
  }, [jobsByType, session?.jobs?.class2dIds]);

  const fetchSelectData = useCallback(async () => {
    const selectIds = session?.jobs?.selectIds;
    if (!selectIds?.length) {
      setSelectData(null);
      return;
    }

    setSelectLoading(true);
    try {
      const res = await liveApi.getSelectGallery(sessionId);
      const data = res.data?.data || res.data;
      setSelectData(data);
    } catch (err) {
      console.error("Failed to fetch select gallery:", err);
      setSelectData(null);
    } finally {
      setSelectLoading(false);
    }
  }, [session?.jobs?.selectIds, sessionId]);


  // ---------- websocket ----------

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(WS_URL);

        wsRef.current.onopen = () => {
          if (session?.projectId && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: "subscribe", projectId: session.projectId })
            );
          }
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "live_session_update") {
              fetchSession();
              fetchStats();
            }
          } catch (e) {
            // non-JSON message, ignore
          }
        };

        wsRef.current.onclose = () => {
          wsReconnectRef.current = setTimeout(connectWebSocket, 5000);
        };

        wsRef.current.onerror = () => {
          console.warn('[LiveDashboard WS] Connection error — will retry');
        };
      } catch (err) {
        wsReconnectRef.current = setTimeout(connectWebSocket, 5000);
      }
    };

    if (session?.projectId) {
      connectWebSocket();
    }

    return () => {
      clearTimeout(wsReconnectRef.current);
      wsReconnectRef.current = null;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [session?.projectId, fetchSession, fetchStats]);

  // ---------- polling fallback ----------

  useEffect(() => {
    fetchSession();
    fetchStats();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch project name when session loads
  useEffect(() => {
    if (session?.projectId) {
      getProjectByIdApi(session.projectId)
        .then((resp) => {
          const responseData = resp?.data;
          const project = responseData?.data || responseData;
          if (Array.isArray(project) && project[0]?.projectName) {
            setProjectName(project[0].projectName);
          } else if (project?.projectName) {
            setProjectName(project.projectName);
          }
        })
        .catch(() => setProjectName(""));
    }
  }, [session?.projectId]);

  useEffect(() => {
    if (session?.status === "running" || session?.status === "paused" || session?.status === "pending") {
      pollRef.current = setInterval(() => {
        fetchSession();
        fetchStats();
      }, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [session?.status, fetchSession, fetchStats]);

  // fetch tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === "activity") fetchActivity();
    if (activeTab === "classes") fetchClassData();
    if (activeTab === "select") fetchSelectData();
  }, [activeTab, fetchActivity, fetchClassData, fetchSelectData]);

  // Periodic refresh for active tab data while session is running
  useEffect(() => {
    if (session?.status !== "running") return;
    if (activeTab !== "activity" && activeTab !== "classes" && activeTab !== "select") return;

    const tabPoll = setInterval(() => {
      if (activeTab === "activity") fetchActivity();
      if (activeTab === "classes") fetchClassData();
      if (activeTab === "select") fetchSelectData();
    }, 10000); // 10s refresh for tab data

    return () => clearInterval(tabPoll);
  }, [session?.status, activeTab, fetchActivity, fetchClassData]);

  // auto-scroll activity log
  useEffect(() => {
    if (activeTab === "activity" && activityEndRef.current) {
      activityEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activity, activeTab]);

  // ---------- actions ----------

  const handleStart = async () => {
    setActionLoading("start");
    try {
      await liveApi.startSession(sessionId);
      await fetchSession();
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async () => {
    setActionLoading("pause");
    try {
      await liveApi.pauseSession(sessionId);
      await fetchSession();
    } catch (err) {
      console.error("Failed to pause session:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading("resume");
    try {
      await liveApi.resumeSession(sessionId);
      await fetchSession();
    } catch (err) {
      console.error("Failed to resume session:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading("stop");
    try {
      await liveApi.stopSession(sessionId);
      setShowStopConfirm(false);
      await fetchSession();
    } catch (err) {
      console.error("Failed to stop session:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // ---------- derived ----------

  const st = session?.state || {};

  const currentStageKey = STAGE_TYPE_TO_KEY[st.currentStage] || null;

  // Has class2d data?
  const hasClass2d = (session?.jobs?.class2dIds?.length ?? 0) > 0 || session?.class2dConfig?.enabled;
  const hasSelect = (session?.jobs?.selectIds?.length ?? 0) > 0 || session?.autoSelectConfig?.enabled;
  const hasInimodel = (session?.jobs?.inimodelIds?.length ?? 0) > 0 || session?.inimodelConfig?.enabled;

  // Tab definitions — stage tabs are direct links to the project dashboard with job pre-selected
  const stageLink = (jobId) =>
    session?.projectId && jobId
      ? `/project/${session.projectId}?selectJob=${jobId}`
      : null;

  // Latest job IDs for array-based stages
  const latestClass2dId = session?.jobs?.class2dIds?.length ? session.jobs.class2dIds[session.jobs.class2dIds.length - 1] : null;
  const latestSelectId = session?.jobs?.selectIds?.length ? session.jobs.selectIds[session.jobs.selectIds.length - 1] : null;
  const latestInimodelId = session?.jobs?.inimodelIds?.length ? session.jobs.inimodelIds[session.jobs.inimodelIds.length - 1] : null;

  const TABS = [
    { key: "overview", label: "Overview", icon: FiActivity },
    { key: "import", label: "Import", icon: FiFilm, link: stageLink(session?.jobs?.importId), jobId: session?.jobs?.importId },
    { key: "motion", label: "Motion Correction", icon: FiRefreshCw, link: stageLink(session?.jobs?.motionId), jobId: session?.jobs?.motionId },
    { key: "ctf", label: "CTF", icon: FiCrosshair, link: stageLink(session?.jobs?.ctfId), jobId: session?.jobs?.ctfId },
    { key: "autopick", label: "AutoPick", icon: FiGrid, link: stageLink(session?.jobs?.pickId), jobId: session?.jobs?.pickId },
    { key: "extract", label: "Extract", icon: FiBox, link: stageLink(session?.jobs?.extractId), jobId: session?.jobs?.extractId },
    ...(hasClass2d ? [{ key: "classes", label: "2D Classes", icon: FiImage, link: stageLink(latestClass2dId), jobId: latestClass2dId }] : []),
    ...(hasSelect ? [{ key: "select", label: "Select", icon: FiCheckCircle, link: stageLink(latestSelectId), jobId: latestSelectId }] : []),
    ...(hasInimodel ? [{ key: "inimodel", label: "3D Model", icon: FiLayers, link: stageLink(latestInimodelId), jobId: latestInimodelId }] : []),
    { key: "activity", label: "Activity Log", icon: FiClock },
  ];

  // ---------- loading / error ----------

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <FiRefreshCw style={styles.spinner} />
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 12 }}>Loading session...</p>
      </div>
    );
  }

  const status = session?.status;
  const isTerminal = status === "stopped" || status === "completed";

  if (error && status !== "running" && status !== "pending") {
    return (
      <div style={styles.loadingContainer}>
        <FiAlertCircle style={{ fontSize: 40, color: "var(--color-danger-text)" }} />
        <p style={{ fontSize: 14, color: "var(--color-danger-text)", marginTop: 12 }}>{error}</p>
        <button style={styles.backBtn} onClick={() => navigate("/projects")}>
          <FiArrowLeft size={14} /> Back to Projects
        </button>
      </div>
    );
  }

  // ---------- render ----------

  const LEVEL_CONFIG = {
    error: { color: "var(--color-danger-text)", bg: "var(--color-danger-bg)", border: "var(--color-danger-border)", icon: FiAlertCircle, label: "Error" },
    warning: { color: "var(--color-warning-text)", bg: "var(--color-warning-bg)", border: "var(--color-warning-border)", icon: FiAlertTriangle, label: "Warning" },
    success: { color: "var(--color-success-text)", bg: "var(--color-success-bg)", border: "var(--color-success-border)", icon: FiCheckCircle, label: "Success" },
    info: { color: "var(--color-primary)", bg: "var(--color-info-bg)", border: "var(--color-info-border)", icon: FiInfo, label: "Info" },
  };

  const STAGE_FILTER_OPTIONS = ["Import", "MotionCorr", "CtfFind", "AutoPick", "Extract", "Class2D"];

  const StatusIcon = STATUS_ICONS[status] || FiClock;
  const statusColor = STATUS_COLORS[status] || "var(--color-text-secondary)";

  return (
    <div style={styles.page}>
      {/* ===== HEADER ===== */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/projects")} title="Back to Projects" aria-label="Back to Projects">
            <FiArrowLeft size={16} aria-hidden="true" />
          </button>
          <div style={{ marginLeft: 8 }}>
            <div style={styles.sessionName}>
              {projectName || "Live Session"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 500 }}>
                Live Processing
              </span>
              <span style={{ color: "var(--color-border)" }}>&middot;</span>
              <span
                style={{
                  ...styles.statusBadge,
                  background: statusColor + "18",
                  color: statusColor,
                  borderColor: statusColor + "40",
                }}
              >
                <StatusIcon size={11} />
                {status}
              </span>
              {status === "running" && (
                <span style={styles.liveIndicator}>
                  <span style={styles.liveDot} />
                  LIVE
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={styles.headerRight}>
          {!isTerminal && (
            <>
              {status === "pending" ? (
                <button
                  style={{ ...styles.controlBtn, ...styles.controlBtnStart }}
                  onClick={handleStart}
                  disabled={actionLoading === "start"}
                >
                  <FiPlay size={13} />
                  {actionLoading === "start" ? "Starting..." : "Start Processing"}
                </button>
              ) : status === "running" ? (
                <button
                  style={{ ...styles.controlBtn, ...styles.controlBtnPause }}
                  onClick={handlePause}
                  disabled={actionLoading === "pause"}
                >
                  <FiPause size={13} />
                  {actionLoading === "pause" ? "Pausing..." : "Pause"}
                </button>
              ) : status === "paused" ? (
                <button
                  style={{ ...styles.controlBtn, ...styles.controlBtnResume }}
                  onClick={handleResume}
                  disabled={actionLoading === "resume"}
                >
                  <FiPlay size={13} />
                  {actionLoading === "resume" ? "Resuming..." : "Resume"}
                </button>
              ) : null}

              {!showStopConfirm ? (
                <button
                  style={{ ...styles.controlBtn, ...styles.controlBtnStop }}
                  onClick={() => setShowStopConfirm(true)}
                >
                  <FiSquare size={13} /> Stop
                </button>
              ) : (
                <div style={styles.stopConfirm}>
                  <span style={styles.stopConfirmText}>
                    Are you sure? This will permanently stop the session.
                  </span>
                  <button
                    style={{ ...styles.controlBtn, ...styles.controlBtnStopConfirm }}
                    onClick={handleStop}
                    disabled={actionLoading === "stop"}
                  >
                    {actionLoading === "stop" ? "Stopping..." : "Confirm"}
                  </button>
                  <button
                    style={{ ...styles.controlBtn, ...styles.controlBtnCancel }}
                    onClick={() => setShowStopConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div style={styles.tabBar} role="tablist" aria-label="Dashboard tabs">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          const isLink = !!tab.link;
          const isDisabled = isLink && !tab.jobId;

          if (isLink) {
            return (
              <button
                key={tab.key}
                style={{
                  ...styles.tab,
                  ...(isDisabled ? { opacity: 0.4, cursor: "default" } : {}),
                }}
                onClick={() => {
                  if (!isDisabled && tab.link) {
                    navigate(tab.link);
                  }
                }}
                title={isDisabled ? "Job not created yet" : `Open ${tab.label} dashboard`}
                aria-label={isDisabled ? `${tab.label} - job not created yet` : `Open ${tab.label} dashboard`}
                aria-disabled={isDisabled}
              >
                <TabIcon size={13} aria-hidden="true" />
                {tab.label}
              </button>
            );
          }

          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              <TabIcon size={13} aria-hidden="true" />
              {tab.label}
              {tab.count > 0 && (
                <span style={styles.tabCount}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div style={styles.content} role="tabpanel" aria-label={`${activeTab} tab content`}>
        {activeTab === "overview" && renderOverview()}
        {activeTab === "classes" && renderClasses()}
        {activeTab === "select" && renderSelect()}
        {activeTab === "activity" && renderActivity()}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          form={settingsForm}
          setForm={setSettingsForm}
          saving={settingsSaving}
          onClose={() => setShowSettings(false)}
          onSave={async () => {
            const original = buildSettingsForm(session);
            const payload = buildConfigPayload(settingsForm, original);
            if (Object.keys(payload).length === 0) {
              setShowSettings(false);
              return;
            }
            setSettingsSaving(true);
            try {
              await liveApi.updateSessionConfig(sessionId, payload);
              await fetchSession();
              setShowSettings(false);
            } catch (err) {
              console.error("Failed to update config:", err);
              alert(err.response?.data?.message || "Failed to update configuration");
            } finally {
              setSettingsSaving(false);
            }
          }}
        />
      )}

      <style>{cssKeyframes}</style>
    </div>
  );

  // ===================== OVERVIEW TAB =====================

  function renderOverview() {
    const rawPassHistory = session?.passHistory || [];

    // Current cumulative counts (latest state)
    const currentCounts = {
      import: st.moviesImported ?? st.moviesFound ?? 0,
      motion: st.moviesMotion ?? 0,
      ctf: st.moviesCtf ?? 0,
      filter: st.moviesFiltered ?? 0,
      pick: st.moviesPicked ?? 0,
      extract: st.particlesExtracted ?? 0,
      class2d: session?.jobs?.class2dIds?.length ?? 0,
      select: session?.jobs?.selectIds?.length ?? 0,
      inimodel: session?.jobs?.inimodelIds?.length ?? 0,
    };

    // If pass_history is empty but session has data, synthesize from current state
    const passHistory = rawPassHistory.length > 0
      ? rawPassHistory
      : (currentCounts.import > 0 || currentCounts.motion > 0)
        ? [{
            passNumber: st.passCount || 1,
            moviesImported: currentCounts.import,
            moviesMotion: currentCounts.motion,
            moviesCtf: currentCounts.ctf,
            moviesFiltered: currentCounts.filter,
            moviesPicked: currentCounts.pick,
            particlesExtracted: currentCounts.extract,
            class2dCount: currentCounts.class2d,
            selectCount: currentCounts.select,
            inimodelCount: currentCounts.inimodel,
          }]
        : [];

    // Filter pipeline stages to only show enabled ones
    const visibleStages = PIPELINE_STAGES.filter((stage) => {
      if (stage.key === "filter") {
        // Show filter stage if thresholds are set
        const th = session?.thresholds;
        return th && (th.ctfResolutionMax || th.totalMotionMax);
      }
      if (stage.key === "select") return session?.autoSelectConfig?.enabled;
      if (stage.key === "inimodel") return session?.inimodelConfig?.enabled;
      if (stage.key === "class2d") return session?.class2dConfig?.enabled;
      return true; // import, motion, ctf, pick, extract always shown
    });

    // Pipeline stage status from current_stage
    const currentStageIdx = currentStageKey
      ? visibleStages.findIndex((s) => s.key === currentStageKey)
      : -1;

    // Latest job status for array-based stages (class2d, select, inimodel)
    const latestJobStatus = session?.latestJobStatus || {};

    function stageStatus(idx) {
      if (isTerminal && status === "completed") return "completed";
      if (idx < currentStageIdx) return "completed";
      const key = visibleStages[idx].key;
      // For array-based stages, check if the latest job failed
      if (latestJobStatus[key] === "failed") return "failed";
      // Check count before current — a stage with results is completed even
      // if current_stage still points at it (e.g. Class2D finished but DB
      // hasn't advanced current_stage yet)
      if (currentCounts[key] > 0) return "completed";
      if (idx === currentStageIdx) return "current";
      return "future";
    }

    // Target for progress fractions on the current live pipeline
    const moviesImported = st.moviesImported ?? 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* ── Pipeline Progress with pass rows below ── */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <FiChevronRight size={14} style={{ color: "var(--color-primary)" }} />
            <span style={styles.cardTitle}>Pipeline Progress</span>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 8 }} />
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={() => {
                  setSettingsForm(buildSettingsForm(session));
                  setShowSettings(true);
                }}
                title="Session Settings"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-secondary)", padding: 4, borderRadius: 4,
                  display: "flex", alignItems: "center",
                }}
              >
                <FiSettings size={15} />
              </button>
            </div>
          </div>

          {/* Stage boxes row */}
          <div style={styles.pipelineRow}>
            {visibleStages.map((stage, idx) => {
              const stageState = stageStatus(idx);
              const StageIcon = stage.icon;
              const isLast = idx === visibleStages.length - 1;

              let boxBg = "var(--color-bg)";
              let boxBorder = "var(--color-border)";
              let textColor = "var(--color-text-muted)";

              if (stageState === "failed") {
                boxBg = "var(--color-error-bg, #fef2f2)";
                boxBorder = "var(--color-error-border, #fca5a5)";
                textColor = "var(--color-error-text, #dc2626)";
              } else if (stageState === "completed") {
                boxBg = "var(--color-success-bg)";
                boxBorder = "#86efac";
                textColor = "var(--color-success-text)";
              } else if (stageState === "current") {
                boxBg = "var(--color-info-bg)";
                boxBorder = "var(--color-info-border)";
                textColor = "var(--color-warning-text)";
              }

              return (
                <React.Fragment key={stage.key}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      style={{
                        ...styles.stageBox,
                        background: boxBg,
                        borderColor: boxBorder,
                        ...(stageState === "current" ? { animation: "stagePulse 2s ease-in-out infinite" } : {}),
                      }}
                    >
                      <StageIcon size={16} style={{ color: textColor, marginBottom: 4 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>
                        {stage.label}
                      </span>
                      {stageState === "completed" && (
                        <FiCheckCircle
                          size={10}
                          style={{ color: "var(--color-success-text)", position: "absolute", top: 4, right: 4 }}
                        />
                      )}
                      {stageState === "failed" && (
                        <FiAlertCircle
                          size={10}
                          style={{ color: "var(--color-error-text, #dc2626)", position: "absolute", top: 4, right: 4 }}
                        />
                      )}
                    </div>
                  </div>
                  {!isLast && (
                    <div style={styles.stageArrow}>
                      <FiChevronRight
                        size={16}
                        style={{
                          color: stageState === "completed" || stageStatus(idx + 1) !== "future" ? "var(--color-success-text)" : "var(--color-border)",
                        }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* ── Per-pass stat rows below the pipeline cards ── */}
          {passHistory.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ height: 1, background: "var(--color-border)", marginBottom: 8 }} />
              {passHistory.map((pass, idx) => {
                // Build values dynamically from visibleStages so counts align with stage cards
                const PASS_FIELD_MAP = {
                  import: 'moviesImported',
                  motion: 'moviesMotion',
                  ctf: 'moviesCtf',
                  filter: 'moviesFiltered',
                  pick: 'moviesPicked',
                  extract: 'particlesExtracted',
                  class2d: 'class2dCount',
                  select: 'selectCount',
                  inimodel: 'inimodelCount',
                };
                const cumValues = visibleStages.map(s => pass[PASS_FIELD_MAP[s.key]] ?? 0);
                const prev = idx > 0 ? passHistory[idx - 1] : null;
                const prevValues = prev
                  ? visibleStages.map(s => prev[PASS_FIELD_MAP[s.key]] ?? 0)
                  : null;

                return (
                  <div key={idx} style={{ position: "relative", padding: "5px 0" }}>
                    {/* Pass label — absolutely positioned so it doesn't shift columns */}
                    <span style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--color-text-secondary)",
                    }}>
                      Pass
                    </span>
                    {/* Values — same flex layout as pipelineRow to align with stage boxes */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}>
                      {cumValues.map((val, sIdx) => {
                        const delta = prevValues ? val - prevValues[sIdx] : 0;
                        const showDelta = prevValues && delta > 0;
                        const isLast = sIdx === cumValues.length - 1;
                        return (
                          <React.Fragment key={sIdx}>
                            <div style={{
                              width: 90,
                              textAlign: "center",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                            }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: val > 0 ? "var(--color-text)" : "var(--color-border)",
                              }}>
                                {val > 0 ? val.toLocaleString() : "--"}
                              </span>
                              {showDelta && (
                                <span style={{ fontSize: 9, color: "var(--color-success-text)", fontWeight: 600 }}>
                                  +{delta.toLocaleString()}
                                </span>
                              )}
                            </div>
                            {/* Spacer matching arrow width */}
                            {!isLast && <div style={{ width: 20 }} />}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Processing Info ── */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <FiClock size={14} style={{ color: "var(--color-text-secondary)" }} />
            <span style={styles.cardTitle}>Processing Info</span>
          </div>
          <div style={styles.infoGrid}>
            <InfoRow label="Session Started" value={formatDateTime(session?.startTime || session?.createdAt)} />
            <InfoRow label="Input Mode" value={session?.inputMode === "watch" ? "Watch Directory" : "Existing Movies"} />
            <InfoRow label="Watch Directory" value={session?.watchDirectory || "--"} mono fullWidth />
            <InfoRow label="File Pattern" value={session?.filePattern || "--"} mono />
            <InfoRow label="Pixel Size" value={session?.optics?.pixelSize ? `${session.optics.pixelSize} Å/px` : "--"} />
          </div>
        </div>
      </div>
    );
  }

  // ===================== 2D CLASSES TAB =====================
  function renderClasses() {
    if (classLoading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <FiRefreshCw style={{ ...styles.spinner, fontSize: 24 }} />
        </div>
      );
    }

    const classes = classData?.classes || [];
    const hasClasses = classes.length > 0;

    if (!hasClasses) {
      const class2dIds = session?.jobs?.class2dIds || [];
      return (
        <div style={styles.emptyState}>
          <FiImage size={32} style={{ color: "var(--color-border)" }} />
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
            {class2dIds.length === 0
              ? "2D classification has not been triggered yet."
              : "Loading class averages..."}
          </p>
          {session?.class2dConfig?.enabled && (
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Triggers when particles exceed {session.class2dConfig.particleThreshold?.toLocaleString() || "5,000"}
            </p>
          )}
        </div>
      );
    }

    // Sort by distribution descending
    const sorted = [...classes].sort((a, b) => (b.distribution ?? 0) - (a.distribution ?? 0));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header info */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <FiImage size={14} style={{ color: "var(--color-indigo-text)" }} />
            <span style={styles.cardTitle}>
              2D Class Averages
              {classData?.iteration != null && (
                <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 8 }}>
                  Iteration {classData.iteration} &middot; {classes.length} classes
                </span>
              )}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: -8, marginBottom: 0 }}>
            Sorted by particle distribution. Hover for details.
          </p>
        </div>

        {/* Class gallery grid */}
        <div style={styles.classGrid}>
          {sorted.map((cls, idx) => {
            const dist = cls.distribution != null ? (cls.distribution * 100).toFixed(1) : cls.particleFraction?.toFixed(1);
            const res = cls.estimatedResolution != null ? Number(cls.estimatedResolution).toFixed(1) : null;
            return (
              <div key={cls.classNumber ?? idx} style={styles.classCard} title={`Class ${cls.classNumber ?? idx + 1}\nDistribution: ${dist || "?"}%\nResolution: ${res || "?"} Å`}>
                <div style={styles.classImageWrap}>
                  {cls.image ? (
                    <img src={cls.image} alt={`Class ${cls.classNumber ?? idx + 1}`} style={styles.classImg} />
                  ) : (
                    <div style={{ ...styles.classImgPlaceholder }}>?</div>
                  )}
                </div>
                <div style={styles.classInfo}>
                  <span style={styles.classDist}>{dist || "?"}%</span>
                  {res && <span style={styles.classRes}>{res} Å</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===================== SELECT TAB =====================
  function renderSelect() {
    if (selectLoading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <FiRefreshCw style={{ ...styles.spinner, fontSize: 24 }} />
        </div>
      );
    }

    const classes = selectData?.classes || [];
    const hasClasses = classes.length > 0;

    if (!hasClasses) {
      const selectIds = session?.jobs?.selectIds || [];
      return (
        <div style={styles.emptyState}>
          <FiCheckCircle size={32} style={{ color: "var(--color-border)" }} />
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
            {selectIds.length === 0
              ? "Auto class selection has not been triggered yet."
              : selectData?.selectJobStatus === "running"
                ? "Class selection is running..."
                : "No selected classes found."}
          </p>
          {session?.autoSelectConfig?.enabled && selectIds.length === 0 && (
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Runs automatically after 2D classification completes.
            </p>
          )}
        </div>
      );
    }

    // Sort by distribution descending
    const sorted = [...classes].sort((a, b) => (b.distribution ?? 0) - (a.distribution ?? 0));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header info */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <FiCheckCircle size={14} style={{ color: "var(--color-success-text)" }} />
            <span style={styles.cardTitle}>
              Selected 2D Classes
              <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 8 }}>
                {selectData.numSelected} of {selectData.numTotal} classes selected
                {selectData.iteration != null && ` \u00b7 Iteration ${selectData.iteration}`}
              </span>
            </span>
          </div>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: -8, marginBottom: 0 }}>
            Auto-selected by relion_class_ranker (score &ge; {session?.autoSelectConfig?.minScore ?? 0.5}).
            Sorted by particle distribution.
          </p>
        </div>

        {/* Class gallery grid */}
        <div style={styles.classGrid}>
          {sorted.map((cls, idx) => {
            const dist = cls.distribution != null ? (cls.distribution * 100).toFixed(1) : cls.particleFraction?.toFixed(1);
            const res = cls.estimatedResolution != null && cls.estimatedResolution < 900 ? Number(cls.estimatedResolution).toFixed(1) : null;
            return (
              <div key={cls.classNumber ?? idx} style={{ ...styles.classCard, border: "2px solid var(--color-success-border, #86efac)" }} title={`Class ${cls.classNumber ?? idx + 1}\nDistribution: ${dist || "?"}%\nResolution: ${res || "?"} \u00c5`}>
                <div style={styles.classImageWrap}>
                  {cls.image ? (
                    <img src={cls.image} alt={`Class ${cls.classNumber ?? idx + 1}`} style={styles.classImg} />
                  ) : (
                    <div style={{ ...styles.classImgPlaceholder }}>?</div>
                  )}
                </div>
                <div style={styles.classInfo}>
                  <span style={styles.classDist}>{dist || "?"}%</span>
                  {res && <span style={styles.classRes}>{res} \u00c5</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===================== ACTIVITY TAB =====================

  function toggleLevelFilter(level) {
    setActivityFilters((prev) => ({
      ...prev,
      level: prev.level === level ? null : level,
    }));
    setExpandedEntries(new Set());
  }

  function toggleStageFilter(stage) {
    setActivityFilters((prev) => ({
      ...prev,
      stage: prev.stage === stage ? null : stage,
    }));
    setExpandedEntries(new Set());
  }

  function toggleExpand(idx) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function copyContext(ctx, idx) {
    navigator.clipboard.writeText(JSON.stringify(ctx, null, 2)).then(() => {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }

  function formatDurationFe(ms) {
    if (!ms || ms < 0) return null;
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins < 60) return `${mins}m ${remSecs}s`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }

  function isPipelineBoundary(evt) {
    return evt.event === "pipeline_pass" || evt.event === "pipeline_complete";
  }

  function renderActivity() {
    const hasFilters = activityFilters.level || activityFilters.stage || activityFilters.search;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Filter bar */}
        <div style={actStyles.filterBar}>
          <div style={actStyles.filterSection}>
            <FiFilter size={12} style={{ color: "var(--color-text-secondary)", marginRight: 4 }} aria-hidden="true" />
            {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => {
              const LevelIcon = cfg.icon;
              const isActive = activityFilters.level === key;
              return (
                <button
                  key={key}
                  onClick={() => toggleLevelFilter(key)}
                  aria-pressed={isActive}
                  aria-label={`Filter by ${cfg.label}`}
                  style={{
                    ...actStyles.filterPill,
                    background: isActive ? cfg.bg : "var(--color-bg)",
                    borderColor: isActive ? cfg.border : "var(--color-border)",
                    color: isActive ? cfg.color : "var(--color-text-muted)",
                  }}
                >
                  <LevelIcon size={10} aria-hidden="true" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div style={actStyles.filterSection}>
            <select
              value={activityFilters.stage || ""}
              onChange={(e) => toggleStageFilter(e.target.value || null)}
              style={actStyles.stageSelect}
              aria-label="Filter by stage"
            >
              <option value="">All Stages</option>
              {STAGE_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div style={actStyles.searchWrap}>
              <FiSearch size={12} style={{ color: "var(--color-text-muted)", position: "absolute", left: 8, top: 8 }} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search logs..."
                value={activityFilters.search}
                onChange={(e) => setActivityFilters((prev) => ({ ...prev, search: e.target.value }))}
                style={actStyles.searchInput}
                aria-label="Search activity logs"
              />
            </div>
          </div>

          <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
            {activity.length}{hasFilters ? ` / ${activityTotal}` : ""} entries
          </div>
        </div>

        {/* Activity entries */}
        {activity.length === 0 ? (
          <div style={styles.emptyState}>
            <FiClock size={32} style={{ color: "var(--color-border)" }} />
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
              {hasFilters ? "No matching events." : "No activity events yet."}
            </p>
          </div>
        ) : (
          <div style={styles.card}>
            <div style={actStyles.logScroll}>
              {activity.map((evt, idx) => {
                const level = evt.level || "info";
                const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.info;
                const LevelIcon = cfg.icon;
                const hasContext = evt.context && Object.keys(evt.context).length > 0;
                const isExpanded = expandedEntries.has(idx);
                const dur = evt.context?.durationMs;

                // Pipeline boundary divider
                if (isPipelineBoundary(evt)) {
                  const passNum = evt.passNumber || evt.context?.passNumber;
                  return (
                    <div key={idx} style={actStyles.passDivider}>
                      <div style={actStyles.passDividerLine} />
                      <span style={actStyles.passDividerLabel}>
                        {evt.event === "pipeline_complete" ? "Pass Complete" : `Pass #${passNum || "?"}`}
                      </span>
                      <div style={actStyles.passDividerLine} />
                    </div>
                  );
                }

                return (
                  <div key={idx}>
                    <div
                      style={{
                        ...actStyles.entry,
                        borderLeftColor: cfg.color,
                        cursor: hasContext ? "pointer" : "default",
                      }}
                      onClick={() => hasContext && toggleExpand(idx)}
                      {...(hasContext ? {
                        role: "button",
                        tabIndex: 0,
                        "aria-expanded": isExpanded,
                        onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(idx); } },
                      } : {})}
                    >
                      <LevelIcon size={13} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />

                      <span style={actStyles.entryTime}>
                        {relativeTime(evt.timestamp)}
                      </span>

                      {evt.stage && (
                        <span style={actStyles.stageBadge}>{evt.stage}</span>
                      )}

                      <span style={actStyles.entryMsg}>{evt.message || evt.event}</span>

                      {dur != null && dur > 0 && (
                        <span style={actStyles.durationBadge}>
                          <FiClock size={9} /> {formatDurationFe(dur)}
                        </span>
                      )}

                      {evt.jobName && (
                        <span style={actStyles.jobBadge}>{evt.jobName}</span>
                      )}

                      {hasContext && (
                        <FiChevronDown
                          size={12}
                          aria-hidden="true"
                          style={{
                            color: "var(--color-text-muted)",
                            flexShrink: 0,
                            transition: "transform 0.15s",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          }}
                        />
                      )}
                    </div>

                    {/* Expanded context panel */}
                    {isExpanded && hasContext && (
                      <div style={actStyles.contextPanel}>
                        {/* SLURM details */}
                        {(evt.context.slurmJobId || evt.context.slurmState || evt.context.exitCode) && (
                          <div style={actStyles.contextSection}>
                            <span style={actStyles.contextLabel}>SLURM</span>
                            <div style={actStyles.contextGrid}>
                              {evt.context.slurmJobId && <ContextKV k="Job ID" v={evt.context.slurmJobId} />}
                              {evt.context.slurmState && <ContextKV k="State" v={evt.context.slurmState} />}
                              {evt.context.exitCode && <ContextKV k="Exit Code" v={evt.context.exitCode} />}
                              {evt.context.elapsed && <ContextKV k="Elapsed" v={evt.context.elapsed} />}
                            </div>
                          </div>
                        )}

                        {/* Counts */}
                        {(evt.context.micrographCount != null || evt.context.particleCount != null || evt.context.fileCount != null) && (
                          <div style={actStyles.contextSection}>
                            <span style={actStyles.contextLabel}>Counts</span>
                            <div style={actStyles.contextGrid}>
                              {evt.context.fileCount != null && <ContextKV k="Files" v={evt.context.fileCount} />}
                              {evt.context.totalFound != null && <ContextKV k="Total Found" v={evt.context.totalFound} />}
                              {evt.context.micrographCount != null && <ContextKV k="Micrographs" v={evt.context.micrographCount} />}
                              {evt.context.particleCount != null && <ContextKV k="Particles" v={evt.context.particleCount} />}
                              {evt.context.moviesProcessed != null && <ContextKV k="Movies" v={evt.context.moviesProcessed} />}
                              {evt.context.particlesExtracted != null && <ContextKV k="Extracted" v={evt.context.particlesExtracted} />}
                            </div>
                          </div>
                        )}

                        {/* SLURM params */}
                        {evt.context.slurmParams && (
                          <div style={actStyles.contextSection}>
                            <span style={actStyles.contextLabel}>SLURM Config</span>
                            <div style={actStyles.contextGrid}>
                              {evt.context.slurmParams.partition && <ContextKV k="Partition" v={evt.context.slurmParams.partition} />}
                              {evt.context.slurmParams.mpi && <ContextKV k="MPI" v={evt.context.slurmParams.mpi} />}
                              {evt.context.slurmParams.threads && <ContextKV k="Threads" v={evt.context.slurmParams.threads} />}
                              {evt.context.slurmParams.gpus != null && <ContextKV k="GPUs" v={evt.context.slurmParams.gpus} />}
                            </div>
                          </div>
                        )}

                        {/* stderr output */}
                        {evt.context.stderrPreview && (
                          <div style={actStyles.contextSection}>
                            <span style={{ ...actStyles.contextLabel, color: "var(--color-danger-text)" }}>stderr output</span>
                            <pre style={actStyles.stderrBlock}>{evt.context.stderrPreview}</pre>
                          </div>
                        )}

                        {/* RELION error lines */}
                        {evt.context.relionErrors && (
                          <div style={actStyles.contextSection}>
                            <span style={{ ...actStyles.contextLabel, color: "var(--color-danger-text)" }}>RELION Errors</span>
                            <pre style={actStyles.stderrBlock}>{evt.context.relionErrors}</pre>
                          </div>
                        )}

                        {/* Command preview */}
                        {evt.context.commandPreview && (
                          <div style={actStyles.contextSection}>
                            <span style={actStyles.contextLabel}>Command</span>
                            <pre style={actStyles.cmdBlock}>{evt.context.commandPreview}</pre>
                          </div>
                        )}

                        {/* Log file path */}
                        {evt.context.logFilePath && (
                          <div style={actStyles.contextSection}>
                            <span style={actStyles.contextLabel}>Log File</span>
                            <code style={actStyles.logFilePath}>{evt.context.logFilePath}</code>
                          </div>
                        )}

                        {/* Session summary (for session_completed) */}
                        {evt.context.totalPasses != null && (
                          <div style={actStyles.contextSection}>
                            <span style={actStyles.contextLabel}>Session Summary</span>
                            <div style={actStyles.contextGrid}>
                              <ContextKV k="Total Passes" v={evt.context.totalPasses} />
                              {evt.context.moviesProcessed != null && <ContextKV k="Movies" v={evt.context.moviesProcessed} />}
                              {evt.context.moviesRejected != null && <ContextKV k="Rejected" v={evt.context.moviesRejected} />}
                              {evt.context.particlesExtracted != null && <ContextKV k="Particles" v={evt.context.particlesExtracted} />}
                              {evt.context.durationMs != null && <ContextKV k="Duration" v={formatDurationFe(evt.context.durationMs)} />}
                            </div>
                          </div>
                        )}

                        {/* Copy button */}
                        <button
                          style={actStyles.copyBtn}
                          onClick={(e) => { e.stopPropagation(); copyContext(evt.context, idx); }}
                          aria-label="Copy event details"
                        >
                          <FiCopy size={11} aria-hidden="true" />
                          {copiedIndex === idx ? "Copied!" : "Copy Details"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={activityEndRef} />
            </div>
          </div>
        )}
      </div>
    );
  }
};

// ===================== SUB-COMPONENTS =====================

const InfoRow = ({ label, value, mono, fullWidth }) => (
  <div style={{ ...infoRowStyles.row, ...(fullWidth ? { gridColumn: "1 / -1", justifyContent: "flex-start", gap: 8 } : {}) }}>
    <span style={{ ...infoRowStyles.label, ...(fullWidth ? { flexShrink: 0 } : {}) }}>{label}</span>
    <span style={{ ...infoRowStyles.value, ...(mono ? { fontFamily: "monospace", fontSize: 11 } : {}), ...(fullWidth ? { wordBreak: "break-all" } : {}) }}>
      {value}
    </span>
  </div>
);

// ===================== STYLES =====================

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--color-bg-card)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },

  // Header
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    borderBottom: "1px solid var(--color-border)",
    background: "var(--color-bg-card)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerLeft: { display: "flex", alignItems: "center" },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    color: "var(--color-text-secondary)",
  },
  sessionName: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--color-text-heading)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  projectLabel: {
    fontSize: 11,
    fontWeight: 400,
    color: "var(--color-text-muted)",
    padding: "1px 6px",
    background: "var(--color-bg)",
    borderRadius: 4,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 10,
    border: "1px solid",
    textTransform: "capitalize",
  },
  liveIndicator: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10,
    fontWeight: 700,
    color: "var(--color-danger-text)",
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--color-danger-text)",
    animation: "liveBlink 1.5s ease-in-out infinite",
  },

  // Control buttons
  controlBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 6,
    border: "1px solid",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  controlBtnStart: { background: "var(--color-success-bg)", borderColor: "var(--color-success-border)", color: "var(--color-success-strong)", fontWeight: 600 },
  controlBtnPause: { background: "var(--color-warning-bg)", borderColor: "var(--color-warning-border)", color: "var(--color-warning-strong)" },
  controlBtnResume: { background: "var(--color-info-bg)", borderColor: "var(--color-info-border)", color: "var(--color-info-strong)" },
  controlBtnStop: { background: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)", color: "var(--color-danger-text)" },
  controlBtnStopConfirm: { background: "var(--color-danger-text)", borderColor: "var(--color-danger-text)", color: "#ffffff" },
  controlBtnCancel: { background: "var(--color-bg)", borderColor: "var(--color-border)", color: "var(--color-text-secondary)" },
  stopConfirm: { display: "flex", alignItems: "center", gap: 8 },
  stopConfirmText: { fontSize: 11, color: "var(--color-danger-text)", maxWidth: 220 },

  // Tabs
  tabBar: {
    display: "flex",
    gap: 2,
    padding: "0 20px",
    borderBottom: "1px solid var(--color-border)",
    background: "var(--color-bg)",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--color-text-secondary)",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  tabActive: {
    color: "var(--color-primary)",
    borderBottomColor: "var(--color-primary)",
    background: "var(--color-bg-card)",
  },
  tabCount: {
    fontSize: 10,
    fontWeight: 600,
    background: "var(--color-border)",
    color: "var(--color-text-secondary)",
    padding: "1px 5px",
    borderRadius: 8,
    minWidth: 18,
    textAlign: "center",
  },

  // Content
  content: {
    padding: 20,
    maxWidth: 1400,
    margin: "0 auto",
  },

  // Card
  card: {
    background: "var(--color-bg-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-text)",
  },

  // Pipeline
  pipelineRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "8px 0",
    overflowX: "auto",
  },
  stageBox: {
    position: "relative",
    width: 90,
    height: 70,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    border: "1.5px solid",
    transition: "all 0.2s ease",
  },
  stageArrow: {
    display: "flex",
    alignItems: "center",
    padding: "0 2px",
  },

  // Info grid
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 8,
  },

  // Image row (exposure detail)
  imageRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  imagePanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "#0f172a",
    borderRadius: 8,
    overflow: "hidden",
  },
  imagePanelLabel: {
    width: "100%",
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-muted)",
    background: "#1e293b",
    textAlign: "center",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  exposureImg: {
    width: "100%",
    maxHeight: 400,
    objectFit: "contain",
    display: "block",
  },
  imagePlaceholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 200,
    color: "var(--color-text-secondary)",
    fontSize: 12,
  },

  // 2D Class gallery
  classGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
    gap: 6,
  },
  classCard: {
    background: "#0f172a",
    borderRadius: 6,
    overflow: "hidden",
    cursor: "default",
    transition: "transform 0.15s ease",
    border: "1px solid #1e293b",
  },
  classImageWrap: {
    width: "100%",
    aspectRatio: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  classImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  classImgPlaceholder: {
    color: "var(--color-text-secondary)",
    fontSize: 20,
    fontWeight: 700,
  },
  classInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 6px",
    background: "#1e293b",
  },
  classDist: {
    fontSize: 10,
    fontWeight: 600,
    color: "#93c5fd",
  },
  classRes: {
    fontSize: 10,
    fontWeight: 500,
    color: "var(--color-text-secondary)",
  },

  // Empty state
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
  },

  // Loading
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
  spinner: {
    fontSize: 32,
    color: "var(--color-primary)",
    animation: "spin 1s linear infinite",
  },

  // Table
  tableWrapper: {
    overflowX: "auto",
    maxHeight: 500,
    overflowY: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  th: {
    padding: "8px 12px",
    fontSize: 10,
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    borderBottom: "2px solid var(--color-border)",
    textAlign: "left",
    position: "sticky",
    top: 0,
    background: "var(--color-bg-card)",
  },
  td: {
    padding: "6px 12px",
    fontSize: 12,
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-bg)",
  },
  trEven: { background: "var(--color-bg-card)" },
  trOdd: { background: "var(--color-bg)" },
  trSelected: { background: "var(--color-info-bg)", outline: "1px solid #93c5fd" },

  // Activity
  activityScroll: {
    maxHeight: 500,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  activityItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    borderRadius: 4,
    background: "var(--color-bg)",
  },
  activityTime: {
    fontSize: 10,
    color: "var(--color-text-muted)",
    minWidth: 56,
    fontFamily: "monospace",
  },
  activityBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 4,
    border: "1px solid",
    textTransform: "capitalize",
    minWidth: 42,
    textAlign: "center",
  },
  activityMsg: {
    fontSize: 12,
    color: "var(--color-text)",
    flex: 1,
  },
};

const infoRowStyles = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 4,
    background: "var(--color-bg)",
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: "var(--color-text-muted)",
  },
  value: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--color-text)",
  },
};

// ===================== ACTIVITY SUB-COMPONENT =====================

const ContextKV = ({ k, v }) => (
  <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
    <span style={{ color: "var(--color-text-muted)", fontWeight: 500, minWidth: 70 }}>{k}:</span>
    <span style={{ color: "var(--color-text)", fontWeight: 600, fontFamily: "monospace" }}>{String(v)}</span>
  </div>
);

// ===================== ACTIVITY STYLES =====================

const actStyles = {
  filterBar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    padding: "10px 14px",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
  },
  filterSection: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  filterPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 12,
    border: "1px solid",
    cursor: "pointer",
    transition: "all 0.15s ease",
    background: "var(--color-bg)",
  },
  stageSelect: {
    padding: "4px 8px",
    fontSize: 11,
    border: "1px solid var(--color-border)",
    borderRadius: 6,
    background: "var(--color-bg-card)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
  searchWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  },
  searchInput: {
    padding: "4px 8px 4px 26px",
    fontSize: 11,
    border: "1px solid var(--color-border)",
    borderRadius: 6,
    background: "var(--color-bg-card)",
    color: "var(--color-text)",
    width: 150,
    outline: "none",
  },
  logScroll: {
    maxHeight: 600,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  entry: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: 4,
    borderLeft: "3px solid",
    background: "var(--color-bg)",
    transition: "background 0.1s ease",
  },
  entryTime: {
    fontSize: 10,
    color: "var(--color-text-muted)",
    minWidth: 52,
    fontFamily: "monospace",
    flexShrink: 0,
  },
  stageBadge: {
    fontSize: 9,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 4,
    background: "var(--color-border)",
    color: "var(--color-text-secondary)",
    flexShrink: 0,
  },
  entryMsg: {
    fontSize: 12,
    color: "var(--color-text)",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  durationBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: 10,
    color: "var(--color-text-secondary)",
    background: "var(--color-bg)",
    padding: "1px 6px",
    borderRadius: 4,
    flexShrink: 0,
  },
  jobBadge: {
    fontSize: 9,
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: 3,
    background: "var(--color-info-bg)",
    color: "var(--color-primary)",
    flexShrink: 0,
  },
  passDivider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
  },
  passDividerLine: {
    flex: 1,
    height: 1,
    background: "var(--color-border)",
  },
  passDividerLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
  },
  contextPanel: {
    margin: "0 0 4px 16px",
    padding: "10px 14px",
    background: "var(--color-bg)",
    borderRadius: "0 0 6px 6px",
    borderLeft: "3px solid var(--color-border)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  contextSection: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  contextGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 4,
    padding: "4px 0",
  },
  stderrBlock: {
    margin: 0,
    padding: 10,
    background: "#1e293b",
    color: "#fca5a5",
    fontSize: 11,
    fontFamily: "monospace",
    borderRadius: 4,
    overflow: "auto",
    maxHeight: 200,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
  cmdBlock: {
    margin: 0,
    padding: 8,
    background: "var(--color-border)",
    color: "var(--color-text-secondary)",
    fontSize: 10,
    fontFamily: "monospace",
    borderRadius: 4,
    overflow: "auto",
    maxHeight: 80,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
  logFilePath: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "var(--color-text-secondary)",
    background: "var(--color-border)",
    padding: "2px 6px",
    borderRadius: 3,
  },
  copyBtn: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    fontSize: 10,
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    background: "var(--color-bg-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 4,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
};

// ===================== CSS KEYFRAMES =====================

const cssKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes liveBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes stagePulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0.25); }
    50% { box-shadow: 0 0 0 6px rgba(37,99,235,0); }
  }
`;

export default LiveDashboard;
