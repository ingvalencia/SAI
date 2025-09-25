import { useState } from "react";
import Usuarios from "./Usuarios";
// futuros módulos
// import Roles from "./Roles";
// import Locales from "./Locales";
// import Reportes from "./Reportes";

export default function AdminDashboard() {
  const [vista, setVista] = useState("inicio");

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <h2 className="text-xl font-bold p-4 border-b border-gray-700">
          Administración del Sistema de Inventarios
        </h2>
        <nav className="flex-1 p-2 space-y-2">
          <button
            onClick={() => setVista("usuarios")}
            className={`w-full text-left px-3 py-2 rounded ${
              vista === "usuarios" ? "bg-gray-700" : "hover:bg-gray-700"
            }`}
          >
            👥 Usuarios y permisos
          </button>
          
          <button
            onClick={() => setVista("reportes")}
            className={`w-full text-left px-3 py-2 rounded ${
              vista === "reportes" ? "bg-gray-700" : "hover:bg-gray-700"
            }`}
          >
            📊 Reportes
          </button>
        </nav>
      </aside>

      {/* Contenido dinámico */}
      <main className="flex-1 p-6 overflow-y-auto">
        {vista === "inicio" && (
          <div className="text-center mt-20">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Bienvenido al Administrador</h1>
            <p className="text-gray-600 text-lg">
              Selecciona una opción del menú para comenzar a gestionar el sistema.
            </p>
          </div>
        )}
        {vista === "usuarios" && <Usuarios />}
        {vista === "roles" && <div>Gestión de roles (pendiente)</div>}
        {vista === "locales" && <div>Gestión de locales (pendiente)</div>}
        {vista === "reportes" && <div>Reportes del sistema (pendiente)</div>}
      </main>
    </div>
  );
}
