import React, { useState, useEffect } from "react";
// Import ipcRenderer from Electron. In a secure Electron setup you might use a preload script and a custom API.
import { ipcRenderer } from "electron";
import "./Dashboard.css";

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

  // Fetch data from the Electron main process via IPC when the component mounts.
  useEffect(() => {
    async function fetchData() {
      try {
        // Assume these IPC endpoints exist in your main process.
        const tablesData: Table[] = await ipcRenderer.invoke("get-tables");
        const sessionsData: Session[] = await ipcRenderer.invoke(
          "get-sessions"
        );
        setTables(tablesData);
        setSessions(sessionsData);
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
      await ipcRenderer.invoke("open-table", tableId);
      // Optionally update the state after the operation.
    } catch (error) {
      console.error("Error opening table:", error);
    }
  };

  const handleCloseTable = async (tableId: number) => {
    try {
      await ipcRenderer.invoke("close-table", tableId);
      // Optionally update the state after the operation.
    } catch (error) {
      console.error("Error closing table:", error);
    }
  };

  const handleEndSession = async (sessionId: number) => {
    try {
      await ipcRenderer.invoke("end-session", sessionId);
      // Optionally update the sessions list.
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
