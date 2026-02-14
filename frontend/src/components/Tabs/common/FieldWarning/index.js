import React from 'react';

/**
 * FieldWarning - Inline warning/error display for form fields.
 * Renders below the field with an icon and message.
 *
 * @param {{ status: { level: 'warning'|'error', message: string } | null }} props
 */
const FieldWarning = ({ status }) => {
  if (!status) return null;

  const isError = status.level === 'error';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        marginTop: '2px',
        marginLeft: '30%',
        paddingLeft: '5px',
        color: isError ? 'var(--color-danger-text, #dc2626)' : 'var(--color-warning-text, #d97706)',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isError ? (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </>
        ) : (
          <>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        )}
      </svg>
      {status.message}
    </div>
  );
};

export default FieldWarning;
