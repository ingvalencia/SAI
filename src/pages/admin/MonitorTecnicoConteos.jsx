import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import Select from "react-select";
import { endpoint } from "../../config/apiConfig";


export default function MonitorTecnicoConteos() {
  const [cia, setCia] = useState("recrefam");
  const [almacen, setAlmacen] = useState("");
  const [cef, setCef] = useState("");
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [catalogoAlmacenes, setCatalogoAlmacenes] = useState([]);
  const [data, setData] = useState(null);

  const empleadoAdmin = localStorage.getItem("empleado") || sessionStorage.getItem("empleado") || "";

  const cefsDisponibles = useMemo(() => {
    return [
      ...new Set(
        catalogoAlmacenes
          .map((alm) => String(alm.codigo || alm.almacen || alm.local_codigo || "").split("-")[0])
          .filter(Boolean)
      ),
    ].sort();
  }, [catalogoAlmacenes]);

  const opcionesCef = useMemo(() => {
    return cefsDisponibles.map((item) => ({
      value: item,
      label: item,
    }));
  }, [cefsDisponibles]);

  const opcionCefSeleccionada = useMemo(() => {
    if (!cef) return null;
    return opcionesCef.find((op) => op.value === cef) || null;
  }, [cef, opcionesCef]);

  const almacenesFiltradosPorCef = useMemo(() => {
    if (!cef) return catalogoAlmacenes;
    return catalogoAlmacenes.filter((alm) =>
      String(alm.codigo || alm.almacen || alm.local_codigo || "").startsWith(`${cef}-`)
    );
  }, [catalogoAlmacenes, cef]);

  const opcionesAlmacenes = useMemo(() => {
    return almacenesFiltradosPorCef.map((alm) => ({
      value: alm.codigo || alm.almacen || alm.local_codigo,
      label: `${alm.codigo || alm.almacen || alm.local_codigo} - ${alm.nombre || alm.descripcion || "SIN NOMBRE"}`,
      raw: alm,
    }));
  }, [almacenesFiltradosPorCef]);

  const opcionAlmacenSeleccionada = useMemo(() => {
    if (!almacen) return null;
    return opcionesAlmacenes.find((op) => op.value === almacen) || null;
  }, [almacen, opcionesAlmacenes]);

  const cargarAlmacenes = async (ciaActual = cia) => {
    if (!ciaActual) return;

    try {
      setLoadingAlmacenes(true);

     const res = await axios.get(await endpoint("catalogo_almacenes.php"), {
        params: { cia: ciaActual },
      });

      if (!res.data.success) throw new Error(res.data.error || "No se pudo cargar catálogo de almacenes");

      setCatalogoAlmacenes(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error) {
      setCatalogoAlmacenes([]);
      Swal.fire("Error", error.response?.data?.error || error.message, "error");
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  useEffect(() => {
    setAlmacen("");
    setCef("");
    setData(null);
    cargarAlmacenes(cia);
  }, [cia]);

  const consultar = async () => {
    if (!cia || !almacen || !fecha) {
      Swal.fire("Faltan datos", "Selecciona CIA, almacén y fecha.", "warning");
      return;
    }

    try {
      setLoading(true);
      setData(null);

      const res = await axios.get(await endpoint("monitor_conteo_almacen.php"), {
        params: { cia, almacen, fecha },
      });

      if (!res.data.success) throw new Error(res.data.error || "Error consultando monitor");

      setData(res.data);
    } catch (error) {
      const mensaje =
        error.response?.data?.error ||
        error.response?.data?.detalle ||
        error.message ||
        "Error desconocido";

      Swal.fire("Error", mensaje, "error");
    } finally {
      setLoading(false);
    }
  };

  const ejecutarRollback = async (accion) => {
    if (!data || !data.resumen) return;

    const textos = {
      REGRESAR_A_CONTEO_1: "REGRESAR A CONTEO 1",
      REGRESAR_A_CONTEO_2: "REGRESAR A CONTEO 2",
      REINICIAR_ALMACEN: "REINICIAR ALMACEN",
    };

    const advertencias = {
      REGRESAR_A_CONTEO_1: "Se eliminarán los conteos posteriores y se regresará el almacén a conteo 1.",
      REGRESAR_A_CONTEO_2: "Se eliminará el conteo 3 y se regresará el almacén a conteo 2.",
      REINICIAR_ALMACEN: "Se eliminarán todos los conteos y el almacén volverá a iniciar desde cero.",
    };

    const motivo = await Swal.fire({
      title: textos[accion],
      html: `
        <div style="text-align:left">
          <p><b>CIA:</b> ${cia}</p>
          <p><b>Almacén:</b> ${almacen}</p>
          <p><b>Fecha:</b> ${fecha}</p>
          <p><b>Advertencia:</b> ${advertencias[accion]}</p>
          <p>Escribe el motivo obligatorio:</p>
        </div>
      `,
      input: "textarea",
      inputPlaceholder: "Motivo del rollback técnico",
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Cancelar",
      preConfirm: (value) => {
        if (!value || value.trim().length < 10) {
          Swal.showValidationMessage("El motivo debe tener mínimo 10 caracteres.");
          return false;
        }
        return value.trim();
      },
    });

    if (!motivo.isConfirmed) return;

    const confirmacion = await Swal.fire({
      title: "Confirmación final",
      html: `
        <div style="text-align:left">
          <p>Para ejecutar esta acción escribe exactamente:</p>
          <p><b>${textos[accion]}</b></p>
        </div>
      `,
      input: "text",
      showCancelButton: true,
      confirmButtonText: "Ejecutar rollback",
      cancelButtonText: "Cancelar",
      preConfirm: (value) => {
        if (value !== textos[accion]) {
          Swal.showValidationMessage("La confirmación no coincide.");
          return false;
        }
        return value;
      },
    });

    if (!confirmacion.isConfirmed) return;

    try {
      Swal.fire({
        title: "Ejecutando...",
        text: "No cierres esta ventana.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const formData = new FormData();
      formData.append("cia", cia);
      formData.append("almacen", almacen);
      formData.append("fecha", fecha);
      formData.append("empleado_admin", empleadoAdmin);
      formData.append("accion", accion);
      formData.append("motivo", motivo.value);

      const res = await axios.post(await endpoint("rollback_conteo_almacen.php"), formData);

      Swal.close();

      if (!res.data.success) throw new Error(res.data.error || "No se pudo ejecutar rollback");

      await Swal.fire({
        title: "Rollback ejecutado",
        html: `
          <div style="text-align:left">
            <p><b>Acción:</b> ${res.data.accion}</p>
            <p><b>Nuevo estatus:</b> ${res.data.nuevo_estatus}</p>
            <p><b>Conteos eliminados:</b> ${res.data.conteos_eliminados}</p>
            <p><b>Trace:</b> ${res.data.trace_id || "-"}</p>
          </div>
        `,
        icon: "success",
      });

      consultar();
    } catch (error) {
      Swal.close();
      Swal.fire("Error", error.response?.data?.error || error.message, "error");
    }
  };

  const resumen = data?.resumen || null;
  const usuarios = data?.usuarios || [];
  const diferencias = data?.diferencias || null;
  const cierre = data?.cierre || null;
  const sap = data?.sap || null;

  const porcentaje = (valor) => {
    const n = Number(valor || 0);
    return `${n.toFixed(2)}%`;
  };

  const numero = (valor) => {
    const n = Number(valor || 0);
    return n.toLocaleString("es-MX");
  };

  const estadoColor = (estatus) => {
    const e = Number(estatus || 0);
    if (e === 4) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (e === 3) return "bg-purple-100 text-purple-800 border-purple-200";
    if (e === 2) return "bg-blue-100 text-blue-800 border-blue-200";
    if (e === 1) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const cardPrincipal = (titulo, valor, subtitulo, etiqueta = null) => (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-gradient-to-br from-[#611232]/10 to-[#b38e5d]/10"></div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">{titulo}</p>
          {etiqueta && <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${etiqueta.className}`}>{etiqueta.texto}</span>}
        </div>
        <p className="mt-3 text-3xl font-black text-gray-900">{valor ?? "-"}</p>
        {subtitulo && <p className="mt-1 text-xs font-semibold text-gray-500">{subtitulo}</p>}
      </div>
    </div>
  );

  const cardConteo = (titulo, capturados, avance, faltantes, ultimo, tono) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">{titulo}</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{numero(capturados)}</p>
        </div>
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black ${tono}`}>
          {porcentaje(avance)}
        </div>
      </div>

      <div className="mt-5">
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-[#611232]"
            style={{ width: `${Math.min(Number(avance || 0), 100)}%` }}
          ></div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="font-black text-gray-500">Faltantes</p>
          <p className="mt-1 text-lg font-black text-gray-800">{numero(faltantes)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="font-black text-gray-500">Último movimiento</p>
          <p className="mt-1 truncate font-bold text-gray-800">{ultimo || "-"}</p>
        </div>
      </div>
    </div>
  );

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "44px",
      borderRadius: "12px",
      borderColor: state.isFocused ? "#611232" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(97,18,50,.12)" : "none",
      "&:hover": {
        borderColor: "#611232",
      },
    }),
    menu: (base) => ({
      ...base,
      zIndex: 50,
      borderRadius: "12px",
      overflow: "hidden",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? "#611232" : state.isFocused ? "#f3e8ee" : "white",
      color: state.isSelected ? "white" : "#111827",
      fontSize: "13px",
    }),
  };

  return (
    <div className="min-h-screen bg-[#f6f3ef] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#611232] via-[#7b1b40] to-[#b38e5d] shadow-xl">
          <div className="flex flex-col gap-6 p-6 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-white/90">
                Vista exclusiva desarrollador
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                Monitor Técnico de Conteos
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium text-white/80">
                Diagnóstico ejecutivo por almacén: avance, usuarios, diferencias, cierre y acciones de rescate.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right md:min-w-[280px]">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-black uppercase text-white/60">Usuario</p>
                <p className="mt-1 text-xl font-black">{empleadoAdmin || "-"}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-black uppercase text-white/60">Ambiente</p>
                <p className="mt-1 text-xl font-black">SICAF</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-black text-gray-900">Panel de consulta</h2>
            <p className="text-sm font-medium text-gray-500">Selecciona los parámetros para revisar el estado operativo del inventario.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">CIA</label>
              <select
                value={cia}
                onChange={(e) => {
                  setCia(e.target.value);
                  setCef("");
                  setAlmacen("");
                  setData(null);
                }}
                className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm font-bold text-gray-800 outline-none focus:border-[#611232] focus:ring-2 focus:ring-[#611232]/10"
              >
                <option value="recrefam">RECREFAM</option>
                <option value="veser">VESER</option>
                <option value="opardiv">OPARDIV</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">CEF</label>
              <Select
                value={opcionCefSeleccionada}
                options={opcionesCef}
                onChange={(opcion) => {
                  setCef(opcion?.value || "");
                  setAlmacen("");
                  setData(null);
                }}
                onMenuOpen={() => {
                  if (catalogoAlmacenes.length === 0) cargarAlmacenes(cia);
                }}
                isLoading={loadingAlmacenes}
                isClearable
                isSearchable
                placeholder={loadingAlmacenes ? "Cargando..." : "Busca CEF"}
                noOptionsMessage={() => "Sin CEF disponible"}
                loadingMessage={() => "Cargando..."}
                styles={selectStyles}
              />
            </div>

            <div className="lg:col-span-3">
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">Almacén</label>
              <Select
                value={opcionAlmacenSeleccionada}
                options={opcionesAlmacenes}
                onChange={(opcion) => {
                  setAlmacen(opcion?.value || "");
                  setData(null);
                }}
                onMenuOpen={() => {
                  if (catalogoAlmacenes.length === 0) cargarAlmacenes(cia);
                }}
                isLoading={loadingAlmacenes}
                isClearable
                isSearchable
                placeholder={loadingAlmacenes ? "Cargando almacenes..." : cef ? `Busca almacén ${cef}` : "Busca y selecciona un almacén"}
                noOptionsMessage={() => "Sin almacenes disponibles"}
                loadingMessage={() => "Cargando..."}
                styles={selectStyles}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  setData(null);
                }}
                className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm font-bold text-gray-800 outline-none focus:border-[#611232] focus:ring-2 focus:ring-[#611232]/10"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">Empleado admin</label>
              <input
                value={empleadoAdmin}
                disabled
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-100 px-3 text-sm font-black text-gray-500"
              />
            </div>

            <div className="flex items-end lg:col-span-1">
              <button
                onClick={consultar}
                disabled={loading}
                className="h-11 w-full rounded-xl bg-[#611232] px-4 text-sm font-black text-white shadow-lg shadow-[#611232]/20 transition hover:bg-[#4d0e28] disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? "..." : "Ver"}
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#611232]"></div>
            <p className="mt-4 text-sm font-black uppercase tracking-wider text-gray-600">Consultando información técnica</p>
          </div>
        )}

        {resumen && !loading && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cardPrincipal(
                "Estado actual",
                resumen.estado_texto,
                `Estatus ${resumen.estatus_actual}`,
                { texto: resumen.estado_texto, className: estadoColor(resumen.estatus_actual) }
              )}
              {cardPrincipal("Total artículos", numero(resumen.total_articulos), `${cia.toUpperCase()} · ${almacen} · ${fecha}`)}
              {cardPrincipal("Cierre", cierre ? "CON CIERRE" : "SIN CIERRE", cierre ? `ID ${cierre.id_cierre || "-"}` : "Aún no hay cierre generado")}
              {cardPrincipal("SAP", sap ? (Number(sap.procesado) === 1 ? "PROCESADO" : "PENDIENTE") : "SIN SEÑAL", sap?.error_msg ? `Error: ${sap.error_msg}` : "Estado de señal SAP")}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
              {cardConteo("Conteo 1", resumen.capturados_conteo_1, resumen.avance_conteo_1, resumen.faltantes_conteo_1, resumen.ultimo_movimiento_c1, "bg-amber-100 text-amber-800")}
              {cardConteo("Conteo 2", resumen.capturados_conteo_2, resumen.avance_conteo_2, resumen.faltantes_conteo_2, resumen.ultimo_movimiento_c2, "bg-blue-100 text-blue-800")}
              {cardConteo("Conteo 3", resumen.capturados_conteo_3, resumen.avance_conteo_3, resumen.faltantes_conteo_3, resumen.ultimo_movimiento_c3, "bg-purple-100 text-purple-800")}
              {cardConteo("Conteo 7", resumen.capturados_conteo_7, resumen.avance_conteo_7, resumen.faltantes_conteo_7, resumen.ultimo_movimiento_c7, "bg-gray-100 text-gray-800")}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {cardPrincipal("Diferencias C1 vs C2", numero(diferencias?.diferencias_c1_c2 || 0), "Artículos con diferencia entre primer y segundo conteo")}
              {cardPrincipal("Diferencias C2 vs C3", numero(diferencias?.diferencias_c2_c3 || 0), "Artículos con diferencia entre segundo y tercer conteo")}
              {cardPrincipal("Diferencias vs SAP", numero(diferencias?.diferencias_vs_sap || 0), "Contra base cargada en inventario")}
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900">Usuarios que capturaron</h2>
                  <p className="text-sm font-medium text-gray-500">Resumen por usuario, conteo y ventana de captura.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
                  {usuarios.length} registros
                </span>
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-600">
                    <tr>
                      <th className="p-4 text-left">Conteo</th>
                      <th className="p-4 text-left">Empleado</th>
                      <th className="p-4 text-left">Nombre</th>
                      <th className="p-4 text-right">Artículos</th>
                      <th className="p-4 text-right">Guardados</th>
                      <th className="p-4 text-left">Primer registro</th>
                      <th className="p-4 text-left">Último registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {usuarios.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-sm font-bold text-gray-500">
                          Sin capturas registradas.
                        </td>
                      </tr>
                    )}

                    {usuarios.map((u, i) => (
                      <tr key={i} className="transition hover:bg-[#f8f2f5]">
                        <td className="p-4">
                          <span className="rounded-full bg-[#611232]/10 px-3 py-1 text-xs font-black text-[#611232]">
                            C{u.nro_conteo}
                          </span>
                        </td>
                        <td className="p-4 font-black text-gray-800">{u.empleado}</td>
                        <td className="p-4 font-semibold text-gray-700">{u.nombre}</td>
                        <td className="p-4 text-right font-black text-gray-900">{numero(u.articulos_capturados)}</td>
                        <td className="p-4 text-right font-black text-gray-900">{numero(u.total_guardados || u.articulos_capturados)}</td>
                        <td className="p-4 font-medium text-gray-600">{u.primer_registro || "-"}</td>
                        <td className="p-4 font-medium text-gray-600">{u.ultimo_registro || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-red-200 bg-white shadow-sm">
              <div className="border-b border-red-100 p-5">
                <h2 className="text-lg font-black text-red-800">Acciones de rescate</h2>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Úsalas solo cuando el conteo esté atorado o se requiera reiniciar el flujo operativo.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
                <button
                  onClick={() => ejecutarRollback("REGRESAR_A_CONTEO_1")}
                  className="rounded-2xl bg-amber-600 px-4 py-4 text-sm font-black text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-700"
                >
                  Regresar a conteo 1
                </button>

                <button
                  onClick={() => ejecutarRollback("REGRESAR_A_CONTEO_2")}
                  className="rounded-2xl bg-orange-600 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700"
                >
                  Regresar a conteo 2
                </button>

                <button
                  onClick={() => ejecutarRollback("REINICIAR_ALMACEN")}
                  className="rounded-2xl bg-red-700 px-4 py-4 text-sm font-black text-white shadow-lg shadow-red-700/20 transition hover:bg-red-800"
                >
                  Reiniciar almacén
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-gray-900">Cierre</h2>
                {cierre ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black uppercase text-gray-500">ID cierre</p>
                      <p className="mt-1 font-black text-gray-900">{cierre.id_cierre || "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black uppercase text-gray-500">Estatus</p>
                      <p className="mt-1 font-black text-gray-900">{cierre.estatus_cierre || "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black uppercase text-gray-500">Total items</p>
                      <p className="mt-1 font-black text-gray-900">{numero(cierre.total_items)}</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black uppercase text-gray-500">Diferencias</p>
                      <p className="mt-1 font-black text-gray-900">{numero(cierre.total_diferencias)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-gray-50 p-6 text-sm font-bold text-gray-500">
                    Sin cierre generado para este almacén.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-gray-900">SAP Signal</h2>
                {sap ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black uppercase text-gray-500">ID signal</p>
                      <p className="mt-1 font-black text-gray-900">{sap.id_signal || "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black uppercase text-gray-500">Procesado</p>
                      <p className="mt-1 font-black text-gray-900">{String(sap.procesado ?? "-")}</p>
                    </div>
                    <div className="col-span-2 rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-black uppercase text-gray-500">Error SAP</p>
                      <p className="mt-1 font-black text-gray-900">{sap.error_msg || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-gray-50 p-6 text-sm font-bold text-gray-500">
                    Sin señal SAP para este almacén.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {!resumen && data && !loading && (
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-xl font-black text-gray-800">No existe inventario para esa selección</p>
            <p className="mt-2 text-sm font-medium text-gray-500">Revisa CIA, almacén o fecha.</p>
          </div>
        )}
      </div>
    </div>
  );
}
