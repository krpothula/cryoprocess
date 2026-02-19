import React, { useEffect, useRef, useState } from "react";
import JobCardList from "../JobCardList";
import { getJobsApi, getLogsApi } from "../../services/builders/jobs";
import { useBuilder } from "../../context/BuilderContext";
import useProjectNotification from "../../hooks/useProjectNotification";
import { isActiveStatus } from "../../utils/jobStatus";
import { BiLoader } from "react-icons/bi";

const POLL_INTERVAL_MS = 10000; // Fallback poll interval; WebSocket provides instant status updates

const JobMonitor = ({ selectedTreeJob, refreshKey, onStatusChange }) => {
  const [jobListData, setJobListData] = useState({});
  const [isLoading, setLoading] = useState(true);
  const [moreJobsLoading, setMoreJobsLoading] = useState(false);
  const boxRef = useRef(null);
  const ticking = useRef(false);
  const fetchingRef = useRef(false);
  const countRef = useRef(0);

  const limit = 1000; // Load all jobs at once
  const skipRef = useRef(0); // maintain skip value across renders

  const { data: jobList, count } = jobListData || {};
  const { selectedJob, setSelectedJob, projectId } = useBuilder();

  // Ref to always access latest selectedJob inside callbacks/intervals
  const selectedJobRef = useRef(selectedJob);
  selectedJobRef.current = selectedJob;

  const getJobs = (initial = false) => {
    if (fetchingRef.current) return; // guard: instant block
    fetchingRef.current = true;

    if (initial) {
      setLoading(true);
    } else {
      setMoreJobsLoading(true);
    }

    getJobsApi(projectId, skipRef.current, limit)
      .then((response) => {
        const newJobs = response?.data?.data || [];
        const totalCount = response?.data?.count || 0;

        setJobListData((prev) => ({
          data: initial ? newJobs : [...prev.data, ...newJobs],
          count: totalCount,
        }));

        // set first selected only for first load
        if (initial && newJobs.length > 0 && !selectedTreeJob) {
          setSelectedJob(newJobs[0]);
        }

        // update skip for next call
        skipRef.current += newJobs.length;
      })
      .catch((error) => {
      })
      .finally(() => {
        setLoading(false);
        fetchingRef.current = false;
        setMoreJobsLoading(false);
      });
  };

  const handleLoadMoreJobs = () => {
    const el = boxRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => {
          const { scrollTop, scrollHeight, clientHeight } = el;
          const bottomReached = scrollTop + clientHeight >= scrollHeight - 100;
          // bottom detection
          if (bottomReached) {
            if (!fetchingRef.current && skipRef.current < countRef.current) {
              getJobs(false); // fetch next batch
            }
          }
          ticking.current = false;
        });
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  };

  // Reactive sync: whenever jobListData changes, sync selectedJob and notify parent
  useEffect(() => {
    if (!selectedJob?.id || !jobListData?.data) return;
    const updated = jobListData.data.find((j) => j.id === selectedJob.id);
    if (updated && updated.status !== selectedJob.status) {
      setSelectedJob(updated);
      // Notify parent (Home) so tree and other components refresh
      if (onStatusChange) onStatusChange();
    }
  }, [jobListData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update a single job's status in the list (selectedJob sync handled by useEffect above)
  const updateJobStatus = (jobId, newStatus) => {
    setJobListData((prev) => ({
      ...prev,
      data: prev.data?.map((job) =>
        job.id === jobId ? { ...job, status: newStatus } : job
      ),
    }));
  };

  // Refresh job statuses without resetting the list
  // (selectedJob sync is handled reactively by the useEffect above)
  const refreshJobStatuses = () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    getJobsApi(projectId, 0, limit)
      .then((response) => {
        const newJobs = response?.data?.data || [];
        const totalCount = response?.data?.count || 0;

        setJobListData({
          data: newJobs,
          count: totalCount,
        });
      })
      .catch((error) => {
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  };

  // Track whether there are active jobs (avoids interval recreation on every data change)
  const hasActiveJobsRef = useRef(false);
  useEffect(() => {
    hasActiveJobsRef.current = jobListData?.data?.some(
      (j) => isActiveStatus(j.status)
    ) || false;
  }, [jobListData?.data]);

  // Poll for job status updates (reliable fallback)
  // Fast polling (3s) when active jobs exist, slow polling (15s) otherwise.
  // Uses ref-based interval to avoid recreating on every data change.
  useEffect(() => {
    if (!projectId) return;

    const tick = () => {
      refreshJobStatuses();
    };

    // Start with a short interval; dynamically adjust via ref
    const id = setInterval(tick, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [projectId]); // only recreate when project changes

  // Real-time job status updates via shared WebSocket (wsNotifier singleton)
  useProjectNotification(projectId, (data) => {
    if (data.id && data.status) {
      updateJobStatus(data.id, data.status);
    }
  });

  useEffect(() => {
    skipRef.current = 0;
    fetchingRef.current = false;
    getJobs(true);
  }, [projectId]);

  // Re-fetch jobs when a new job is submitted (refreshKey changes)
  useEffect(() => {
    if (refreshKey > 0) {
      skipRef.current = 0;
      fetchingRef.current = false;
      getJobs(true);
    }
  }, [refreshKey]);

  useEffect(() => {
    countRef.current = count;
    handleLoadMoreJobs();
  }, [count]);

  useEffect(() => {
    if (selectedJob?.id && projectId) {
      getLogsApi(projectId, selectedJob.id).catch((err) => console.warn('[JobMonitor] Failed to prefetch logs:', err.message));
    }
  }, [selectedJob, projectId]);

  useEffect(() => {
    if (!selectedTreeJob) return;

    // 1) The sidebar div (scrollable container)
    const container = boxRef.current;

    // 2) The specific card you want to scroll to the top
    const element = document.getElementById(`jb${selectedTreeJob}`);

    if (container && element) {
      container.scrollTo({
        top: element.offsetTop - 125, // <-- THIS puts the element at the top
        behavior: "smooth",
      });
    }

    if (jobList?.length > 0) {
      const selectedJob = jobList?.find((jb) => jb.id === selectedTreeJob);
      if (selectedJob) {
        setSelectedJob(selectedJob);
      } else {
        setSelectedJob(jobList[0]);
      }
    }
  }, [selectedTreeJob, jobList]); // runs after API updates list

  return (
    <div ref={boxRef} className="job-status-container">
      {isLoading ? (
        <div className="flex items-center justify-center">
          <p className="font-medium items-center text-[var(--color-text)]">
            <BiLoader className="mx-auto mb-2 text-2xl animate-spin" />
            Fetching all the jobs, please wait ..
          </p>
        </div>
      ) : !jobList ? (
        <div className="mt-6">
          <h2 className="font-semibold text-center text-[var(--color-text)] mb-2">
            No Jobs Found
          </h2>
          <p className="text-[var(--color-text-secondary)] text-xs text-center font-medium mt-0">
            Try refreshing the page or check back later.
          </p>
        </div>
      ) : (
        <JobCardList
          selectedJob={selectedJob}
          setSelectedJob={setSelectedJob}
          jobs={jobList || []}
          onJobCancelled={(jobId) => {
            // Update job status in local state
            setJobListData((prev) => ({
              ...prev,
              data: prev.data.map((job) =>
                job.id === jobId ? { ...job, status: "cancelled" } : job
              ),
            }));
          }}
        />
      )}
      {moreJobsLoading ? (
        <p className="flex gap-2 font-medium items-center text-sm text-[var(--color-text)] p-3">
          <BiLoader className="animate-spin" />
          Loading more jobs ..
        </p>
      ) : (
        ""
      )}
      <style>{`
        .job-status-container {
          background: var(--color-bg-card);
          padding: 0;
        }
      `}</style>
    </div>
  );
};

export default JobMonitor;
