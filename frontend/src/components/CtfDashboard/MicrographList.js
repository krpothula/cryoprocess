import React from "react";
import { List } from "react-window";

const ROW_HEIGHT = 32;

const Row = ({ index, style, items, onSelect, getName, isSelectedFn }) => {
  const item = items[index];
  const name = getName(item);
  const selected = isSelectedFn(item);

  return (
    <div
      style={style}
      onClick={() => onSelect(name)}
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
        title={name}
      >
        {name}
      </p>
    </div>
  );
};

const MicrographList = ({
  micrographs = [],
  latestMicrographs = [],
  selectedMicrograph,
  onSelect,
}) => {
  const getName = (m) => {
    return m.micrographName || m.name || "Unknown";
  };

  const isSelectedFn = (m) => {
    const name = getName(m);
    return selectedMicrograph === name;
  };

  // Combine and deduplicate micrographs
  const allMicrographs = React.useMemo(() => {
    const latestNames = new Set(latestMicrographs?.map((m) => m.name) || []);
    const combined = [
      ...(latestMicrographs || []).map((m) => ({
        micrographName: m.name,
        defocusAvg: m.defocusAvg,
        ctfMaxResolution: m.resolution,
        ctfFigureOfMerit: m.ctfFigureOfMerit,
      })),
      ...micrographs.filter((m) => !latestNames.has(m.micrographName)),
    ];
    return combined;
  }, [micrographs, latestMicrographs]);

  if (allMicrographs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)]">
        <p className="text-center text-sm">
          No micrographs processed yet
          <br />
          <span className="text-xs">Micrographs will appear here after processing</span>
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
          rowProps={{ items: allMicrographs, onSelect, getName, isSelectedFn }}
          overscanCount={5}
          style={{ height: "100%" }}
        />
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] text-center py-2 border-t flex-shrink-0">
        {allMicrographs.length} micrographs
      </div>
    </div>
  );
};

export default MicrographList;
