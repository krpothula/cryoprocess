import React from 'react';

/**
 * SuggestedBadge — a small clickable pill that shows a suggested value.
 * Only renders when suggestedValue differs from currentValue.
 *
 * Props:
 *   suggestedValue: number|string - The suggested value
 *   currentValue: number|string - The current form value
 *   onAccept: function(suggestedValue) - Called when user clicks to accept
 *   label: string - Optional label prefix (default: "Suggested")
 */
const SuggestedBadge = ({ suggestedValue, currentValue, onAccept, label = 'Suggested' }) => {
  if (suggestedValue == null) return null;
  if (String(suggestedValue) === String(currentValue)) return null;

  return (
    <button
      type="button"
      onClick={() => onAccept(suggestedValue)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--color-info-light-text, #1d4ed8)',
        backgroundColor: 'var(--color-info-light-bg, #eff6ff)',
        border: '1px solid var(--color-info-light-border, #bfdbfe)',
        borderRadius: '12px',
        cursor: 'pointer',
        marginLeft: '6px',
        lineHeight: '18px',
        whiteSpace: 'nowrap',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--color-info-light-border, #bfdbfe)'; }}
      onMouseLeave={(e) => { e.target.style.backgroundColor = 'var(--color-info-light-bg, #eff6ff)'; }}
      title={`Click to set ${suggestedValue}`}
    >
      {label}: {suggestedValue} ✓
    </button>
  );
};

export default SuggestedBadge;
