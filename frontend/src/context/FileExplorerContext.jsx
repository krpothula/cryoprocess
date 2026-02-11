import { createContext, useContext, useEffect, useState } from "react";

// Create Context
const FileExplorerContext = createContext();

// Provider Component
export const FileExplorerProvider = ({
  children,
  initialData,
  onFileSelect,
  onClose,
  isLoading,
}) => {
  const [fileStructure, setFileStructure] = useState(initialData);
  const [searchedResult, setSearchedResult] = useState([]);
  const [currentPath, setCurrentPath] = useState([]); // Current path in the breadcrumb
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); // Store search query

  // Get the current directory based on the path
  const getCurrentDirectory = () => {
    return searchedResult?.length > 0 ? searchedResult : fileStructure;
  };

  // Search functionality - filter files/folders based on the query
  const searchFiles = (query) => {
    setSearchQuery(query);

    const searchRecursive = (items) => {
      return items
        .filter((item) => {
          return item.name.toLowerCase().includes(query.toLowerCase());
        })
        .map((item) => {
          if (item.type === "folder") {
            return { ...item, children: searchRecursive(item.children) }; // Recurse into children
          }
          return item;
        });
    };

    return searchRecursive(fileStructure);
  };

  // Navigate into a folder
  const navigateToFolder = (folderPath = "") => {
    const pathSlugs = folderPath?.split("/").filter((item) => item);
    setCurrentPath(pathSlugs);
  };

  // Navigate back (Breadcrumb click)
  const navigateToPath = (pathArray) => {
    setCurrentPath(pathArray);
  };

  // Select a file
  const selectFile = (file) => {
    setSelectedFile(file);
  };

  const handleFileSelection = () => {
    if (onFileSelect) {
      onFileSelect(selectedFile);
    }
  };

  useEffect(() => {
    if (initialData?.length > 0) {
      setFileStructure(initialData); // Set API data
    }
  }, [initialData]);

  return (
    <FileExplorerContext.Provider
      value={{
        fileStructure,
        currentPath,
        selectedFile,
        searchQuery,
        isLoading,
        getCurrentDirectory,
        searchFiles,
        navigateToFolder,
        navigateToPath,
        selectFile,
        setSearchedResult,
        handleFileSelection,
        onClose,
      }}
    >
      {children}
    </FileExplorerContext.Provider>
  );
};

// Custom Hook
export const useFileExplorer = () => useContext(FileExplorerContext);
