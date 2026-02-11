import React, { useState } from "react";
import CustomInput from "../../common/Input";
import SimpleInput from "../../common/SimpleInput";
import { FolderBrowserPopup } from "../../common/FolderBrowser";
import FastaPastePopup from "./FastaPastePopup";
import { FiEdit2 } from "react-icons/fi";
import { PiBrowser } from "react-icons/pi";
import { IoInformationCircleOutline } from "react-icons/io5";

// Reusable component for FASTA file input with browse + paste buttons
const FastaBrowseOnly = ({ label, name, value, onBrowse, onPaste, tooltipText }) => {
  const [isTooltipVisible, setTooltipVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <div style={{ width: "30%" }}>
        <label style={{ textAlign: "left" }}>{label}</label>
      </div>
      <div className="flex items-center gap-[7px]">
        <div style={{ width: "280px", display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={onBrowse}
            style={{
              height: "32px",
              flex: 1,
              minWidth: 0,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              color: value ? "#1f2937" : "#9ca3af",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "left",
            }}
            title={value || "Browse ..."}
          >
            {value ? (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{value}</span>
            ) : (
              <>
                <span style={{ flex: 1 }}>Browse ...</span>
                <PiBrowser style={{ color: "#4b5563", flexShrink: 0 }} size={14} />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onPaste}
            style={{
              height: "32px",
              padding: "0 8px",
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title="Paste FASTA sequence"
          >
            <FiEdit2 style={{ color: "#3b82f6" }} size={13} />
          </button>
        </div>
        <div
          className="bg-white p-[2px] rounded flex items-center justify-center cursor-pointer relative"
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          <IoInformationCircleOutline className="text-gray-400 text-sm" />
          {isTooltipVisible && (
            <div
              style={{
                position: "absolute",
                left: "calc(100% + 8px)",
                top: "50%",
                transform: "translateY(-50%)",
                backgroundColor: "#1e293b",
                color: "#f8fafc",
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                lineHeight: "1.4",
                width: "220px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                zIndex: 1000,
              }}
            >
              {tooltipText}
              <div
                style={{
                  position: "absolute",
                  left: "-6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "0",
                  height: "0",
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                  borderRight: "6px solid #1e293b",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FASTA_FIELD_MAP = {
  protein: "fastaProtein",
  dna: "fastaDNA",
  rna: "fastaRNA",
};

const Io = ({ formData, handleInputChange, jobType }) => {
  const [browserOpen, setBrowserOpen] = useState(null); // 'protein', 'dna', 'rna', or null
  const [pasteOpen, setPasteOpen] = useState(null);     // 'protein', 'dna', 'rna', or null

  const handleFileSelect = (fieldName) => ({ path }) => {
    handleInputChange({ target: { name: fieldName, value: path } });
    setBrowserOpen(null);
  };

  const handlePasteSave = (type) => (savedPath) => {
    handleInputChange({ target: { name: FASTA_FIELD_MAP[type], value: savedPath } });
    setPasteOpen(null);
  };

  return (
    <div className="tab-content">
      <CustomInput
        stageMrcFiles="PostProcess"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "bFactorSharpenedMap", value: val } });
        }}
        name="bFactorSharpenedMap"
        placeholder="Select sharpened map from Post-Processing"
        tooltipText="B-factor sharpened map from Post-Processing. This high-resolution map is used by ModelAngelo for automated model building. Select the postprocess.mrc file from a completed Post-Processing job."
        label="B-factor sharpened map:"
        value={formData?.["bFactorSharpenedMap"]}
        jobType={jobType}
      />

      <FastaBrowseOnly
        label="FASTA sequence for proteins:"
        name="fastaProtein"
        value={formData?.fastaProtein}
        onBrowse={() => setBrowserOpen("protein")}
        onPaste={() => setPasteOpen("protein")}
        tooltipText="FASTA file containing protein amino acid sequences. ModelAngelo uses these sequences to build and assign protein chains in your map. Click the edit icon to paste a sequence directly."
      />

      <FastaBrowseOnly
        label="FASTA sequence for DNA:"
        name="fastaDNA"
        value={formData?.fastaDNA}
        onBrowse={() => setBrowserOpen("dna")}
        onPaste={() => setPasteOpen("dna")}
        tooltipText="FASTA file containing DNA nucleotide sequences. Leave empty if your structure has no DNA. Click the edit icon to paste a sequence directly."
      />

      <FastaBrowseOnly
        label="FASTA sequence for RNA:"
        name="fastaRNA"
        value={formData?.fastaRNA}
        onBrowse={() => setBrowserOpen("rna")}
        onPaste={() => setPasteOpen("rna")}
        tooltipText="FASTA file containing RNA nucleotide sequences. Leave empty if your structure has no RNA. Click the edit icon to paste a sequence directly."
      />

      <SimpleInput
        label="ModelAngelo executable:"
        placeholder="relion_python_modelangelo"
        name="modelAngeloExecutable"
        value={formData.modelAngeloExecutable}
        onChange={handleInputChange}
        tooltipText="Path to the ModelAngelo executable. Default 'relion_python_modelangelo' uses the RELION-bundled version. Can also specify a custom ModelAngelo installation path."
      />
      <SimpleInput
        label="Which GPUs to use:"
        placeholder="0"
        name="gpuToUse"
        value={formData.gpuToUse}
        onChange={handleInputChange}
        tooltipText="GPU device ID to use for ModelAngelo. Use 0 for the first GPU. ModelAngelo requires a CUDA-capable GPU with sufficient memory (typically 8GB+ recommended)."
      />

      {/* Folder Browser Popups */}
      {browserOpen === "protein" && (
        <FolderBrowserPopup
          onClose={() => setBrowserOpen(null)}
          onFileSelect={handleFileSelect("fastaProtein")}
          extensions=".fasta,.fa,.faa"
          title="Select Protein FASTA File"
        />
      )}
      {browserOpen === "dna" && (
        <FolderBrowserPopup
          onClose={() => setBrowserOpen(null)}
          onFileSelect={handleFileSelect("fastaDNA")}
          extensions=".fasta,.fa,.fna"
          title="Select DNA FASTA File"
        />
      )}
      {browserOpen === "rna" && (
        <FolderBrowserPopup
          onClose={() => setBrowserOpen(null)}
          onFileSelect={handleFileSelect("fastaRNA")}
          extensions=".fasta,.fa,.fna"
          title="Select RNA FASTA File"
        />
      )}

      {/* FASTA Paste Popups */}
      {pasteOpen && (
        <FastaPastePopup
          fastaType={pasteOpen}
          onSave={handlePasteSave(pasteOpen)}
          onClose={() => setPasteOpen(null)}
        />
      )}
    </div>
  );
};

export default Io;
