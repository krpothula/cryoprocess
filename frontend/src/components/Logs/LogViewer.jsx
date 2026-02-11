import { useState } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa6";

const LogViewer = ({ logs }) => {
  const [expandedRow, setExpandedRow] = useState(0);

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  return (
    <div className="bg-gray-100 p-4">
      {logs.map((log, index) => (
        <div key={index}>
          {/* Log Row */}
          <div
            className="flex items-center p-3 py-2 bg-white rounded border-gray-200 cursor-pointer"
            onClick={() => toggleRow(index)}
          >
            <span className="text-gray-500">
              {expandedRow === index ? (
                <FaChevronDown className="text-sm" />
              ) : (
                <FaChevronRight className="text-sm" />
              )}
            </span>
            <div className="flex space-x-4 ml-5">
              {/* <span className="text-sm font-mono text-blue-600">{log.cpu}</span>
              <span className="text-sm font-mono text-green">{log.memory}</span> */}
              <span className="text-sm font-mono">{log.message}</span>
            </div>
          </div>

          {/* Details View */}
          {expandedRow === index ? (
            Array.isArray(log.details) ? (
              <div className="p-4 bg-gray-50 border-gray-200 rounded-b-md shadow-inner">
                <div className="grid grid-cols-2 gap-4 font-mono text-sm max-w-[70%]">
                  <div className="space-y-1 text-gray-700 text-right">
                    {log.details.map((detail, i) => (
                      <div key={i}>{detail.label} &nbsp;&nbsp;&nbsp; : </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {log.details.map((detail, i) => (
                      <div key={i}>{detail.value}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 px-14 bg-gray-50 border-gray-200 rounded-b-md shadow-inner">
                <pre
                  className="text-sm font-mono text-gray-700"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {log.details}
                </pre>
              </div>
            )
          ) : (
            ""
          )}
        </div>
      ))}
    </div>
  );
};

export default LogViewer;
