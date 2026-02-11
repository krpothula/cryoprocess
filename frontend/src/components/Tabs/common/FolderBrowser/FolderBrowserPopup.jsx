import { useState, useEffect, useRef, useCallback } from "react";
import { useBuilder } from "../../../../context/BuilderContext";
import { browseFolderApi, selectFilesApi } from "../../../../services/folderBrowser";
import {
  FaCircleCheck,
  FaRegFile,
  FaFolderOpen,
} from "react-icons/fa6";
import { FiFilter, FiChevronRight, FiX, FiLoader, FiFolder, FiHome, FiArrowLeft } from "react-icons/fi";

/**
 * FolderBrowserPopup - Browse actual filesystem folders within project
 */
const FolderBrowserPopup = ({
  onClose,
  onSelect,
  onFileSelect,
  initialPath = "",
  mode = "files",
  extensions = "",
  title = "Browse Project Folder",
}) => {
  const { projectId } = useBuilder();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [items, setItems] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [debouncedPrefix, setDebouncedPrefix] = useState("");
  const [debouncedSuffix, setDebouncedSuffix] = useState("");

  const [selectedFolder, setSelectedFolder] = useState(initialPath);
  const [selectedFile, setSelectedFile] = useState(null);
  const [matchCount, setMatchCount] = useState(0);
  const [projectFolderName, setProjectFolderName] = useState("");
  const [editablePattern, setEditablePattern] = useState("");
  const [totalFolderCount, setTotalFolderCount] = useState(0);
  const [totalFileCount, setTotalFileCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setLoadingMore] = useState(false);

  const loadIdRef = useRef(0);
  const scrollContainerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const isSingleFileMode = mode === "single" || !!onFileSelect;

  const ROW_HEIGHT = 35;
  const BUFFER = 5;

  // Measure container height for virtualization
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset scroll position when navigating to a new folder
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items]);

  // Debounce prefix/suffix — wait 300ms after last keystroke before firing API
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedPrefix(prefix); setDebouncedSuffix(suffix); }, 300);
    return () => clearTimeout(timer);
  }, [prefix, suffix]);

  useEffect(() => {
    if (!isSingleFileMode && selectedFolder) {
      const firstFile = items.find(item => !item.is_dir);
      if (firstFile && firstFile.extension) {
        setEditablePattern(`${selectedFolder}/*${firstFile.extension}`);
      } else {
        const ext = extensions ? extensions.split(",")[0] : "";
        const pattern = ext ? `*${ext}` : "*";
        setEditablePattern(`${selectedFolder}/${pattern}`);
      }
    } else if (!isSingleFileMode && !selectedFolder) {
      const ext = extensions ? extensions.split(",")[0] : "";
      setEditablePattern(ext ? `*${ext}` : "*");
    }
  }, [selectedFolder, extensions, isSingleFileMode, items]);

  const PAGE_SIZE = 500;

  const loadFolder = useCallback(async (folderPath, filterPrefix, filterSuffix) => {
    if (!projectId) return;
    const thisLoadId = ++loadIdRef.current;
    setLoading(true);
    setError("");
    setItems([]);
    setHasMore(false);
    try {
      const response = await browseFolderApi(projectId, folderPath, {
        prefix: filterPrefix, suffix: filterSuffix, extensions, showFiles: true,
        limit: PAGE_SIZE, offset: 0,
      });
      if (thisLoadId !== loadIdRef.current) return;
      if (response?.data?.success) {
        const data = response.data.data;
        setItems(data.items || []);
        setCurrentPath(data.current_path || "");
        setTotalFolderCount(data.total_folders || 0);
        setTotalFileCount(data.total_files || 0);
        setHasMore(data.has_more || false);
        if (data.project_root) setProjectFolderName(data.project_root);
      } else {
        setError(response?.data?.message || "Failed to load folder");
        setItems([]);
      }
    } catch (err) {
      if (thisLoadId !== loadIdRef.current) return;
      setError(err.response?.data?.message || "Error loading folder");
      setItems([]);
    } finally {
      if (thisLoadId === loadIdRef.current) setLoading(false);
    }
  }, [projectId, extensions]);

  // Load next page of items
  const loadMore = useCallback(async () => {
    if (!projectId || !hasMore || isLoadingMore) return;
    setLoadingMore(true);
    try {
      const response = await browseFolderApi(projectId, currentPath, {
        prefix: debouncedPrefix, suffix: debouncedSuffix, extensions, showFiles: true,
        limit: PAGE_SIZE, offset: items.length,
      });
      if (response?.data?.success) {
        const data = response.data.data;
        setItems(prev => [...prev, ...(data.items || [])]);
        setHasMore(data.has_more || false);
      }
    } catch (err) { /* ignore */ }
    finally { setLoadingMore(false); }
  }, [projectId, currentPath, debouncedPrefix, debouncedSuffix, extensions, hasMore, isLoadingMore, items.length]);

  // Virtualized scroll handler + infinite scroll trigger
  const handleScroll = useCallback((e) => {
    const el = e.target;
    setScrollTop(el.scrollTop);
    // Load more when within 200px of the bottom
    if (hasMore && !isLoadingMore && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // Initial load
  useEffect(() => { loadFolder(initialPath, "", ""); }, [projectId, initialPath, loadFolder]);
  // Reload when debounced filters change
  useEffect(() => { loadFolder(currentPath, debouncedPrefix, debouncedSuffix); }, [debouncedPrefix, debouncedSuffix]);

  const navigateToFolder = (folderPath) => { setSelectedFolder(folderPath); loadFolder(folderPath, debouncedPrefix, debouncedSuffix); };
  const goUp = () => { if (!currentPath) return; const parts = currentPath.split("/"); parts.pop(); navigateToFolder(parts.join("/")); };
  const goToRoot = () => navigateToFolder("");

  useEffect(() => {
    const updateMatchCount = async () => {
      if (!projectId || !selectedFolder) { setMatchCount(0); return; }
      try {
        const pattern = extensions ? `*${extensions.split(",")[0]}` : "*";
        const response = await selectFilesApi(projectId, selectedFolder, pattern, debouncedPrefix, debouncedSuffix);
        if (response?.data?.success) {
          setMatchCount(response.data.data.matching_count || 0);
        }
      } catch (err) { /* ignore */ }
    };
    updateMatchCount();
  }, [projectId, selectedFolder, debouncedPrefix, debouncedSuffix, extensions]);

  const handleSelect = () => {
    if (isSingleFileMode) {
      if (selectedFile && onFileSelect) onFileSelect({ path: selectedFile.path });
      return;
    }
    if (onSelect) {
      onSelect({ path: selectedFolder, pattern: editablePattern || `${selectedFolder}/*`, matchCount });
    }
  };

  const clearSelection = () => { setEditablePattern(""); setSelectedFolder(""); setSelectedFile(null); setPrefix(""); setSuffix(""); };

  const handleFileClick = (item) => {
    if (item.is_dir) { navigateToFolder(item.path); }
    else if (isSingleFileMode) { setSelectedFile(item); setEditablePattern(item.path); }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getBreadcrumb = () => {
    const parts = currentPath ? currentPath.split("/") : [];
    return [
      { name: projectFolderName || "Project", path: "" },
      ...parts.map((part, index) => ({ name: part, path: parts.slice(0, index + 1).join("/") })),
    ];
  };

  const folderCount = totalFolderCount;
  const fileCount = totalFileCount;

  // Virtualization: only render rows visible in the viewport
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER);
  const visibleItems = items.slice(startIndex, endIndex);
  const topSpacer = startIndex * ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (items.length - endIndex) * ROW_HEIGHT);

  return (
    <div style={S.overlay}>
      <div style={S.popup}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={S.headerIcon}><FiFolder size={16} /></div>
            <div>
              <h2 style={S.headerTitle}>{title}</h2>
              <span style={S.headerSub}>Navigate folders and select files</span>
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}><FiX size={18} /></button>
        </div>

        {/* Navigation bar */}
        <div style={S.navBar}>
          <button onClick={goToRoot} style={S.navBtn} className="fb-nav-btn" title="Project root"><FiHome size={14} /></button>
          <button onClick={goUp} disabled={!currentPath} style={{ ...S.navBtn, ...(currentPath ? {} : S.navBtnDisabled) }} className="fb-nav-btn" title="Go up">
            <FiArrowLeft size={14} />
          </button>
          <div style={S.breadcrumb}>
            {getBreadcrumb().map((crumb, idx) => (
              <span key={idx} style={{ display: "flex", alignItems: "center" }}>
                {idx > 0 && <FiChevronRight size={12} style={{ color: "#cbd5e1", margin: "0 2px" }} />}
                <button
                  onClick={() => navigateToFolder(crumb.path)}
                  style={{ ...S.crumbBtn, ...(crumb.path === currentPath ? S.crumbActive : {}) }}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
          <span style={S.countBadge}>
            {folderCount > 0 && `${folderCount} folder${folderCount !== 1 ? "s" : ""}`}
            {folderCount > 0 && fileCount > 0 && ", "}
            {fileCount > 0 && `${fileCount} file${fileCount !== 1 ? "s" : ""}`}
            {folderCount === 0 && fileCount === 0 && !isLoading && "Empty"}
          </span>
        </div>

        {/* Filters */}
        {!isSingleFileMode && (
          <div style={S.filterBar}>
            <FiFilter size={13} style={{ color: "#94a3b8", flexShrink: 0 }} />
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Prefix filter..."
              style={S.filterInput}
              className="fb-filter-input"
            />
            <div style={S.filterDivider} />
            <input
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="Suffix filter (e.g. .tiff)"
              style={S.filterInput}
              className="fb-filter-input"
            />
            {(prefix || suffix) && (
              <button onClick={() => { setPrefix(""); setSuffix(""); }} style={S.filterClear} title="Clear filters">
                <FiX size={13} />
              </button>
            )}
          </div>
        )}

        {isSingleFileMode && extensions && (
          <div style={S.extInfo}>Showing: <span style={{ fontWeight: 600 }}>{extensions}</span></div>
        )}

        {error && <div style={S.errorBar}>{error}</div>}

        {/* File list */}
        <div style={S.tableWrap}>
          <div style={S.tableHeader}>
            <span style={{ flex: 1 }}>Name</span>
            <span style={{ width: 90, textAlign: "right" }}>Size</span>
            <span style={{ width: 80, textAlign: "right" }}>Type</span>
          </div>
          <div ref={scrollContainerRef} onScroll={handleScroll} style={S.tableBody}>
            {isLoading ? (
              <div style={S.emptyState}>
                <FiLoader size={18} style={{ animation: "spin 1s linear infinite" }} />
                <span>Loading...</span>
              </div>
            ) : items.length === 0 ? (
              <div style={S.emptyState}>
                <span style={{ color: "#94a3b8" }}>{prefix || suffix ? "No files match the filter" : "Empty folder"}</span>
              </div>
            ) : (
              <>
                {/* Top spacer for virtualization */}
                <div style={{ height: topSpacer, flexShrink: 0 }} />
                {visibleItems.map((item, index) => {
                  const isSelFile = isSingleFileMode && !item.is_dir && selectedFile?.path === item.path;
                  return (
                    <div
                      key={startIndex + index}
                      style={{ ...S.row, height: ROW_HEIGHT, boxSizing: "border-box", ...(isSelFile ? S.rowSelectedFile : {}) }}
                      onClick={() => handleFileClick(item)}
                      onDoubleClick={() => {
                        if (item.is_dir) navigateToFolder(item.path);
                        else if (isSingleFileMode) { setSelectedFile(item); if (onFileSelect) onFileSelect({ path: item.path }); }
                      }}
                      onMouseEnter={(e) => { if (!isSelFile) e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { if (!isSelFile) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {item.is_dir
                          ? <FaFolderOpen size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
                          : <FaRegFile size={13} style={{ color: isSelFile ? "#3b82f6" : "#94a3b8", flexShrink: 0 }} />
                        }
                        <span style={{
                          fontSize: 13,
                          fontWeight: item.is_dir ? 500 : 400,
                          color: isSelFile ? "#1d4ed8" : item.is_dir ? "#0f172a" : "#334155",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {item.name}
                        </span>
                      </div>
                      <span style={{ width: 90, textAlign: "right", fontSize: 12, color: "#94a3b8" }}>
                        {item.is_dir ? "--" : formatSize(item.size)}
                      </span>
                      <span style={{ width: 80, textAlign: "right", fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 500, letterSpacing: 0.3 }}>
                        {item.is_dir ? "Folder" : (item.extension || "File").replace(".", "")}
                      </span>
                    </div>
                  );
                })}
                {/* Bottom spacer for virtualization */}
                <div style={{ height: bottomSpacer, flexShrink: 0 }} />
                {isLoadingMore && (
                  <div style={{ padding: "8px 14px", fontSize: 12, color: "#64748b", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <FiLoader size={13} style={{ animation: "spin 1s linear infinite" }} />
                    Loading more...
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <div style={S.selectionRow}>
            <span style={S.selLabel}>Selected:</span>
            <div style={S.selInputWrap}>
              <input
                type="text"
                value={editablePattern}
                onChange={(e) => setEditablePattern(e.target.value)}
                placeholder={isSingleFileMode ? "Click a file above..." : "Movies/*.mrc"}
                style={S.selInput}
                className="fb-sel-input"
              />
              {editablePattern && (
                <button onClick={clearSelection} style={S.selClear}><FiX size={14} /></button>
              )}
            </div>
          </div>
          <div style={S.footerActions}>
            <button onClick={onClose} style={S.cancelBtn}>Cancel</button>
            <button
              onClick={handleSelect}
              disabled={isSingleFileMode ? !selectedFile?.path : !editablePattern}
              style={{
                ...S.selectBtn,
                ...((isSingleFileMode ? !selectedFile?.path : !editablePattern) ? S.selectBtnDisabled : {}),
              }}
            >
              <FaCircleCheck size={13} />
              {isSingleFileMode ? "Select File" : "Select"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .fb-nav-btn { padding: 0 !important; width: 30px !important; height: 30px !important; min-width: 30px !important; }
        .fb-filter-input, .fb-filter-input:hover, .fb-filter-input:focus, .fb-filter-input:focus-visible {
          border: none !important; outline: none !important; box-shadow: none !important;
          padding: 8px 4px !important; background: transparent !important;
        }
        .fb-sel-input, .fb-sel-input:hover, .fb-sel-input:focus, .fb-sel-input:focus-visible {
          border: none !important; outline: none !important; box-shadow: none !important;
          padding: 7px 10px !important; background: transparent !important;
        }
      `}</style>
    </div>
  );
};

// ===================== STYLES =====================
const S = {
  overlay: {
    position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", zIndex: 50,
  },
  popup: {
    background: "#fff", width: "min(900px, 90vw)", height: "min(640px, 85vh)",
    borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    display: "flex", flexDirection: "column", overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", borderBottom: "1px solid #f1f5f9",
  },
  headerIcon: {
    width: 36, height: 36, borderRadius: 10, background: "#eff6ff",
    display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6",
  },
  headerTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: "#0f172a" },
  headerSub: { fontSize: 12, color: "#94a3b8" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent",
    color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  navBar: {
    display: "flex", alignItems: "center", gap: 6, padding: "10px 20px",
    borderBottom: "1px solid #f1f5f9", background: "#fafbfc",
  },
  navBtn: {
    width: 30, height: 30, borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#64748b", cursor: "pointer", fontSize: 12, flexShrink: 0,
  },
  navBtnDisabled: { opacity: 0.35, cursor: "not-allowed" },
  breadcrumb: {
    display: "flex", alignItems: "center", flex: 1, overflow: "hidden",
    fontSize: 13, gap: 0, minWidth: 0,
  },
  crumbBtn: {
    background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
    borderRadius: 4, color: "#64748b", fontSize: 13, whiteSpace: "nowrap",
  },
  crumbActive: { color: "#2563eb", fontWeight: 600 },
  countBadge: {
    fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0,
    background: "#f1f5f9", padding: "3px 8px", borderRadius: 6,
  },
  filterBar: {
    display: "flex", alignItems: "center", gap: 8, margin: "0 20px",
    padding: "0 12px", height: 38, border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#fff", marginTop: 12,
  },
  filterInput: {
    flex: 1, border: "none", outline: "none", boxShadow: "none", fontSize: 13,
    background: "transparent", color: "#334155", minWidth: 0, padding: "8px 4px",
    WebkitAppearance: "none", appearance: "none",
  },
  filterDivider: { width: 1, height: 18, background: "#e2e8f0", flexShrink: 0 },
  filterClear: {
    width: 24, height: 24, borderRadius: 6, border: "none", background: "#fee2e2",
    color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  extInfo: {
    margin: "12px 20px 0", fontSize: 12, color: "#64748b", background: "#eff6ff",
    padding: "6px 12px", borderRadius: 6,
  },
  errorBar: {
    margin: "12px 20px 0", fontSize: 12, color: "#dc2626", background: "#fef2f2",
    padding: "8px 12px", borderRadius: 8, border: "1px solid #fecaca",
  },
  tableWrap: {
    flex: 1, display: "flex", flexDirection: "column", margin: "12px 20px 0",
    border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", minHeight: 0,
  },
  tableHeader: {
    display: "flex", alignItems: "center", padding: "8px 14px",
    background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
    fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase",
    letterSpacing: 0.5, flexShrink: 0, gap: 8,
  },
  tableBody: { flex: 1, overflowY: "auto", minHeight: 0 },
  row: {
    display: "flex", alignItems: "center", padding: "7px 14px", gap: 8,
    borderBottom: "1px solid #f8fafc", cursor: "pointer", transition: "background 0.1s",
  },
  rowSelectedFile: { background: "#eff6ff", borderLeft: "3px solid #3b82f6" },
  emptyState: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    height: 120, color: "#64748b", fontSize: 13,
  },
  footer: {
    padding: "12px 20px", borderTop: "1px solid #f1f5f9",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    flexShrink: 0,
  },
  selectionRow: { display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  selLabel: { fontSize: 12, fontWeight: 600, color: "#64748b", flexShrink: 0 },
  selInputWrap: {
    display: "flex", alignItems: "center", flex: 1, minWidth: 0,
    border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", overflow: "hidden",
  },
  selInput: {
    flex: 1, border: "none", outline: "none", boxShadow: "none", padding: "7px 10px",
    fontSize: 12, fontFamily: "monospace", background: "transparent", color: "#334155", minWidth: 0,
    WebkitAppearance: "none", appearance: "none",
  },
  selClear: {
    padding: "0 8px", height: "100%", border: "none", background: "transparent",
    color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center",
  },
  footerActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  cancelBtn: {
    padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0",
    background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer",
  },
  selectBtn: {
    display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
    borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff",
    fontSize: 13, fontWeight: 500, cursor: "pointer",
  },
  selectBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
};

export default FolderBrowserPopup;
