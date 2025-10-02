import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [empleado, setEmpleado] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/auth/login.php",
        { empleado, password }
      );

      if (res.data.success) {
        sessionStorage.setItem("empleado", res.data.empleado);
        sessionStorage.setItem("nombre", res.data.nombre);
        sessionStorage.setItem("roles", JSON.stringify(res.data.roles));

        const roles = res.data.roles.map((r) => r.id);

        if (roles.includes(1) || roles.includes(2) || roles.includes(3)) {
          navigate("/admin");
        } else if (roles.includes(4)) {
          navigate("/captura");
        } else {
          setError("No tienes permisos asignados");
        }
      } else {
        setError(res.data.error || "Credenciales incorrectas");
      }
    } catch (err) {
      setError("Error de red o servidor");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Panel izquierdo (desktop) */}
      <div className="hidden md:flex flex-col items-center justify-center bg-gradient-to-b from-red-800 to-red-600 text-white px-10">
        <div className="max-w-md text-center">
          <h1 className="text-5xl font-extrabold mb-6 tracking-tight">SICAF</h1>
          <h2 className="text-xl font-semibold mb-4">
            Sistema de Captura de Inventarios Físicos
          </h2>
          <p className="text-base opacity-90 leading-relaxed">
            Ingresa al sistema web-móvil para gestionar tus conteos de inventario de forma
            rápida, segura y centralizada.
          </p>
        </div>
      </div>

      {/* Panel derecho (login) */}
      <div className="flex items-center justify-center bg-gray-50 px-6 py-10">
        <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 border border-gray-200">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600
                text-gray-800 transition"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600
                text-gray-800 transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center font-medium">{error}</div>
            )}

            <button
              type="submit"
              className="w-full bg-red-700 text-white font-semibold py-3 rounded-lg
              hover:bg-red-800 transition-all duration-200 shadow-md"
            >
              Entrar
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-8">
            © {new Date().getFullYear()} SICAF
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
