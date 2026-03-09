import { useEffect, useState, useRef } from "react";
import {
  Route,
  Routes,
  Navigate,
  useLocation,
  HashRouter
} from "react-router-dom";

import RutaProtegida from "./pages/RutaProtegida";
import CapturaInventario from "./pages/CapturaInventario";
import CompararInventario from "./pages/CompararInventario";
import EnMantenimiento from "./pages/EnMantenimiento";
import Login from "./pages/auth/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";

function FullscreenLoader({ text = "Verificando acceso al sistema..." }) {
  return (
    <div className="flex items-center justify-center h-screen bg-[#611232] text-white text-xl font-semibold">
      <div className="flex flex-col items-center gap-6">

        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-white border-white/40 rounded-full animate-spin"></div>
        </div>

        <p className="tracking-wide">{text}</p>

        <div className="w-48 h-1 bg-white/20 rounded overflow-hidden">
          <div className="h-full bg-white animate-pulse"></div>
        </div>

      </div>
    </div>
  );
}

function AppRoutes() {
  const [estadoSistema, setEstadoSistema] = useState({
    habilitado: 1,
    modo_forzado: false,
  });

  const empleado = sessionStorage.getItem("empleado");
  const nombre = sessionStorage.getItem("nombre");
  const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
  const location = useLocation();

  const yaVerificado = useRef(false);

  useEffect(() => {
    if (yaVerificado.current) return;
    yaVerificado.current = true;

    let cancelado = false;

    const run = async () => {
      if (!empleado) {
        setEstadoSistema({ habilitado: 1, modo_forzado: false });
        return;
      }

      try {
        const res = await fetch(
          `https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/verifica_estado_sistema.php?empleado=${empleado}`
        );
        const data = await res.json();
        if (!data?.success) throw new Error();
        if (!cancelado) setEstadoSistema(data);
      } catch {
        if (!cancelado) {
          setEstadoSistema({ habilitado: 1, modo_forzado: false });
        }
      }
    };

    run();

    return () => {
      cancelado = true;
    };
  }, [empleado]);

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/diniz/inventarios/#/login";
  };

  const RequireAuth = ({ children }) => {
    if (!empleado) return <Navigate to="/login" replace />;
    if (!estadoSistema && empleado) return <FullscreenLoader />;

    const { habilitado, modo_forzado } = estadoSistema;
    if (habilitado === 0 && !modo_forzado) return <EnMantenimiento />;

    return children;
  };

  const { modo_forzado } = estadoSistema || {};

  return (
    <>
      {location.pathname !== "/login" && (
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 bg-[#611232] text-white px-4 py-3 shadow">

          <div className="text-sm md:text-base">
            Usuario: <strong>{nombre || "Sin nombre"}</strong> ({empleado || "—"})
          </div>

          <button
            onClick={handleLogout}
            className="bg-white text-[#611232] hover:bg-gray-200 px-3 py-1 rounded text-sm font-semibold transition"
          >
            Cerrar sesión
          </button>

        </div>
      )}

      {modo_forzado && location.pathname !== "/login" && (
        <div className="bg-yellow-900 text-yellow-300 px-4 py-2 text-xs text-center border-b border-yellow-700">
          ⚠ Acceso de desarrollador. Sistema en mantenimiento para otros usuarios.
        </div>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              {roles.some((r) => [1, 2, 3].includes(r.id)) ? (
                <Navigate to="/admin" replace />
              ) : (
                <Navigate to="/captura" replace />
              )}
            </RequireAuth>
          }
        />

        <Route
          path="/captura"
          element={
            <RequireAuth>
              <RutaProtegida permitidos={[4]}>
                <CapturaInventario />
              </RutaProtegida>
            </RequireAuth>
          }
        />

        <Route
          path="/comparar"
          element={
            <RequireAuth>
              <RutaProtegida permitidos={[4]}>
                <CompararInventario />
              </RutaProtegida>
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RutaProtegida permitidos={[1, 2, 3]}>
                <AdminDashboard />
              </RutaProtegida>
            </RequireAuth>
          }
        />

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
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
