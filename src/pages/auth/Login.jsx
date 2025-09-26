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

        const roles = res.data.roles.map(r => r.id);

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
      {/* Panel izquierdo */}
      <div className="hidden md:flex flex-col items-center justify-center bg-red-700 text-white px-10">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold mb-4">Bienvenido</h1>
          <p className="text-lg opacity-90">
            Accede al sistema de inventarios de Diniz y gestiona tu información
            de forma segura.
          </p>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white shadow-lg rounded-xl w-full max-w-sm p-8 border border-gray-200">
          <h2 className="text-2xl font-semibold text-center text-gray-800 mb-6">
            Iniciar sesión
          </h2>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-gray-600 text-sm mb-1">Empleado</label>
              <input
                type="text"
                value={empleado}
                onChange={(e) => setEmpleado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                transition text-gray-800"
                placeholder="Número de empleado"
                required
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                transition text-gray-800"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 text-center">{error}</div>
            )}
            <button
              type="submit"
              className="w-full bg-red-700 text-white font-medium py-2 rounded-lg
              hover:bg-red-800 transition"
            >
              Entrar
            </button>
          </form>
          <p className="text-center text-xs text-gray-500 mt-6">
            © {new Date().getFullYear()} Diniz
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
