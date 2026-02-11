import React, { Suspense, useEffect, useCallback, useState, useRef } from "react";
import "../../App.css";
import JobList from "../JobList";
import MainComponent from "../MainComponent";
import { useParams, useSearchParams } from "react-router-dom";
import Meta from "../Meta";
import LogsArea from "../Meta/Logs";
import { BuilderContextProvider, useBuilder } from "../../context/BuilderContext";
import {
  IoChevronBackCircleOutline,
  IoChevronForwardCircleOutline,
  IoCloseCircleOutline,
} from "react-icons/io5";
import { FiLayers, FiActivity } from "react-icons/fi";
import { getJobOutputsApi } from "../../services/builders/jobs";

// Lazy-load heavy tree view — only downloaded when user opens Job Tree
const LazyTreeView = React.lazy(() =>
  Promise.all([
    import("../Tree"),
    import("@xyflow/react"),
  ]).then(([treeModule, xyflowModule]) => ({
    default: (props) => (
      <xyflowModule.ReactFlowProvider>
        <treeModule.default {...props} />
      </xyflowModule.ReactFlowProvider>
    ),
  }))
);

// Bridge component to sync context's selectedBuilder with local selectedJob
// Also exposes populateInputs via builderRef for use by handleTreeJobClick
const BuilderSyncBridge = ({ selectedJob, onJobSelect, setActiveTab, builderRef }) => {
  const { selectedBuilder, copiedJobParams, autoPopulateInputs, populateInputs, getActiveInputField } = useBuilder();

  // Expose populateInputs and getActiveInputField to parent via ref
  useEffect(() => {
    if (builderRef) builderRef.current = { populateInputs, getActiveInputField };
  }, [builderRef, populateInputs, getActiveInputField]);

  useEffect(() => {
    if (selectedBuilder) {
      if ((copiedJobParams || autoPopulateInputs) && setActiveTab) {
        setActiveTab("builder");
      }
      if (selectedBuilder !== selectedJob) {
        onJobSelect(selectedBuilder);
      }
    }
  }, [selectedBuilder, selectedJob, onJobSelect, setActiveTab, copiedJobParams, autoPopulateInputs]);

  return null;
};

const Home1 = ({
  isLayoutSwitched,
  showJobTree,
  setShowJobTree,
}) => {
  const [selectedJob, setSelectedJob] = useState("Import");
  const [activeTab, setActiveTab] = useState("builder");
  const [expandedView, setExpandedView] = useState(false);
  const [selectedTreeJob, setSelectedTreeJob] = useState("");
  const [jobRefreshKey, setJobRefreshKey] = useState(0);
  const builderRef = useRef(null); // ref to access context's populateInputs from Home1
  const params = useParams();
  const { id: projectId } = params || {};
  const [searchParams] = useSearchParams();

  // Auto-select a job when navigating from LiveDashboard (e.g., ?selectJob=abc123)
  useEffect(() => {
    const selectJobId = searchParams.get("selectJob");
    if (selectJobId) {
      setSelectedTreeJob(selectJobId);
      setActiveTab("metadata");
      setJobRefreshKey((k) => k + 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJobSelect = useCallback((job) => {
    setSelectedJob(job);
  }, []);

  const tabs = [
    { value: "builder", label: "Pipeline", icon: FiLayers },
    { value: "metadata", label: "Job Status", icon: FiActivity },
  ];

  const onJobSuccess = () => {
    setActiveTab("metadata");
    setJobRefreshKey((k) => k + 1);
  };

  const Icon = (() => {
    if (isLayoutSwitched) {
      // normal behavior
      return expandedView
        ? IoChevronForwardCircleOutline
        : IoChevronBackCircleOutline;
    } else {
      // inverted behavior
      return expandedView
        ? IoChevronBackCircleOutline
        : IoChevronForwardCircleOutline;
    }
  })();

  // Tree node click: open job dashboard / status view
  const handleTreeJobSelect = useCallback((nodeId) => {
    setSelectedTreeJob(nodeId);
    setJobRefreshKey((k) => k + 1);
    setActiveTab("metadata");
  }, []);

  // Tree populate icon click: fill the currently focused input field with output from clicked job
  // User flow: 1) click an input field in the builder, 2) click populate icon on a tree job
  const handleTreeJobPopulate = useCallback(async (nodeId) => {
    const { populateInputs, getActiveInputField } = builderRef.current || {};
    const activeField = getActiveInputField?.();

    if (!activeField || !populateInputs) return; // No input selected — do nothing

    try {
      const res = await getJobOutputsApi(nodeId);
      const data = res?.data?.data;
      if (data?.downstream_suggestions?.length > 0) {
        // Find suggestion matching the active input field AND current builder
        const match = data.downstream_suggestions.find(
          s => s.field === activeField && s.downstream === selectedJob
        );

        if (match?.filePath) {
          populateInputs({ [activeField]: match.filePath });
          setActiveTab("builder");
        } else {
          // Fallback: try any suggestion matching just the field name
          const fallback = data.downstream_suggestions.find(
            s => s.field === activeField && s.filePath
          );
          if (fallback?.filePath) {
            populateInputs({ [activeField]: fallback.filePath });
            setActiveTab("builder");
          }
        }
      }
    } catch (err) {
      // Silently fail — user can still manually select inputs
    }
  }, [selectedJob]);

  useEffect(() => {
    if (!showJobTree) {
      setExpandedView(false);
    }
  }, [showJobTree]);

  return (
    <BuilderContextProvider projectId={projectId} onJobSuccess={onJobSuccess}>
      {/* Sync context's selectedBuilder to App.js state */}
      <BuilderSyncBridge selectedJob={selectedJob} onJobSelect={handleJobSelect} setActiveTab={setActiveTab} builderRef={builderRef} />
      <div className={`${isLayoutSwitched ? "App" : "App1"} ${!showJobTree ? "no-tree" : ""}`}>
        <div className="left-panel relative">
          {/* Tab Header - Same height as navbar */}
          <div className="panel-tabs">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.value}
                  className={`panel-tab ${activeTab === tab.value ? 'panel-tab-active' : ''}`}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <TabIcon className="panel-tab-icon" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          {/* Tab Content */}
          {activeTab === "builder" ? (
            <JobList selectedJob={selectedJob} onSelectJob={handleJobSelect} />
          ) : (
            <div className="w-full">
              <Meta
                selectedTreeJob={selectedTreeJob}
                refreshKey={jobRefreshKey}
                onStatusChange={() => setJobRefreshKey((k) => k + 1)}
              />
            </div>
          )}
        </div>
        <div className="right-panel !pt-0 !p-0" style={showJobTree ? { paddingRight: expandedView ? '50%' : '25%' } : {}}>
          {activeTab === "builder" ? (
            <MainComponent selectedJob={selectedJob} />
          ) : (
            <LogsArea projectId={projectId} />
          )}
        </div>
        {showJobTree && (
          <div
            className="transition-all duration-300 ease-in-out third-panel"
            style={expandedView ? { width: '50%', maxWidth: 'none' } : {}}
          >
            {/* Expand/collapse + close buttons on the edge */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                [isLayoutSwitched ? 'left' : 'right']: '-12px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <button
                onClick={() => setExpandedView(!expandedView)}
                style={{
                  padding: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <Icon style={{ fontSize: '16px', color: '#3b82f6' }} />
              </button>
              <button
                onClick={() => setShowJobTree(false)}
                title="Close job tree"
                style={{
                  padding: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <IoCloseCircleOutline style={{ fontSize: '16px', color: '#ef4444' }} />
              </button>
            </div>
            <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", fontSize: 13 }}>Loading tree...</div>}>
              <LazyTreeView
                projectId={projectId}
                expanded={expandedView}
                setSelectedTreeJob={handleTreeJobSelect}
                onPopulateJob={handleTreeJobPopulate}
                refreshKey={jobRefreshKey}
              />
            </Suspense>
          </div>
        )}
      </div>
      <style>{`
        .panel-tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          height: 36px;
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 10;
          box-sizing: border-box;
        }
        .panel-tab {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          height: 28px;
          box-sizing: border-box;
        }
        .panel-tab:hover {
          color: #3b82f6;
          background: rgba(255,255,255,0.5);
        }
        .panel-tab-active {
          color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }
        .panel-tab-icon {
          font-size: 12px;
        }
      `}</style>
    </BuilderContextProvider>
  );
};

export default Home1;
