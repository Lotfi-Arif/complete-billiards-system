import React from "react";

const Sidebar = () => {
  const menuItems = [
    { icon: "🎱", name: "Dashboard", path: "/" },
    { icon: "📅", name: "Reservations", path: "/reservations" },
    { icon: "⏱️", name: "Active Sessions", path: "/sessions" },
    { icon: "💰", name: "Payments", path: "/payments" },
    { icon: "📊", name: "Reports", path: "/reports" },
    { icon: "⚙️", name: "Settings", path: "/settings" },
  ];

  return (
    <div className="bg-slate-800 text-white w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform -translate-x-full md:relative md:translate-x-0 transition duration-200 ease-in-out">
      <div className="flex items-center justify-center space-x-2 px-4">
        <span className="text-2xl">🎱</span>
        <span className="text-xl font-bold">Billiards System</span>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className="flex items-center space-x-2 px-4 py-3 text-gray-300 hover:bg-slate-700 rounded-lg transition duration-150"
          >
            <span>{item.icon}</span>
            <span>{item.name}</span>
          </a>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
