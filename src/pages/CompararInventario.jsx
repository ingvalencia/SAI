import React, { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

export default function CompararInventario() {
  const location = useLocation();
  const navigate = useNavigate();
  const { almacen, fecha, empleado } = location.state || {};

  const [datos, setDatos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [diferenciaConfirmada, setDiferenciaConfirmada] = useState(false);


  const exportarExcel = () => {
    const datosExportar = datos.map((item, i) => ({
      "#": i + 1,
      Código: item.codigo,
      Nombre: item.nombre,
      SAP: item.inventario_sap,
      Físico: item.cant_invfis,
      Diferencia: item.diferencia,
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Diferencias");

    XLSX.writeFile(workbook, `comparacion_${almacen}_${fecha}.xlsx`);
  };

  useEffect(() => {
    if (!almacen || !fecha || !empleado) {
      navigate("/");
      return;
    }

    const obtenerComparacion = async () => {
        try {
          const res = await axios.get(
            "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/comparar_inventarios.php",
            { params: { almacen, fecha, usuario: empleado } }
          );

          if (!res.data.success) throw new Error(res.data.error);
          setDatos(res.data.data);


          if (res.data.estatus === 2) {
            setDiferenciaConfirmada(true);
          }

        } catch (error) {
          console.error("Error al obtener diferencias", error.message);
        } finally {
          setLoading(false);
        }
      };

      obtenerComparacion();
    }, [almacen, fecha, empleado, navigate]);

    if (loading) return <p className="text-center mt-10 text-gray-600">Cargando diferencias...</p>;

    const confirmarDiferencia = async () => {
  const resultado = await Swal.fire({
    title: "¿Confirmar diferencias?",
    text: "¿Deseas confirmar las diferencias proporcionadas?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, confirmar",
    cancelButtonText: "No estoy de acuerdo",
  });

  if (!resultado.isConfirmed) {
    Swal.fire("Cancelado", "Debe completar el proceso para continuar.", "info");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("almacen", almacen);
    formData.append("fecha", fecha);
    formData.append("empleado", empleado);

    const res = await axios.post(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/confirmar_diferencia.php",
      formData
    );

    if (!res.data.success) throw new Error(res.data.error);

    Swal.fire("¡Hecho!", "Las diferencias han sido confirmadas.", "success");
    setDiferenciaConfirmada(true);
  } catch (error) {
    Swal.fire("Error", error.message, "error");
  }
};



  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 flex items-center gap-2">
        Comparación de Inventarios
      </h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por código o nombre"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

      </div>

      <div className="relative overflow-auto max-h-[70vh] border rounded-lg shadow-md">

        <table className="min-w-full text-sm table-auto">
          <thead className="sticky top-0 bg-gradient-to-r from-blue-100 via-white to-blue-100 text-gray-800 text-xs uppercase tracking-wider shadow-md z-10">
            <tr>
              <th className="p-3 text-left w-10">#</th>
              <th className="p-3 text-left">Código</th>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-right">SAP</th>
              <th className="p-3 text-right">Físico</th>
              <th className="p-3 text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {datos
              .filter(
                (item) =>
                  item.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
                  item.nombre.toLowerCase().includes(busqueda.toLowerCase())
              )
              .map((item, i) => (
                <tr key={i} className="hover:bg-blue-50 transition duration-150 ease-in-out">
                  <td className="p-3 text-sm text-gray-500 font-semibold whitespace-nowrap">{i + 1}</td>
                  <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.codigo}</td>
                  <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.nombre}</td>
                  <td className="p-3 text-sm text-right text-gray-700">{item.inventario_sap.toFixed(2)}</td>
                  <td className="p-3 text-sm text-right text-gray-700">{item.cant_invfis.toFixed(2)}</td>
                  <td
                    className={`p-3 text-sm text-right font-semibold ${
                      item.diferencia === 0 ? "text-green-600" : item.diferencia > 0 ? "text-yellow-600" : "text-red-600"
                    }`}
                  >
                    {item.diferencia.toFixed(2)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {diferenciaConfirmada && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
            <div className="text-[5rem] font-bold text-gray-600 opacity-20 rotate-[-20deg]">
              Proceso completado
            </div>
          </div>
        )}

      </div>

      <div className="mt-6 flex flex-wrap gap-4 justify-between items-center relative">
  <button
    onClick={exportarExcel}
    className="px-4 py-2 bg-green-300 hover:bg-green-400 text-green-900 font-semibold rounded flex items-center gap-2 shadow"
  >
    <img src="https://img.icons8.com/color/24/microsoft-excel-2019.png" alt="excel" />
    Exportar a Excel
  </button>

  {!diferenciaConfirmada && (
    <button
      onClick={confirmarDiferencia}
      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded shadow"
    >
      Confirmar diferencia
    </button>
  )}

  <button
    onClick={() => navigate("/")}
    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded"
  >
    Volver
  </button>

  {diferenciaConfirmada && (
    <div className="absolute top-10 right-0 text-5xl text-gray-300 opacity-10 select-none pointer-events-none transform rotate-[-30deg]">
      Proceso completado
    </div>
  )}
</div>


    </div>
  );
}
