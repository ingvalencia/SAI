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
        className={`relative overflow-hidden bg-gradient-to-br from-[#0b0508] via-[#3d0b20] to-[#611232] text-white transition-all duration-300 ease-in-out shadow-2xl flex flex-col
        ${collapsed ? "w-20" : "w-72"}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%)]"></div>

        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <div className="absolute left-[-120px] top-24 w-[320px] h-[320px] border border-white/40 rotate-45"></div>
          <div className="absolute right-[-130px] bottom-20 w-[360px] h-[360px] border border-white/30 rotate-45"></div>
          <div className="absolute left-16 top-44 w-[220px] h-[220px] rounded-full border border-white/25"></div>
        </div>

        <div className="absolute inset-0 opacity-[0.10] pointer-events-none">
          <div className="absolute top-20 left-10 grid grid-cols-6 gap-2">
            {Array.from({ length: 36 }).map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-white"></span>
            ))}
          </div>
        </div>

  <div className="relative z-10 flex flex-col h-full">

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

        </div>
      </aside>

      <main
        className={`flex-1 overflow-y-auto transition-all duration-300
        ${collapsed ? "p-6" : "p-10"}`}
      >

        {vista === "inicio" && (
          <div className="flex items-center justify-center h-full">
            <div className="relative overflow-hidden bg-white rounded-[2rem] shadow-[0_35px_100px_rgba(15,23,42,0.18)] max-w-5xl w-full p-12 text-center border border-gray-100">

              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3d0b20] via-[#611232] to-[#8a1b48]"></div>

              <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#611232]/5 blur-3xl"></div>
              <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-gray-900/5 blur-3xl"></div>

              <div className="relative">
                <div className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-[#3d0b20] via-[#611232] to-[#8a1b48] flex items-center justify-center shadow-[0_20px_45px_rgba(97,18,50,0.35)]">
                  <span className="text-white text-4xl font-black">SICAF</span>
                </div>

                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#611232]/8 text-[#611232] text-xs font-extrabold tracking-[0.22em] uppercase mb-5">
                  Panel administrativo
                </div>

                <h1 className="text-5xl font-black text-gray-950 mb-4 tracking-tight">
                  Administrador SICAF
                </h1>

                <div className="w-24 h-1 bg-gradient-to-r from-[#3d0b20] via-[#611232] to-[#8a1b48] mx-auto mb-7 rounded-full"></div>

                <h2 className="text-xl font-bold text-gray-800 mb-6">
                  Sistema de Captura de Inventarios Físicos
                </h2>

                <p className="text-gray-600 leading-relaxed max-w-3xl mx-auto text-base">
                  Plataforma centralizada para supervisar operaciones de inventario,
                  gestionar capturistas y monitorear el estado de los procesos
                  operativos dentro del sistema SICAF.
                </p>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">

                  <div className="group bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                    <p className="text-3xl font-black text-[#611232]">v1.0</p>
                    <p className="text-xs text-gray-500 mt-2 tracking-[0.18em] font-bold">
                      VERSIÓN DEL SISTEMA
                    </p>
                  </div>

                  <div className="group bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                    <p className="text-sm font-black text-gray-900 tracking-wide">
                      ÁREA DE TI
                    </p>
                    <p className="text-xs text-gray-500 mt-2 tracking-[0.18em] font-bold">
                      DESARROLLO SAP
                    </p>
                  </div>

                  <div className="group bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                    <p className="text-sm font-black text-gray-900 tracking-wide">
                      GRUPO DINIZ
                    </p>
                    <p className="text-xs text-gray-500 mt-2 tracking-[0.18em] font-bold">
                      INVENTARIOS FÍSICOS
                    </p>
                  </div>

                </div>

                <div className="mt-10 pt-6 border-t border-gray-100">
                  <p className="text-xs text-gray-400 tracking-[0.25em] uppercase">
                    Control · Operación · Conciliación SAP
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
