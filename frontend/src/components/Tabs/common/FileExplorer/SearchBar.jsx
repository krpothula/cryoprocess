import { useEffect, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { IoMdClose } from "react-icons/io";
import { useFileExplorer } from "../../../../context/FileExplorerContext";

const SearchBar = () => {
  const { getCurrentDirectory, setSearchedResult, onClose } = useFileExplorer();
  const [query, setQuery] = useState("");

  // Get the current directory files and filter by search query
  const currentDirectory = getCurrentDirectory();
  // const filteredItems = currentDirectory.filter((item) =>
  //   item.name.toLowerCase().includes(query.toLowerCase())
  // );

  const searchRecursive = (items, query) => {
    return items
      .filter((item) => item.name.toLowerCase().includes(query.toLowerCase())) // Filter current level
      .map((item) => {
        if (item.type === "folder" && item.children) {
          return {
            ...item,
            // children: searchRecursive(item.children, query), // Recurse into subfolders
          };
        }
        return item;
      });
  };

  useEffect(() => {
    if (!query) {
      setSearchedResult([]);
      return;
    }
    const result = searchRecursive(currentDirectory, query);
    setSearchedResult(result || []);
  }, [query]);

  return (
    <div className="flex items-center w-full mb-2 relative">
      <IoSearch className="absolute top-[16px] left-2.5" />
      <input
        type="text"
        placeholder="Search folders..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="block w-[30%] p-2 pl-8 border rounded text-sm "
      />
      <button
        className="flex items-center w-fit ml-auto justify-center bg-midgray text-white py-2 mt-3 text-sm px-4"
        onClick={onClose}
      >
        <IoMdClose className="text-base mr-2" />
        Close
      </button>
    </div>
  );
};

export default SearchBar;
