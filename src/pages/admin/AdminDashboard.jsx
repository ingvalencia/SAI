import { useState } from "react";
import Usuarios from "./Usuarios";
import Control from "./Control";
import Mapa from "./Mapa";

export default function AdminDashboard() {
  const [vista, setVista] = useState("inicio");

  const menuItems = [
    { id: "usuarios", label: "Usuarios y permisos", icon: "👥" },
    { id: "control", label: "Control de operaciones", icon: "⚙️" },
    { id: "mapa", label: "Mapa de operaciones", icon: "🗺️" },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-red-900 to-red-700 text-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-red-600">
          <h2 className="text-xl font-bold tracking-wide">SICAF</h2>
          <p className="text-xs text-red-200">Administrador</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setVista(item.id)}
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

      {/* Contenido dinámico */}
      <main className="flex-1 p-10 overflow-y-auto">
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
        {vista === "mapa" && <Mapa />}
      </main>
    </div>
  );
}
