import React from "react";
import TableCard from "./TableCard";
import TableStatusBadge from "./TableStatusBadge";

interface TableGridProps {
  onTableAction?: (
    tableId: number,
    action: "open" | "close" | "reserve"
  ) => void;
}

const TableGrid: React.FC<TableGridProps> = ({ onTableAction }) => {
  // This would normally come from props or context
  const tables = [
    { id: 1, number: 1, status: "available", type: "standard" },
    {
      id: 2,
      number: 2,
      status: "occupied",
      type: "standard",
      timeRemaining: "1:30:00",
    },
    {
      id: 3,
      number: 3,
      status: "reserved",
      type: "tournament",
      reservedFor: "14:00",
    },
    { id: 4, number: 4, status: "maintenance", type: "standard" },
    { id: 5, number: 5, status: "available", type: "premium" },
    {
      id: 6,
      number: 6,
      status: "occupied",
      type: "premium",
      timeRemaining: "0:45:00",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Pool Tables</h2>
        <div className="flex space-x-2">
          <TableStatusBadge status="available" count={2} />
          <TableStatusBadge status="occupied" count={2} />
          <TableStatusBadge status="reserved" count={1} />
          <TableStatusBadge status="maintenance" count={1} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onAction={(action) => onTableAction?.(table.id, action)}
          />
        ))}
      </div>
    </div>
  );
};

export default TableGrid;
