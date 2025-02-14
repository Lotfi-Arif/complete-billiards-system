import React, { useState } from "react";
import "./App.css";
import Dashboard from "./components/Dashboard";
import ReservationsPage from "./pages/ReservationsPage";
import MainLayout from "./components/layout/MainLayout";
import SessionsPage from "./pages/SessionsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ReportsPage from "./pages/ReportsPage";

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>("dashboard");

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "reservations":
        return <ReservationsPage />;
      case "sessions":
        return <SessionsPage />;
      case "payments":
        return <PaymentsPage />;
      case "reports":
        return <ReportsPage />;
      case "settings":
        return <div>Settings Page</div>; // Placeholder
      default:
        return <Dashboard />;
    }
  };

  return (
    <MainLayout onNavigate={setCurrentPage} currentPage={currentPage}>
      <div className="h-full">{renderPage()}</div>
    </MainLayout>
  );
};

export default App;
