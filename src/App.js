import { useEffect, useState } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import CapturaInventario from "./pages/CapturaInventario";
import CompararInventario from "./pages/CompararInventario";
import EnMantenimiento from "./pages/EnMantenimiento";

export default function App() {
  const [estadoSistema, setEstadoSistema] = useState(null);

  // Asignar empleado directamente (modo desarrollo)
  const EMPLEADO_FORZADO = "1648";
  localStorage.setItem("empleado", EMPLEADO_FORZADO);

  useEffect(() => {
    const empleado = localStorage.getItem("empleado");

    if (!empleado) {
      setEstadoSistema({ habilitado: 0, modo_forzado: false });
      return;
    }

    const verificarSistema = async () => {
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

    verificarSistema();
  }, []);

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
    <Router>
      {modo_forzado && (
        <div className="bg-yellow-900 text-yellow-300 px-4 py-2 font-mono text-xs text-center border-b border-yellow-700">
          ⚠ Estás accediendo como desarrollador. El sistema está en mantenimiento para otros usuarios.
        </div>
      )}

      <Routes>
        <Route path="/" element={bloqueado ? <EnMantenimiento /> : <CapturaInventario />} />
        <Route path="/comparar" element={bloqueado ? <EnMantenimiento /> : <CompararInventario />} />
      </Routes>
    </Router>
  );
}
