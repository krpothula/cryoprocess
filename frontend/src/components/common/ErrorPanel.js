import React, { useState, useEffect, useCallback } from 'react';
import { FiAlertTriangle, FiAlertCircle, FiChevronDown, FiChevronRight } from 'react-icons/fi';

/**
 * ErrorPanel - Displays human-readable RELION errors with explanations and fix suggestions.
 *
 * Props:
 *   jobId: string - Job ID to fetch issues for
 *   fetchIssues: function(jobId) => Promise<{issues, summary}> - API function to fetch issues
 *   issues: Array - Pre-fetched issues (optional, skips API call)
 */
const ErrorPanel = ({ jobId, fetchIssues, issues: preloadedIssues }) => {
  const [issues, setIssues] = useState(preloadedIssues || []);
  const [loading, setLoading] = useState(!preloadedIssues);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const loadIssues = useCallback(async () => {
    if (!jobId || !fetchIssues) return;
    try {
      setLoading(true);
      const response = await fetchIssues(jobId);
      const data = response?.data?.data || response?.data;
      setIssues(data?.issues || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [jobId, fetchIssues]);

  useEffect(() => {
    if (!preloadedIssues && fetchIssues) {
      loadIssues();
    }
  }, [preloadedIssues, loadIssues, fetchIssues]);

  useEffect(() => {
    if (preloadedIssues) setIssues(preloadedIssues);
  }, [preloadedIssues]);

  if (loading) return null;

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div style={{
      margin: '12px 16px',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--color-danger-border, #fecaca)',
      backgroundColor: 'var(--color-bg-card, #fff)',
    }}>
      {/* Summary Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        backgroundColor: errors.length > 0 ? 'var(--color-danger-bg, #fef2f2)' : 'var(--color-warning-bg, #fffbeb)',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
      }}>
        {errors.length > 0 ? (
          <FiAlertCircle size={16} color="var(--color-danger-text, #dc2626)" />
        ) : (
          <FiAlertTriangle size={16} color="var(--color-warning-text, #d97706)" />
        )}
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-heading)' }}>
          {errors.length > 0 && `${errors.length} error${errors.length > 1 ? 's' : ''}`}
          {errors.length > 0 && warnings.length > 0 && ', '}
          {warnings.length > 0 && `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Error Cards */}
      {errors.map((issue, idx) => (
        <IssueCard
          key={`err-${idx}`}
          issue={issue}
          isExpanded={expandedIndex === idx}
          onToggle={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
        />
      ))}

      {/* Warning Cards */}
      {warnings.map((issue, idx) => (
        <IssueCard
          key={`warn-${idx}`}
          issue={issue}
          isExpanded={expandedIndex === `w${idx}`}
          onToggle={() => setExpandedIndex(expandedIndex === `w${idx}` ? null : `w${idx}`)}
        />
      ))}
    </div>
  );
};

const IssueCard = ({ issue, isExpanded, onToggle }) => {
  const isError = issue.severity === 'error';

  return (
    <div style={{
      borderBottom: '1px solid var(--color-border-light, #f3f4f6)',
    }}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '8px 14px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '12px',
        }}
      >
        {isExpanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isError ? 'var(--color-danger-text, #dc2626)' : 'var(--color-warning-text, #d97706)',
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 600, color: 'var(--color-text-heading)' }}>
          {issue.category}
        </span>
        <span style={{ color: 'var(--color-text-muted)', marginLeft: 'auto', fontSize: '11px' }}>
          {issue.source} line {issue.line}
        </span>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div style={{ padding: '0 14px 12px 38px' }}>
          {issue.explanation && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                What happened
              </span>
              <p style={{ fontSize: '12px', color: 'var(--color-text)', margin: '2px 0 0 0', lineHeight: 1.5 }}>
                {issue.explanation}
              </p>
            </div>
          )}

          {issue.suggestion && (
            <div style={{
              marginBottom: '8px',
              padding: '8px 10px',
              backgroundColor: 'var(--color-info-light-bg, #eff6ff)',
              borderRadius: '6px',
              border: '1px solid var(--color-info-light-border, #bfdbfe)',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-info-light-text, #1d4ed8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                How to fix
              </span>
              <p style={{ fontSize: '12px', color: 'var(--color-text)', margin: '2px 0 0 0', lineHeight: 1.5 }}>
                {issue.suggestion}
              </p>
            </div>
          )}

          {issue.context && (
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Log output
              </span>
              <pre style={{
                fontSize: '11px',
                backgroundColor: 'var(--color-bg, #f3f4f6)',
                padding: '8px',
                borderRadius: '4px',
                margin: '4px 0 0 0',
                overflow: 'auto',
                maxHeight: '120px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.4,
              }}>
                {issue.context}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorPanel;
