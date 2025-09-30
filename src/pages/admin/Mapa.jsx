import React, { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";

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
      // Abrir modal de procesamiento
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

      Swal.close(); // cerrar modal de loading

      if (res.data.success) {
        setDetalle(res.data.data);
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        🗌 Mapa de operaciones
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {almacenes.map((a, i) => {
            const estado = coloresEstatus[a.estatus] || coloresEstatus[0];

            return (
              <div
                key={i}
                onClick={() => setAlmacenSeleccionado(a.almacen)}
                className={`cursor-pointer rounded-xl p-4 text-white ${estado.color} shadow-md hover:scale-105 transition`}
              >
                <div className="text-lg font-bold mb-1 flex justify-between items-center">
                  <span>{a.almacen}</span>
                  <span>{estado.icono}</span>
                </div>
                <div className="text-sm">{estado.label}</div>
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
            <button
              onClick={() => setAlmacenSeleccionado(null)}
              className="text-sm text-blue-600 hover:underline"
            >
              ⬅️ Volver al mapa
            </button>
          </div>

          {detalle.length === 0 ? (
            <p className="text-gray-500">Sin registros para este almacén.</p>
          ) : (
            <div className="overflow-auto max-h-[60vh] border rounded shadow">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-800 text-white text-xs">
                  <tr>
                    <th className="px-4 py-2">Código</th>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2">Conteo 1</th>
                    <th className="px-4 py-2">Conteo 2</th>
                    <th className="px-4 py-2">Conteo 3</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {detalle.map((d, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-mono text-red-900">{d.ItemCode}</td>
                      <td className="px-4 py-2 text-gray-800">{d.Itemname}</td>
                      <td className="px-4 py-2 text-center">{d.conteo1 || "-"}</td>
                      <td className="px-4 py-2 text-center">{d.conteo2 || "-"}</td>
                      <td className="px-4 py-2 text-center">{d.conteo3 || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
