import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const coloresEstatus = {
  0: { color: "bg-gray-300", label: "Sin conteo", icono: "➕" },
  1: { color: "bg-red-500", label: "Conteo 0", icono: "🔴" },
  2: { color: "bg-yellow-400", label: "Conteo 1", icono: "🟡" },
  3: { color: "bg-green-500", label: "Conteo 2", icono: "🟢" },
  4: { color: "bg-blue-600", label: "Conteo 3", icono: "🔵" },
};


export default function Mapa() {
  const [almacenes, setAlmacenes] = useState([]);
  const [cia, setCia] = useState("");
  const [fecha, setFecha] = useState("");
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 100;

  const fetchAlmacenes = async () => {
    if (!cia || !fecha) {
      Swal.fire("Faltan datos", "Debes seleccionar una CIA y una fecha.", "warning");
      return;
    }
    try {
      const res = await axios.get(
        `https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/mapa_operaciones.php`,
        { params: { cia, fecha } }
      );
      if (res.data.success) {
        setAlmacenes(res.data.data);
        if (res.data.data.length === 0) {
          Swal.fire("Sin datos", "No se encontraron almacenes para la CIA y fecha seleccionada.", "warning");
        }
      }
    } catch (err) {
      console.error("Error al cargar almacenes:", err);
      Swal.fire("Error", "No se pudieron cargar los almacenes.", "error");
    }
  };

  const fetchDetalle = async () => {
    if (!cia || !fecha || !almacenSeleccionado) return;
    try {
      Swal.fire({
        title: "Procesando...",
        text: "Obteniendo detalle del almacén, por favor espera",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await axios.get(
        `https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/mapa_detalle.php`,
        { params: { almacen: almacenSeleccionado, fecha, cia } }
      );

      Swal.close();

      if (res.data.success) {
        setDetalle(res.data.data);
        setPaginaActual(1);
        if (res.data.data.length === 0) {
          Swal.fire("Sin datos", "No hay información para este almacén y fecha.", "info");
        }
      }
    } catch (err) {
      Swal.close();
      console.error("Error al obtener detalle:", err);
      Swal.fire("Error", "No se pudo obtener el detalle del almacén.", "error");
    }
  };

  useEffect(() => {
    fetchDetalle();
  }, [almacenSeleccionado]);

  // === Filtro por búsqueda ===
  const detalleFiltrado = useMemo(() => {
    const texto = busqueda.toLowerCase();
    return detalle.filter((item) => {
      return (
        item.codigo?.toLowerCase().includes(texto) ||
        item.nombre?.toLowerCase().includes(texto) ||
        item.familia?.toLowerCase().includes(texto) ||
        item.subfamilia?.toLowerCase().includes(texto) ||
        item.codebars?.toLowerCase().includes(texto)
      );
    });
  }, [detalle, busqueda]);

  // === Paginación ===
  const indiceInicial = (paginaActual - 1) * registrosPorPagina;
  const indiceFinal = indiceInicial + registrosPorPagina;
  const datosPaginados = detalleFiltrado.slice(indiceInicial, indiceFinal);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  // === Exportar Excel ===
  const exportarExcelMapa = async () => {
    const datosExportar = detalleFiltrado;

    const headers = [
      "#", "CÓDIGO", "NOMBRE", "FAMILIA", "SUBFAMILIA",
      "INVENTARIO SAP", "CONTEO 1", "CONTEO 2", "CONTEO 3", "DIFERENCIA"
    ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mapa Operaciones");

    // Encabezados
    worksheet.addRow(headers);

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
    datosExportar.forEach((item, i) => {
      worksheet.addRow([
        i + 1,
        item.codigo,
        item.nombre,
        item.familia ?? "-",
        item.subfamilia ?? "-",
        item.inventario_sap ?? 0,
        item.conteo1 ?? 0,
        item.conteo2 ?? 0,
        item.conteo3 ?? 0,
        item.diferencia ?? 0,
      ]);
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `mapa_${almacenSeleccionado || "almacen"}_${fecha}.xlsx`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Mapa de operaciones
      </h1>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
        {/* Select CIA */}
        <select
          value={cia}
          onChange={(e) => {
            setCia(e.target.value);
            setAlmacenSeleccionado(null);
          }}
          className="border rounded px-4 py-2 shadow-sm"
        >
          <option value="">Selecciona CIA</option>
          <option value="recrefam">RECREFAM</option>
          <option value="veser">VESER</option>
          <option value="opardiv">OPARDIV</option>
        </select>

        {/* Fecha */}
        <input
          type="date"
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value);
            setAlmacenSeleccionado(null);
          }}
          className="border rounded px-4 py-2 shadow-sm"
        />

        {/* Botón buscar */}
        <button
          onClick={fetchAlmacenes}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-sm"
        >
          🔍 Buscar
        </button>
      </div>

      {/* Grid de almacenes o detalle */}
      {!almacenSeleccionado ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {almacenes.map((a, i) => {
            const estado = coloresEstatus[a.estatus] || coloresEstatus[0];

            return (
              <div
                key={i}
                onClick={() => setAlmacenSeleccionado(a.almacen)}
                className={`group cursor-pointer rounded-2xl overflow-hidden shadow-lg transition-transform duration-200 hover:scale-105`}
              >
                {/* Encabezado con color dinámico */}
                <div
                  className={`h-20 flex items-center justify-between px-4 ${estado.color}`}
                >
                  <span className="text-xl font-semibold tracking-wide">
                    {a.almacen}
                  </span>
                  <span className="text-2xl">{estado.icono}</span>
                </div>

                {/* Cuerpo blanco */}
                <div className="bg-white p-4 text-gray-700 flex flex-col items-center">
                  <div className="text-sm font-medium mb-1">{estado.label}</div>
                  <button
                    className="mt-2 px-4 py-1 text-sm rounded-full border border-gray-300 text-gray-600
                              group-hover:bg-gray-100 transition"
                  >
                    Ver detalle
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              🔎 Detalle: {almacenSeleccionado}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={exportarExcelMapa}
                className="w-40 h-10 px-3 rounded-full text-sm font-semibold bg-green-300 text-green-900 hover:bg-green-400 flex items-center justify-center gap-2 transition"
              >
                <img src="https://img.icons8.com/color/20/microsoft-excel-2019.png" alt="excel" />
                Exportar Excel
              </button>
              <button
                onClick={() => setAlmacenSeleccionado(null)}
                className="text-sm text-blue-600 hover:underline"
              >
                ⬅️ Volver al mapa
              </button>
            </div>
          </div>

          {detalle.length === 0 ? (
            <p className="text-gray-500">Sin registros para este almacén.</p>
          ) : (
            <div className="border rounded shadow">
              {/* Input de búsqueda */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Buscar por código, nombre, familia..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm"
                />
              </div>

              {/* Tabla */}
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-800 text-white text-xs">
                  <tr>
                    <th className="px-4 py-2">Código</th>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2">Familia</th>
                    <th className="px-4 py-2">Subfamilia</th>
                    <th className="px-4 py-2">Inventario SAP</th>
                    <th className="px-4 py-2">Conteo 1</th>
                    <th className="px-4 py-2">Conteo 2</th>
                    <th className="px-4 py-2">Conteo 3</th>
                    <th className="px-4 py-2">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {datosPaginados.map((d, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-mono text-red-900">{d.codigo}</td>
                      <td className="px-4 py-2 text-gray-800">{d.nombre}</td>
                      <td className="px-4 py-2 text-gray-700">{d.familia ?? "-"}</td>
                      <td className="px-4 py-2 text-gray-700">{d.subfamilia ?? "-"}</td>
                      <td className="px-4 py-2 text-center">{d.inventario_sap.toFixed(2)}</td>
                      <td className="px-4 py-2 text-center">{d.conteo1 ?? "-"}</td>
                      <td className="px-4 py-2 text-center">{d.conteo2 ?? "-"}</td>
                      <td className="px-4 py-2 text-center">{d.conteo3 ?? "-"}</td>
                      <td
                        className={`px-4 py-2 text-center font-bold ${
                          d.diferencia === 0
                            ? "text-green-600"
                            : d.diferencia > 0
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {d.diferencia.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Paginación */}
              <div className="mt-4 flex justify-center items-center gap-4 text-sm text-gray-700 font-medium">
                <button
                  onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                  disabled={paginaActual === 1}
                  className={`px-3 py-1 rounded border ${
                    paginaActual === 1
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-white hover:bg-blue-100 text-blue-700"
                  }`}
                >
                  ⬅️ Anterior
                </button>

                <span>
                  Página {paginaActual} de {Math.ceil(detalleFiltrado.length / registrosPorPagina)}
                </span>

                <button
                  onClick={() =>
                    setPaginaActual((prev) =>
                      prev < Math.ceil(detalleFiltrado.length / registrosPorPagina)
                        ? prev + 1
                        : prev
                    )
                  }
                  disabled={paginaActual >= Math.ceil(detalleFiltrado.length / registrosPorPagina)}
                  className={`px-3 py-1 rounded border ${
                    paginaActual >= Math.ceil(detalleFiltrado.length / registrosPorPagina)
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-white hover:bg-blue-100 text-blue-700"
                  }`}
                >
                  Siguiente ➡️
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
