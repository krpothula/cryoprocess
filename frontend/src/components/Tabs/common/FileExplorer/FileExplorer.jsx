import { FileExplorerProvider } from "../../../../context/FileExplorerContext";
import Breadcrumb from "./Breadcrumb";
import FileList from "./FileList";
import SearchBar from "./SearchBar";

const FileExplorer = ({ data, onFileSelect, onClose, isLoading }) => {
  return (
    <FileExplorerProvider
      initialData={data}
      onFileSelect={onFileSelect}
      onClose={onClose}
      isLoading={isLoading}
    >
      <div className="mx-auto bg-white relative rounded h-full">
        <SearchBar />
        <Breadcrumb />
        <FileList />
      </div>
    </FileExplorerProvider>
  );
};

export default FileExplorer;
