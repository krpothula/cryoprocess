import React from "react";
import { List } from "react-window";

const ROW_HEIGHT = 32;

const Row = ({ index, style, items, onSelect, getDisplayName, getRawName, isSelectedFn }) => {
  const item = items[index];
  const display = getDisplayName(item);
  const raw = getRawName(item);
  const selected = isSelectedFn(item);

  return (
    <div
      style={style}
      onClick={() => onSelect(raw)}
      className={`px-3 cursor-pointer flex items-center ${
        selected ? "bg-[var(--color-info-bg)]" : "hover:bg-[var(--color-bg-hover)]"
      }`}
    >
      <p
        className="truncate"
        style={{
          fontSize: "12px",
          fontWeight: selected ? 500 : 400,
          color: selected ? "var(--color-info-strong)" : "var(--color-text-label)",
        }}
        title={raw}
      >
        {display}
      </p>
    </div>
  );
};

const MicrographList = ({
  micrographs = [],
  liveFiles = [],
  selectedMicrograph,
  onSelect,
  total = null,
}) => {
  // Full name from data
  const getRawName = (m) => {
    if (typeof m === "string") return m;
    return m.micrographName || m.name || "Unknown";
  };

  // Display: just the filename (no path)
  const getDisplayName = (m) => {
    const raw = getRawName(m);
    const parts = raw.split("/");
    return parts[parts.length - 1];
  };

  const isSelectedFn = (m) => {
    const name = getRawName(m);
    if (selectedMicrograph === name) return true;
    const parts = name.split("/");
    const basename = parts[parts.length - 1].replace(".mrc", "");
    return selectedMicrograph === basename;
  };

  const allMicrographs = React.useMemo(() => {
    if (liveFiles && liveFiles.length > 0) {
      return liveFiles.map((f) => ({ micrographName: f }));
    }
    return micrographs;
  }, [micrographs, liveFiles]);

  if (allMicrographs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)]">
        <p className="text-center text-sm">
          No movies processed yet
          <br />
          <span className="text-xs">Movies will appear here after processing</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <List
          rowComponent={Row}
          rowCount={allMicrographs.length}
          rowHeight={ROW_HEIGHT}
          rowProps={{ items: allMicrographs, onSelect, getDisplayName, getRawName, isSelectedFn }}
          overscanCount={5}
          style={{ height: "100%" }}
        />
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] text-center py-2 border-t border-[var(--color-border)] flex-shrink-0">
        {allMicrographs.length} / {total || allMicrographs.length} movies processed
      </div>
    </div>
  );
};

export default MicrographList;
