import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [empleado, setEmpleado] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/auth/login.php",
        { empleado, password }
      );

      if (res.data.success) {
        sessionStorage.setItem("empleado", res.data.empleado);
        sessionStorage.setItem("nombre", res.data.nombre);
        sessionStorage.setItem("roles", JSON.stringify(res.data.roles));
        sessionStorage.setItem("token_sesion", res.data.token_sesion);

        const roles = res.data.roles.map((r) => r.id);

        let destino = "";

        if (roles.includes(1) || roles.includes(2) || roles.includes(3)) {
          destino = "/admin";
        } else if (roles.includes(4)) {
          destino = "/captura";
        } else {
          setError("No tienes permisos asignados");
          setLoading(false);
          return;
        }

        setLoading(false);
        setLoginSuccess(true);

        setTimeout(() => {
          navigate(destino, { replace: true });
        }, 1800);

        return;
      } else {
        setError(res.data.error || "Credenciales incorrectas");
      }
    } catch (err) {
      setError("Error de red o servidor");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-[#611232] border-[#611232]/30 rounded-full animate-spin"></div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800">
                Validando credenciales
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Accediendo al sistema SICAF
              </p>
            </div>

            <div className="w-48 h-1 bg-gray-200 rounded overflow-hidden">
              <div className="h-full bg-[#611232] animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {loginSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f0f12]/90 backdrop-blur-md">
          <div className="relative flex flex-col items-center justify-center">
            <div className="absolute w-72 h-72 rounded-full bg-[#611232]/30 blur-3xl animate-pulse"></div>

            <div className="relative bg-white/95 border border-white/30 shadow-2xl rounded-full w-64 h-64 flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute inset-0 rounded-full border-[10px] border-[#611232]/10"></div>
              <div className="absolute inset-3 rounded-full border border-[#611232]/20"></div>

              <img
                src={`${process.env.PUBLIC_URL}/icons/icon-192.png`}
                alt="SICAF"
                className="w-28 h-28 object-contain drop-shadow-xl animate-bounce"
              />

              <div className="mt-4 text-center">
                <h2 className="text-2xl font-extrabold text-[#611232] tracking-wide">
                  SICAF
                </h2>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-[0.25em]">
                  Acceso autorizado
                </p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <h3 className="text-white text-xl font-semibold">
                Bienvenido al sistema
              </h3>
              <p className="text-gray-300 text-sm mt-1">
                Preparando entorno de inventarios
              </p>
            </div>

            <div className="mt-6 w-64 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden md:flex flex-col items-center justify-center bg-gradient-to-br from-[#3d0b20] via-[#611232] to-[#7d163f] text-white px-12 relative">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-md text-center">
          <h1 className="text-6xl font-extrabold tracking-tight mb-6">SICAF</h1>
          <h2 className="text-xl font-semibold mb-4 text-gray-200">
            Sistema de Captura de Inventarios Físicos
          </h2>
          <p className="text-gray-300 leading-relaxed text-sm">
            Plataforma corporativa para la gestión de inventarios físicos,
            diseñada para capturas rápidas, control de conteos y conciliación
            contra SAP en tiempo real.
          </p>
          <div className="mt-10 border-t border-white/20 pt-4 text-xs text-gray-300">
            <p>Versión 1.0</p>
            <p>ÁREA DE TI · DESARROLLO SAP</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-gray-100 px-6 py-10">
        <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-10 border border-gray-200">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
            Iniciar sesión
          </h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-1">
                Número de empleado
              </label>
              <input
                type="text"
                value={empleado}
                onChange={(e) => setEmpleado(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#611232] focus:border-[#611232] text-gray-800 transition"
                placeholder="Ej. 12345"
                required
              />
            </div>

            <div>
              <label className="block text-gray-600 text-sm font-medium mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#611232] focus:border-[#611232] text-gray-800 transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#611232] text-white font-semibold py-3 rounded-lg hover:bg-[#7d163f] transition-all duration-200 shadow-md"
            >
              Entrar al sistema
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-10">
            © {new Date().getFullYear()} SICAF
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
