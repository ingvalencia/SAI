import { useMemo, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { endpoint } from "../config/apiConfig";

export default function EstadisticasInventario() {
  const [datos, setDatos] = useState([]);
  const [catalogoAlmacenes, setCatalogoAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [vistaTabla, setVistaTabla] = useState("resumen");
  const [paginaResumen, setPaginaResumen] = useState(1);
  const [paginaDetalle, setPaginaDetalle] = useState(1);

  const [filtros, setFiltros] = useState({
    cia: "",
    cef: "",
    almacen: "",
    empleado: "",
    fecha_desde: "",
    fecha_hasta: "",
    nro_conteo: ""
  });

  const registrosPorPagina = 10;

  const numero = (valor) => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  };

  const fechaTs = (valor) => {
    if (!valor) return null;
    const d = new Date(String(valor).replace(" ", "T"));
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  };

  const formatoNumero = (valor) => {
    return numero(valor).toLocaleString("es-MX", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const formatoDecimal = (valor) => {
    return numero(valor).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatoTiempoSegundos = (segundos) => {
    const total = Math.max(0, Math.round(numero(segundos)));
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const seg = total % 60;

    return `${String(horas).padStart(2, "0")}h ${String(minutos).padStart(2, "0")}m ${String(seg).padStart(2, "0")}s`;
  };

  const formatoTiempoCorto = (segundos) => {
    const total = Math.max(0, Math.round(numero(segundos)));
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const seg = total % 60;

    if (horas > 0) return `${horas}h ${minutos}m ${seg}s`;
    if (minutos > 0) return `${minutos}m ${seg}s`;
    return `${seg}s`;
  };

  const formatearEstadoSesion = (estado) => {
    if (estado === "SESION CERRADA") return "CONTEO FINALIZADO";
    return estado || "-";
  };

  const cambiarFiltro = (campo, valor) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor
    }));
  };

  const cargarAlmacenesPorCia = async (cia) => {
    try {
      setCatalogoAlmacenes([]);
      cambiarFiltro("cef", "");
      cambiarFiltro("almacen", "");

      if (!cia) return;

      setLoadingAlmacenes(true);

      const res = await axios.get(
        await endpoint("catalogo_almacenes.php"),
        { params: { cia } }
      );

      if (res.data.success && Array.isArray(res.data.data)) {
        setCatalogoAlmacenes(res.data.data);
      } else {
        setCatalogoAlmacenes([]);
      }
    } catch (error) {
      console.error(error);
      setCatalogoAlmacenes([]);
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      setConsultado(false);
      setPaginaResumen(1);
      setPaginaDetalle(1);

      const params = {};

      Object.keys(filtros).forEach((key) => {
        if (filtros[key] !== "") {
          params[key] = filtros[key];
        }
      });

      const res = await axios.get(
        await endpoint("estadisticas_inventario.php"),
        { params }
      );

      if (!res.data.success) {
        throw new Error(res.data.error || "Error consultando estadísticas");
      }

      setDatos(res.data.data || []);
      setConsultado(true);
    } catch (error) {
      console.error(error);
      alert(error.message);
      setDatos([]);
      setConsultado(true);
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFiltros({
      cia: "",
      cef: "",
      almacen: "",
      empleado: "",
      fecha_desde: "",
      fecha_hasta: "",
      nro_conteo: ""
    });
    setCatalogoAlmacenes([]);
    setDatos([]);
    setConsultado(false);
    setPaginaResumen(1);
    setPaginaDetalle(1);
  };

  const cefsDisponibles = useMemo(() => {
    return [
      ...new Set(
        catalogoAlmacenes
          .map((alm) => String(alm.codigo || "").split("-")[0])
          .filter(Boolean)
      )
    ].sort();
  }, [catalogoAlmacenes]);

  const almacenesFiltradosPorCef = useMemo(() => {
    if (!filtros.cef) return catalogoAlmacenes;

    return catalogoAlmacenes.filter((alm) =>
      String(alm.codigo || "").startsWith(`${filtros.cef}-`)
    );
  }, [catalogoAlmacenes, filtros.cef]);

  const resumenPorAlmacen = useMemo(() => {
    const resultado = datos.reduce((acc, item) => {
      const key = `${item.cia}-${item.almacen}-${item.fecha_inventario}`;
      const totalArticulos = numero(item.total_articulos);
      const capturados = numero(item.articulos_capturados);
      const tiempoSesionSegundos = numero(item.tiempo_guardado_lote_segundos);
      const tiempoCapturaSegundos = numero(item.tiempo_guardado_lote_segundos);
      const conteo = numero(item.nro_conteo);
      const inicioTs = fechaTs(item.primera_captura_guardada);
      const finTs = fechaTs(item.ultima_captura_guardada);

      if (!acc[key]) {
        acc[key] = {
          cia: item.cia,
          almacen: item.almacen,
          fecha_inventario: item.fecha_inventario,
          total_articulos: 0,
          conteo1: 0,
          conteo2: 0,
          conteo3: 0,
          conteo4: 0,
          conteo7: 0,
          tiempo_conteo1_segundos: 0,
          tiempo_conteo2_segundos: 0,
          tiempo_conteo3_segundos: 0,
          tiempo_conteo4_segundos: 0,
          tiempo_conteo7_segundos: 0,
          tiempo_captura_conteo1_segundos: 0,
          tiempo_captura_conteo2_segundos: 0,
          tiempo_captura_conteo3_segundos: 0,
          tiempo_captura_conteo4_segundos: 0,
          tiempo_captura_conteo7_segundos: 0,
          total_capturados: 0,
          pendientes: 0,
          tiempo_operativo_segundos: 0,
          tiempo_captura_segundos: 0,
          tiempo_real_segundos: 0,
          primera_fecha_inicio_ts: null,
          ultima_fecha_fin_ts: null,
          sesiones: 0,
          sesiones_abiertas: 0,
          sesiones_cerradas: 0,
          _sesiones_unicas: {},
          avance_porcentaje: 0,
          articulos_por_minuto: 0,
          estado_tiempo: item.estado_tiempo || "-",
          avance_actual: item.avance_actual || "-"
        };
      }

      acc[key].sesiones += 1;
      acc[key].total_articulos = Math.max(acc[key].total_articulos, totalArticulos);
      acc[key].tiempo_operativo_segundos += tiempoSesionSegundos;
      acc[key].tiempo_captura_segundos += tiempoCapturaSegundos;

      if (
        inicioTs !== null &&
        (acc[key].primera_fecha_inicio_ts === null ||
          inicioTs < acc[key].primera_fecha_inicio_ts)
      ) {
        acc[key].primera_fecha_inicio_ts = inicioTs;
      }

      if (
        finTs !== null &&
        (acc[key].ultima_fecha_fin_ts === null ||
          finTs > acc[key].ultima_fecha_fin_ts)
      ) {
        acc[key].ultima_fecha_fin_ts = finTs;
      }

      if (
        acc[key].primera_fecha_inicio_ts !== null &&
        acc[key].ultima_fecha_fin_ts !== null
      ) {
        acc[key].tiempo_real_segundos = Math.max(
          0,
          Math.round((acc[key].ultima_fecha_fin_ts - acc[key].primera_fecha_inicio_ts) / 1000)
        );
      }

      const keySesionUnica = `${item.empleado}-${item.nro_conteo}`;

      if (!acc[key]._sesiones_unicas[keySesionUnica]) {
        acc[key]._sesiones_unicas[keySesionUnica] = item.estado_sesion;
      }

      if (item.estado_sesion === "SESION CERRADA") {
        acc[key]._sesiones_unicas[keySesionUnica] = item.estado_sesion;
      }

      if (conteo === 1) {
        acc[key].conteo1 = Math.max(acc[key].conteo1, capturados);
        acc[key].tiempo_conteo1_segundos += tiempoSesionSegundos;
        acc[key].tiempo_captura_conteo1_segundos += tiempoCapturaSegundos;
      }

      if (conteo === 2) {
        acc[key].conteo2 = Math.max(acc[key].conteo2, capturados);
        acc[key].tiempo_conteo2_segundos += tiempoSesionSegundos;
        acc[key].tiempo_captura_conteo2_segundos += tiempoCapturaSegundos;
      }

      if (conteo === 3) {
        acc[key].conteo3 = Math.max(acc[key].conteo3, capturados);
        acc[key].tiempo_conteo3_segundos += tiempoSesionSegundos;
        acc[key].tiempo_captura_conteo3_segundos += tiempoCapturaSegundos;
      }

      if (conteo === 4) {
        acc[key].conteo4 = Math.max(acc[key].conteo4, capturados);
        acc[key].tiempo_conteo4_segundos += tiempoSesionSegundos;
        acc[key].tiempo_captura_conteo4_segundos += tiempoCapturaSegundos;
      }

      if (conteo === 7) {
        acc[key].conteo7 = Math.max(acc[key].conteo7, capturados);
        acc[key].tiempo_conteo7_segundos += tiempoSesionSegundos;
        acc[key].tiempo_captura_conteo7_segundos += tiempoCapturaSegundos;
      }

      acc[key].total_capturados =
        acc[key].conteo3 > 0
          ? acc[key].conteo3
          : acc[key].conteo2 > 0
          ? acc[key].conteo2
          : acc[key].conteo1;

      acc[key].pendientes = Math.max(
        acc[key].total_articulos - acc[key].total_capturados,
        0
      );

      acc[key].avance_porcentaje =
        acc[key].total_articulos > 0
          ? (acc[key].total_capturados * 100) / acc[key].total_articulos
          : 0;

      acc[key].articulos_por_minuto =
        acc[key].tiempo_operativo_segundos > 0
          ? acc[key].total_capturados / (acc[key].tiempo_operativo_segundos / 60)
          : 0;

      return acc;
    }, {});

    return Object.values(resultado)
      .map((item) => {
        const sesionesUnicas = Object.values(item._sesiones_unicas || {});
        item.sesiones_abiertas = sesionesUnicas.filter((estado) => estado === "SESION ABIERTA").length;
        item.sesiones_cerradas = sesionesUnicas.filter((estado) => estado === "SESION CERRADA").length;
        delete item._sesiones_unicas;
        return item;
      })
      .sort((a, b) => b.tiempo_real_segundos - a.tiempo_real_segundos);
  }, [datos]);

  const detalleConProductividad = useMemo(() => {
    const mapa = {};

    datos.forEach((item) => {
      const key = `${item.cia}-${item.almacen}-${item.fecha_inventario}-${item.empleado}-${item.nro_conteo}`;
      const esFinalizado = item.estado_sesion === "SESION CERRADA";

      if (!mapa[key]) {
        mapa[key] = item;
        return;
      }

      const actualFinalizado = mapa[key].estado_sesion === "SESION CERRADA";

      if (esFinalizado && !actualFinalizado) {
        mapa[key] = item;
        return;
      }

      if (esFinalizado === actualFinalizado) {
        const fechaActual = fechaTs(
          mapa[key].fecha_fin ||
            mapa[key].ultima_captura_guardada ||
            mapa[key].fecha_inicio
        );
        const fechaNueva = fechaTs(
          item.fecha_fin ||
            item.ultima_captura_guardada ||
            item.fecha_inicio
        );

        if ((fechaNueva || 0) > (fechaActual || 0)) {
          mapa[key] = item;
        }
      }
    });

    return Object.values(mapa)
      .map((item) => {
        const capturados = numero(item.articulos_capturados);
        const segundosCaptura = numero(item.tiempo_guardado_lote_segundos);

        return {
          ...item,
          articulos_por_minuto:
            segundosCaptura > 0 ? capturados / (segundosCaptura / 60) : 0
        };
      })
      .sort((a, b) => {
        const almacenA = String(a.almacen || "");
        const almacenB = String(b.almacen || "");

        if (almacenA !== almacenB) {
          return almacenA.localeCompare(almacenB);
        }

        const conteoA = numero(a.nro_conteo);
        const conteoB = numero(b.nro_conteo);

        if (conteoA !== conteoB) {
          return conteoA - conteoB;
        }

        return String(a.empleado || "").localeCompare(String(b.empleado || ""));
      });
  }, [datos]);

  const totalSesiones = detalleConProductividad.length;
  const sesionesCerradas = detalleConProductividad.filter((d) => d.estado_sesion === "SESION CERRADA").length;
  const sesionesAbiertas = detalleConProductividad.filter((d) => d.estado_sesion === "SESION ABIERTA").length;

  const totalArticulosUniverso = resumenPorAlmacen.reduce(
    (acc, item) => acc + numero(item.total_articulos),
    0
  );

  const totalCapturados = resumenPorAlmacen.reduce(
    (acc, item) => acc + numero(item.total_capturados),
    0
  );

  const tiempoRealTotalSegundos = resumenPorAlmacen.reduce(
    (acc, item) => acc + numero(item.tiempo_real_segundos),
    0
  );

  const tiempoOperativoTotalSegundos = resumenPorAlmacen.reduce(
    (acc, item) => acc + numero(item.tiempo_operativo_segundos),
    0
  );

  const avanceGlobal =
    totalArticulosUniverso > 0
      ? (totalCapturados * 100) / totalArticulosUniverso
      : 0;

  const productividadGeneral =
    tiempoOperativoTotalSegundos > 0
      ? totalCapturados / (tiempoOperativoTotalSegundos / 60)
      : 0;

  const articulosPendientes = Math.max(totalArticulosUniverso - totalCapturados, 0);

  const almacenesAtrasados = resumenPorAlmacen.filter(
    (item) => item.estado_tiempo === "ATRASADO" && item.avance_actual !== "CERRADO"
  ).length;

  const almacenMasTardado =
    resumenPorAlmacen.length > 0
      ? [...resumenPorAlmacen].sort((a, b) => b.tiempo_real_segundos - a.tiempo_real_segundos)[0]
      : null;

  const almacenMayorTiempoOperativo =
    resumenPorAlmacen.length > 0
      ? [...resumenPorAlmacen].sort((a, b) => b.tiempo_operativo_segundos - a.tiempo_operativo_segundos)[0]
      : null;

  const almacenMasProductivo =
    resumenPorAlmacen.length > 0
      ? [...resumenPorAlmacen].sort((a, b) => b.articulos_por_minuto - a.articulos_por_minuto)[0]
      : null;

  const almacenMenorAvance =
    resumenPorAlmacen.length > 0
      ? [...resumenPorAlmacen].sort((a, b) => a.avance_porcentaje - b.avance_porcentaje)[0]
      : null;

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

  const resumenPorConteoTabla = useMemo(() => {
    const mapa = {};

    detallePaginado.forEach((item) => {
      const conteo = numero(item.nro_conteo);
      const key = `Conteo ${conteo}`;

      if (!mapa[key]) {
        mapa[key] = {
          conteo: key,
          capturados: 0,
          tiempo_sesion: 0,
          tiempo_captura: 0,
          sesiones: 0,
          abiertas: 0,
          cerradas: 0,
          articulos_minuto: 0
        };
      }

      mapa[key].capturados += numero(item.articulos_capturados);
      mapa[key].tiempo_sesion += numero(item.tiempo_guardado_lote_segundos);
      mapa[key].tiempo_captura += numero(item.tiempo_guardado_lote_segundos);
      mapa[key].sesiones += 1;

      if (item.estado_sesion === "SESION ABIERTA") {
        mapa[key].abiertas += 1;
      }

      if (item.estado_sesion === "SESION CERRADA") {
        mapa[key].cerradas += 1;
      }

      mapa[key].articulos_minuto =
        mapa[key].tiempo_sesion > 0
          ? mapa[key].capturados / (mapa[key].tiempo_sesion / 60)
          : 0;
    });

    return Object.values(mapa).sort((a, b) => {
      const ca = Number(String(a.conteo).replace("Conteo ", ""));
      const cb = Number(String(b.conteo).replace("Conteo ", ""));
      return ca - cb;
    });
  }, [detallePaginado]);

  const resumenPorAlmacenConteoTabla = useMemo(() => {
    return resumenPaginado.map((item) => ({
      almacen: item.almacen,
      conteo1: numero(item.conteo1),
      conteo2: numero(item.conteo2),
      conteo3: numero(item.conteo3),
      conteo7: numero(item.conteo7),
      tiempo_conteo1: numero(item.tiempo_conteo1_segundos),
      tiempo_conteo2: numero(item.tiempo_conteo2_segundos),
      tiempo_conteo3: numero(item.tiempo_conteo3_segundos),
      tiempo_conteo7: numero(item.tiempo_conteo7_segundos),
      tiempo_captura_conteo1: numero(item.tiempo_captura_conteo1_segundos),
      tiempo_captura_conteo2: numero(item.tiempo_captura_conteo2_segundos),
      tiempo_captura_conteo3: numero(item.tiempo_captura_conteo3_segundos),
      tiempo_captura_conteo7: numero(item.tiempo_captura_conteo7_segundos)
    }));
  }, [resumenPaginado]);

  const graficaResumenTabla = resumenPaginado.map((item) => ({
    almacen: item.almacen,
    total_articulos: numero(item.total_articulos),
    capturados: numero(item.total_capturados),
    pendientes: Math.max(numero(item.total_articulos) - numero(item.total_capturados), 0),
    avance: Number(numero(item.avance_porcentaje).toFixed(2)),
    duracion_real: numero(item.tiempo_real_segundos),
    tiempo_operativo: numero(item.tiempo_operativo_segundos),
    articulos_minuto: Number(numero(item.articulos_por_minuto).toFixed(2)),
    sesiones_abiertas: numero(item.sesiones_abiertas)
  }));

  const graficaDetalleTabla = detallePaginado.map((item) => ({
    empleado: String(item.empleado || "-"),
    conteo: `C${item.nro_conteo}`,
    empleado_conteo: `${item.empleado || "-"} C${item.nro_conteo}`,
    capturados: numero(item.articulos_capturados),
    avance: Number(numero(item.avance_porcentaje).toFixed(2)),
    tiempo_sesion: numero(item.tiempo_guardado_lote_segundos),
    tiempo_captura: numero(item.tiempo_guardado_lote_segundos),
    articulos_minuto: Number(numero(item.articulos_por_minuto).toFixed(2))
  }));

  const cambiarPaginaResumen = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginasResumen) return;
    setPaginaResumen(nuevaPagina);
  };

  const cambiarPaginaDetalle = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginasDetalle) return;
    setPaginaDetalle(nuevaPagina);
  };

  const TooltipEjecutivo = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
        <p className="font-bold text-[#611232] mb-2">{label}</p>
        {payload.map((item, index) => {
          const esTiempo =
            item.dataKey === "duracion_real" ||
            item.dataKey === "tiempo_operativo" ||
            item.dataKey === "tiempo_sesion" ||
            item.dataKey === "tiempo_captura" ||
            item.dataKey === "tiempo_conteo1" ||
            item.dataKey === "tiempo_conteo2" ||
            item.dataKey === "tiempo_conteo3" ||
            item.dataKey === "tiempo_conteo7" ||
            item.dataKey === "tiempo_captura_conteo1" ||
            item.dataKey === "tiempo_captura_conteo2" ||
            item.dataKey === "tiempo_captura_conteo3" ||
            item.dataKey === "tiempo_captura_conteo7";

          const esPorcentaje = item.dataKey === "avance";

          return (
            <p key={index} className="text-gray-700">
              <span className="font-semibold">{item.name}:</span>{" "}
              {esTiempo
                ? formatoTiempoSegundos(item.value)
                : esPorcentaje
                ? `${formatoDecimal(item.value)}%`
                : formatoDecimal(item.value)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-gradient-to-r from-[#611232] via-[#7b183b] to-[#235b4e] rounded-3xl shadow-xl p-8 mb-6 text-white">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/70 font-bold mb-2">
                SICAF · Inteligencia operativa
              </p>
              <h1 className="text-3xl md:text-4xl font-black mb-2">
                Panel Ejecutivo de Inventarios
              </h1>
              <p className="text-white/80 text-sm md:text-base max-w-4xl">
                Métricas reales de sesiones, avance, productividad, duración cronológica, tiempo operativo y ritmo real de captura por conteo.
              </p>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-2xl px-5 py-4 min-w-[260px]">
              <p className="text-xs text-white/70 uppercase font-bold">
                Estado de consulta
              </p>
              <p className="text-2xl font-black">
                {consultado ? `${formatoNumero(datos.length)} registros` : "Sin consultar"}
              </p>
              <p className="text-xs text-white/70">
                La información se carga solo al presionar Consultar métricas.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-md border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 font-bold uppercase mb-1">
                CIA
              </label>
              <select
                value={filtros.cia}
                onChange={(e) => {
                  cambiarFiltro("cia", e.target.value);
                  cargarAlmacenesPorCia(e.target.value);
                }}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
              >
                <option value="">Todas</option>
                <option value="recrefam">RECREFAM</option>
                <option value="veser">VESER</option>
                <option value="opardiv">OPARDIV</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-bold uppercase mb-1">
                CEF
              </label>
              <input
                type="text"
                list="cefs-disponibles"
                value={filtros.cef}
                onChange={(e) => {
                  cambiarFiltro("cef", e.target.value.toUpperCase());
                  cambiarFiltro("almacen", "");
                }}
                disabled={!filtros.cia || loadingAlmacenes}
                placeholder={!filtros.cia ? "Selecciona CIA" : "Buscar CEF"}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#611232] disabled:bg-gray-100 disabled:text-gray-400"
              />
              <datalist id="cefs-disponibles">
                {cefsDisponibles.map((cef) => (
                  <option key={cef} value={cef} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-bold uppercase mb-1">
                Almacén
              </label>
              <select
                value={filtros.almacen}
                onChange={(e) => cambiarFiltro("almacen", e.target.value)}
                disabled={!filtros.cia || loadingAlmacenes}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#611232] disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!filtros.cia
                    ? "Selecciona una CIA"
                    : loadingAlmacenes
                    ? "Cargando almacenes..."
                    : filtros.cef
                    ? `Todos ${filtros.cef}`
                    : "Todos los almacenes"}
                </option>

                {almacenesFiltradosPorCef.map((alm) => (
                  <option key={alm.codigo} value={alm.codigo}>
                    {alm.codigo} - {alm.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-bold uppercase mb-1">
                Empleado
              </label>
              <input
                type="text"
                value={filtros.empleado}
                onChange={(e) => cambiarFiltro("empleado", e.target.value)}
                placeholder="No. empleado"
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-bold uppercase mb-1">
                Desde
              </label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) => cambiarFiltro("fecha_desde", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-bold uppercase mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) => cambiarFiltro("fecha_hasta", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-bold uppercase mb-1">
                Conteo
              </label>
              <select
                value={filtros.nro_conteo}
                onChange={(e) => cambiarFiltro("nro_conteo", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
              >
                <option value="">Todos</option>
                <option value="1">Conteo 1</option>
                <option value="2">Conteo 2</option>
                <option value="3">Conteo 3</option>
                <option value="7">Conteo 7</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={cargarEstadisticas}
                disabled={loading}
                className="w-full px-4 py-2 rounded-xl bg-[#611232] text-white text-sm font-bold hover:bg-[#4b0d26] transition disabled:opacity-60"
              >
                {loading ? "Consultando..." : "Consultar"}
              </button>

              <button
                onClick={limpiarFiltros}
                disabled={loading}
                className="w-full px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black transition disabled:opacity-60"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {!consultado && !loading && (
          <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">
              Selecciona filtros y consulta métricas
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Las gráficas, indicadores y tablas se activan únicamente después de consultar.
            </p>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-200">
            <div className="w-12 h-12 border-4 border-[#611232]/20 border-t-[#611232] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700 font-bold">Consultando información real...</p>
            <p className="text-gray-500 text-sm">SQL está trabajando. El que se queja es el navegador.</p>
          </div>
        )}

        {consultado && !loading && datos.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-200">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">
              Sin información disponible
            </h2>
            <p className="text-gray-500">
              No hay registros con los filtros seleccionados.
            </p>
          </div>
        )}

        {consultado && !loading && datos.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase">Avance global</p>
                <p className="text-3xl font-black text-[#611232]">{formatoDecimal(avanceGlobal)}%</p>
                <p className="text-xs text-gray-500">{formatoNumero(totalCapturados)} de {formatoNumero(totalArticulosUniverso)} artículos</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase">Pendientes</p>
                <p className="text-3xl font-black text-[#9f2241]">{formatoNumero(articulosPendientes)}</p>
                <p className="text-xs text-gray-500">Artículos no capturados</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase">Duración real</p>
                <p className="text-3xl font-black text-[#235b4e]">{formatoTiempoCorto(tiempoRealTotalSegundos)}</p>
                <p className="text-xs text-gray-500">Tiempo cronológico de almacenes</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase">Tiempo operativo</p>
                <p className="text-3xl font-black text-[#bc955c]">{formatoTiempoCorto(tiempoOperativoTotalSegundos)}</p>
                <p className="text-xs text-gray-500">Tiempo efectivo de captura</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase">Productividad</p>
                <p className="text-3xl font-black text-gray-900">{formatoDecimal(productividadGeneral)}</p>
                <p className="text-xs text-gray-500">Artículos por minuto operativo</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase">Sesiones</p>
                <p className="text-3xl font-black text-red-700">{formatoNumero(totalSesiones)}</p>
                <p className="text-xs text-gray-500">{formatoNumero(sesionesAbiertas)} abiertas · {formatoNumero(sesionesCerradas)} finalizadas</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#611232] text-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-white/70 font-bold uppercase mb-1">Mayor duración real</p>
                <p className="text-2xl font-black">{almacenMasTardado?.almacen || "-"}</p>
                <p className="text-sm text-white/80">{almacenMasTardado ? formatoTiempoSegundos(almacenMasTardado.tiempo_real_segundos) : "-"}</p>
              </div>

              <div className="bg-[#7b183b] text-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-white/70 font-bold uppercase mb-1">Mayor tiempo operativo</p>
                <p className="text-2xl font-black">{almacenMayorTiempoOperativo?.almacen || "-"}</p>
                <p className="text-sm text-white/80">{almacenMayorTiempoOperativo ? formatoTiempoSegundos(almacenMayorTiempoOperativo.tiempo_operativo_segundos) : "-"}</p>
              </div>

              <div className="bg-[#235b4e] text-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-white/70 font-bold uppercase mb-1">Mejor productividad</p>
                <p className="text-2xl font-black">{almacenMasProductivo?.almacen || "-"}</p>
                <p className="text-sm text-white/80">{almacenMasProductivo ? `${formatoDecimal(almacenMasProductivo.articulos_por_minuto)} artículos/min` : "-"}</p>
              </div>

              <div className="bg-[#9f2241] text-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-white/70 font-bold uppercase mb-1">Menor avance</p>
                <p className="text-2xl font-black">{almacenMenorAvance?.almacen || "-"}</p>
                <p className="text-sm text-white/80">{almacenMenorAvance ? `${formatoDecimal(almacenMenorAvance.avance_porcentaje)}% avance` : "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              {vistaTabla === "resumen" && (
                <>
                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Capturados por almacén y conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Cada barra muestra lo capturado por conteo en los almacenes visibles.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumenPorAlmacenConteoTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="almacen" />
                          <YAxis />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="conteo1" name="Conteo 1" fill="#235b4e" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="conteo2" name="Conteo 2" fill="#611232" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="conteo3" name="Conteo 3" fill="#bc955c" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="conteo7" name="Conteo 7" fill="#6f7271" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Tiempo operativo por conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Tiempo de captura acumulado por conteo en los almacenes visibles.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumenPorAlmacenConteoTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="almacen" />
                          <YAxis tickFormatter={(value) => formatoTiempoCorto(value)} />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="tiempo_conteo1" name="Conteo 1" fill="#235b4e" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="tiempo_conteo2" name="Conteo 2" fill="#611232" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="tiempo_conteo3" name="Conteo 3" fill="#bc955c" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="tiempo_conteo7" name="Conteo 7" fill="#6f7271" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Tiempo captura por conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Tiempo real de guardado por conteo en los almacenes visibles.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumenPorAlmacenConteoTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="almacen" />
                          <YAxis tickFormatter={(value) => formatoTiempoCorto(value)} />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="tiempo_captura_conteo1" name="Conteo 1" fill="#235b4e" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="tiempo_captura_conteo2" name="Conteo 2" fill="#611232" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="tiempo_captura_conteo3" name="Conteo 3" fill="#bc955c" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="tiempo_captura_conteo7" name="Conteo 7" fill="#6f7271" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Capturados vs pendientes
                      </h2>
                      <p className="text-xs text-gray-500">
                        Misma información visible en la tabla de resumen.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={graficaResumenTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="almacen" />
                          <YAxis />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="capturados" name="Capturados" fill="#235b4e" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="pendientes" name="Pendientes" fill="#9f2241" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {vistaTabla === "detalle" && (
                <>
                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Capturados agrupados por conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Suma de capturas por cada conteo visible en la tabla.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumenPorConteoTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="conteo" />
                          <YAxis />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="capturados" name="Capturados" fill="#235b4e" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Tiempo real por conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Tiempo real de captura acumulado por conteo visible.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumenPorConteoTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="conteo" />
                          <YAxis tickFormatter={(value) => formatoTiempoCorto(value)} />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="tiempo_sesion" name="Tiempo real" fill="#611232" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Tiempo captura por conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Tiempo de guardado acumulado por conteo visible.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumenPorConteoTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="conteo" />
                          <YAxis tickFormatter={(value) => formatoTiempoCorto(value)} />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="tiempo_captura" name="Tiempo captura" fill="#bc955c" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Productividad por conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Artículos por minuto operativo en cada conteo visible.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumenPorConteoTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="conteo" />
                          <YAxis />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="articulos_minuto" name="Art/min" fill="#235b4e" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Capturados por empleado y conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Comparativo directo del empleado contra el conteo que ejecutó.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={graficaDetalleTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="empleado_conteo" />
                          <YAxis />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="capturados" name="Capturados" fill="#235b4e" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-gray-800">
                        Tiempo real por empleado y conteo
                      </h2>
                      <p className="text-xs text-gray-500">
                        Tiempo real de captura por empleado y conteo visible.
                      </p>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={graficaDetalleTabla}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="empleado_conteo" />
                          <YAxis tickFormatter={(value) => formatoTiempoCorto(value)} />
                          <Tooltip content={<TooltipEjecutivo />} />
                          <Legend />
                          <Bar dataKey="tiempo_sesion" name="Tiempo real" fill="#611232" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-black text-gray-800">
                    Tablas ejecutivas
                  </h2>
                  <p className="text-sm text-gray-500">
                    La duración real no se suma por empleado. El tiempo operativo sí.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setVistaTabla("resumen");
                      setPaginaResumen(1);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                      vistaTabla === "resumen"
                        ? "bg-[#611232] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Resumen por almacén
                  </button>

                  <button
                    onClick={() => {
                      setVistaTabla("detalle");
                      setPaginaDetalle(1);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                      vistaTabla === "detalle"
                        ? "bg-[#611232] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Detalle por empleado
                  </button>
                </div>
              </div>

              {vistaTabla === "resumen" && (
                <>
                  <div className="overflow-auto border rounded-2xl">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#611232] text-white">
                        <tr>
                          <th className="px-3 py-3 text-left">CIA</th>
                          <th className="px-3 py-3 text-left">Almacén</th>
                          <th className="px-3 py-3 text-left">Fecha</th>
                          <th className="px-3 py-3 text-right">Total artículos</th>
                          <th className="px-3 py-3 text-right">C1</th>
                          <th className="px-3 py-3 text-right">C2</th>
                          <th className="px-3 py-3 text-right">C3</th>
                          <th className="px-3 py-3 text-right">C7</th>
                          <th className="px-3 py-3 text-right">Capturados</th>
                          <th className="px-3 py-3 text-right">Pendientes</th>
                          <th className="px-3 py-3 text-right">Avance</th>
                          <th className="px-3 py-3 text-right">Duración real</th>
                          <th className="px-3 py-3 text-right">Tiempo operativo</th>
                          <th className="px-3 py-3 text-right">Art/min</th>
                          <th className="px-3 py-3 text-center">Abiertas</th>
                          <th className="px-3 py-3 text-left">Estado</th>
                        </tr>
                      </thead>

                      <tbody>
                        {resumenPaginado.map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-3">{item.cia}</td>
                            <td className="px-3 py-3 font-bold text-[#611232]">{item.almacen}</td>
                            <td className="px-3 py-3">{item.fecha_inventario}</td>
                            <td className="px-3 py-3 text-right">{formatoNumero(item.total_articulos)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoNumero(item.conteo1)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoNumero(item.conteo2)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoNumero(item.conteo3)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoNumero(item.conteo7)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoNumero(item.total_capturados)}</td>
                            <td className="px-3 py-3 text-right">{formatoNumero(Math.max(item.total_articulos - item.total_capturados, 0))}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoDecimal(item.avance_porcentaje)}%</td>
                            <td className="px-3 py-3 text-right font-bold text-[#235b4e]">{formatoTiempoSegundos(item.tiempo_real_segundos)}</td>
                            <td className="px-3 py-3 text-right font-bold text-[#611232]">{formatoTiempoSegundos(item.tiempo_operativo_segundos)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoDecimal(item.articulos_por_minuto)}</td>
                            <td className="px-3 py-3 text-center">{item.sesiones_abiertas}</td>
                            <td className="px-3 py-3">{item.estado_tiempo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end items-center gap-2 mt-4">
                    <button
                      onClick={() => cambiarPaginaResumen(paginaResumen - 1)}
                      disabled={paginaResumen === 1}
                      className="px-3 py-1 rounded-lg border text-sm disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                    >
                      Anterior
                    </button>

                    <span className="text-sm text-gray-600">
                      {paginaResumen} / {totalPaginasResumen}
                    </span>

                    <button
                      onClick={() => cambiarPaginaResumen(paginaResumen + 1)}
                      disabled={paginaResumen === totalPaginasResumen}
                      className="px-3 py-1 rounded-lg border text-sm disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </>
              )}

              {vistaTabla === "detalle" && (
                <>
                  <div className="overflow-auto border rounded-2xl">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#611232] text-white">
                        <tr>
                          <th className="px-3 py-3 text-left">CIA</th>
                          <th className="px-3 py-3 text-left">Almacén</th>
                          <th className="px-3 py-3 text-left">Fecha</th>
                          <th className="px-3 py-3 text-left">Empleado</th>
                          <th className="px-3 py-3 text-center">Conteo</th>
                          <th className="px-3 py-3 text-left">Tipo</th>
                          <th className="px-3 py-3 text-left">Inicio</th>
                          <th className="px-3 py-3 text-left">Fin</th>
                          <th className="px-3 py-3 text-right">Tiempo real</th>
                          <th className="px-3 py-3 text-right">Tiempo captura</th>
                          <th className="px-3 py-3 text-right">Capturados</th>
                          <th className="px-3 py-3 text-right">Avance</th>
                          <th className="px-3 py-3 text-right">Art/min</th>
                          <th className="px-3 py-3 text-left">Estado</th>
                        </tr>
                      </thead>

                      <tbody>
                        {detallePaginado.map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-3">{item.cia}</td>
                            <td className="px-3 py-3 font-bold text-[#611232]">{item.almacen}</td>
                            <td className="px-3 py-3">{item.fecha_inventario}</td>
                            <td className="px-3 py-3 font-semibold">{item.empleado}</td>
                            <td className="px-3 py-3 text-center font-bold">{item.nro_conteo}</td>
                            <td className="px-3 py-3">{item.tipo_conteo || "-"}</td>
                            <td className="px-3 py-3">{item.fecha_inicio}</td>
                            <td className="px-3 py-3">{item.fecha_fin || "Abierta"}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoTiempoSegundos(item.tiempo_guardado_lote_segundos)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoTiempoSegundos(item.tiempo_guardado_lote_segundos)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoNumero(item.articulos_capturados)}</td>
                            <td className="px-3 py-3 text-right">{formatoDecimal(item.avance_porcentaje)}%</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoDecimal(item.articulos_por_minuto)}</td>
                            <td className="px-3 py-3">{formatearEstadoSesion(item.estado_sesion)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end items-center gap-2 mt-4">
                    <button
                      onClick={() => cambiarPaginaDetalle(paginaDetalle - 1)}
                      disabled={paginaDetalle === 1}
                      className="px-3 py-1 rounded-lg border text-sm disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                    >
                      Anterior
                    </button>

                    <span className="text-sm text-gray-600">
                      {paginaDetalle} / {totalPaginasDetalle}
                    </span>

                    <button
                      onClick={() => cambiarPaginaDetalle(paginaDetalle + 1)}
                      disabled={paginaDetalle === totalPaginasDetalle}
                      className="px-3 py-1 rounded-lg border text-sm disabled:bg-gray-100 disabled:text-gray-400 hover:bg-gray-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
