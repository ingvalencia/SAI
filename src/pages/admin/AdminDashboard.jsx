import { useState } from "react";
import Usuarios from "./Usuarios";
import Control from "./Control";
import Mapa from "./Mapa";

export default function AdminDashboard() {
  const [vista, setVista] = useState("inicio");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const menuItems = [
    { id: "usuarios", label: "Usuarios y permisos", icon: "👥" },
    { id: "control", label: "Control de operaciones", icon: "⚙️" },
    { id: "mapa", label: "Mapa de operaciones", icon: "🗺️" },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">

      <aside
        className={`relative h-full bg-gradient-to-b from-red-900 to-red-700 text-white shadow-2xl transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? "w-20" : "w-72"}`}
      >
        <div className="flex items-center justify-between p-5 border-b border-red-600">
          {!sidebarCollapsed && (
            <div>
              <h2 className="text-xl font-bold tracking-wide">SICAF</h2>
              <p className="text-xs text-red-200">Administrador</p>
            </div>
          )}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition"
          >
            {sidebarCollapsed ? "▶" : "◀"}
          </button>
        </div>

        <nav className="mt-4 space-y-2 px-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setVista(item.id)}
              className={`group relative flex items-center gap-4 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300
              ${
                vista === item.id
                  ? "bg-red-600 shadow-lg"
                  : "hover:bg-red-800 text-red-100"
              }`}
            >
              <span className="text-xl">{item.icon}</span>

              {!sidebarCollapsed && (
                <span className="whitespace-nowrap">
                  {item.label}
                </span>
              )}

              {sidebarCollapsed && (
                <span className="absolute left-full ml-3 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="absolute bottom-0 w-full p-4 border-t border-red-600 text-xs text-red-200 text-center">
            © {new Date().getFullYear()} SICAF
          </div>
        )}
      </aside>

      <main className="flex-1 p-10 overflow-y-auto transition-all duration-300">
        {vista === "inicio" && (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-100 to-gray-200 px-6">
            <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden">

              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600"></div>

              <div className="p-14">

                <div className="flex flex-col items-center text-center">

                  <span className="text-xs tracking-[0.35em] text-gray-400 mb-4">
                   
                  </span>

                  <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
                    Administrador SICAF
                  </h1>

                  <div className="w-20 h-1 bg-indigo-600 rounded-full mb-6"></div>

                  <h2 className="text-lg font-semibold text-gray-700 mb-6">
                    Sistema de Captura de Inventarios Físicos
                  </h2>

                  <p className="text-gray-600 leading-relaxed max-w-2xl">
                    Plataforma centralizada para la gestión, supervisión y control
                    estratégico de los procesos de inventario físico dentro de la organización.
                  </p>

                </div>

                <div className="mt-12 grid grid-cols-2 gap-8 text-center">
                  <div>
                    <p className="text-3xl font-bold text-indigo-600">v1.0</p>
                    <p className="text-xs tracking-wider text-gray-500 mt-1">VERSIÓN DEL SISTEMA</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-800">ÁREA DE TI</p>
                    <p className="text-xs tracking-wider text-gray-500 mt-1">DESARROLLO SAP</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {vista === "usuarios" && <Usuarios />}
        {vista === "control" && <Control />}
        {vista === "mapa" && <Mapa drawerRootId="drawer-root" />}
      </main>

      <div id="drawer-root"></div>
    </div>
  );
}
