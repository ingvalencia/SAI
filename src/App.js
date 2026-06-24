import { useEffect, useState, useRef } from "react";
import {
  Route,
  Routes,
  Navigate,
  useLocation,
  HashRouter
} from "react-router-dom";
import Swal from "sweetalert2";

import RutaProtegida from "./pages/RutaProtegida";
import CapturaInventario from "./pages/CapturaInventario";
import CompararInventario from "./pages/CompararInventario";
import EnMantenimiento from "./pages/EnMantenimiento";
import Login from "./pages/auth/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ObservacionesProyecto from "./pages/ObservacionesProyecto";
import EstadisticasObservaciones from "./pages/EstadisticasObservaciones";

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
  const [estadoSistema, setEstadoSistema] = useState(null);
  const [errorVerificacionSistema, setErrorVerificacionSistema] = useState("");

  const empleado = sessionStorage.getItem("empleado");
  const nombre = sessionStorage.getItem("nombre");

  let roles = [];
  try {
    roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
  } catch {
    roles = [];
  }

  const tokenSesion = sessionStorage.getItem("token_sesion");
  const location = useLocation();
  const sesionCerradaRef = useRef(false);

  const rutasPublicas = ["/login", "/observaciones"];
  const mostrarBarraUsuario = !rutasPublicas.includes(location.pathname);

  useEffect(() => {
    let cancelado = false;

    const run = async () => {
      if (!empleado) {
        if (!cancelado) {
          setEstadoSistema({
            habilitado: 1,
            modo_forzado: false
          });
        }
        return;
      }

      try {
        const res = await fetch(
          `https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/verifica_estado_sistema.php?empleado=${encodeURIComponent(empleado)}`
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (!data || data.success !== true) {
          throw new Error(data?.error || "Respuesta inválida del servidor");
        }

        if (!cancelado) {
          setEstadoSistema({
            habilitado: Number(data.habilitado),
            modo_forzado: Boolean(data.modo_forzado)
          });
          setErrorVerificacionSistema("");
        }
      } catch (error) {
        if (!cancelado) {
          setEstadoSistema({
            habilitado: 1,
            modo_forzado: false
          });
          setErrorVerificacionSistema(error.message || "No se pudo validar el estado del sistema");
        }
      }
    };

    run();

    return () => {
      cancelado = true;
    };
  }, [empleado]);

  useEffect(() => {
    if (!empleado || !tokenSesion || rutasPublicas.includes(location.pathname)) return;

    const validarSesion = async () => {
      if (sesionCerradaRef.current) return;

      try {
        const res = await fetch(
          "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/auth/validar_sesion.php",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
              empleado: empleado,
              token_sesion: tokenSesion
            })
          }
        );

        const data = await res.json();

        if (!data.success || !data.sesion_valida) {
          sesionCerradaRef.current = true;

          sessionStorage.clear();

          await Swal.fire({
            title: "Conteo finalizado",
            text: "Tu cuenta fue abierta en otro dispositivo.",
            icon: "warning",
            confirmButtonText: "Aceptar",
            allowOutsideClick: false
          });

          window.location.href = "/diniz/inventarios/#/login";
        }
      } catch (error) {
        console.error("Error al validar sesión:", error.message);
      }
    };

    validarSesion();

    const intervalo = setInterval(() => {
      validarSesion();
    }, 15000);

    return () => clearInterval(intervalo);
  }, [empleado, tokenSesion, location.pathname]);

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/diniz/inventarios/#/login";
  };

  const RequireAuth = ({ children }) => {
    if (!empleado) return <Navigate to="/login" replace />;

    if (estadoSistema === null) {
      return <FullscreenLoader />;
    }

    const { habilitado, modo_forzado } = estadoSistema;
    const bloqueado = Number(habilitado) === 0 && !modo_forzado;

    if (bloqueado) return <EnMantenimiento />;

    return children;
  };

  const modo_forzado = estadoSistema?.modo_forzado || false;

  if (estadoSistema === null && !rutasPublicas.includes(location.pathname)) {
    return <FullscreenLoader />;
  }

  return (
    <>
      {mostrarBarraUsuario && (
        <div className="relative overflow-hidden flex flex-col md:flex-row md:justify-between md:items-center gap-2 bg-gradient-to-r from-[#0b0508] via-[#3d0b20] to-[#611232] text-white px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)] border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(255,255,255,0.08),transparent_35%)]"></div>

          <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
            <div className="absolute left-10 top-[-60px] w-40 h-40 border border-white/40 rotate-45"></div>
            <div className="absolute right-40 top-[-80px] w-52 h-52 border border-white/20 rotate-45"></div>
          </div>

          <div className="relative z-10 text-sm md:text-base tracking-wide">
            Usuario:{" "}
            <strong className="font-extrabold">
              {nombre || "Sin nombre"}
            </strong>{" "}
            <span className="text-white/80">({empleado || "—"})</span>
          </div>

          <button
            onClick={handleLogout}
            className="relative z-10 bg-white/95 text-[#611232] hover:bg-white px-4 py-1.5 rounded-lg text-sm font-bold transition shadow-md hover:shadow-lg"
          >
            Cerrar sesión
          </button>
        </div>
      )}

      {modo_forzado && mostrarBarraUsuario && (
        <div className="bg-yellow-900 text-yellow-300 px-4 py-2 text-xs text-center border-b border-yellow-700">
          ⚠ Acceso de desarrollador. Sistema en mantenimiento para otros usuarios.
        </div>
      )}

      {errorVerificacionSistema && mostrarBarraUsuario && (
        <div className="bg-red-900 text-red-200 px-4 py-2 text-xs text-center border-b border-red-700">
          ⚠ No se pudo validar el estado de mantenimiento. Se permite acceso operativo. Detalle: {errorVerificacionSistema}
        </div>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/observaciones" element={<ObservacionesProyecto />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              {roles.some((r) => [1, 2, 3].includes(Number(r.id ?? r))) ? (
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
          path="/observaciones/estadisticas"
          element={
            <RequireAuth>
              <RutaProtegida permitidos={[1, 2]}>
                <EstadisticasObservaciones />
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
