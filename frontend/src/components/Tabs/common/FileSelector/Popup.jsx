import { useEffect, useState } from "react";
import FileExplorer from "../FileExplorer/FileExplorer";
import { useBuilder } from "../../../../context/BuilderContext";
import { getPrevFilesApi } from "../../../../services/builders/motion/motion";

/**
 * FileExplorePopup - A popup component for browsing and selecting files
 *
 * @param {function} onClose - Callback when popup is closed
 * @param {function} onFileSelect - Callback when a file is selected, receives the file path
 * @param {number|string} jobType - The job type to filter files. Can be:
 *   - A number (0-22) for job-specific files
 *   - "pdb" for PDB structure files (.pdb, .ent)
 *   - "map" for density map files (.mrc, .map, .ccp4)
 */
const FileExplorePopup = ({ onClose, onFileSelect, jobType }) => {
  const { projectId } = useBuilder();
  const [fileData, setFileData] = useState([]);
  const [isLoading, setLoading] = useState(true);

  const getFileList = () => {
    getPrevFilesApi(projectId, "", jobType)
      .then((response) => {
        if (response?.data?.data?.files?.length > 0) {
          setFileData(response?.data?.data?.files);
        } else {
          setFileData([]);
        }
      })
      .catch((error) => {
        setFileData([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (projectId) {
      getFileList();
    }
  }, [projectId, jobType]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white dark:bg-slate-800 w-[80vw] h-[80vh] p-5 rounded shadow-lg">
        <FileExplorer
          data={fileData}
          onClose={onClose}
          onFileSelect={onFileSelect}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default FileExplorePopup;
