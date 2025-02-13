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
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Complete Billiards System</h1>
        <nav>
          <ul>
            <li>Dashboard</li>
            <li>Reservations</li>
            <li>Sessions</li>
            <li>Reports</li>
            <li>Settings</li>
          </ul>
        </nav>
      </header>

      <main className="dashboard-content">
        <section className="tables-section">
          <h2>Pool Tables</h2>
          <div className="tables-grid">
            {tables.map((table) => (
              <div key={table.id} className={`table-card ${table.status}`}>
                <h3>Table {table.number}</h3>
                <p>Status: {table.status}</p>
                <div className="table-actions">
                  <button onClick={() => handleOpenTable(table.id)}>
                    Open
                  </button>
                  <button onClick={() => handleCloseTable(table.id)}>
                    Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sessions-section">
          <h2>Active Sessions</h2>
          <table className="sessions-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Table</th>
                <th>Start Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.id}</td>
                  <td>{session.tableId}</td>
                  <td>{session.startTime}</td>
                  <td>{session.status}</td>
                  <td>
                    {session.status === "active" && (
                      <button onClick={() => handleEndSession(session.id)}>
                        End Session
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      <footer className="dashboard-footer">
        <p>&copy; 2025 Complete Billiards System</p>
      </footer>
    </div>
  );
};

export default Dashboard;
