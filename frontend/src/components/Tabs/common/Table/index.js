import React from "react";

const Table = ({ columns, rows, isDataLoading }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse rounded border border-gray-300">
        <thead className="rounded bg-black">
          <tr>
            {columns.map((col, index) => (
              <th
                key={index}
                className="border rounded border-stroke font-medium px-4 py-2 text-left text-base text-white"
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isDataLoading ? (
            <tr>
              <td
                colSpan={4}
                className="border border-stroke px-4 py-3 text-center"
              >
                <p className="flex justify-center items-center text-black my-3">
                  <span className="block w-5 h-5 border-2 border-t-[2px] border-[#c4c4c4] mr-2 border-solid rounded-full animate-spin border-t-primary"></span>
                  Loading data, please wait...
                </p>
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? "bg-white" : "bg-white"}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    className="border border-stroke px-4 py-3 text-sm text-gray-700"
                  >
                    {row[col.accessor] || "-"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
