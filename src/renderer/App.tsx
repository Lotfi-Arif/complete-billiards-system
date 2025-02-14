// src/renderer/App.tsx
import React, { useState } from "react";
import "./App.css";
import Dashboard from "./components/Dashboard";
import ReservationsPage from "./pages/ReservationsPage";
import MainLayout from "./components/layout/MainLayout";

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>("dashboard");

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "reservations":
        return <ReservationsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <MainLayout>
      <div className="h-full">
        {/* This would normally be handled by a router, but for now we'll use state */}
        <div className="mb-4 flex space-x-4">
          <button
            onClick={() => setCurrentPage("dashboard")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              currentPage === "dashboard"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentPage("reservations")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              currentPage === "reservations"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Reservations
          </button>
        </div>

        {renderPage()}
      </div>
    </MainLayout>
  );
};

export default App;
