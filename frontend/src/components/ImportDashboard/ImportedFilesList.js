import React from "react";
import { List } from "react-window";

const ROW_HEIGHT = 32;

const Row = ({ index, style, items, onSelect, getName, isSelectedFn }) => {
  const file = items[index];
  const fileName = getName(file);
  const selected = isSelectedFn(file);

  return (
    <div
      style={style}
      onClick={() => onSelect({ name: fileName, path: file.movieName || file.micrographName || "", ...file })}
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
        title={fileName}
      >
        {fileName}
      </p>
    </div>
  );
};

const ImportedFilesList = ({ files, type, selectedFile, onSelect, totalImported }) => {
  const getName = (file) => {
    return file.movieName || file.micrographName || file.name || "Unknown";
  };

  const isSelectedFn = (file) => {
    const fileName = getName(file);
    return selectedFile?.name === fileName;
  };

  if (!files || files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)]">
        <p className="text-center text-sm">
          No {type} imported yet
          <br />
          <span className="text-xs">Files will appear here after import completes</span>
        </p>
      </div>
    );
  }

  const displayType = type === "movies" ? "movies" : "micrographs";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <List
          rowComponent={Row}
          rowCount={files.length}
          rowHeight={ROW_HEIGHT}
          rowProps={{ items: files, onSelect, getName, isSelectedFn }}
          overscanCount={5}
          style={{ height: "100%" }}
        />
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] text-center py-2 border-t flex-shrink-0">
        {files.length} of {totalImported || files.length} {displayType}
      </div>
    </div>
  );
};

export default ImportedFilesList;
