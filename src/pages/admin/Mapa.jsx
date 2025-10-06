import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const coloresEstatus = {
  0: { color: "bg-gray-300", label: "Sin conteo", icono: "➕" },
  1: { color: "bg-red-500", label: "Conteo 1", icono: "🔴" },
  2: { color: "bg-yellow-400", label: "Conteo 2", icono: "🟡" },
  3: { color: "bg-green-500", label: "Conteo 3", icono: "🟢" },
  4: { color: "bg-blue-600", label: "Finalizado", icono: "🔵" },
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

    worksheet.addRow(headers);

    headers.forEach((_, idx) => {
      const cell = worksheet.getRow(1).getCell(idx + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "9B1C1C" }, // rojo elegante
      };
      cell.font = {
        color: { argb: "FFFFFF" },
        bold: true,
      };
    });

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
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
        📊 Mapa de Operaciones
      </h1>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
        <select
          value={cia}
          onChange={(e) => {
            setCia(e.target.value);
            setAlmacenSeleccionado(null);
          }}
          className="border rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-red-600"
        >
          <option value="">Selecciona CIA</option>
          <option value="recrefam">RECREFAM</option>
          <option value="veser">VESER</option>
          <option value="opardiv">OPARDIV</option>
        </select>

        <input
          type="date"
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value);
            setAlmacenSeleccionado(null);
          }}
          className="border rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-red-600"
        />

        <button
          onClick={fetchAlmacenes}
          className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg shadow-md transition"
        >
          🔍 Buscar
        </button>
      </div>

      {/* Grid de almacenes */}
      {!almacenSeleccionado ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {almacenes.map((a, i) => {
            const estado = coloresEstatus[a.estatus] || coloresEstatus[0];

            return (
              <div
                key={i}
                onClick={() => setAlmacenSeleccionado(a.almacen)}
                className="cursor-pointer rounded-2xl overflow-hidden shadow-lg transition-all hover:scale-105 hover:shadow-2xl bg-white"
              >
                <div className={`h-20 flex items-center justify-between px-4 text-white ${estado.color}`}>
                  <span className="text-lg font-bold">{a.almacen}</span>
                  <span className="text-2xl">{estado.icono}</span>
                </div>
                <div className="p-4 text-center">
                  <div className="text-sm font-medium text-gray-700">{estado.label}</div>
                  <span className="inline-block mt-2 px-4 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                    Ver detalle
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              🔎 Detalle: {almacenSeleccionado}
            </h2>
            <div className="flex gap-3">
              <button
                onClick={exportarExcelMapa}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 shadow-md flex items-center gap-2"
              >
                <img src="https://img.icons8.com/color/20/microsoft-excel-2019.png" alt="excel" />
                Exportar
              </button>
              <button
                onClick={() => setAlmacenSeleccionado(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
              >
                ⬅️ Volver
              </button>
            </div>
          </div>

          {detalle.length === 0 ? (
            <p className="text-gray-500">Sin registros para este almacén.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Buscar por código, nombre, familia..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg shadow-sm text-sm focus:ring-2 focus:ring-red-600"
                />
              </div>

              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-red-800 to-red-600 text-white text-xs uppercase">
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
                <tbody className="bg-white divide-y divide-gray-100">
                  {datosPaginados.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-red-900">{d.codigo}</td>
                      <td className="px-4 py-2 text-gray-800">{d.nombre}</td>
                      <td className="px-4 py-2 text-gray-700">{d.familia ?? "-"}</td>
                      <td className="px-4 py-2 text-gray-700">{d.subfamilia ?? "-"}</td>
                      <td className="px-4 py-2 text-center">{d.inventario_sap.toFixed(2)}</td>
                      <td className="px-4 py-2 text-center">{d.conteo1 ?? "-"}</td>
                      <td className="px-4 py-2 text-center">{d.conteo2 ?? "-"}</td>
                      <td className="px-4 py-2 text-center">{d.conteo3 ?? "-"}</td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            d.diferencia === 0
                              ? "bg-green-100 text-green-700"
                              : d.diferencia > 0
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {d.diferencia.toFixed(2)}
                        </span>
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
                      : "bg-white hover:bg-red-50 text-red-700"
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
                      : "bg-white hover:bg-red-50 text-red-700"
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
