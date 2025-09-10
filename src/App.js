import { useEffect, useState } from "react";
import {
  Route,
  BrowserRouter as Router,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import CapturaInventario from "./pages/CapturaInventario";
import CompararInventario from "./pages/CompararInventario";
import EnMantenimiento from "./pages/EnMantenimiento";
import Login from "./pages/auth/Login";
import AdminDashboard from "./pages/admin/AdminDashboard"; // nueva vista

function FullscreenLoader({ text = "Verificando acceso al sistema..." }) {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-green-400 font-mono text-xl">
      {text}
    </div>
  );
}

function AppRoutes() {
  const [estadoSistema, setEstadoSistema] = useState(null); // null = cargando
  const empleado = sessionStorage.getItem("empleado");
  const nombre = sessionStorage.getItem("nombre");
  const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
  const isAdmin = roles.some((r) => r.id === 4); // validar si tiene rol admin
  const location = useLocation();

  // Verifica sistema solo si hay sesión
  useEffect(() => {
    const run = async () => {
      if (!empleado) {
        setEstadoSistema({ habilitado: 0, modo_forzado: false });
        return;
      }
      try {
        const res = await fetch(
          `https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/verifica_estado_sistema.php?empleado=${empleado}`
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setEstadoSistema(data);
      } catch {
        sessionStorage.clear();
        setEstadoSistema({ habilitado: 0, modo_forzado: false });
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleado]);

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/login";
  };

  // Guard para rutas privadas
  const RequireAuth = ({ children }) => {
    if (!empleado) return <Navigate to="/login" replace />;
    if (estadoSistema === null) return <FullscreenLoader />;
    const { habilitado, modo_forzado } = estadoSistema;
    const bloqueado = habilitado === 0 && !modo_forzado;
    if (bloqueado) return <EnMantenimiento />;
    return children;
  };

  const { modo_forzado } = estadoSistema || {};

  return (
    <>
      {/* Encabezado visible excepto en /login */}
      {location.pathname !== "/login" && (
        <div className="flex justify-between items-center bg-gray-800 text-white px-4 py-2">
          <span>
            Usuario: <strong>{nombre || "Sin nombre"}</strong> ({empleado || "—"})
          </span>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm font-semibold"
          >
            Cerrar sesión
          </button>
        </div>
      )}

      {modo_forzado && location.pathname !== "/login" && (
        <div className="bg-yellow-900 text-yellow-300 px-4 py-2 font-mono text-xs text-center border-b border-yellow-700">
          ⚠ Acceso de desarrollador. Sistema en mantenimiento para otros usuarios.
        </div>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              {isAdmin ? <AdminDashboard /> : <CapturaInventario />}
            </RequireAuth>
          }
        />

        <Route
          path="/comparar"
          element={
            <RequireAuth>
              <CompararInventario />
            </RequireAuth>
          }
        />

        {/* Ruta directa para admin */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminDashboard />
            </RequireAuth>
          }
        />

        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to={empleado ? "/" : "/login"} replace />}
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
