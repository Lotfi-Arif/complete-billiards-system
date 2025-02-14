// src/renderer/components/tables/TableCard.tsx
import React from "react";

interface TableCardProps {
  table: {
    id: number;
    number: number;
    status: string;
    type: string;
    timeRemaining?: string;
    reservedFor?: string;
  };
  onAction?: (action: "open" | "close" | "reserve") => void;
}

const TableCard: React.FC<TableCardProps> = ({ table, onAction }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "border-green-500 bg-green-50";
      case "occupied":
        return "border-red-500 bg-red-50";
      case "reserved":
        return "border-yellow-500 bg-yellow-50";
      case "maintenance":
        return "border-gray-500 bg-gray-50";
      default:
        return "border-gray-300";
    }
  };

  return (
    <div
      className={`rounded-lg border-2 ${getStatusColor(
        table.status
      )} p-6 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">
            Table {table.number}
          </h3>
          <span className="text-sm text-gray-600 capitalize">{table.type}</span>
        </div>
        <div className="flex items-center">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium
            ${table.status === "available" ? "bg-green-100 text-green-800" : ""}
            ${table.status === "occupied" ? "bg-red-100 text-red-800" : ""}
            ${
              table.status === "reserved" ? "bg-yellow-100 text-yellow-800" : ""
            }
            ${table.status === "maintenance" ? "bg-gray-100 text-gray-800" : ""}
          `}
          >
            {table.status}
          </span>
        </div>
      </div>

      {table.timeRemaining && (
        <div className="mb-4 text-center">
          <span className="text-sm text-gray-600">Time Remaining</span>
          <div className="text-2xl font-bold text-gray-800">
            {table.timeRemaining}
          </div>
        </div>
      )}

      {table.reservedFor && (
        <div className="mb-4 text-center">
          <span className="text-sm text-gray-600">Reserved for</span>
          <div className="text-lg font-medium text-gray-800">
            {table.reservedFor}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4">
        {table.status === "available" && (
          <>
            <button
              onClick={() => onAction?.("open")}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              Open
            </button>
            <button
              onClick={() => onAction?.("reserve")}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded transition-colors"
            >
              Reserve
            </button>
          </>
        )}
        {table.status === "occupied" && (
          <button
            onClick={() => onAction?.("close")}
            className="col-span-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
          >
            Close Table
          </button>
        )}
      </div>
    </div>
  );
};

export default TableCard;
