import { useState } from "react";
import Usuarios from "./Usuarios";
import Control from "./Control";
import Mapa from "./Mapa";

export default function AdminDashboard() {
  const [vista, setVista] = useState("inicio");
  const [menuAbierto, setMenuAbierto] = useState(false);

  const menuItems = [
    { id: "usuarios", label: "Usuarios y permisos", icon: "👥" },
    { id: "control", label: "Control de operaciones", icon: "⚙️" },
    { id: "mapa", label: "Mapa de operaciones", icon: "🗺️" },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans relative overflow-hidden">


      <button
        className="lg:hidden fixed top-4 left-4 z-[60] bg-white p-2 rounded-md shadow-md border border-red-700"
        onClick={() => setMenuAbierto(!menuAbierto)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-red-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {menuAbierto ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      <aside
        className={`fixed lg:static top-0 left-0 h-full w-72 bg-gradient-to-b from-red-900 to-red-700 text-white flex flex-col shadow-2xl transform transition-transform duration-300 z-50
        ${menuAbierto ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      >
        <div className="p-6 border-b border-red-600 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold tracking-wide">SICAF</h2>
            <p className="text-xs text-red-200">Administrador</p>
          </div>
          <button
            className="lg:hidden text-red-200 hover:text-white text-xl"
            onClick={() => setMenuAbierto(false)}
          >
            ✕
          </button>
        </div>


        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setVista(item.id);
                setMenuAbierto(false);
              }}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300
                ${
                  vista === item.id
                    ? "bg-red-600 shadow-lg scale-105"
                    : "hover:bg-red-800 text-red-100"
                }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-red-600 text-xs text-red-200 text-center">
          © {new Date().getFullYear()} SICAF
        </div>
      </aside>


      {menuAbierto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMenuAbierto(false)}
        ></div>
      )}


      <main className="flex-1 p-10 overflow-y-auto transition-all duration-300 z-0">
        {vista === "inicio" && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-white shadow-xl rounded-2xl p-12 max-w-2xl text-center">
              <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
                Bienvenido al Administrador
              </h1>
              <h2 className="text-2xl font-semibold text-indigo-600 mb-6">
                Sistema de Captura de Inventarios Físicos{" "}
                <span className="font-bold">SICAF</span>
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                Selecciona una opción del menú para comenzar a gestionar el sistema.
              </p>
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
