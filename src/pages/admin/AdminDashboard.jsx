import { useState } from "react";
import Usuarios from "./Usuarios";
import Control from "./Control";
import Mapa from "./Mapa";

export default function AdminDashboard() {
  const [vista, setVista] = useState("inicio");
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: "usuarios", label: "Usuarios y permisos", icon: "👥" },
    { id: "control", label: "Control de operaciones", icon: "⚙️" },
    { id: "mapa", label: "Mapa de operaciones", icon: "🗺️" },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      <aside
        className={`bg-[#611232] text-white transition-all duration-300 ease-in-out shadow-2xl flex flex-col
        ${collapsed ? "w-20" : "w-72"}`}
      >

        <div className="flex items-center justify-between px-4 h-16 border-b border-white/20">

          {!collapsed && (
            <div>
              <h2 className="text-lg font-bold tracking-wide">SICAF</h2>
              <p className="text-xs text-white/70">Administrador</p>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="relative w-10 h-10 flex items-center justify-center group"
          >
            <div className="w-6 flex flex-col gap-1">
              <span
                className={`block h-0.5 bg-white transition-all duration-300
                ${collapsed ? "rotate-45 translate-y-1.5" : ""}`}
              ></span>

              <span
                className={`block h-0.5 bg-white transition-all duration-300
                ${collapsed ? "opacity-0" : ""}`}
              ></span>

              <span
                className={`block h-0.5 bg-white transition-all duration-300
                ${collapsed ? "-rotate-45 -translate-y-1.5" : ""}`}
              ></span>
            </div>
          </button>

        </div>

        <nav className="mt-6 flex-1 px-2 space-y-2">

          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setVista(item.id)}
              className={`group flex items-center gap-4 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${
                vista === item.id
                  ? "bg-white text-[#611232] shadow-lg"
                  : "hover:bg-white/10 text-white/90"
              }`}
            >

              <span className="text-xl">{item.icon}</span>

              {!collapsed && (
                <span className="whitespace-nowrap">
                  {item.label}
                </span>
              )}

              {collapsed && (
                <span className="absolute left-20 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                  {item.label}
                </span>
              )}

            </button>
          ))}

        </nav>

        {!collapsed && (
          <div className="p-4 border-t border-white/20 text-xs text-white/70 text-center">
            © {new Date().getFullYear()} SICAF
          </div>
        )}

      </aside>

      <main
        className={`flex-1 overflow-y-auto transition-all duration-300
        ${collapsed ? "p-6" : "p-10"}`}
      >

        {vista === "inicio" && (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-12 text-center">

              <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
                Administrador SICAF
              </h1>

              <div className="w-20 h-1 bg-[#611232] mx-auto mb-6 rounded-full"></div>

              <h2 className="text-lg font-semibold text-gray-700 mb-6">
                Sistema de Captura de Inventarios Físicos
              </h2>

              <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
                Plataforma centralizada para supervisar operaciones de inventario,
                gestionar capturistas y monitorear el estado de los procesos
                operativos dentro del sistema SICAF.
              </p>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-center">

                <div className="bg-gray-50 rounded-xl p-6">
                  <p className="text-3xl font-bold text-[#611232]">v1.0</p>
                  <p className="text-xs text-gray-500 mt-1 tracking-wider">
                    VERSIÓN DEL SISTEMA
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <p className="text-sm font-semibold text-gray-800">
                    ÁREA DE TI
                  </p>
                  <p className="text-xs text-gray-500 mt-1 tracking-wider">
                    DESARROLLO SAP
                  </p>
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
