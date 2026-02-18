import React, { useState } from "react";
import { FiX, FiSave, FiAlertCircle, FiFileText } from "react-icons/fi";
import { BiLoader } from "react-icons/bi";
import { useBuilder } from "../../../../context/BuilderContext";
import { saveFastaSequenceApi } from "../../../../services/builders/model-angelo/model-angelo";

const PLACEHOLDERS = {
  protein: ">sp|P00533|EGFR_HUMAN Epidermal growth factor receptor\nMRPSGTAGAALLALLAALCPASRALEEKKVCQGTSNKLTQLGTFEDHFLSLQRMFNNCEVVL\nGNLEITYVQRNYDLSFLKTIQEVAGYVLIALNTVERIPLENLQIIRGNMYYENSYALAVLS\nNYDAN",
  dna: ">gene_01 Example DNA sequence\nATGCGTACCGTAGCTAGCTAGCTACGATCGATCGATCGATCGATC\nGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTA",
  rna: ">transcript_01 Example RNA sequence\nAUGCGUACCGUAGCUAGCUAGCUACGAUCGAUCGAUCGAUCGAUC\nGCUAGCUAGCUAGCUAGCUAGCUAGCUAGCUAGCUAGCUAGCUA",
};

const TITLES = {
  protein: "Paste Protein FASTA Sequence",
  dna: "Paste DNA FASTA Sequence",
  rna: "Paste RNA FASTA Sequence",
};

const FastaPastePopup = ({ fastaType, onSave, onClose }) => {
  const { projectId } = useBuilder();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const validate = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "Paste a FASTA sequence";
    if (!trimmed.startsWith(">")) return "Must start with a header line beginning with \">\"";

    const lines = trimmed.split("\n");
    let hasHeader = false;
    let hasSequence = false;

    const charSets = {
      protein: /^[ACDEFGHIKLMNPQRSTVWYX*\s]+$/i,
      dna: /^[ACGTNX\s]+$/i,
      rna: /^[ACGUNX\s]+$/i,
    };
    const allowed = charSets[fastaType];

    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;
      if (l.startsWith(">")) {
        hasHeader = true;
      } else {
        if (!hasHeader) return "Sequence data found before header line";
        if (!allowed.test(l)) return `Invalid characters for ${fastaType} sequence`;
        hasSequence = true;
      }
    }

    if (!hasSequence) return "No sequence data found after header";
    return null;
  };

  const handleSave = async () => {
    const validationError = validate(text);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await saveFastaSequenceApi(projectId, fastaType, text.trim());
      if (res?.data?.success && res.data.data?.path) {
        onSave(res.data.data.path);
      } else {
        setError(res?.data?.message || "Failed to save sequence");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save sequence");
    } finally {
      setSaving(false);
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (error) setError("");
  };

  // Count sequences
  const seqCount = (text.match(/^>/gm) || []).length;

  return (
    <div style={S.overlay}>
      <div style={S.popup}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={S.headerIcon}>
              <FiFileText size={16} />
            </div>
            <div>
              <h2 style={S.headerTitle}>{TITLES[fastaType]}</h2>
              <span style={S.headerSub}>
                Paste your {fastaType} FASTA sequence below
              </span>
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>
            <FiX size={18} />
          </button>
        </div>

        {/* Textarea */}
        <div style={S.body}>
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder={PLACEHOLDERS[fastaType]}
            style={S.textarea}
            spellCheck={false}
            autoFocus
          />
          {error && (
            <div style={S.errorBar}>
              <FiAlertCircle size={13} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <span style={S.seqCount}>
            {seqCount > 0 ? `${seqCount} sequence${seqCount !== 1 ? "s" : ""} detected` : "No sequences"}
          </span>
          <div style={S.footerActions}>
            <button onClick={onClose} style={S.cancelBtn}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              style={{
                ...S.saveBtn,
                ...(saving || !text.trim() ? S.saveBtnDisabled : {}),
              }}
            >
              {saving ? (
                <BiLoader size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <FiSave size={13} />
              )}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--color-bg-overlay)",
    backdropFilter: "blur(4px)",
    zIndex: 50,
  },
  popup: {
    background: "var(--color-bg-card)",
    width: "min(640px, 90vw)",
    height: "min(520px, 80vh)",
    borderRadius: 16,
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--color-border-light)",
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "var(--color-primary-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--color-primary)",
  },
  headerTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text-heading)" },
  headerSub: { fontSize: 12, color: "var(--color-text-muted)" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--color-text-muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "16px 20px",
    minHeight: 0,
    gap: 8,
  },
  textarea: {
    flex: 1,
    resize: "none",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 1.5,
    padding: 12,
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    color: "var(--color-text)",
    background: "var(--color-bg)",
    outline: "none",
    minHeight: 0,
  },
  errorBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--color-danger-text)",
    background: "var(--color-danger-bg)",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--color-danger-border)",
  },
  footer: {
    padding: "12px 20px",
    borderTop: "1px solid var(--color-border-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  seqCount: { fontSize: 12, color: "var(--color-text-muted)" },
  footerActions: { display: "flex", alignItems: "center", gap: 8 },
  cancelBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg-card)",
    color: "var(--color-text-secondary)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  saveBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    background: "var(--color-primary)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  saveBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
};

export default FastaPastePopup;
