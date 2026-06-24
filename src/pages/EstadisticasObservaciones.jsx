import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";

const API_BASE = "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap";

export default function EstadisticasObservaciones() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [cia, setCia] = useState("");
  const [cef, setCef] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [panelActivo, setPanelActivo] = useState("resumen");

  const cargarEstadisticas = async (filtros = null) => {
    try {
      setLoading(true);

      const params = filtros || {
        cia,
        cef,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      };

      const res = await axios.get(`${API_BASE}/estadisticas_observaciones.php`, {
        params,
      });

      if (!res.data.success) {
        throw new Error(res.data.error || "No se pudo cargar la estadística");
      }

      setData(res.data);
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstadisticas({
      cia: "",
      cef: "",
      fecha_inicio: "",
      fecha_fin: "",
    });
  }, []);

  const resumen = data?.resumen || {};
  const analisis = data?.analisis_global || {};
  const problemasDetectados = data?.problemas_detectados || [];
  const temasDetectados = data?.temas_detectados || [];
  const tendenciaDiaria = data?.tendencia_diaria || [];
  const topCef = data?.top_cef || [];
  const topResponsables = data?.top_responsables || [];
  const porEstatus = data?.por_estatus || [];

  const maxProblemas = useMemo(() => {
    if (!problemasDetectados.length) return 1;
    return Math.max(...problemasDetectados.map((x) => Number(x.total || 0)), 1);
  }, [problemasDetectados]);

  const maxCef = useMemo(() => {
    if (!topCef.length) return 1;
    return Math.max(...topCef.map((x) => Number(x.total || 0)), 1);
  }, [topCef]);

  const maxResponsables = useMemo(() => {
    if (!topResponsables.length) return 1;
    return Math.max(...topResponsables.map((x) => Number(x.total || 0)), 1);
  }, [topResponsables]);

  const maxTendencia = useMemo(() => {
    if (!tendenciaDiaria.length) return 1;
    return Math.max(...tendenciaDiaria.map((x) => Number(x.total || 0)), 1);
  }, [tendenciaDiaria]);

  const maxTemas = useMemo(() => {
    if (!temasDetectados.length) return 1;
    return Math.max(...temasDetectados.map((x) => Number(x.total || 0)), 1);
  }, [temasDetectados]);

  const limpiarFiltros = () => {
    setCia("");
    setCef("");
    setFechaInicio("");
    setFechaFin("");

    cargarEstadisticas({
      cia: "",
      cef: "",
      fecha_inicio: "",
      fecha_fin: "",
    });
  };

  const porcentaje = (valor, total) => {
    const v = Number(valor || 0);
    const t = Number(total || 0);
    if (t <= 0) return 0;
    return Math.round((v * 100) / t);
  };

  const CardResumen = ({ titulo, valor, detalle, icono, variante = "normal" }) => {
    const estilos = {
      normal: "from-white to-slate-50 border-slate-200 text-slate-900",
      dark: "from-[#101935] to-[#172554] border-blue-950 text-white",
      warning: "from-amber-50 to-orange-50 border-amber-200 text-amber-950",
      success: "from-emerald-50 to-green-50 border-emerald-200 text-emerald-950",
      danger: "from-red-50 to-rose-50 border-red-200 text-red-950",
    };

    return (
      <div className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${estilos[variante]} p-5 shadow-sm`}>
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-black/5"></div>
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] font-black opacity-60">{titulo}</p>
            <p className="text-4xl font-black mt-3 leading-none">{valor}</p>
            <p className="text-sm mt-2 opacity-70">{detalle}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/70 shadow-sm flex items-center justify-center text-2xl">
            {icono}
          </div>
        </div>
      </div>
    );
  };

  const BarraHorizontal = ({ etiqueta, valor, maximo, detalle }) => {
    const ancho = maximo > 0 ? Math.max(5, Math.round((Number(valor || 0) * 100) / maximo)) : 0;

    return (
      <div className="mb-5 last:mb-0">
        <div className="flex justify-between gap-4 mb-2">
          <div className="min-w-0">
            <p className="font-black text-slate-800 truncate">{etiqueta || "Sin dato"}</p>
            {detalle && <p className="text-xs text-slate-500 mt-0.5">{detalle}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-slate-950">{valor}</p>
          </div>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-[#611232] to-[#9f2241] rounded-full" style={{ width: `${ancho}%` }} />
        </div>
      </div>
    );
  };

  const BarraVertical = ({ etiqueta, valor, maximo }) => {
    const alto = maximo > 0 ? Math.max(8, Math.round((Number(valor || 0) * 100) / maximo)) : 0;

    return (
      <div className="flex flex-col items-center justify-end min-w-[64px]">
        <div className="text-xs font-black text-slate-800 mb-2">{valor}</div>
        <div className="h-44 w-9 bg-slate-100 rounded-t-xl flex items-end overflow-hidden shadow-inner">
          <div className="w-full bg-gradient-to-t from-[#611232] to-[#9f2241] rounded-t-xl" style={{ height: `${alto}%` }} />
        </div>
        <div className="text-[11px] text-slate-500 mt-2 text-center w-20 truncate">{etiqueta}</div>
      </div>
    );
  };

  const Pill = ({ children }) => (
    <span className="inline-flex items-center rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs font-bold text-white/90">
      {children}
    </span>
  );

  const Lista = ({ items, vacio = "Sin información suficiente." }) => {
    if (!items || items.length === 0) {
      return <p className="text-sm text-slate-400">{vacio}</p>;
    }

    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="mt-0.5 w-6 h-6 rounded-full bg-[#611232] text-white flex items-center justify-center text-xs font-black">
              {index + 1}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    );
  };

  const Comentarios = ({ items }) => {
    if (!items || items.length === 0) {
      return <p className="text-sm text-slate-400">Sin comentarios para mostrar.</p>;
    }

    return (
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-[#611232]/10 text-[#611232] text-xs font-black">
                  {item.categoria || "Sin categoría"}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {item.cef || "Sin CEF"}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {item.estatus || "Sin estatus"}
                </span>
                {Number(item.tiene_evidencia || 0) === 1 ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    Con evidencia
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    Sin evidencia
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-bold">{item.fecha_observacion || ""}</p>
            </div>

            <p className="text-xs uppercase tracking-[0.18em] font-black text-slate-400 mb-1">
              Responsable
            </p>
            <p className="text-sm font-black text-slate-800 mb-3">
              {item.responsable || "Sin responsable"}
            </p>

            <p className="text-xs uppercase tracking-[0.18em] font-black text-slate-400 mb-1">
              Comentario
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {item.descripcion || "Sin descripción"}
            </p>

            {item.accion_sugerida && (
              <>
                <p className="text-xs uppercase tracking-[0.18em] font-black text-slate-400 mb-1 mt-4">
                  Acción sugerida
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {item.accion_sugerida}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const ProblemaCard = ({ item, index }) => {
    const topCefItem = item.top_cef && item.top_cef.length > 0 ? item.top_cef[0] : null;
    const topResponsableItem = item.top_responsables && item.top_responsables.length > 0 ? item.top_responsables[0] : null;
    const topEstatusItem = item.top_estatus && item.top_estatus.length > 0 ? item.top_estatus[0] : null;

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] font-black text-slate-400">Foco #{index + 1}</p>
            <h3 className="text-xl font-black text-slate-950 mt-1">{item.categoria}</h3>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[#611232]">{item.total}</p>
            <p className="text-xs font-bold text-slate-400">observaciones</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <p className="text-xs text-slate-400 font-black uppercase">CEF dominante</p>
            <p className="text-sm font-black text-slate-800 mt-1">
              {topCefItem ? `${topCefItem.nombre} (${topCefItem.total})` : "Sin dato"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <p className="text-xs text-slate-400 font-black uppercase">Responsable</p>
            <p className="text-sm font-black text-slate-800 mt-1">
              {topResponsableItem ? `${topResponsableItem.nombre} (${topResponsableItem.total})` : "Sin dato"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <p className="text-xs text-slate-400 font-black uppercase">Estatus</p>
            <p className="text-sm font-black text-slate-800 mt-1">
              {topEstatusItem ? `${topEstatusItem.nombre} (${topEstatusItem.total})` : "Sin dato"}
            </p>
          </div>
        </div>

        <BarraHorizontal etiqueta="Peso dentro del análisis" valor={item.total} maximo={maxProblemas} />

        {item.ejemplos && item.ejemplos.length > 0 && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.18em] font-black text-slate-400 mb-3">
              Ejemplos reales
            </p>
            <div className="space-y-3">
              {item.ejemplos.slice(0, 3).map((ejemplo, i) => (
                <div key={i} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="flex flex-wrap justify-between gap-2 mb-2">
                    <p className="text-xs font-black text-[#611232]">{ejemplo.cef || "Sin CEF"}</p>
                    <p className="text-xs text-slate-400 font-bold">{ejemplo.responsable || "Sin responsable"}</p>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{ejemplo.descripcion || "Sin descripción"}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-10 text-center">
          <div className="w-14 h-14 border-4 border-[#611232]/20 border-t-[#611232] rounded-full animate-spin mx-auto mb-5" />
          <p className="text-slate-800 font-black">Analizando observaciones...</p>
          <p className="text-sm text-slate-500 mt-1">Leyendo comentarios, focos y evidencia.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <div className="max-w-[1500px] mx-auto p-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0b1024] via-[#172554] to-[#611232] text-white p-8 mb-6 shadow-2xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-white rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#9f2241] rounded-full blur-3xl"></div>
          </div>

          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-2 mb-5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-black uppercase tracking-[0.22em]">
                  Inteligencia operativa
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                Observaciones del Inventario
              </h1>

              <p className="text-white/75 max-w-3xl mt-3 leading-relaxed">
                Resumen ejecutivo, lectura de comentarios, focos de riesgo, evidencia y acciones recomendadas para tomar decisiones sin buscar aguja en pajar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>{resumen.total_observaciones || 0} observaciones</Pill>
              <Pill>{resumen.abiertas || 0} abiertas</Pill>
              <Pill>{resumen.con_evidencia || 0} con evidencia</Pill>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.16em] mb-2">CIA</label>
              <select
                value={cia}
                onChange={(e) => setCia(e.target.value)}
                className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#611232]"
              >
                <option value="">Todas</option>
                <option value="recrefam">RECREFAM</option>
                <option value="veser">VESER</option>
                <option value="opardiv">OPARDIV</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.16em] mb-2">CEF</label>
              <input
                value={cef}
                onChange={(e) => setCef(e.target.value.toUpperCase())}
                placeholder="Ej. ERM"
                className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.16em] mb-2">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.16em] mb-2">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#611232]"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => cargarEstadisticas()}
                disabled={loading}
                className="flex-1 bg-[#611232] hover:bg-[#4a0d26] disabled:bg-slate-400 text-white font-black px-5 py-3 rounded-2xl shadow-sm transition"
              >
                {loading ? "Buscando..." : "Buscar"}
              </button>
              <button
                onClick={limpiarFiltros}
                disabled={loading}
                className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-800 font-black px-5 py-3 rounded-2xl transition"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
              <CardResumen
                titulo="Total"
                valor={resumen.total_observaciones || 0}
                detalle="Registros activos analizados"
                icono="📋"
                variante="dark"
              />
              <CardResumen
                titulo="Abiertas"
                valor={resumen.abiertas || 0}
                detalle={`${analisis.porcentaje_abiertas || 0}% del total`}
                icono="🔥"
                variante={Number(resumen.abiertas || 0) > 0 ? "warning" : "normal"}
              />
              <CardResumen
                titulo="Cerradas"
                valor={resumen.cerradas || 0}
                detalle={`${analisis.porcentaje_cerradas || 0}% del total`}
                icono="✅"
                variante="success"
              />
              <CardResumen
                titulo="Evidencia"
                valor={`${analisis.porcentaje_evidencia || 0}%`}
                detalle={`${resumen.con_evidencia || 0} observaciones documentadas`}
                icono="📎"
                variante={Number(analisis.porcentaje_evidencia || 0) < 50 ? "danger" : "success"}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              <div className="xl:col-span-2 relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#101935] via-[#172554] to-[#0f172a] text-white p-7 shadow-xl">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-blue-200 font-black">
                        Lectura ejecutiva
                      </p>
                      <h2 className="text-3xl font-black mt-2">
                        {analisis.problema_principal || "Sin patrón dominante"}
                      </h2>
                      <p className="text-sm text-white/70 mt-2">
                        {analisis.total_problema_principal || 0} observaciones asociadas al foco principal
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 min-w-[260px]">
                      <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                        <p className="text-xs text-blue-200 font-black uppercase">CEF crítico</p>
                        <p className="text-xl font-black mt-1">{analisis.cef_mas_afectado || "N/A"}</p>
                        <p className="text-xs text-white/60">{analisis.total_cef_mas_afectado || 0} registros</p>
                      </div>
                      <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                        <p className="text-xs text-blue-200 font-black uppercase">Responsable</p>
                        <p className="text-xl font-black mt-1 truncate">{analisis.responsable_mas_cargado || "N/A"}</p>
                        <p className="text-xs text-white/60">{analisis.total_responsable_mas_cargado || 0} registros</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 p-5 mb-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-blue-200 font-black mb-3">
                      Resumen de comentarios
                    </p>
                    <p className="text-sm leading-relaxed text-white/95">
                      {analisis.resumen_comentarios || "Sin resumen disponible."}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-blue-200 font-black mb-3">
                      Qué significa
                    </p>
                    <p className="text-sm leading-relaxed text-white/95">
                      {analisis.lectura_ejecutiva || analisis.recomendacion || "Sin lectura ejecutiva disponible."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] font-black text-slate-400 mb-4">
                  Focos de riesgo
                </p>

                {analisis.focos_riesgo && analisis.focos_riesgo.length > 0 ? (
                  <div className="space-y-3">
                    {analisis.focos_riesgo.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 rounded-2xl bg-[#611232]/5 border border-[#611232]/10 p-4">
                        <div className="w-9 h-9 rounded-xl bg-[#611232] text-white flex items-center justify-center font-black">
                          {index + 1}
                        </div>
                        <p className="text-sm font-black text-slate-800">{item}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin focos de riesgo detectados.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] font-black text-slate-400">
                      Hallazgos
                    </p>
                    <h2 className="text-2xl font-black text-slate-950 mt-1">
                      Qué está pasando
                    </h2>
                  </div>
                  <div className="text-3xl">🔎</div>
                </div>
                <Lista items={analisis.hallazgos || []} />
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] font-black text-slate-400">
                      Plan de acción
                    </p>
                    <h2 className="text-2xl font-black text-slate-950 mt-1">
                      Qué hacer
                    </h2>
                  </div>
                  <div className="text-3xl">🎯</div>
                </div>
                <Lista items={analisis.acciones_recomendadas || []} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm mb-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { id: "resumen", label: "Resumen", icono: "📊" },
                  { id: "problemas", label: "Problemas", icono: "🧠" },
                  { id: "comentarios", label: "Comentarios", icono: "💬" },
                  { id: "tendencia", label: "Tendencia", icono: "📈" },
                  { id: "detalle", label: "Detalle", icono: "📌" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setPanelActivo(item.id)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                      panelActivo === item.id
                        ? "bg-[#611232] text-white shadow-md"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="mr-2">{item.icono}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {panelActivo === "resumen" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    Problemas detectados por comentarios
                  </h2>
                  {problemasDetectados.length > 0 ? (
                    problemasDetectados.map((item, index) => (
                      <BarraHorizontal
                        key={index}
                        etiqueta={item.categoria}
                        valor={item.total}
                        maximo={maxProblemas}
                        detalle={item.top_cef && item.top_cef[0] ? `Principal CEF: ${item.top_cef[0].nombre}` : ""}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Sin datos.</p>
                  )}
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    Temas más mencionados
                  </h2>
                  {temasDetectados.length > 0 ? (
                    temasDetectados.map((item, index) => (
                      <BarraHorizontal
                        key={index}
                        etiqueta={item.nombre}
                        valor={item.total}
                        maximo={maxTemas}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Sin datos.</p>
                  )}
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    CEF con más observaciones
                  </h2>
                  {topCef.length > 0 ? (
                    topCef.map((item, index) => (
                      <BarraHorizontal
                        key={index}
                        etiqueta={item.cef}
                        valor={item.total}
                        maximo={maxCef}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Sin datos.</p>
                  )}
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    Responsables con mayor carga
                  </h2>
                  {topResponsables.length > 0 ? (
                    topResponsables.map((item, index) => (
                      <BarraHorizontal
                        key={index}
                        etiqueta={item.responsable}
                        valor={item.total}
                        maximo={maxResponsables}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Sin datos.</p>
                  )}
                </div>
              </div>
            )}

            {panelActivo === "problemas" && (
              <div className="grid grid-cols-1 gap-6 mb-6">
                {problemasDetectados.length > 0 ? (
                  problemasDetectados.map((item, index) => (
                    <ProblemaCard key={index} item={item} index={index} />
                  ))
                ) : (
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-slate-400">
                    Sin problemas detectados.
                  </div>
                )}
              </div>
            )}

            {panelActivo === "comentarios" && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <div className="xl:col-span-1 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    Abiertos
                  </h2>
                  <Comentarios items={analisis.comentarios_abiertos || []} />
                </div>

                <div className="xl:col-span-1 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    Sin evidencia
                  </h2>
                  <Comentarios items={analisis.comentarios_sin_evidencia || []} />
                </div>

                <div className="xl:col-span-1 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    Recientes / relevantes
                  </h2>
                  <Comentarios items={analisis.comentarios_relevantes || []} />
                </div>
              </div>
            )}

            {panelActivo === "tendencia" && (
              <div className="grid grid-cols-1 gap-6 mb-6">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] font-black text-slate-400">
                        Evolución diaria
                      </p>
                      <h2 className="text-2xl font-black text-slate-950 mt-1">
                        Tendencia de observaciones
                      </h2>
                    </div>
                    <div className="text-sm font-bold text-slate-500">
                      {tendenciaDiaria.length} días
                    </div>
                  </div>

                  {tendenciaDiaria.length > 0 ? (
                    <div className="overflow-x-auto">
                      <div className="flex gap-5 items-end min-w-max pt-4 pb-2">
                        {tendenciaDiaria.map((item, index) => (
                          <BarraVertical
                            key={index}
                            etiqueta={item.fecha}
                            valor={item.total}
                            maximo={maxTendencia}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Sin datos.</p>
                  )}
                </div>
              </div>
            )}

            {panelActivo === "detalle" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    Observaciones por estatus
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700">
                          <th className="text-left p-4 rounded-l-2xl">Estatus</th>
                          <th className="text-right p-4">Total</th>
                          <th className="text-right p-4 rounded-r-2xl">Peso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {porEstatus.length > 0 ? (
                          porEstatus.map((item, index) => (
                            <tr key={index} className="border-b border-slate-100">
                              <td className="p-4 font-black text-slate-700">{item.estatus || "Sin estatus"}</td>
                              <td className="p-4 text-right font-black text-slate-900">{item.total}</td>
                              <td className="p-4 text-right font-bold text-slate-500">
                                {porcentaje(item.total, resumen.total_observaciones)}%
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="p-4 text-center text-slate-400">
                              Sin datos.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950 mb-5">
                    Indicadores de control
                  </h2>

                  <div className="space-y-4">
                    <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                      <div className="flex justify-between mb-2">
                        <p className="font-black text-slate-800">Cierre de observaciones</p>
                        <p className="font-black text-slate-950">{analisis.porcentaje_cerradas || 0}%</p>
                      </div>
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-3 bg-emerald-600 rounded-full" style={{ width: `${analisis.porcentaje_cerradas || 0}%` }} />
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                      <div className="flex justify-between mb-2">
                        <p className="font-black text-slate-800">Evidencia documental</p>
                        <p className="font-black text-slate-950">{analisis.porcentaje_evidencia || 0}%</p>
                      </div>
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-3 bg-[#611232] rounded-full" style={{ width: `${analisis.porcentaje_evidencia || 0}%` }} />
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                      <div className="flex justify-between mb-2">
                        <p className="font-black text-slate-800">Pendientes abiertos</p>
                        <p className="font-black text-slate-950">{analisis.porcentaje_abiertas || 0}%</p>
                      </div>
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-3 bg-amber-500 rounded-full" style={{ width: `${analisis.porcentaje_abiertas || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
