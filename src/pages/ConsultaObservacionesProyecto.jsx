import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";

const API_OBSERVACIONES =
  "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/consultar_observaciones_proyecto.php";

export default function ConsultaObservacionesProyecto() {
  const [observaciones, setObservaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    cia: "",
    cef: "",
    tipo: "",
    estatus: "",
    fecha_inicio: "",
    fecha_fin: "",
  });

  const [seleccionada, setSeleccionada] = useState(null);

  useEffect(() => {
    consultarObservaciones();
  }, []);

  const tieneEvidencia = (item) => {
    return item?.tiene_evidencia == 1 || !!item?.evidencia_url;
  };

  const obtenerUrlEvidencia = (item) => {
    if (!item) return "";

    if (item.evidencia_url) {
      return item.evidencia_url;
    }

    if (item.tiene_evidencia == 1 && item.id_observacion) {
      return `${API_OBSERVACIONES}?ver_evidencia=1&id_observacion=${item.id_observacion}`;
    }

    return "";
  };

  const consultarObservaciones = async (paramsPersonalizados = null) => {
    try {
      setLoading(true);

      const params = paramsPersonalizados || filtros;

      const res = await axios.get(API_OBSERVACIONES, { params });

      if (!res.data.success) {
        throw new Error(res.data.error || "No se pudieron consultar las observaciones.");
      }

      setObservaciones(res.data.data || []);
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    const vacios = {
      cia: "",
      cef: "",
      tipo: "",
      estatus: "",
      fecha_inicio: "",
      fecha_fin: "",
    };

    setFiltros(vacios);
    consultarObservaciones(vacios);
  };

  const cambiarFiltro = (campo, valor) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  const tiposDisponibles = useMemo(() => {
    return [...new Set(observaciones.map((item) => item.tipo_observacion).filter(Boolean))];
  }, [observaciones]);

  const estadisticas = useMemo(() => {
    const total = observaciones.length;
    const abiertas = observaciones.filter((item) => item.estatus === "ABIERTA").length;
    const conEvidencia = observaciones.filter((item) => tieneEvidencia(item)).length;

    return {
      total,
      abiertas,
      conEvidencia,
    };
  }, [observaciones]);

 const exportarWord = () => {
  if (!observaciones || observaciones.length === 0) {
    Swal.fire("Sin datos", "No hay observaciones para exportar.", "warning");
    return;
  }

  const limpiarTexto = (valor) => {
    if (valor === null || valor === undefined || valor === "") return "-";

    return String(valor)
      .normalize("NFC")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n/g, "<br/>");
  };

  const fechaReporte = new Date().toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const filtrosAplicados = `
    CIA: ${limpiarTexto(filtros.cia || "Todas")} |
    CEF: ${limpiarTexto(filtros.cef || "Todos")} |
    Tipo: ${limpiarTexto(filtros.tipo || "Todos")} |
    Estatus: ${limpiarTexto(filtros.estatus || "Todos")} |
    Desde: ${limpiarTexto(filtros.fecha_inicio || "Sin filtro")} |
    Hasta: ${limpiarTexto(filtros.fecha_fin || "Sin filtro")}
  `;

  const tarjetas = observaciones
    .map((item, index) => {
      const evidencia = tieneEvidencia(item) ? "Sí" : "No";

      return `
        <div class="card">
          <div class="card-header">
            <table class="header-table">
              <tr>
                <td>
                  <span class="badge">Observación ${index + 1}</span>
                  <h2>${limpiarTexto(item.tipo_observacion)}</h2>
                </td>
                <td class="status-cell">
                  <div class="status">${limpiarTexto(item.estatus)}</div>
                </td>
              </tr>
            </table>
          </div>

          <table class="meta">
            <tr>
              <td>
                <div class="label">CIA</div>
                <div class="value">${limpiarTexto(item.cia).toUpperCase()}</div>
              </td>
              <td>
                <div class="label">CEF</div>
                <div class="value">${limpiarTexto(item.cef).toUpperCase()}</div>
              </td>
              <td>
                <div class="label">Fecha observación</div>
                <div class="value">${limpiarTexto(item.fecha_observacion)}</div>
              </td>
              <td>
                <div class="label">Responsable</div>
                <div class="value">${limpiarTexto(item.responsable)}</div>
              </td>
              <td>
                <div class="label">Evidencia</div>
                <div class="value">${evidencia}</div>
              </td>
            </tr>
          </table>

          <table class="detail">
            <tr>
              <td class="section">
                <div class="section-title">Comentario / Descripción</div>
                <div class="section-text">${limpiarTexto(item.descripcion)}</div>
              </td>
              <td class="section">
                <div class="section-title">Acción sugerida</div>
                <div class="section-text">${limpiarTexto(item.accion_sugerida || "Sin acción sugerida")}</div>
              </td>
            </tr>
          </table>

          <div class="footer-card">
            <strong>Capturó:</strong> ${limpiarTexto(item.usuario_creacion)}
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <strong>Fecha registro:</strong> ${limpiarTexto(item.fecha_creacion)}
          </div>
        </div>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Reporte Ejecutivo de Observaciones</title>
        <style>
          @page Section1 {
            size: 841.95pt 595.35pt;
            margin: 28pt 28pt 28pt 28pt;
            mso-page-orientation: landscape;
          }

          div.Section1 {
            page: Section1;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            font-size: 9pt;
            background: #ffffff;
            margin: 0;
            padding: 0;
          }

          .cover {
            border-bottom: 5px solid #611232;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }

          .title {
            background: #611232;
            color: #ffffff;
            padding: 14px 18px;
          }

          .title h1 {
            margin: 0;
            font-size: 22pt;
            letter-spacing: 0.3px;
          }

          .title p {
            margin: 5px 0 0 0;
            font-size: 9pt;
            color: #f7dce8;
          }

          .summary {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            table-layout: fixed;
          }

          .summary td {
            border: 1px solid #e5e7eb;
            background: #f9fafb;
            padding: 10px;
            width: 25%;
            vertical-align: top;
          }

          .summary .label {
            color: #6b7280;
            font-size: 7.5pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }

          .summary .number {
            color: #611232;
            font-size: 18pt;
            font-weight: bold;
            margin-top: 4px;
          }

          .filters {
            margin-top: 10px;
            padding: 8px 10px;
            background: #fff7fb;
            border-left: 5px solid #611232;
            font-size: 8pt;
            color: #374151;
          }

          .card {
            page-break-inside: avoid;
            border: 1px solid #d1d5db;
            margin-bottom: 12px;
            padding: 0;
            width: 100%;
          }

          .card-header {
            background: #f3f4f6;
            border-bottom: 1px solid #d1d5db;
            padding: 8px 10px;
          }

          .header-table {
            width: 100%;
            border-collapse: collapse;
          }

          .header-table td {
            border: none;
            vertical-align: middle;
          }

          .status-cell {
            width: 120px;
            text-align: right;
          }

          .badge {
            background: #611232;
            color: #ffffff;
            padding: 3px 7px;
            font-size: 7.5pt;
            font-weight: bold;
            text-transform: uppercase;
          }

          .card-header h2 {
            margin: 6px 0 0 0;
            color: #111827;
            font-size: 13pt;
          }

          .status {
            background: #ffffff;
            border: 1px solid #611232;
            color: #611232;
            padding: 5px 9px;
            font-weight: bold;
            font-size: 8pt;
            text-transform: uppercase;
            display: inline-block;
          }

          .meta {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .meta td {
            border-bottom: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            padding: 7px;
            vertical-align: top;
          }

          .meta td:last-child {
            border-right: none;
          }

          .label {
            color: #6b7280;
            font-size: 7pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 3px;
          }

          .value {
            color: #111827;
            font-size: 8.5pt;
            font-weight: bold;
          }

          .detail {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .detail td {
            width: 50%;
            vertical-align: top;
            padding: 10px;
            border-right: 1px solid #e5e7eb;
          }

          .detail td:last-child {
            border-right: none;
          }

          .section-title {
            color: #611232;
            font-size: 9pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 7px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 4px;
          }

          .section-text {
            font-size: 8.7pt;
            line-height: 1.35;
            color: #1f2937;
            text-align: justify;
          }

          .footer-card {
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            padding: 7px 10px;
            font-size: 8pt;
            color: #4b5563;
          }

          .document-footer {
            margin-top: 16px;
            text-align: right;
            font-size: 7.5pt;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 8px;
          }
        </style>
      </head>

      <body>
        <div class="Section1">
          <div class="cover">
            <div class="title">
              <h1>Reporte Ejecutivo de Observaciones</h1>
              <p>Hallazgos, comentarios, responsables, evidencias y acciones sugeridas del proceso de inventario.</p>
            </div>

            <table class="summary">
              <tr>
                <td>
                  <div class="label">Total de observaciones</div>
                  <div class="number">${estadisticas.total}</div>
                </td>
                <td>
                  <div class="label">Observaciones abiertas</div>
                  <div class="number">${estadisticas.abiertas}</div>
                </td>
                <td>
                  <div class="label">Con evidencia</div>
                  <div class="number">${estadisticas.conEvidencia}</div>
                </td>
                <td>
                  <div class="label">Fecha de generación</div>
                  <div class="number" style="font-size: 12pt;">${fechaReporte}</div>
                </td>
              </tr>
            </table>

            <div class="filters">
              <strong>Filtros aplicados:</strong> ${filtrosAplicados}
            </div>
          </div>

          ${tarjetas}

          <div class="document-footer">
            Documento generado automáticamente desde SICAF · ${fechaReporte}
          </div>
        </div>
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `reporte_ejecutivo_observaciones_${fechaArchivo}.doc`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-[28px] shadow-[0_25px_70px_rgba(15,23,42,0.14)] border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#4a0d26] via-[#611232] to-[#7a1740] px-8 py-7">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div>
                <p className="text-white/70 text-xs font-black tracking-[0.24em] uppercase">
                  Consulta ejecutiva
                </p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2">
                  Observaciones Capturadas
                </h1>
                <p className="text-white/75 text-sm mt-2 max-w-2xl">
                  Revisión de hallazgos, evidencias y acciones sugeridas registradas durante el cierre de inventario.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-center">
                  <p className="text-2xl font-black text-white">{estadisticas.total}</p>
                  <p className="text-[10px] text-white/60 font-black tracking-widest uppercase">
                    Total
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-center">
                  <p className="text-2xl font-black text-white">{estadisticas.abiertas}</p>
                  <p className="text-[10px] text-white/60 font-black tracking-widest uppercase">
                    Abiertas
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-center">
                  <p className="text-2xl font-black text-white">{estadisticas.conEvidencia}</p>
                  <p className="text-[10px] text-white/60 font-black tracking-widest uppercase">
                    Evidencia
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-[0.18em] mb-2">
                    CIA
                  </label>
                  <select
                    value={filtros.cia}
                    onChange={(e) => cambiarFiltro("cia", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                  >
                    <option value="">Todas</option>
                    <option value="recrefam">RECREFAM</option>
                    <option value="veser">VESER</option>
                    <option value="opardiv">OPARDIV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-[0.18em] mb-2">
                    CEF
                  </label>
                  <input
                    type="text"
                    value={filtros.cef}
                    onChange={(e) => cambiarFiltro("cef", e.target.value.toUpperCase())}
                    placeholder="Ej. CJN"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-[0.18em] mb-2">
                    Tipo
                  </label>
                  <select
                    value={filtros.tipo}
                    onChange={(e) => cambiarFiltro("tipo", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                  >
                    <option value="">Todos</option>
                    {tiposDisponibles.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-[0.18em] mb-2">
                    Estatus
                  </label>
                  <select
                    value={filtros.estatus}
                    onChange={(e) => cambiarFiltro("estatus", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                  >
                    <option value="">Todos</option>
                    <option value="ABIERTA">ABIERTA</option>
                    <option value="CERRADA">CERRADA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-[0.18em] mb-2">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={filtros.fecha_inicio}
                    onChange={(e) => cambiarFiltro("fecha_inicio", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-[0.18em] mb-2">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={filtros.fecha_fin}
                    onChange={(e) => cambiarFiltro("fecha_fin", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={limpiarFiltros}
                  className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-black hover:bg-gray-100 transition"
                >
                  Limpiar
                </button>

                <button
                  onClick={exportarWord}
                  disabled={loading || observaciones.length === 0}
                  className={`px-6 py-2.5 rounded-xl text-sm font-black shadow transition ${
                    loading || observaciones.length === 0
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-blue-900 text-white hover:bg-blue-950"
                  }`}
                >
                  Descargar Word
                </button>

                <button
                  onClick={() => consultarObservaciones()}
                  className="px-6 py-2.5 rounded-xl bg-[#611232] text-white text-sm font-black shadow-[0_12px_30px_rgba(97,18,50,0.25)] hover:bg-[#4a0d26] transition"
                >
                  Buscar
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-[#611232] font-black">
                Consultando observaciones...
              </div>
            ) : observaciones.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center bg-gray-50 border border-gray-100 rounded-2xl text-center">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-900 font-black">Sin observaciones</p>
                <p className="text-gray-500 text-sm mt-1">
                  No se encontraron registros con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <div className="overflow-auto border border-gray-100 rounded-2xl shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-4 text-left">#</th>
                      <th className="p-4 text-left">CIA</th>
                      <th className="p-4 text-left">CEF</th>
                      <th className="p-4 text-left">Fecha</th>
                      <th className="p-4 text-left">Responsable</th>
                      <th className="p-4 text-left">Tipo</th>
                      <th className="p-4 text-left">Descripción</th>
                      <th className="p-4 text-left">Estatus</th>
                      <th className="p-4 text-center">Evidencia</th>
                      <th className="p-4 text-center">Detalle</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-100">
                    {observaciones.map((item, index) => {
                      const urlEvidencia = obtenerUrlEvidencia(item);

                      return (
                        <tr key={item.id_observacion} className="hover:bg-[#611232]/[0.03] transition">
                          <td className="p-4 font-bold text-gray-500">{index + 1}</td>
                          <td className="p-4 font-bold text-gray-800 uppercase">{item.cia}</td>
                          <td className="p-4 font-bold text-[#611232]">{item.cef}</td>
                          <td className="p-4 text-gray-700">{item.fecha_observacion}</td>
                          <td className="p-4 font-semibold text-gray-700">{item.responsable}</td>
                          <td className="p-4 text-gray-700">{item.tipo_observacion}</td>
                          <td className="p-4 text-gray-600 max-w-[280px] truncate">{item.descripcion}</td>
                          <td className="p-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-black ${
                                item.estatus === "ABIERTA"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {item.estatus}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {tieneEvidencia(item) && urlEvidencia ? (
                              <a
                                href={urlEvidencia}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#611232] text-white text-xs font-black hover:bg-[#4a0d26]"
                              >
                                Ver
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs font-bold">Sin evidencia</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => setSeleccionada(item)}
                              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 text-xs font-black hover:bg-gray-200 transition"
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {seleccionada && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-3xl w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#4a0d26] via-[#611232] to-[#7a1740] px-7 py-5 flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-black tracking-[0.20em] uppercase">
                  Detalle de observación
                </p>
                <h2 className="text-2xl font-black text-white mt-1">
                  {seleccionada.cef} · {seleccionada.tipo_observacion}
                </h2>
              </div>

              <button
                onClick={() => setSeleccionada(null)}
                className="w-10 h-10 rounded-full bg-white/10 text-white font-black hover:bg-white/20"
              >
                ×
              </button>
            </div>

            <div className="p-7">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider">CIA</p>
                  <p className="text-sm font-black text-gray-900 mt-1 uppercase">{seleccionada.cia}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Fecha</p>
                  <p className="text-sm font-black text-gray-900 mt-1">{seleccionada.fecha_observacion}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Responsable</p>
                  <p className="text-sm font-black text-gray-900 mt-1">{seleccionada.responsable}</p>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-[0.18em] mb-2">
                  Descripción
                </p>
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {seleccionada.descripcion}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-[0.18em] mb-2">
                  Acción sugerida
                </p>
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {seleccionada.accion_sugerida || "Sin acción sugerida"}
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-gray-100 pt-5">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-[0.18em]">
                    Registro
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Capturado por {seleccionada.usuario_creacion || "-"} el {seleccionada.fecha_creacion}
                  </p>
                </div>

                {tieneEvidencia(seleccionada) && obtenerUrlEvidencia(seleccionada) && (
                  <a
                    href={obtenerUrlEvidencia(seleccionada)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 rounded-xl bg-[#611232] text-white text-sm font-black hover:bg-[#4a0d26] transition"
                  >
                    Ver evidencia
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
