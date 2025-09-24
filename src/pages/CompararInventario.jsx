import React, { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
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

 const exportarExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Diferencias");

    // Encabezados
    const headers = [
      "#", "No Empleado", "Almacén", "CIA", "Código", "Nombre",
      "Código de Barras", "Captura SAP", "Conteo 1", "Conteo 2", "Conteo 3", "Diferencia"
    ];

    worksheet.addRow(headers);

    // Estilo encabezado
    headers.forEach((_, idx) => {
      const cell = worksheet.getRow(1).getCell(idx + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "CC0000" },
      };
      cell.font = {
        color: { argb: "FFFFFF" },
        bold: true,
      };
    });

    // Filas
    datos.forEach((item, i) => {
      const conteo1 = item.conteo1 ?? 0;
      const conteo2 = item.conteo2 ?? 0;
      const conteo3 = item.conteo3 ?? 0;
      const sap = item.inventario_sap ?? 0;

      const conteoActual =
        estatus === 3 ? conteo3 :
        estatus === 2 ? conteo2 :
        conteo1;

      const diferencia = parseFloat((sap - conteoActual).toFixed(2));

      const row = worksheet.addRow([
        i + 1,
        item.usuario,
        item.almacen,
        item.cias,
        item.codigo,
        item.nombre,
        item.codebars,
        sap,
        conteo1,
        conteo2,
        conteo3,
        diferencia,
      ]);

      // Estilo diferencia negativa
      if (diferencia < 0) {
        const diffCell = row.getCell(12); // columna "Diferencia"
        diffCell.font = { color: { argb: "000000" } };
      }
    });

    // Filtros
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    // Guardar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `comparacion_${almacen}_${fecha}.xlsx`);
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
          const estatusActual = res.data.estatus || 1;
          setEstatus(estatusActual);

          // Calcula la diferencia según el conteo actual
          const datosConDiferencias = res.data.data.map((item) => {
            const conteo =
              estatusActual === 1 ? item.conteo1 ?? 0 :
              estatusActual === 2 ? item.conteo2 ?? 0 :
              estatusActual === 3 ? item.conteo3 ?? 0 :
              0;

            return {
              ...item,
              diferencia: parseFloat((conteo - (item.inventario_sap ?? 0)).toFixed(2))
            };
          });

          setDatos(datosConDiferencias);

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
      // Mostrar modal de cargando
      Swal.fire({
        title: "Procesando...",
        text: "Por favor espera",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const formData = new FormData();
      formData.append("almacen", almacen);
      formData.append("fecha", fecha);
      formData.append("empleado", empleado);

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/confirmar_diferencia.php",
        formData
      );

      Swal.close(); // cerrar el loading

      if (!res.data.success) throw new Error(res.data.error);

      await Swal.fire("¡Hecho!", "Las diferencias han sido confirmadas.", "success");
      setDiferenciaConfirmada(true);
      setEstatus(4); // reflejar estatus final
    } catch (error) {
      Swal.close();
      Swal.fire("Error", error.message, "error");
    }
  };


  function getColor(diferencia) {
      if (diferencia > 0) return "orange";
      if (diferencia < 0) return "red";
      return "green";
    }


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

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-2">
        {["Primer Conteo", "Segundo Conteo", "Tercer Conteo"].map((label, index) => {
          const conteoNumero = index + 1;
          const activo = estatus === conteoNumero;

          return (
            <button
              key={label}
              onClick={async () => {
                if (conteoNumero === 1) {
                  if (estatus === 1) {
                    Swal.fire("No permitido", "Ya se realizo el primer conteo.", "warning");
                    return;
                  }
                  if ([2, 3, 4].includes(estatus)) {
                    Swal.fire("No permitido", "Ya no se puede realizar primer conteo.", "warning");
                    return;
                  }
                }

                else if (conteoNumero === 2) {
                  if ([2, 3, 4].includes(estatus)) {
                    Swal.fire("No permitido", "Ya no se puede realizar segundo conteo.", "warning");
                    return;
                  }

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

                    try {
                      const formData = new FormData();
                      formData.append("almacen", almacen);
                      formData.append("fecha", fecha);
                      formData.append("empleado", empleado);
                      formData.append("estatus", 2);

                      await axios.post(
                        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/actualizar_estatus.php",
                        formData
                      );

                      navigate("/captura", {
                        state: { almacen, fecha, cia, empleado, estatus: 2 },
                      });
                    } catch (error) {
                      console.error("Error al actualizar estatus", error);
                      Swal.fire("Error", "No se pudo actualizar el estatus. Revisa la consola.", "error");
                    }
                  }
                }

                else if (conteoNumero === 3) {
                  if (estatus === 1) {
                    Swal.fire("No permitido", "Debe hacer el segundo conteo previamente.", "warning");
                    return;
                  }
                  if ([3, 4].includes(estatus)) {
                    Swal.fire("No permitido", "Ya no se puede hacer ningún conteo.", "warning");
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

                  try {
                    const formData3 = new FormData();
                    formData3.append("almacen", almacen);
                    formData3.append("fecha", fecha);
                    formData3.append("empleado", empleado);
                    formData3.append("estatus", 3);

                    await axios.post(
                      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/actualizar_estatus.php",
                      formData3
                    );

                    navigate("/captura", {
                      state: { almacen, fecha, cia, empleado, estatus: 3 },
                    });
                  } catch (error) {
                    console.error("Error al actualizar estatus", error);
                    Swal.fire("Error", "No se pudo actualizar el estatus. Revisa la consola.", "error");
                  }
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

        {!diferenciaConfirmada && (
          <button
            onClick={confirmarDiferencia}
            className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-500 text-white hover:bg-yellow-600 transition"
          >
            Confirmar diferencia
          </button>

        )}

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
          className="px-3 py-1 rounded-full text-sm font-semibold bg-green-300 text-green-900 hover:bg-green-400 flex items-center gap-2 transition"
        >
          <img src="https://img.icons8.com/color/24/microsoft-excel-2019.png" alt="excel" />
          Exportar a Excel
        </button>
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
          <td className="p-3 text-sm text-right bg-blue-50 text-blue-800 font-semibold">
            {(item.conteo1 ?? 0).toFixed(2)}
          </td>
        )}
        {estatus >= 2 && (
          <td className="p-3 text-sm text-right bg-purple-50 text-purple-800 font-semibold">
            {(item.conteo2 ?? 0).toFixed(2)}
          </td>
        )}
        {estatus >= 3 && (
          <td className="p-3 text-sm text-right bg-amber-50 text-amber-800 font-semibold">
            {(item.conteo3 ?? 0).toFixed(2)}
          </td>
        )}
        {/* Diferencia */}
        <td className="p-3 text-sm text-right font-bold"
            style={{
              color:
                estatus === 3
                  ? getColor((item.sap || 0) - (item.conteo3 || 0))
                  : estatus === 2
                  ? getColor((item.sap || 0) - (item.conteo2 || 0))
                  : getColor((item.sap || 0) - (item.conteo1 || 0)),
            }}
        >
          {(
            estatus === 3
              ? (item.sap || 0) - (item.conteo3 || 0)
              : estatus === 2
              ? (item.sap || 0) - (item.conteo2 || 0)
              : (item.sap || 0) - (item.conteo1 || 0)
          ).toFixed(2)}
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
