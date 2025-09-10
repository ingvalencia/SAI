import { useEffect, useState } from "react";
import { Route, BrowserRouter as Router, Routes, useNavigate } from "react-router-dom";
import CapturaInventario from "./pages/CapturaInventario";
import CompararInventario from "./pages/CompararInventario";
import EnMantenimiento from "./pages/EnMantenimiento";
import Login from "./pages/auth/Login";

const AppRoutes = () => {
  const [estadoSistema, setEstadoSistema] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const verificarSesion = async () => {
      const empleado = sessionStorage.getItem("empleado");
      const nombre = sessionStorage.getItem("nombre");
      const roles = sessionStorage.getItem("roles");

      if (!empleado || !nombre || !roles) {
        navigate("/login");
        return;
      }

      verificarSistema(empleado);
    };

    const verificarSistema = async (empleado) => {
      try {
        const res = await fetch(
          `https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/verifica_estado_sistema.php?empleado=${empleado}`
        );
        const data = await res.json();

        if (!data.success) throw new Error(data.error);
        setEstadoSistema(data);
      } catch (error) {
        setEstadoSistema({ habilitado: 0, modo_forzado: false });
      }
    };

    verificarSesion();
  }, [navigate]);

  if (estadoSistema === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-green-400 font-mono text-xl">
        Verificando acceso al sistema...
      </div>
    );
  }

  const { habilitado, modo_forzado } = estadoSistema;
  const bloqueado = habilitado === 0 && !modo_forzado;

  return (
    <>
      {modo_forzado && (
        <div className="bg-yellow-900 text-yellow-300 px-4 py-2 font-mono text-xs text-center border-b border-yellow-700">
          ⚠ Estás accediendo como desarrollador. El sistema está en mantenimiento para otros usuarios.
        </div>
      )}

      <Routes>
        <Route path="/" element={bloqueado ? <EnMantenimiento /> : <CapturaInventario />} />
        <Route path="/comparar" element={bloqueado ? <EnMantenimiento /> : <CompararInventario />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </>
  );
};

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
