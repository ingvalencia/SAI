import { useState } from "react";
import Usuarios from "./Usuarios";


export default function AdminDashboard() {
  const [vista, setVista] = useState("inicio");

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-red-900 text-white flex flex-col shadow-lg">
        <h2 className="text-lg font-semibold p-4 border-b border-red-700 tracking-wide">
          Administración de Inventarios
        </h2>
        <nav className="flex-1 p-3 space-y-2">
          <button
            onClick={() => setVista("usuarios")}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm tracking-wide transition-all duration-200
              ${
                vista === "usuarios"
                  ? "bg-red-700 text-white font-medium shadow-sm"
                  : "text-red-100 hover:bg-red-800 hover:text-white"
              }`}
          >
            <span className="text-lg">👥</span>
            <span>Usuarios y permisos</span>
          </button>

          <button
            onClick={() => setVista("reportes")}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm tracking-wide transition-all duration-200
              ${
                vista === "reportes"
                  ? "bg-red-700 text-white font-medium shadow-sm"
                  : "text-red-100 hover:bg-red-800 hover:text-white"
              }`}
          >
            <span className="text-lg">📊</span>
            <span>Reportes</span>
          </button>

        </nav>
        <div className="p-4 border-t border-red-700 text-xs text-red-200">
          © {new Date().getFullYear()} SAI
        </div>
      </aside>

      {/* Contenido dinámico */}
      <main className="flex-1 p-8 overflow-y-auto">
        {vista === "inicio" && (
          <div className="text-center mt-20">
            <h1 className="text-3xl font-extrabold text-gray-800 mb-3">
              Bienvenido al Administrador
            </h1>
            <p className="text-gray-600 text-lg">
              Selecciona una opción del menú para comenzar a gestionar el sistema.
            </p>
          </div>
        )}
        {vista === "usuarios" && <Usuarios />}
        {vista === "reportes" && (
          <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
            <h2 className="text-xl font-semibold text-red-800 mb-4">
              Reportes del sistema
            </h2>
            <p className="text-gray-600">Módulo en construcción.</p>
          </div>
        )}
      </main>
    </div>

  );
}
