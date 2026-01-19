import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

import axios from "axios";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";


const coloresEstatus = {
  0: { color: "bg-gray-300", label: "Sin conteo", icono: "➕" },
  1: { color: "bg-red-500", label: "Conteo 1", icono: "🔴" },
  2: { color: "bg-yellow-400", label: "Conteo 2", icono: "🟡" },
  3: { color: "bg-green-500", label: "Conteo 3", icono: "🟢" },
  4: { color: "bg-blue-600", label: "Finalizado", icono: "🔵" },
};


export default function Mapa({ drawerRootId }) {
  const [almacenes, setAlmacenes] = useState([]);
  const [cia, setCia] = useState("");
  const [fecha, setFecha] = useState("");
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 100;

  const [fechasDisponibles, setFechasDisponibles] = useState([]);

  const [mostrarDrawer, setMostrarDrawer] = useState(false);
  const [estatusInventario, setEstatusInventario] = useState(null);
  const [tabActiva, setTabActiva] = useState("resumen");
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [almacenFiltro, setAlmacenFiltro] = useState("TODOS");

  const [sapRefrescado, setSapRefrescado] = useState(null); // null | 0 | 1
  const [procesandoRefresh, setProcesandoRefresh] = useState(false);

  const [mostrarConteo4, setMostrarConteo4] = useState(false);





  const fetchFechasDisponibles = async (ciaSeleccionada) => {
    const ciaActiva = ciaSeleccionada || cia;
    if (!ciaActiva) {
      Swal.fire("Falta dato", "Debes seleccionar una CIA.", "warning");
      return;
    }

    try {
      Swal.fire({
        title: "Procesando...",
        text: "Cargando fechas disponibles, por favor espera.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/mapa_fechas.php",
        { params: { cia: ciaActiva } }
      );

      Swal.close();

      if (res.data.success) {
        setFechasDisponibles(res.data.data);
        if (res.data.data.length === 0) {
          Swal.fire("Sin datos", "No se encontraron fechas con registros para esta CIA.", "info");
        }
      } else {
        Swal.fire("Error", res.data.error || "Error al obtener las fechas.", "error");
      }
    } catch (err) {
      Swal.close();
      console.error("Error al cargar fechas:", err);
      Swal.fire("Error", "No se pudieron cargar las fechas disponibles.", "error");
    }
  };


  useEffect(() => {
    if (cia) {
      fetchFechasDisponibles(cia);
    }
  }, [cia]);


 const fetchAlmacenes = async () => {
    if (!cia || !fecha) {
      Swal.fire("Faltan datos", "Debes seleccionar una CIA y una fecha.", "warning");
      return;
    }

    try {
      Swal.fire({
        title: "Procesando...",
        text: "Obteniendo información de los almacenes, por favor espera.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await axios.get(
        `https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/mapa_operaciones.php`,
        { params: { cia, fecha } }
      );

      Swal.close();

      if (res.data.success) {

        const data = Array.isArray(res.data.data) ? res.data.data : [];

        const listaAplanada =
          data.length > 0 && data[0]?.registros
            ? data.flatMap((b) => Array.isArray(b.registros) ? b.registros : [])
            : data; //

        if (res.data.success) {
          const bloques = Array.isArray(res.data.data) ? res.data.data : [];
          setAlmacenes(bloques);

          if (bloques.length === 0) {
            Swal.fire("Sin datos", "No se encontraron almacenes para la CIA y fecha seleccionada.", "warning");
          }
        }


        if (listaAplanada.length === 0) {
          Swal.fire(
            "Sin datos",
            "No se encontraron almacenes para la CIA y fecha seleccionada.",
            "warning"
          );
        }
      }
      else {
              Swal.fire("Error", res.data.error || "Error desconocido en la carga de datos.", "error");
            }
          } catch (err) {
            Swal.close();
            console.error("Error al cargar almacenes:", err);
            Swal.fire("Error", "No se pudieron cargar los almacenes.", "error");
          }
        };

    const filtrarArticulosValidos = (data = []) => {
      return data.filter((item) => {
        const sap = Number(item.inventario_sap ?? 0);

        const c1 = Number(item.conteo1 ?? 0);
        const c2 = Number(item.conteo2 ?? 0);
        const c3 = Number(item.conteo3 ?? 0);
        const c4 = Number(item.conteo4 ?? 0);

        //
        // Mostrar SOLO si tiene SAP o algún conteo
        return sap !== 0 || c1 !== 0 || c2 !== 0 || c3 !== 0 || c4 !== 0;
      });
    };


    const normalizarDetalle = (data = []) => {
      return (Array.isArray(data) ? data : []).map((item) => {
        const c1 = Number(item.conteo1 ?? 0);
        const c2 = Number(item.conteo2 ?? 0);
        const c3 = Number(item.conteo3 ?? 0);

        let conteo_final = 0;
        if (c3 > 0) conteo_final = c3;
        else if (c2 > 0) conteo_final = c2;
        else conteo_final = c1;

        const sap_final = Number(item.inventario_sap ?? 0);
        const diferencia_cierre = conteo_final - sap_final;

        return {
          ...item,
          conteo1: c1,
          conteo2: c2,
          conteo3: c3,
          inventario_sap: sap_final,
          conteo_final,
          sap_final,
          diferencia_cierre,
        };
      });
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
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/mapa_detalle.php",
        { params: { almacen: almacenSeleccionado, fecha, cia } }
      );

      Swal.close();

      if (res.data.success) {
        // 🔥 Guardar estatus del inventario
        setEstatusInventario(Number(res.data.estatus));

        //  consultar si SAP ya fue refrescado
        try {
          const resp = await axios.get(
            "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/estado_refresh_sap.php",
            { params: { almacen: almacenSeleccionado, fecha, cia } }
          );

          if (resp.data.success) {
            setSapRefrescado(Number(resp.data.sap_refrescado) === 1);

          } else {
            setSapRefrescado(null);
          }
        } catch {
          setSapRefrescado(null);
        }


        // ✅ Normaliza para que siempre tengas: almacen, sap_final, conteo_final, diferencia_cierre
        const detalleConFinal = normalizarDetalle(res.data.data);

       setDetalle(filtrarArticulosValidos(detalleConFinal));

        setPaginaActual(1);

        if (res.data.data.length === 0) {
          Swal.fire("Sin datos", "No hay información para este almacén y fecha.", "info");
        }
      } else {
        Swal.fire("Error", res.data.error || "No se pudo obtener el detalle.", "error");
      }
    } catch (err) {
      Swal.close();
      console.error("Error al obtener detalle:", err);
      Swal.fire("Error", "No se pudo obtener el detalle del almacén.", "error");
    }
  };

 const fetchDetalleGrupo = async (grupo) => {
  if (!cia || !fecha || !grupo?.base || !grupo?.almacenes?.length) return;

  try {
    Swal.fire({
      title: "Procesando...",
      text: `Obteniendo detalle del grupo ${grupo.base}...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    /* ===============================
       1. OBTENER DETALLE DEL GRUPO
    ================================ */
    const res = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/mapa_detalle_grupo.php",
      {
        params: {
          grupo: grupo.base,
          fecha,
          cia,
          usuario: sessionStorage.getItem("empleado"),
        },
      }
    );

    const hayConteo4 = res.data.data?.some(
      (row) => Number(row.conteo4 ?? 0) > 0
    );

    setMostrarConteo4(hayConteo4);

    Swal.close();

    if (!res.data.success) {
      Swal.fire(
        "Error",
        res.data.error || "Error al obtener detalle del grupo",
        "error"
      );
      return;
    }

    /* ===============================
       2. ESTATUS DEL INVENTARIO
    ================================ */
    setEstatusInventario(Number(res.data.estatus));

    /* ===============================
       3. CONSULTAR FLAG SAP (GRUPO)
       → UNA SOLA PETICIÓN
    ================================ */
    try {
      const almacenesCSV = grupo.almacenes.join(",");

      const resp = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/estado_refresh_sap.php",
        {
          params: {
            almacen: almacenesCSV,
            fecha,
            cia,
          },
        }
      );

      if (resp.data && resp.data.success) {
        // El PHP decide si TODO el grupo está refrescado
        setSapRefrescado(resp.data.sap_refrescado === 1);
      } else {
        setSapRefrescado(null);
      }
    } catch (e) {
      console.error("Error consultando estado SAP grupo:", e);
      setSapRefrescado(null);
    }

    /* ===============================
       4. NORMALIZAR DETALLE
    ================================ */
    const detalleConFinal = (Array.isArray(res.data.data) ? res.data.data : []).map((item) => {
      const c1 = Number(item.conteo1 ?? 0);
      const c2 = Number(item.conteo2 ?? 0);
      const c3 = Number(item.conteo3 ?? 0);
      const c4 = Number(item.conteo4 ?? 0);

      // ÚLTIMO CONTEO REAL
      const conteo_final =
        c4 > 0 ? c4 :
        c3 > 0 ? c3 :
        c2 > 0 ? c2 :
        c1;

      const sap_final = Number(item.inventario_sap ?? 0);
      const diferencia_cierre = Number((sap_final - conteo_final).toFixed(2));

      return {
        ...item,
        conteo1: c1,
        conteo2: c2,
        conteo3: c3,
        conteo4: c4,
        conteo_final,
        sap_final,
        diferencia_cierre,
      };
    });


    setDetalle(filtrarArticulosValidos(detalleConFinal));

    setPaginaActual(1);

    if (detalleConFinal.length === 0) {
      Swal.fire("Sin datos", "No hay información para este grupo.", "info");
    }

  } catch (err) {
    Swal.close();
    console.error(err);
    Swal.fire("Error", "No se pudo obtener el detalle del grupo.", "error");
  }
};





  useEffect(() => {
    if (!fecha || !cia) {
      setAlmacenes([]);
      setAlmacenSeleccionado(null);
      setDetalle([]);
    }
  }, [fecha, cia]);


  useEffect(() => {
    if (cia && fecha) {
      fetchAlmacenes();
    }
  }, [fecha, cia]);


  useEffect(() => {
    if (grupoSeleccionado) {
      fetchDetalleGrupo(grupoSeleccionado);
    } else if (almacenSeleccionado) {
      fetchDetalle();
    }
  }, [almacenSeleccionado, grupoSeleccionado]);

  const almacenesDisponibles = useMemo(() => {
    const set = new Set();
    detalle.forEach(d => {
      if (d.almacen) set.add(d.almacen);
    });
    return Array.from(set).sort();
  }, [detalle]);

  // === Filtro por búsqueda ===
  const detalleFiltrado = useMemo(() => {
    const texto = busqueda.toLowerCase();

    return detalle.filter((item) => {
      const matchTexto =
        item.codigo?.toLowerCase().includes(texto) ||
        item.nombre?.toLowerCase().includes(texto) ||
        item.familia?.toLowerCase().includes(texto) ||
        item.subfamilia?.toLowerCase().includes(texto) ||
        item.codebars?.toLowerCase().includes(texto);

      const matchAlmacen =
        almacenFiltro === "TODOS" || item.almacen === almacenFiltro;

      return matchTexto && matchAlmacen;
    });
  }, [detalle, busqueda, almacenFiltro]);


  const detallePaginado = useMemo(() => {
  const inicio = (paginaActual - 1) * registrosPorPagina;
  const fin = inicio + registrosPorPagina;

  return detalleFiltrado.slice(inicio, fin);
  }, [detalleFiltrado, paginaActual]);


  const detallePorAlmacen = useMemo(() => {
    const out = {};
    detallePaginado.forEach((item) => {
      const alm = item.almacen || "SIN_ALMACEN";
      if (!out[alm]) out[alm] = [];
      out[alm].push(item);
    });
    return out;
  }, [detallePaginado]);



  const resumenCierre = useMemo(() => {
    if (!detalle || detalle.length === 0) {
      return {
        totalItems: 0,
        itemsConDiferencia: 0,
        sobrantes: 0,
        faltantes: 0,
        ajusteTotalAbs: 0,
      };
    }

    let totalItems = detalle.length;
    let itemsConDiferencia = 0;
    let sobrantes = 0; // fisico > sap
    let faltantes = 0; // sap > fisico

    detalle.forEach((d) => {
      const dif = d.diferencia_cierre ?? 0;
      if (dif !== 0) {
        itemsConDiferencia++;
        if (dif > 0) {
          sobrantes += dif;
        } else {
          faltantes += Math.abs(dif);
        }
      }
    });

    return {
      totalItems,
      itemsConDiferencia,
      sobrantes,
      faltantes,
      ajusteTotalAbs: sobrantes + faltantes,
    };
  }, [detalle]);

  // Solo artículos con diferencia para el resumen
  const filasDiferencias = useMemo(() => {
    return detalle
      .filter((d) => (d.diferencia_cierre ?? 0) !== 0)
      .sort((a, b) => Math.abs(b.diferencia_cierre ?? 0) - Math.abs(a.diferencia_cierre ?? 0));
  }, [detalle]);

  const gruposUI = useMemo(() => {
    const bloques = Array.isArray(almacenes) ? almacenes : [];

    //
    const out = {};

    bloques.forEach((b) => {
      const est = Number(b.estatus);
      const regs = Array.isArray(b.registros) ? b.registros : [];

      const porBase = {};
      regs.forEach((r) => {
        const alm = (r.almacen || "").trim();
        const base = alm.includes("-") ? alm.split("-")[0] : alm; // MGP-CO -> MGP

        if (!porBase[base]) porBase[base] = [];
        porBase[base].push(r);
      });

      out[est] = Object.entries(porBase).map(([base, items]) => ({
        base,
        items,
      }));
    });

    return out;
  }, [almacenes]);



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

    // HEADERS dinámicos
    const headers = [
      "#",
      "ALMACÉN",
      "CÓDIGO",
      "NOMBRE",
      "FAMILIA",
      "SUBFAMILIA",
      "PRECIO",
      "EXISTENCIA SAP",
      "CONTEO 1",
      "CONTEO 2",
      "CONTEO 3",
      ...(mostrarConteo4 ? ["CONTEO 4"] : []),
      "DIFERENCIA",
    ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mapa Operaciones");

    worksheet.addRow(headers);

    // Estilo encabezados
    headers.forEach((_, idx) => {
      const cell = worksheet.getRow(1).getCell(idx + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "9B1C1C" },
      };
      cell.font = {
        color: { argb: "FFFFFF" },
        bold: true,
      };
    });

    // Filas
    datosExportar.forEach((item, i) => {
      const c1 = Number(item.conteo1 ?? 0);
      const c2 = Number(item.conteo2 ?? 0);
      const c3 = Number(item.conteo3 ?? 0);
      const c4 = Number(item.conteo4 ?? 0);
      const sap = Number(item.inventario_sap ?? 0);

      // 🔴 DIFERENCIA SIEMPRE VS ÚLTIMO CONTEO
      const ultimoConteo =
        c4 > 0 ? c4 :
        c3 > 0 ? c3 :
        c2 > 0 ? c2 :
        c1;

      const diferencia = Number((sap - ultimoConteo).toFixed(2));

      const row = [
        i + 1,
        item.almacen ?? "-",
        item.codigo ?? "-",
        item.nombre ?? "-",
        item.familia ?? "-",
        item.subfamilia ?? "-",
        item.precio ?? "-",
        sap,
        c1,
        c2,
        c3,
        ...(mostrarConteo4 ? [c4] : []),
        diferencia,
      ];

      worksheet.addRow(row);
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(
      blob,
      `mapa_${almacenSeleccionado || "almacen"}_${fecha}.xlsx`
    );
  };


  const grupos = {
      0: almacenes.filter(a => a.estatus === 0),
      1: almacenes.filter(a => a.estatus === 1),
      2: almacenes.filter(a => a.estatus === 2),
      3: almacenes.filter(a => a.estatus === 3),
      4: almacenes.filter(a => a.estatus === 4),
    };

  const [catCierre, setCatCierre] = useState(null); // { proyecto, cuentas: [] }

  const fetchCatalogoCierre = async () => {

    // Resolver almacén real de referencia
    let almacenRef = null;

    if (grupoSeleccionado && grupoSeleccionado.almacenes?.length > 0) {
      almacenRef = grupoSeleccionado.almacenes[0]; // 👈 uno cualquiera del grupo
    } else if (almacenSeleccionado) {
      almacenRef = almacenSeleccionado;
    }

    if (!almacenRef) {
      throw new Error("No hay almacén seleccionado.");
    }

    const res = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/get_catalogo_cierre.php",
      {
        params: {
          cia: almacenRef, //
        },
      }
    );

    if (!res.data.success) {
      throw new Error(res.data.error || "Error al obtener catálogo de cierre.");
    }

    setCatCierre(res.data);
    return res.data;
  };



 const confirmarCierre = async () => {
    try {
      /* =========================
        1. CARGAR CATÁLOGO
      ========================= */
      Swal.fire({
        title: "Cargando catálogo...",
        text: "Obteniendo proyecto y cuentas para el cierre.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const data = await fetchCatalogoCierre();

      Swal.close();

      const proyectoDefault = data.proyecto || "";
      const cuentas = Array.isArray(data.cuentas) ? data.cuentas : [];

      const optionsCuentas = cuentas
        .map(
          (c) =>
            `<option value="${c.numero_cuenta}">
              ${c.numero_cuenta} - ${c.nombre_cuenta}
            </option>`
        )
        .join("");

      /* =========================
        2. MODAL DE CONFIRMACIÓN
      ========================= */
      const { isConfirmed, value } = await Swal.fire({
        title: "¿Generar cierre oficial?",
        icon: "warning",
        width: 900,
        padding: "1.25rem",
        showCancelButton: true,
        confirmButtonText: "Sí, generar cierre",
        cancelButtonText: "Cancelar",
        focusConfirm: false,
        html: `
          <div style="text-align:left; font-size:14px;">
            <p style="margin:0 0 12px 0;">
              Esto consolidará los conteos y creará los ajustes SAP.
            </p>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:14px; align-items:end;">
              <div>
                <label style="display:block; margin:0 0 6px;">Proyecto</label>
                <input
                  id="sw_proyecto"
                  class="swal2-input"
                  style="width:100%; margin:0;"
                  value="${proyectoDefault}"
                  readonly
                  disabled
                />
              </div>

              <div>
                <label style="display:block; margin:0 0 6px;">Cuenta EM (Sobrante)</label>
                <select id="sw_em" class="swal2-select" style="width:100%; margin:0;">
                  <option value="">-- Selecciona cuenta EM --</option>
                  ${optionsCuentas}
                </select>
              </div>

              <div>
                <label style="display:block; margin:0 0 6px;">Cuenta SM (Salida)</label>
                <select id="sw_sm" class="swal2-select" style="width:100%; margin:0;">
                  <option value="">-- Selecciona cuenta SM --</option>
                  ${optionsCuentas}
                </select>
              </div>
            </div>
          </div>
        `,
        didOpen: () => {
          const popup = Swal.getPopup();
          if (popup) popup.style.overflow = "hidden";
        },
        preConfirm: () => {
          const proyecto = document.getElementById("sw_proyecto")?.value?.trim();
          const cuentaEM = document.getElementById("sw_em")?.value;
          const cuentaSM = document.getElementById("sw_sm")?.value;

          if (!cuentaEM) {
            Swal.showValidationMessage("Selecciona la cuenta EM (sobrante).");
            return;
          }
          if (!cuentaSM) {
            Swal.showValidationMessage("Selecciona la cuenta SM (salida).");
            return;
          }

          return { proyecto, cuentaEM, cuentaSM };
        },
      });

      if (!isConfirmed) return;

      /* =========================
        3. PROCESO DE CIERRE
      ========================= */
      Swal.fire({
        title: "Procesando...",
        text: "Generando cierre del inventario...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // 👉 DEFINIR ALMACENES A CERRAR
      const almacenesACerrar = grupoSeleccionado
        ? grupoSeleccionado.almacenes
        : [almacenSeleccionado];

      if (!almacenesACerrar || almacenesACerrar.length === 0) {
        Swal.close();
        Swal.fire("Error", "No hay almacenes para cerrar.", "error");
        return;
      }

      /* =========================
        4. CIERRE POR ALMACÉN
      ========================= */
      for (const alm of almacenesACerrar) {
        const res = await axios.get(
          "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/cerrar_inventario_admin.php",
          {
            params: {
              cia,
              almacen: alm, //
              fecha,
              usuario: sessionStorage.getItem("empleado"),
              proyecto: value.proyecto,
              cuenta_em: value.cuentaEM,
              cuenta_sm: value.cuentaSM,
            },
          }
        );

        if (!res.data || !res.data.success) {
          throw new Error(
            res.data?.error || `Error al cerrar el almacén ${alm}`
          );
        }
      }

      /* =========================
        5. FINALIZAR
      ========================= */
      Swal.close();

      await Swal.fire(
        "Éxito",
        grupoSeleccionado
          ? "Cierre generado correctamente para todos los almacenes del grupo."
          : "Cierre generado correctamente.",
        "success"
      );

      setMostrarDrawer(false);

      if (grupoSeleccionado) {
        fetchDetalleGrupo(grupoSeleccionado);
      } else {
        fetchDetalle();
      }

    } catch (e) {
      Swal.close();
      Swal.fire(
        "Error",
        e.message || "No se pudo generar el cierre",
        "error"
      );
    }
  };

  const refreshSAP = async () => {
    const confirm = await Swal.fire({
      title: "¿Actualizar datos desde SAP?",
      text: "Este proceso solo se puede ejecutar una vez y no tiene vuelta atrás.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, actualizar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      setProcesandoRefresh(true);

      Swal.fire({
        title: "Procesando...",
        text: "Reconsultando datos desde SAP",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      //
      const almacenesRefresh = grupoSeleccionado
        ? grupoSeleccionado.almacenes.join(",")
        : almacenSeleccionado;

      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/refresh_sap.php",
        {
          params: {
            almacen: almacenesRefresh,
            fecha,
            cia,
          },
        }
      );

      Swal.close();

      if (!res.data || !res.data.success) {
        throw new Error(res.data?.error || "Error al refrescar SAP");
      }

      Swal.fire("Listo", res.data.mensaje, "success");

      setSapRefrescado(1);

      //  recargar detalle
      if (grupoSeleccionado) {
        fetchDetalleGrupo(grupoSeleccionado);
      } else {
        fetchDetalle();
      }

    } catch (e) {
      Swal.close();
      Swal.fire("Error", e.message || "Error al refrescar SAP", "error");
    } finally {
      setProcesandoRefresh(false);
    }
  };


  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
        📊 Mapa de Operaciones
      </h1>

    {mostrarDrawer &&
      createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-[600]">



          <div className="w-full max-w-[1500px] h-screen bg-white shadow-2xl overflow-y-auto rounded-lg">

            {/* HEADER */}
            <div className="sticky top-0 bg-gray-100 p-5 shadow flex justify-between items-center border-b z-[650]">

              <button
                onClick={() => setMostrarDrawer(false)}
                className="text-gray-600 text-lg hover:text-black"
              >
                ← Regresar
              </button>

              <h2 className="text-xl font-bold text-gray-800 text-center flex-1">
                Cierre del Inventario –{" "}
                {grupoSeleccionado
                  ? `Grupo ${grupoSeleccionado.base}`
                  : almacenSeleccionado}
                {" – "}
                {fecha}
              </h2>


              <button
                onClick={() => setMostrarDrawer(false)}
                className="text-gray-600 text-xl hover:text-black"
              >
                ×
              </button>
            </div>

            {/* TABS */}
            <div className="sticky top-[64px] bg-white border-b flex z-[650]">

              <button
                onClick={() => setTabActiva("resumen")}
                className={`px-5 py-3 text-sm font-semibold ${
                  tabActiva === "resumen"
                    ? "border-b-4 border-red-600 text-red-700"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                Resumen
              </button>

              <button
                onClick={() => setTabActiva("detalle")}
                className={`px-5 py-3 text-sm font-semibold ${
                  tabActiva === "detalle"
                    ? "border-b-4 border-red-600 text-red-700"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                Detalle Completo
              </button>
            </div>

            {/* CONTENIDO */}
            <div className="p-8 bg-gray-50 min-h-[70vh]">

              {tabActiva === "resumen" ? (
                <>
                  {/* CARDS KPI */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">

                    <div className="bg-white rounded-lg shadow-md p-5">
                      <p className="text-xs text-gray-500">Total artículos</p>
                      <p className="text-3xl font-extrabold text-gray-800">
                        {resumenCierre.totalItems}
                      </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-5">
                      <p className="text-xs text-gray-500">Artículos con diferencia</p>
                      <p className="text-3xl font-extrabold text-gray-800">
                        {resumenCierre.itemsConDiferencia}
                      </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-5">
                      <p className="text-xs text-gray-500">Sobrantes (unidades)</p>
                      <p className="text-3xl font-extrabold text-green-700">
                        {resumenCierre.sobrantes.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-5">
                      <p className="text-xs text-gray-500">Faltantes (unidades)</p>
                      <p className="text-3xl font-extrabold text-red-700">
                        {resumenCierre.faltantes.toFixed(2)}
                      </p>
                    </div>

                  </div>

                  {/* TABLA RESUMEN */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Artículos con diferencia (ordenados por impacto)
                    </h3>

                    {filasDiferencias.length === 0 ? (
                      <p className="text-gray-500 text-sm">
                        No hay diferencias en este inventario.
                      </p>
                    ) : (
                      <div className="overflow-x-auto max-h-[60vh]">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                            <tr>
                              <th className="px-3 py-2 text-left">Código</th>
                              <th className="px-3 py-2 text-left">Nombre</th>
                              <th className="px-3 py-2 text-center">SAP</th>
                              <th className="px-3 py-2 text-center">Físico</th>
                              <th className="px-3 py-2 text-center">Diferencia</th>
                              <th className="px-3 py-2 text-center">Ajuste</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y">
                            {filasDiferencias.map((d, i) => {
                              const dif = d.diferencia_cierre ?? 0;
                              const tipo = dif > 0 ? "Entrada" : "Salida";

                              return (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono text-red-900">{d.codigo}</td>
                                  <td className="px-3 py-2">{d.nombre}</td>
                                  <td className="px-3 py-2 text-center">{d.sap_final}</td>
                                  <td className="px-3 py-2 text-center">{d.conteo_final}</td>
                                  <td className="px-3 py-2 text-center">{dif}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                        dif > 0
                                          ? "bg-green-100 text-green-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {tipo}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* DETALLE COMPLETO */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Detalle completo del inventario
                    </h3>

                    <div className="overflow-x-auto max-h-[65vh]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 uppercase text-gray-700 text-xs">
                          <tr>
                            <th className="px-3 py-2 text-left">Código</th>
                            <th className="px-3 py-2 text-left">Nombre</th>
                            <th className="px-3 py-2 text-center">SAP</th>
                            <th className="px-3 py-2 text-center">C1</th>
                            <th className="px-3 py-2 text-center">C2</th>
                            <th className="px-3 py-2 text-center">C3</th>

                            {mostrarConteo4 && (
                              <th className="px-3 py-2 text-center">C4</th>
                            )}

                            <th className="px-3 py-2 text-center">Final</th>
                            <th className="px-3 py-2 text-center">Dif</th>
                            <th className="px-3 py-2 text-center">Ajuste</th>
                          </tr>
                        </thead>

                        <tbody className="bg-white divide-y">
                          {detalle.map((d, i) => {
                            const dif = d.diferencia_cierre ?? 0;
                            const tipo = dif > 0 ? "Entrada" : dif < 0 ? "Salida" : "-";

                            return (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-red-900">
                                  {d.codigo}
                                </td>

                                <td className="px-3 py-2">
                                  {d.nombre}
                                </td>

                                <td className="px-3 py-2 text-center">
                                  {d.sap_final}
                                </td>

                                <td className="px-3 py-2 text-center">
                                  {d.conteo1}
                                </td>

                                <td className="px-3 py-2 text-center">
                                  {d.conteo2}
                                </td>

                                <td className="px-3 py-2 text-center">
                                  {d.conteo3}
                                </td>

                                {mostrarConteo4 && (
                                  <td className="px-3 py-2 text-center">
                                    {d.conteo4}
                                  </td>
                                )}

                                <td className="px-3 py-2 text-center font-semibold">
                                  {d.conteo_final}
                                </td>

                                <td className="px-3 py-2 text-center font-semibold">
                                  {dif}
                                </td>

                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      dif === 0
                                        ? "bg-gray-100 text-gray-500"
                                        : dif > 0
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {tipo}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </>
              )}

            </div>

            {/* FOOTER */}
           <div className="sticky bottom-0 bg-white p-5 shadow-lg flex justify-center items-center border-t z-[650]">
              <button
                onClick={confirmarCierre}
                className="
                  px-6 py-3
                  bg-emerald-700
                  text-white
                  text-sm
                  font-semibold
                  rounded-lg
                  shadow-md
                  transition-all
                  duration-200
                  hover:bg-emerald-800
                  hover:shadow-lg
                  focus:outline-none
                  focus:ring-2
                  focus:ring-emerald-500
                  focus:ring-offset-2
                  active:scale-[0.98]
                "
              >
                Confirmar y Generar Cierre SAP
              </button>

            </div>


          </div>

        </div>,
        document.body
      )
    }




      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-end">
        <select
          value={cia}
          onChange={(e) => {
            const nuevaCia = e.target.value;
            setCia(nuevaCia);
            setAlmacenSeleccionado(null);
            setAlmacenes([]);
            setDetalle([]);
            setFecha("");
            setFechasDisponibles([]);

            if (nuevaCia) fetchFechasDisponibles(nuevaCia);
          }}
          className="border rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-red-600"
        >
          <option value="">Selecciona CIA</option>
          <option value="recrefam">RECREFAM</option>
          <option value="veser">VESER</option>
          <option value="opardiv">OPARDIV</option>
        </select>
      </div>

      {/* === CALENDARIO === */}

      <div className="bg-white border border-gray-300 rounded-2xl shadow-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📅</span>
          <h2 className="text-xl font-bold text-gray-800">Fechas con datos</h2>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* === Calendario === */}
          <div className="w-full md:w-1/2">
            <Calendar
              onClickDay={(value) => {
                const fechaSeleccionada = value.toISOString().split("T")[0];
                setFecha(fechaSeleccionada);
                setAlmacenSeleccionado(null);
                setAlmacenes([]);
              }}



              tileContent={({ date, view }) => {
                if (view === "month") {
                  const fechaStr = date.toISOString().split("T")[0];
                  const registro = fechasDisponibles.find(f => f.fecha === fechaStr);

                  if (registro) {
                    const estado = coloresEstatus[registro.estatus] || coloresEstatus[0];

                    return (
                      <div className="flex justify-center mt-1">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${estado.color} shadow-md`}
                          title={estado.label}
                        ></div>
                      </div>
                    );
                  }
                }
              }}
              tileClassName={({ date }) => {
                const fechaStr = date.toISOString().split("T")[0];
                const registro = fechasDisponibles.find(f => f.fecha === fechaStr);
                return registro ? "font-semibold bg-gray-50 rounded-lg" : "";
              }}
              className="rounded-xl border border-gray-200 shadow-sm p-2 w-full"
            />
          </div>

          {/* === Leyenda de colores === */}
          <div className="w-full md:w-1/2 bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-inner">
            <h3 className="text-md font-semibold text-gray-700 mb-3">📊 Indicadores de conteo</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <span className={`h-3 w-3 ${coloresEstatus[1].color} rounded-full shadow-sm`}></span>
                {coloresEstatus[1].label}
              </li>
              <li className="flex items-center gap-2">
                <span className={`h-3 w-3 ${coloresEstatus[2].color} rounded-full shadow-sm`}></span>
                {coloresEstatus[2].label}
              </li>
              <li className="flex items-center gap-2">
                <span className={`h-3 w-3 ${coloresEstatus[3].color} rounded-full shadow-sm`}></span>
                {coloresEstatus[3].label}
              </li>
              <li className="flex items-center gap-2">
                <span className={`h-3 w-3 ${coloresEstatus[4].color} rounded-full shadow-sm`}></span>
                {coloresEstatus[4].label}
              </li>
            </ul>

            {fecha && (
              <div className="mt-5 p-3 bg-white border rounded-lg shadow-sm text-gray-700">
                <p className="text-sm">
                  Fecha seleccionada:{" "}
                  <span className="font-semibold text-red-700">{fecha}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid de almacenes */}
      {!almacenSeleccionado && !grupoSeleccionado ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">

         {Object.entries(gruposUI)
        .sort((a, b) => Number(b[0]) - Number(a[0])) // estatus desc
        .map(([estatus, conjuntos]) => (
          conjuntos.length > 0 && (
            <div key={estatus} className="mb-10 animar-grupo">
              <h3
                className={`grupo-header ${
                  coloresEstatus[estatus]?.color || "bg-gray-400"
                } bg-gradient-to-r from-white/10 to-black/10`}
              >
                {coloresEstatus[estatus]?.icono} {coloresEstatus[estatus]?.label}
              </h3>

              <div className="flex gap-6 overflow-x-auto pb-4 px-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
                {conjuntos.map((g, idx) => (
                  <div
                    key={`${estatus}-${g.base}-${idx}`}
                    className="min-w-[260px] flex-shrink-0 rounded-2xl overflow-hidden shadow-lg bg-white"
                  >
                    <div className={`p-4 text-white ${coloresEstatus[estatus]?.color || "bg-gray-400"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold truncate">{g.base}</span>
                        <span className="text-2xl">{coloresEstatus[estatus]?.icono}</span>
                      </div>
                      <div className="text-xs opacity-90 mt-1">
                        {g.items.length} almacén(es)
                      </div>
                    </div>

                    <div className="p-4">

                      <button
                        onClick={() => {
                          setAlmacenSeleccionado(null);
                          setGrupoSeleccionado({
                            base: g.base,
                            almacenes: g.items.map(x => x.almacen),
                            estatus: Number(estatus),
                          });
                        }}


                        className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800"
                      >
                        Ver detalle del grupo
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        {g.items.map((r, j) => (
                          <button
                            key={`${r.almacen}-${j}`}
                            onClick={() => setAlmacenSeleccionado(r.almacen)}
                            className="px-3 py-2 rounded-lg border text-sm font-semibold hover:bg-gray-50 transition"
                            title="Ver detalle"
                          >
                            {r.almacen}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}

        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              🔎 Detalle: {grupoSeleccionado ? `Grupo ${grupoSeleccionado.base}` : almacenSeleccionado}
            </h2>

            {estatusInventario === 4 && sapRefrescado === false && (
              <button
                onClick={refreshSAP}
                disabled={procesandoRefresh}
                className="
                  px-5 py-3
                  bg-yellow-600
                  text-white
                  text-sm
                  font-semibold
                  rounded-lg
                  shadow-md
                  transition-all
                  duration-200
                  hover:bg-yellow-700
                  disabled:opacity-50
                "
              >
                🔄 Actualizar datos de SAP
              </button>
            )}


           {estatusInventario === 4 && sapRefrescado === true && (
              <button
                onClick={() => setMostrarDrawer(true)}
                className="px-5 py-3 bg-slate-700 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-slate-800"
              >
                Revisar Cierre del Inventario
              </button>
            )}



            <div className="flex gap-3">
              <button
                onClick={exportarExcelMapa}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 shadow-md flex items-center gap-2"
              >
                <img src="https://img.icons8.com/color/20/microsoft-excel-2019.png" alt="excel" />
                Exportar
              </button>
              <button
                onClick={() => {
                  setAlmacenSeleccionado(null);
                  setGrupoSeleccionado(null);
                  setDetalle([]);
                }}
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

          <div className="flex flex-col md:flex-row gap-3 mb-3">
              <select
                value={almacenFiltro}
                onChange={(e) => {
                  setAlmacenFiltro(e.target.value);
                  setPaginaActual(1);
                }}
                className="px-3 py-2 border rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-red-600"
              >
                <option value="TODOS">📦 Todos los almacenes</option>
                {almacenesDisponibles.map((alm) => (
                  <option key={alm} value={alm}>
                    {alm}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Buscar por código, nombre, familia..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg shadow-sm text-sm focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
            <span>
              Mostrando{" "}
              <strong>
                {(paginaActual - 1) * registrosPorPagina + 1}
                –
                {Math.min(paginaActual * registrosPorPagina, detalleFiltrado.length)}
              </strong>{" "}
              de <strong>{detalleFiltrado.length}</strong> registros
            </span>

            <span>
              Página <strong>{paginaActual}</strong> de{" "}
              <strong>{Math.ceil(detalleFiltrado.length / registrosPorPagina)}</strong>
            </span>
          </div>

            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-red-800 to-red-600 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-2">Almacén</th>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Familia</th>
                  <th className="px-4 py-2">Subfamilia</th>
                  <th className="px-4 py-2">Precio</th>
                  <th className="px-4 py-2">Existencia SAP</th>
                  <th className="px-4 py-2">Conteo 1</th>
                  <th className="px-4 py-2">Conteo 2</th>
                  <th className="px-4 py-2">Conteo 3</th>

                  {mostrarConteo4 && (
                    <th className="px-4 py-2">Conteo 4</th>
                  )}

                  <th className="px-4 py-2">Diferencia</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-100">
                {Object.entries(detallePorAlmacen).map(([alm, items]) => (
                  <React.Fragment key={alm}>
                    {/* SUB-HEADER DEL ALMACÉN */}
                    <tr className="bg-slate-200">
                      <td
                        colSpan={mostrarConteo4 ? 11 : 10}
                        className="px-4 py-2 font-bold text-slate-800"
                      >
                        📦 {alm}
                      </td>
                    </tr>

                    {/* FILAS */}
                    {items.map((d, i) => {
                      // DIFERENCIA SIEMPRE VS ÚLTIMO CONTEO DISPONIBLE
                      const ultimoConteo =
                        Number(d.conteo4 ?? 0) > 0
                          ? Number(d.conteo4)
                          : Number(d.conteo3 ?? 0) > 0
                          ? Number(d.conteo3)
                          : Number(d.conteo2 ?? 0) > 0
                          ? Number(d.conteo2)
                          : Number(d.conteo1 ?? 0);

                      const diferencia = Number(
                        (d.inventario_sap - ultimoConteo).toFixed(2)
                      );

                      return (
                        <tr key={`${alm}-${i}`} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-semibold text-slate-700">
                            {d.almacen}
                          </td>
                          <td className="px-4 py-2 font-mono text-red-900">
                            {d.codigo}
                          </td>
                          <td className="px-4 py-2 text-gray-800">
                            {d.nombre}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {d.familia ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {d.subfamilia ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {d.precio ?? "-"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {d.inventario_sap.toFixed(2)}
                          </td>

                          <td className="px-4 py-2 text-center">{d.conteo1 ?? "-"}</td>
                          <td className="px-4 py-2 text-center">{d.conteo2 ?? "-"}</td>
                          <td className="px-4 py-2 text-center">{d.conteo3 ?? "-"}</td>

                          {mostrarConteo4 && (
                            <td className="px-4 py-2 text-center">
                              {d.conteo4 ?? "-"}
                            </td>
                          )}

                          <td className="px-4 py-2 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold ${
                                diferencia === 0
                                  ? "bg-green-100 text-green-700"
                                  : diferencia > 0
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {diferencia.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
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
                Página {paginaActual} de{" "}
                {Math.ceil(detalleFiltrado.length / registrosPorPagina)}
              </span>

              <button
                onClick={() =>
                  setPaginaActual((prev) =>
                    prev < Math.ceil(detalleFiltrado.length / registrosPorPagina)
                      ? prev + 1
                      : prev
                  )
                }
                disabled={
                  paginaActual >=
                  Math.ceil(detalleFiltrado.length / registrosPorPagina)
                }
                className={`px-3 py-1 rounded border ${
                  paginaActual >=
                  Math.ceil(detalleFiltrado.length / registrosPorPagina)
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
