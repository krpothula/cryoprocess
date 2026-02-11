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
        selected ? "bg-blue-50" : "hover:bg-gray-50"
      }`}
    >
      <p
        className="truncate"
        style={{
          fontSize: "12px",
          fontWeight: selected ? 500 : 400,
          color: selected ? "#1d4ed8" : "#374151",
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
  selectedMicrograph,
  onSelect,
  totalMicrographs = 0,
}) => {
  const getName = (m) => {
    return m.micrograph_name || m.name || "Unknown";
  };

  const isSelectedFn = (m) => {
    const name = getName(m);
    return selectedMicrograph === name;
  };

  if (micrographs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
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
          rowCount={micrographs.length}
          rowHeight={ROW_HEIGHT}
          rowProps={{ items: micrographs, onSelect, getName, isSelectedFn }}
          overscanCount={5}
          style={{ height: "100%" }}
        />
      </div>
      <div className="text-xs text-gray-500 text-center py-2 border-t flex-shrink-0">
        {micrographs.length} / {totalMicrographs || micrographs.length} micrographs
      </div>
    </div>
  );
};

export default MicrographList;
