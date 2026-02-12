import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { getSoftwareConfig } from "../services/softwareConfig";

const BuilderContext = createContext();

// Use sessionStorage to persist copied params across re-renders
const COPIED_PARAMS_KEY = 'cryoem_copied_job_params';

const getStoredCopiedParams = () => {
  try {
    const stored = sessionStorage.getItem(COPIED_PARAMS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only return if not expired (5 seconds max)
      if (parsed.timestamp && Date.now() - parsed.timestamp < 5000) {
        return parsed.params;
      }
      sessionStorage.removeItem(COPIED_PARAMS_KEY);
    }
  } catch (e) { /* ignore */ }
  return null;
};

const storeParams = (params) => {
  try {
    if (params) {
      sessionStorage.setItem(COPIED_PARAMS_KEY, JSON.stringify({
        params,
        timestamp: Date.now()
      }));
    } else {
      sessionStorage.removeItem(COPIED_PARAMS_KEY);
    }
  } catch (e) { /* ignore */ }
};

export const BuilderContextProvider = ({ children, projectId, onJobSuccess }) => {
  const [builderState, setState] = useState(() => ({
    selectedJob: "",
    selectedBuilder: "",
    projectId,
    copiedJobParams: getStoredCopiedParams(),
  }));

  const handleStateChange = useCallback((newProps = {}) => {
    setState((prev) => ({ ...prev, ...newProps }));
  }, []);

  const setSelectedBuilder = useCallback((builder = {}) => {
    setState((prev) => ({ ...prev, selectedBuilder: builder }));
  }, []);

  const setSelectedJob = useCallback((job = {}) => {
    setState((prev) => ({ ...prev, selectedJob: job }));
  }, []);

  const setCopiedJobParams = useCallback((params, jobType) => {
    storeParams(params);
    setState((prev) => ({
      ...prev,
      copiedJobParams: params,
      selectedBuilder: jobType
    }));
  }, []);

  const clearCopiedJobParams = useCallback(() => {
    storeParams(null);
    setState((prev) => ({ ...prev, copiedJobParams: null }));
  }, []);

  // Auto-populate inputs from tree job click
  const setParentJobOutputs = useCallback((outputs) => {
    setState((prev) => ({ ...prev, parentJobOutputs: outputs, autoPopulateInputs: null }));
  }, []);

  const selectDownstreamJob = useCallback((displayName, suggestions) => {
    // Build the auto-populate map: { fieldName: filePath }
    const inputMap = {};
    for (const s of suggestions) {
      if (s.downstream === displayName && s.filePath) {
        inputMap[s.field] = s.filePath;
      }
    }
    setState((prev) => ({
      ...prev,
      selectedBuilder: displayName,
      autoPopulateInputs: inputMap,
      parentJobOutputs: null,
    }));
  }, []);

  // Direct populate — fill fields in the CURRENT builder without switching
  const populateInputs = useCallback((inputMap) => {
    setState((prev) => ({ ...prev, autoPopulateInputs: inputMap }));
  }, []);

  const clearAutoPopulate = useCallback(() => {
    setState((prev) => ({ ...prev, autoPopulateInputs: null, parentJobOutputs: null }));
  }, []);

  // Email notifications enabled (fetched once from server config)
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  useEffect(() => {
    getSoftwareConfig()
      .then((res) => {
        if (res?.data?.email_notifications_enabled) {
          setEmailNotificationsEnabled(true);
        }
      })
      .catch(() => {});
  }, []);

  // Resource validation error (set by SlurmRunningConfig, displayed by SubmitButton)
  const [resourceError, setResourceErrorState] = useState(null);
  const setResourceError = useCallback((error) => {
    setResourceErrorState(error);
  }, []);

  // Track which input field the user last clicked/focused (for targeted populate from tree)
  // Use a ref so the value is always current when the populate icon is clicked
  const activeInputFieldRef = useRef(null);
  const setActiveInputField = useCallback((fieldName) => {
    activeInputFieldRef.current = fieldName;
  }, []);
  const getActiveInputField = useCallback(() => activeInputFieldRef.current, []);

  const value = useMemo(() => ({
    ...builderState,
    handleStateChange,
    setSelectedJob,
    setSelectedBuilder,
    setCopiedJobParams,
    clearCopiedJobParams,
    setParentJobOutputs,
    selectDownstreamJob,
    populateInputs,
    clearAutoPopulate,
    emailNotificationsEnabled,
    resourceError,
    setResourceError,
    setActiveInputField,
    getActiveInputField,
    onJobSuccess
  }), [builderState, emailNotificationsEnabled, resourceError, handleStateChange, setSelectedJob, setSelectedBuilder, setCopiedJobParams, clearCopiedJobParams, setParentJobOutputs, selectDownstreamJob, populateInputs, clearAutoPopulate, setResourceError, setActiveInputField, getActiveInputField, onJobSuccess]);

  return (
    <BuilderContext.Provider value={value}>
      {children}
    </BuilderContext.Provider>
  );
};

export const useBuilder = () => useContext(BuilderContext);
