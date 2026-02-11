import { useState } from "react";
import { useFileExplorer } from "../../../../context/FileExplorerContext";
import {
  FaCircleCheck,
  FaRegFile,
  FaRegFolder,
  FaRegFolderOpen,
} from "react-icons/fa6";
import { BiLoader } from "react-icons/bi";

const FileList = () => {
  const {
    getCurrentDirectory,
    selectedFile,
    selectFile,
    navigateToFolder,
    handleFileSelection,
    onClose,
    isLoading,
  } = useFileExplorer();
  const [openFolders, setOpenFolders] = useState({});

  // Toggle folder open/close
  const toggleFolder = (folderName, folderPath) => {
    setOpenFolders((prev) => ({ ...prev, [folderName]: !prev[folderName] }));
    navigateToFolder(folderPath);
  };

  // Recursive function to render files & folders
  const renderFiles = (items, level = 0, rowIndex = 0, parentPath = "") => {
    return items.map((item, index) => {
      const isEvenRow = (rowIndex + index) % 2 === 0;
      const newPath = `${parentPath}/${item.name}`;
      return (
        <div
          key={index}
          className={`flex justify-between flex-wrap items-center ${
            isEvenRow ? "bg-lightgray" : "bg-white"
          }
           ${
             item.type === "file" &&
             item.name === selectedFile?.name &&
             item.path === selectedFile?.path
               ? "border-l-4 border-black !bg-[#d3daea]"
               : ""
           }
          `}
        >
          <div
            style={{ paddingLeft: level * 16 }}
            className={`cursor-pointer flex-1 p-2 rounded text-sm ${
              item.type === "folder" ? "font-medium text-black" : "text-black"
            } hover:text-[#000]`}
            onClick={() => {
              if (item.type === "folder") {
                toggleFolder(item.name, newPath);
              } else {
                toggleFolder(item.name, newPath);
                selectFile(item);
              }
            }}
          >
            <span className="flex items-center ">
              {item.type === "folder" ? (
                openFolders[item.name] ? (
                  <FaRegFolderOpen className="mx-2" />
                ) : (
                  <FaRegFolder className="mx-2" />
                )
              ) : (
                <FaRegFile className="mx-2" />
              )}{" "}
              {item.name}
            </span>
          </div>
          <div className="w-40 text-gray-600 text-sm">
            {item.lastModified || "-"}
          </div>
          <div className="w-20 text-gray-600 text-sm">{item.size || "-"}</div>

          {/* Render nested children if folder is open */}
          {item.type === "folder" &&
            openFolders[item.name] &&
            item.children && (
              <div className="w-full">
                {renderFiles(
                  item.children,
                  level + 1,
                  rowIndex + index + 1,
                  newPath
                )}
              </div>
            )}
        </div>
      );
    });
  };

  return (
    <>
      <div className="rounded-lg relative h-full">
        {/* Table Header */}
        <div className="flex justify-between text-midgray text-sm font-medium p-2 border-b border-gray-300">
          <div className="flex-1">File Name</div>
          <div className="w-40">Last Modified</div>
          <div className="w-20">Size</div>
        </div>

        {/* File & Folder List */}
        <div
          className="overflow-y-auto"
          style={{ height: "calc(100% - 200px)" }}
        >
          {isLoading ? (
            <p className="flex font-normal items-center text-black/80 mb-5">
              <BiLoader className="mr-1 text-xl animate-spin" />
              Loading, please wait
            </p>
          ) : (
            renderFiles(getCurrentDirectory())
          )}
        </div>
      </div>
      <div className="flex justify-end w-full bg-white mt-2 absolute bottom-0">
        {selectedFile?.path ? (
          <p className="mr-auto text-black/80 font-medium text-sm">
            Selected File: <span className="text-black font-semibold">{selectedFile?.path}</span>
          </p>
        ) : (
          ""
        )}
        <button
          className="flex items-center w-fit min-w-[100px] justify-center bg-midgray mr-4 text-white py-2 mt-3 text-sm px-4"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className={`flex items-center w-fit min-w-[100px] justify-center bg-primary text-white py-2 mt-3 text-sm px-4 ${
            !selectedFile ? "cursor-not-allowed opacity-70" : ""
          }`}
          disabled={!selectedFile}
          onClick={() => {
            handleFileSelection();
          }}
        >
          <FaCircleCheck className="text-base mr-2" />
          Select
        </button>
      </div>
    </>
  );
};

export default FileList;
