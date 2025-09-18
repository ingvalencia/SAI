import React, { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

export default function CompararInventario() {
  const location = useLocation();
  const navigate = useNavigate();
  const { almacen, fecha, cia } = location.state || {};


  const [datos, setDatos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [diferenciaConfirmada, setDiferenciaConfirmada] = useState(false);
  const empleado = sessionStorage.getItem("empleado");

 const { estatus: estatusRuta } = location.state || {};
 const [estatus, setEstatus] = useState(estatusRuta || 1);




  const exportarExcel = () => {
  const datosExportar = datos.map((item, i) => {
    const fila = {
      "#": i + 1,
      "No Empleado": item.usuario,
      "Almacén": item.almacen,
      "CIA": item.cias,
      "Código": item.codigo,
      "Nombre": item.nombre,
      "Código de Barras": item.codebars,
      "Captura SAP": item.inventario_sap,
      "Diferencia": item.diferencia,
    };

    if (estatus >= 1) fila["Conteo 1"] = item.conteo1 ?? 0;
    if (estatus >= 2) fila["Conteo 2"] = item.conteo2 ?? 0;
    if (estatus >= 3) fila["Conteo 3"] = item.conteo3 ?? 0;

    return fila;
  });

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

    // Solo hacer la llamada si los datos aún no han sido cargados
    if (datos.length === 0) {
      const obtenerComparacion = async () => {
        try {
          const res = await axios.get(
            "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/comparar_inventarios.php",
            { params: { almacen, fecha, usuario: empleado, cia } }
          );

          if (!res.data.success) throw new Error(res.data.error);
          setDatos(res.data.data);
          setEstatus(res.data.estatus || 1);


         if (res.data.estatus === 4) {
            setDiferenciaConfirmada(true);
          }

        } catch (error) {
          console.error("Error al obtener diferencias", error.message);
        } finally {
          setLoading(false);
        }
      };

      obtenerComparacion();
    }
  }, [almacen, fecha, empleado, navigate, datos.length]);

  // Mostrar loading si aún no termina
  if (loading) return <p className="text-center mt-10 text-gray-600">Cargando diferencias...</p>;

  // Función para confirmar diferencias
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
        {`Comparación de Inventarios - ${
          estatus === 1
            ? "Primer Conteo"
            : estatus === 2
            ? "Segundo Conteo"
            : estatus === 3
            ? "Tercer Conteo"
            : estatus === 4
            ? "Diferencia Confirmada"
            : "Sin Estatus"
        }`}
      </h1>

      <div className="flex items-center gap-2 mb-4">
        {["Primer Conteo", "Segundo Conteo", "Tercer Conteo"].map((label, index) => {
          const conteoNumero = index + 1;
          const activo = estatus === conteoNumero;

          return (
            <button
              key={label}
              onClick={async () => {
                if (conteoNumero === 1) {
                  // No redirijas si ya estás en estatus 1
                  if (estatus !== 1) {
                    navigate("/captura", {
                      state: { almacen, fecha, cia, estatus: 1 },
                    });
                  }
                }

                else if (conteoNumero === 2) {
                  if (estatus === 1) {
                    const confirm = await Swal.fire({
                      title: "¿Iniciar segundo conteo?",
                      text: "¿Estás seguro de avanzar al segundo conteo?",
                      icon: "question",
                      showCancelButton: true,
                      confirmButtonText: "Sí",
                      cancelButtonText: "Cancelar",
                    });

                    if (!confirm.isConfirmed) return;

                    // 🔁 ACTUALIZAR ESTATUS EN BACKEND
                    try {
                      const formData = new FormData();
                      formData.append("almacen", almacen);
                      formData.append("fecha", fecha);
                      formData.append("empleado", empleado);
                      formData.append("estatus", 2);

                      await axios.post("/actualizar_estatus.php", formData);



                      // Redirigir a Captura con estatus 2
                      navigate("/captura", {
                        state: { almacen, fecha, cia, estatus: 2 },
                      });
                    } catch (error) {
                      console.error("Error al actualizar estatus", error);
                      Swal.fire("Error", "No se pudo actualizar el estatus. Revisa la consola.", "error");
                    }

                  }
                }

                else if (conteoNumero === 3) {
                  if (estatus !== 2) {
                    Swal.fire("No permitido", "Debes completar el segundo conteo primero.", "warning");
                    return;
                  }

                  const confirm = await Swal.fire({
                    title: "¿Iniciar tercer conteo?",
                    text: "¿Estás seguro de avanzar al tercer conteo?",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sí",
                    cancelButtonText: "Cancelar",
                  });
                  if (!confirm.isConfirmed) return;

                  const formData3 = new FormData();
                  formData3.append("almacen", almacen);
                  formData3.append("fecha", fecha);
                  formData3.append("empleado", empleado);
                  formData3.append("estatus", 3);

                  await axios.post("/actualizar_estatus.php", formData3);


                  navigate("/captura", {
                    state: { almacen, fecha, cia, estatus: 3 },
                  });

                }
              }}
              className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                activo
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>




      <div className="w-full bg-white p-4 mb-4 rounded-lg shadow border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">🔎 Buscar artículo</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Escribe código, nombre o código de barras..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-4 py-2 border border-blue-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
          <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center mb-4 gap-3">
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
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded shadow transition duration-200"
          >
            Confirmar diferencia
          </button>
        )}
      </div>


      <div className="relative overflow-auto max-h-[70vh] border rounded-lg shadow-md">

        <table className="min-w-full text-sm table-auto">
          <thead className="sticky top-0 bg-gradient-to-r from-blue-100 via-white to-blue-100 text-gray-800 text-xs uppercase tracking-wider shadow-md z-10">
            <tr>
              <th className="p-3 text-left w-10">#</th>
              <th className="p-3 text-left">No Empleado</th>
              <th className="p-3 text-left">Almacen</th>
              <th className="p-3 text-left">CIA</th>
              <th className="p-3 text-left">Código</th>
              <th className="p-3 text-left w-64 max-w-[16rem]">NOMBRE</th>
              <th className="p-3 text-left">Código de Barras</th>
              <th className="p-3 text-right">Captura SAP</th>
              {estatus >= 1 && <th className="p-3 text-right">Conteo 1</th>}
              {estatus >= 2 && <th className="p-3 text-right">Conteo 2</th>}
              {estatus >= 3 && <th className="p-3 text-right">Conteo 3</th>}
              <th className="p-3 text-right">Diferencia</th>

            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
  {datos
    .filter((item) => {
      const texto = busqueda.toLowerCase();
      return (
        item.codigo?.toLowerCase().includes(texto) ||
        item.codebars?.toLowerCase().includes(texto) ||
        item.nombre?.toLowerCase().includes(texto)
      );
    })
    .map((item, i) => (
      <tr
        key={i}
        className="hover:bg-blue-50 transition duration-150 ease-in-out"
      >
        <td className="p-3 text-sm text-gray-500 font-semibold whitespace-nowrap">
          {i + 1}
        </td>
        <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
          {item.usuario ?? "-"}
        </td>
        <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
          {item.almacen ?? "-"}
        </td>
        <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
          {item.cias ?? "-"}
        </td>
        <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
          {item.codigo ?? "-"}
        </td>
        <td className="p-3 text-sm text-gray-700 whitespace-nowrap truncate max-w-[16rem]">
          {item.nombre ?? "-"}
        </td>
        <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
          {item.codebars ?? "-"}
        </td>
        {/* Columna SAP */}
        <td className="p-3 text-sm text-right text-gray-700">
          {item.inventario_sap?.toFixed(2) ?? "0.00"}
        </td>
        {/* Conteos dinámicos */}
        {estatus >= 1 && (
          <td className="p-3 text-sm text-right text-gray-700">
            {(item.conteo1 ?? 0).toFixed(2)}
          </td>
        )}
        {estatus >= 2 && (
          <td className="p-3 text-sm text-right text-gray-700">
            {(item.conteo2 ?? 0).toFixed(2)}
          </td>
        )}
        {estatus >= 3 && (
          <td className="p-3 text-sm text-right text-gray-700">
            {(item.conteo3 ?? 0).toFixed(2)}
          </td>
        )}
        {/* Diferencia */}
        <td
          className={`p-3 text-sm text-right font-semibold ${
            item.diferencia === 0
              ? "text-green-600"
              : item.diferencia > 0
              ? "text-yellow-600"
              : "text-red-600"
          }`}
        >
          {item.diferencia?.toFixed(2) ?? "0.00"}
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
