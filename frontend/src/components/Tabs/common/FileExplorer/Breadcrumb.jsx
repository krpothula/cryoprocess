import { FaFolder } from "react-icons/fa6";
import { useFileExplorer } from "../../../../context/FileExplorerContext";
import { useRef, useState } from "react";

const Breadcrumb = () => {
  const { currentPath, navigateToPath, selectedFile, selectFile } =
    useFileExplorer();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  const isFile = currentPath.length > 0; // If path has segments, assume last is a file

  // Enable edit mode only for the file name
  const handleEditClick = () => {
    if (!isFile) return; // If no file name, don't enter edit mode
    setIsEditing(true);
    setInputValue(currentPath[currentPath.length - 1]); // Only edit last segment
    setTimeout(() => inputRef.current?.focus(), 0); // Auto-focus input
  };

  // Handle input change
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const updateFilePath = (newFileName) => {
    const oldPath = selectedFile.path || ""; // Example: "/opt/krpothula/cryoem-gui/mask_creation/admin.py"
    const pathParts = oldPath.split("/"); // Split into parts
    pathParts[pathParts.length - 1] = newFileName; // Replace only the last part (filename)
    const newPath = pathParts.join("/"); // Join back to form new path
    selectFile({ path: newPath });
    // return newPath;
  };

  // Handle blur or Enter to save the new file name
  const handleInputSubmit = () => {
    setIsEditing(false);
    if (!inputValue.trim()) return; // Prevent empty names

    const newPath = [...currentPath];
    newPath[newPath.length - 1] = inputValue; // Update only the file name
    navigateToPath(newPath);
    updateFilePath(inputValue);
  };

  // Handle Enter key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleInputSubmit();
    }
  };

  return (
    <div
      className={`p-2 flex items-center border text-[var(--color-text)] rounded text-sm mb-2 ${
        isEditing ? "border-b-primary border-b-2" : ""
      }`}
      onClick={handleEditClick}
    >
      <FaFolder className="mr-2" />

      {/* Root folder */}
      <span
        className="cursor-pointer hover:underline"
        onClick={handleEditClick}
      >
        <span className="text-midgray">/</span> root
      </span>

      {/* Render folders */}
      {currentPath.slice(0, -1).map((folder, index) => (
        <span key={index} className="">
          <span className="mx-1 text-midgray">/</span>
          <span
            className="cursor-pointer text-[var(--color-text)] hover:underline"
            onClick={handleEditClick}
          >
            {folder}
          </span>
        </span>
      ))}

      {/* Render file (last segment) */}
      {isFile && <span className="mx-1 text-midgray">/</span>}
      {isFile && isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputSubmit}
          onKeyDown={handleKeyDown}
          className="border rounded px-2 py-1 w-auto focus:outline-none"
        />
      ) : (
        isFile && (
          <span
            className="cursor-pointer text-[var(--color-text)] hover:underline"
            onClick={handleEditClick}
          >
            {currentPath[currentPath.length - 1]}
          </span>
        )
      )}
    </div>
  );
};

export default Breadcrumb;
