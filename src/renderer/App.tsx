import React, { useState, useEffect } from "react";
import "./App.css";

// Define data interfaces (or import these from your shared types)
interface Table {
  id: number;
  number: number;
  status: "available" | "occupied" | string;
}

interface Session {
  id: number;
  tableId: number;
  startTime: string;
  endTime?: string;
  cost?: number;
  status: "active" | "completed" | string;
}

const Dashboard: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Use the API exposed by the preload script.
        // If these methods aren't implemented yet, you can use fallback data.

        // Fallback dummy data for UI rendering
        setTables([
          { id: 1, number: 1, status: "available" },
          { id: 2, number: 2, status: "occupied" },
        ]);
        setSessions([
          {
            id: 1,
            tableId: 2,
            startTime: "2025-02-13T12:00:00Z",
            status: "active",
          },
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleOpenTable = async (tableId: number) => {
    try {
      await window.electron.openTable(tableId);
      // Optionally update state or show a notification
    } catch (error) {
      console.error("Error opening table:", error);
    }
  };

  const handleCloseTable = async (tableId: number) => {
    try {
      await window.electron.closeTable(tableId);
      // Optionally update state or show a notification
    } catch (error) {
      console.error("Error closing table:", error);
    }
  };

  const handleEndSession = async (sessionId: number) => {
    try {
      // Optionally update state or refresh the session list
    } catch (error) {
      console.error("Error ending session:", error);
    }
  };

  if (loading) {
    return <div className="text-center p-8 text-lg">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen m-0 p-0 font-sans">
      <header className="bg-slate-800 text-gray-100 p-4">
        <h1 className="m-0">Complete Billiards System</h1>
        <nav>
          <ul className="list-none p-0 mt-4 flex gap-4">
            <li className="cursor-pointer">Dashboard</li>
            <li className="cursor-pointer">Reservations</li>
            <li className="cursor-pointer">Sessions</li>
            <li className="cursor-pointer">Reports</li>
            <li className="cursor-pointer">Settings</li>
          </ul>
        </nav>
      </header>

      <main className="flex-1 p-4 overflow-y-auto bg-gray-100">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Pool Tables</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map((table) => (
              <div
                key={table.id}
                className={`bg-white rounded-lg p-4 shadow-md text-center
                  ${
                    table.status === "available"
                      ? "border-2 border-green-500"
                      : "border-2 border-red-500"
                  }`}
              >
                <h3 className="text-lg font-medium">Table {table.number}</h3>
                <p className="my-2">Status: {table.status}</p>
                <div className="space-x-2">
                  <button
                    onClick={() => handleOpenTable(table.id)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleCloseTable(table.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Active Sessions</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-3 text-center">ID</th>
                  <th className="border border-gray-300 p-3 text-center">
                    Table
                  </th>
                  <th className="border border-gray-300 p-3 text-center">
                    Start Time
                  </th>
                  <th className="border border-gray-300 p-3 text-center">
                    Status
                  </th>
                  <th className="border border-gray-300 p-3 text-center">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="border border-gray-300 p-3 text-center">
                      {session.id}
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      {session.tableId}
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      {session.startTime}
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      {session.status}
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      {session.status === "active" && (
                        <button
                          onClick={() => handleEndSession(session.id)}
                          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition-colors"
                        >
                          End Session
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="bg-slate-800 text-gray-100 text-center py-2">
        <p>&copy; 2025 Complete Billiards System</p>
      </footer>
    </div>
  );
};

export default Dashboard;
