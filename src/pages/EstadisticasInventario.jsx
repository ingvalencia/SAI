import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function EstadisticasInventario() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroAlmacen, setFiltroAlmacen] = useState("");
  const [paginaResumen, setPaginaResumen] = useState(1);
  const [paginaDetalle, setPaginaDetalle] = useState(1);

  const registrosPorPagina = 10;

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/estadisticas_inventario.php"
      );

      if (!res.data.success) {
        throw new Error(res.data.error || "Error consultando estadísticas");
      }

      setDatos(res.data.data || []);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  useEffect(() => {
    setPaginaResumen(1);
    setPaginaDetalle(1);
  }, [filtroAlmacen]);

  const almacenesDisponibles = useMemo(() => {
    return [...new Set(datos.map((d) => d.almacen).filter(Boolean))].sort();
  }, [datos]);

  const datosFiltrados = useMemo(() => {
    return datos.filter((item) => {
      if (!filtroAlmacen) return true;
      return item.almacen === filtroAlmacen;
    });
  }, [datos, filtroAlmacen]);

  const totalSesiones = datosFiltrados.length;

  const sesionesCerradas = datosFiltrados.filter(
    (d) => d.estado_sesion === "SESION CERRADA"
  ).length;

  const sesionesAbiertas = datosFiltrados.filter(
    (d) => d.estado_sesion === "SESION ABIERTA"
  ).length;

  const promedioMinutos =
    totalSesiones === 0
      ? 0
      : datosFiltrados.reduce(
          (acc, d) => acc + Number(d.minutos_sesion || 0),
          0
        ) / totalSesiones;

  const resumenPorAlmacen = Object.values(
    datosFiltrados.reduce((acc, item) => {
      const key = `${item.cia}-${item.almacen}-${item.fecha_inventario}`;

      if (!acc[key]) {
        acc[key] = {
          cia: item.cia,
          almacen: item.almacen,
          fecha_inventario: item.fecha_inventario,
          conteo1: 0,
          conteo2: 0,
          conteo3: 0,
          conteo4: 0,
          minutos1: 0,
          minutos2: 0,
          minutos3: 0,
          minutos4: 0,
          total_capturados: 0,
          minutos_totales: 0,
          articulos_por_minuto: 0,
        };
      }

      const capturados = Number(item.articulos_capturados || 0);
      const minutos = Number(item.minutos_sesion || 0);
      const conteo = Number(item.nro_conteo);

      if (conteo === 1) {
        acc[key].conteo1 += capturados;
        acc[key].minutos1 += minutos;
      }

      if (conteo === 2) {
        acc[key].conteo2 += capturados;
        acc[key].minutos2 += minutos;
      }

      if (conteo === 3) {
        acc[key].conteo3 += capturados;
        acc[key].minutos3 += minutos;
      }

      if (conteo === 4) {
        acc[key].conteo4 += capturados;
        acc[key].minutos4 += minutos;
      }

      acc[key].total_capturados += capturados;
      acc[key].minutos_totales += minutos;

      acc[key].articulos_por_minuto =
        acc[key].minutos_totales > 0
          ? acc[key].total_capturados / acc[key].minutos_totales
          : 0;

      return acc;
    }, {})
  );

  const detalleConProductividad = datosFiltrados.map((item) => {
    const capturados = Number(item.articulos_capturados || 0);
    const minutos = Number(item.minutos_sesion || 0);

    return {
      ...item,
      articulos_por_minuto: minutos > 0 ? capturados / minutos : 0,
    };
  });

  const almacenesMasTardados = [...resumenPorAlmacen]
    .sort((a, b) => b.minutos_totales - a.minutos_totales)
    .slice(0, 5);

  const almacenesMasProductivos = [...resumenPorAlmacen]
    .sort((a, b) => b.articulos_por_minuto - a.articulos_por_minuto)
    .slice(0, 5);

  const capturadosTotales = resumenPorAlmacen.reduce(
    (acc, item) => acc + Number(item.total_capturados || 0),
    0
  );

  const minutosTotales = resumenPorAlmacen.reduce(
    (acc, item) => acc + Number(item.minutos_totales || 0),
    0
  );

  const productividadGeneral =
    minutosTotales > 0 ? capturadosTotales / minutosTotales : 0;

  const graficaMinutosPorAlmacen = resumenPorAlmacen.map((item) => ({
    almacen: item.almacen,
    minutos: Number(item.minutos_totales.toFixed(2)),
  }));

  const graficaConteosPorAlmacen = resumenPorAlmacen.map((item) => ({
    almacen: item.almacen,
    conteo1: Number(item.minutos1.toFixed(2)),
    conteo2: Number(item.minutos2.toFixed(2)),
    conteo3: Number(item.minutos3.toFixed(2)),
    conteo4: Number(item.minutos4.toFixed(2)),
  }));

  const graficaCapturadosPorAlmacen = resumenPorAlmacen.map((item) => ({
    almacen: item.almacen,
    capturados: item.total_capturados,
  }));

  const graficaProductividadPorAlmacen = resumenPorAlmacen.map((item) => ({
    almacen: item.almacen,
    articulos_minuto: Number(item.articulos_por_minuto.toFixed(2)),
  }));

  const totalPaginasResumen = Math.max(
    1,
    Math.ceil(resumenPorAlmacen.length / registrosPorPagina)
  );

  const totalPaginasDetalle = Math.max(
    1,
    Math.ceil(detalleConProductividad.length / registrosPorPagina)
  );

  const resumenPaginado = resumenPorAlmacen.slice(
    (paginaResumen - 1) * registrosPorPagina,
    paginaResumen * registrosPorPagina
  );

  const detallePaginado = detalleConProductividad.slice(
    (paginaDetalle - 1) * registrosPorPagina,
    paginaDetalle * registrosPorPagina
  );

  const cambiarPaginaResumen = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginasResumen) return;
    setPaginaResumen(nuevaPagina);
  };

  const cambiarPaginaDetalle = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginasDetalle) return;
    setPaginaDetalle(nuevaPagina);
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-[#611232] mb-2">
          📈 Estadísticas de Inventario
        </h1>

        <p className="text-gray-600 text-sm mb-6">
          Consulta de tiempos reales, productividad, avance y comparativa por almacén, conteo y empleado.
        </p>

        {loading ? (
          <div className="text-gray-500 text-sm">Cargando estadísticas...</div>
        ) : (
          <>
            <div className="bg-gray-50 border rounded-xl p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">
                    Filtrar por almacén
                  </label>
                  <select
                    value={filtroAlmacen}
                    onChange={(e) => setFiltroAlmacen(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
                  >
                    <option value="">Todos los almacenes</option>
                    {almacenesDisponibles.map((almacen) => (
                      <option key={almacen} value={almacen}>
                        {almacen}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <button
                    onClick={() => setFiltroAlmacen("")}
                    className="w-full px-4 py-2 rounded-lg bg-[#611232] text-white text-sm font-semibold hover:bg-[#4b0d26] transition"
                  >
                    Limpiar filtro
                  </button>
                </div>

                <div>
                  <button
                    onClick={cargarEstadisticas}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-black transition"
                  >
                    Actualizar datos
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-[#611232]">
                    {datosFiltrados.length}
                  </span>{" "}
                  registros encontrados
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-50 border rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase">
                  Total sesiones
                </p>
                <p className="text-2xl font-bold text-[#611232]">
                  {totalSesiones}
                </p>
              </div>

              <div className="bg-gray-50 border rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase">
                  Sesiones cerradas
                </p>
                <p className="text-2xl font-bold text-[#611232]">
                  {sesionesCerradas}
                </p>
              </div>

              <div className="bg-gray-50 border rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase">
                  Sesiones abiertas
                </p>
                <p className="text-2xl font-bold text-[#611232]">
                  {sesionesAbiertas}
                </p>
              </div>

              <div className="bg-gray-50 border rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase">
                  Promedio minutos
                </p>
                <p className="text-2xl font-bold text-[#611232]">
                  {promedioMinutos.toFixed(2)}
                </p>
              </div>

              <div className="bg-gray-50 border rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase">
                  Artículos por minuto
                </p>
                <p className="text-2xl font-bold text-[#611232]">
                  {productividadGeneral.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
              <div className="border rounded-xl p-4 bg-white shadow-sm">
                <h2 className="text-base font-bold text-[#611232] mb-4">
                  Minutos totales por almacén
                </h2>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficaMinutosPorAlmacen}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="almacen" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="minutos" name="Minutos" fill="#611232" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border rounded-xl p-4 bg-white shadow-sm">
                <h2 className="text-base font-bold text-[#611232] mb-4">
                  Minutos por conteo
                </h2>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficaConteosPorAlmacen}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="almacen" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="conteo1" name="Conteo 1" fill="#611232" />
                      <Bar dataKey="conteo2" name="Conteo 2" fill="#9f2241" />
                      <Bar dataKey="conteo3" name="Conteo 3" fill="#bc955c" />
                      <Bar dataKey="conteo4" name="Conteo 4" fill="#235b4e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border rounded-xl p-4 bg-white shadow-sm">
                <h2 className="text-base font-bold text-[#611232] mb-4">
                  Artículos capturados por almacén
                </h2>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficaCapturadosPorAlmacen}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="almacen" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="capturados"
                        name="Capturados"
                        fill="#9f2241"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border rounded-xl p-4 bg-white shadow-sm">
                <h2 className="text-base font-bold text-[#611232] mb-4">
                  Productividad por almacén
                </h2>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficaProductividadPorAlmacen}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="almacen" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="articulos_minuto"
                        name="Artículos/min"
                        fill="#235b4e"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
              <div className="border rounded-xl p-4 bg-white shadow-sm">
                <h2 className="text-base font-bold text-[#611232] mb-4">
                  Top almacenes con más tiempo
                </h2>

                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Almacén</th>
                        <th className="px-3 py-2 text-right">Minutos</th>
                        <th className="px-3 py-2 text-right">Capturados</th>
                        <th className="px-3 py-2 text-right">Art/min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {almacenesMasTardados.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-3 py-6 text-center text-gray-500"
                          >
                            Sin información disponible.
                          </td>
                        </tr>
                      ) : (
                        almacenesMasTardados.map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 font-bold">
                              {index + 1}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              {item.almacen}
                            </td>
                            <td className="px-3 py-2 text-right font-bold">
                              {item.minutos_totales.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.total_capturados}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.articulos_por_minuto.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border rounded-xl p-4 bg-white shadow-sm">
                <h2 className="text-base font-bold text-[#611232] mb-4">
                  Top almacenes más productivos
                </h2>

                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Almacén</th>
                        <th className="px-3 py-2 text-right">Art/min</th>
                        <th className="px-3 py-2 text-right">Capturados</th>
                        <th className="px-3 py-2 text-right">Minutos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {almacenesMasProductivos.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-3 py-6 text-center text-gray-500"
                          >
                            Sin información disponible.
                          </td>
                        </tr>
                      ) : (
                        almacenesMasProductivos.map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 font-bold">
                              {index + 1}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              {item.almacen}
                            </td>
                            <td className="px-3 py-2 text-right font-bold">
                              {item.articulos_por_minuto.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.total_capturados}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.minutos_totales.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold text-[#611232]">
                  Resumen por almacén y conteo
                </h2>

                <div className="text-sm text-gray-600">
                  Página{" "}
                  <span className="font-bold text-[#611232]">
                    {paginaResumen}
                  </span>{" "}
                  de{" "}
                  <span className="font-bold text-[#611232]">
                    {totalPaginasResumen}
                  </span>
                </div>
              </div>

              <div className="overflow-auto border rounded-xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#611232] text-white">
                    <tr>
                      <th className="px-3 py-2 text-left">CIA</th>
                      <th className="px-3 py-2 text-left">Almacén</th>
                      <th className="px-3 py-2 text-left">Fecha Inv.</th>
                      <th className="px-3 py-2 text-right">Conteo 1</th>
                      <th className="px-3 py-2 text-right">Min. C1</th>
                      <th className="px-3 py-2 text-right">Conteo 2</th>
                      <th className="px-3 py-2 text-right">Min. C2</th>
                      <th className="px-3 py-2 text-right">Conteo 3</th>
                      <th className="px-3 py-2 text-right">Min. C3</th>
                      <th className="px-3 py-2 text-right">Conteo 4</th>
                      <th className="px-3 py-2 text-right">Min. C4</th>
                      <th className="px-3 py-2 text-right">
                        Total Capturados
                      </th>
                      <th className="px-3 py-2 text-right">
                        Minutos Totales
                      </th>
                      <th className="px-3 py-2 text-right">Art/min</th>
                    </tr>
                  </thead>

                  <tbody>
                    {resumenPaginado.length === 0 ? (
                      <tr>
                        <td
                          colSpan="14"
                          className="px-3 py-6 text-center text-gray-500"
                        >
                          Sin información disponible.
                        </td>
                      </tr>
                    ) : (
                      resumenPaginado.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{item.cia}</td>
                          <td className="px-3 py-2 font-semibold">
                            {item.almacen}
                          </td>
                          <td className="px-3 py-2">
                            {item.fecha_inventario}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {item.conteo1}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.minutos1.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {item.conteo2}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.minutos2.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {item.conteo3}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.minutos3.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {item.conteo4}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.minutos4.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {item.total_capturados}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {item.minutos_totales.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {item.articulos_por_minuto.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end items-center gap-2 mt-4">
                <button
                  onClick={() => cambiarPaginaResumen(paginaResumen - 1)}
                  disabled={paginaResumen === 1}
                  className="px-3 py-1 rounded border text-sm disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  Anterior
                </button>

                <span className="text-sm text-gray-600">
                  {paginaResumen} / {totalPaginasResumen}
                </span>

                <button
                  onClick={() => cambiarPaginaResumen(paginaResumen + 1)}
                  disabled={paginaResumen === totalPaginasResumen}
                  className="px-3 py-1 rounded border text-sm disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>

            <div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold text-[#611232]">
                  Detalle por empleado
                </h2>

                <div className="text-sm text-gray-600">
                  Página{" "}
                  <span className="font-bold text-[#611232]">
                    {paginaDetalle}
                  </span>{" "}
                  de{" "}
                  <span className="font-bold text-[#611232]">
                    {totalPaginasDetalle}
                  </span>
                </div>
              </div>

              <div className="overflow-auto border rounded-xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#611232] text-white">
                    <tr>
                      <th className="px-3 py-2 text-left">CIA</th>
                      <th className="px-3 py-2 text-left">Almacén</th>
                      <th className="px-3 py-2 text-left">Fecha Inv.</th>
                      <th className="px-3 py-2 text-left">Empleado</th>
                      <th className="px-3 py-2 text-center">Conteo</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Inicio</th>
                      <th className="px-3 py-2 text-left">Fin</th>
                      <th className="px-3 py-2 text-right">Minutos</th>
                      <th className="px-3 py-2 text-right">
                        Total Artículos
                      </th>
                      <th className="px-3 py-2 text-right">Capturados</th>
                      <th className="px-3 py-2 text-right">Avance</th>
                      <th className="px-3 py-2 text-right">Art/min</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detallePaginado.length === 0 ? (
                      <tr>
                        <td
                          colSpan="14"
                          className="px-3 py-6 text-center text-gray-500"
                        >
                          Sin información disponible.
                        </td>
                      </tr>
                    ) : (
                      detallePaginado.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{item.cia}</td>
                          <td className="px-3 py-2 font-semibold">
                            {item.almacen}
                          </td>
                          <td className="px-3 py-2">
                            {item.fecha_inventario}
                          </td>
                          <td className="px-3 py-2">{item.empleado}</td>
                          <td className="px-3 py-2 text-center">
                            {item.nro_conteo}
                          </td>
                          <td className="px-3 py-2">
                            {item.tipo_conteo || "-"}
                          </td>
                          <td className="px-3 py-2">{item.fecha_inicio}</td>
                          <td className="px-3 py-2">
                            {item.fecha_fin || "Abierta"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {Number(item.minutos_sesion || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.total_articulos}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.articulos_capturados}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.avance_porcentaje === null
                              ? "-"
                              : `${Number(item.avance_porcentaje).toFixed(2)}%`}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {Number(item.articulos_por_minuto || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">{item.estado_sesion}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end items-center gap-2 mt-4">
                <button
                  onClick={() => cambiarPaginaDetalle(paginaDetalle - 1)}
                  disabled={paginaDetalle === 1}
                  className="px-3 py-1 rounded border text-sm disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  Anterior
                </button>

                <span className="text-sm text-gray-600">
                  {paginaDetalle} / {totalPaginasDetalle}
                </span>

                <button
                  onClick={() => cambiarPaginaDetalle(paginaDetalle + 1)}
                  disabled={paginaDetalle === totalPaginasDetalle}
                  className="px-3 py-1 rounded border text-sm disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
