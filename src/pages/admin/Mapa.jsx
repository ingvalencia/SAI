import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

import axios from "axios";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import logoDiniz from "../../assets/logo-diniz.png";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts.vfs;




const coloresEstatus = {
  0: { color: "bg-gray-300", label: "Sin conteo", icono: "➕" },
  1: { color: "bg-red-500", label: "Conteo 1", icono: "🔴" },
  2: { color: "bg-yellow-400", label: "Conteo 2", icono: "🟡" },
  3: { color: "bg-green-500", label: "Conteo 3", icono: "🟢" },
  4: { color: "bg-blue-600", label: "Finalizado", icono: "🔵" },
};


const obtenerUltimoConteo = (item) => {
  if (item.conteo4 !== null && item.conteo4 !== undefined)
    return Number(item.conteo4);

  if (item.conteo3 !== null && item.conteo3 !== undefined)
    return Number(item.conteo3);

  if (item.conteo2 !== null && item.conteo2 !== undefined)
    return Number(item.conteo2);

  return Number(item.conteo1 ?? 0);
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

  const [mostrarResumenSAP, setMostrarResumenSAP] = useState(false);
  const [resumenSAP, setResumenSAP] = useState([]);



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


        return sap !== 0 || c1 !== 0 || c2 !== 0 || c3 !== 0 || c4 !== 0;
      });
    };


    const normalizarDetalle = (data = []) => {
      return (Array.isArray(data) ? data : []).map((item) => {
        const c1 = Number(item.conteo1 ?? 0);
        const c2 = Number(item.conteo2 ?? 0);
        const c3 = Number(item.conteo3 ?? 0);

        const conteo_final = obtenerUltimoConteo(item);

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

        setEstatusInventario(Number(res.data.estatus));


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


    setEstatusInventario(Number(res.data.estatus));


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

        setSapRefrescado(resp.data.sap_refrescado === 1);
      } else {
        setSapRefrescado(null);
      }
    } catch (e) {
      console.error("Error consultando estado SAP grupo:", e);
      setSapRefrescado(null);
    }


    const detalleConFinal = (Array.isArray(res.data.data) ? res.data.data : []).map((item) => {
      const c1 = Number(item.conteo1 ?? 0);
      const c2 = Number(item.conteo2 ?? 0);
      const c3 = Number(item.conteo3 ?? 0);
      const c4 = Number(item.conteo4 ?? 0);


      const conteo_final = obtenerUltimoConteo(item);

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

      return matchTexto && matchAlmacen; //
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
    let sobrantes = 0;
    let faltantes = 0;
    let importeEntrada = 0;
    let importeSalida = 0;



   detalle.forEach((d) => {
      const dif = d.diferencia_cierre ?? 0;
      const precio = Number(d.precio ?? 0);

      if (dif !== 0) {
        itemsConDiferencia++;

        if (dif > 0) {
          sobrantes += dif;
        } else {
          faltantes += Math.abs(dif);
        }

        const impacto = dif * precio;

        if (dif < 0) {
          // Entrada (faltante físico vs SAP)
          importeEntrada += Math.abs(impacto);
        } else if (dif > 0) {
          // Salida (sobrante físico vs SAP)
          importeSalida += Math.abs(impacto);
        }

              }
    });


    return {
      totalItems,
      itemsConDiferencia,
      sobrantes,
      faltantes,
      ajusteTotalAbs: sobrantes + faltantes,
      importeEntrada,
      importeSalida,
      importeTotal: importeEntrada + importeSalida,


    };
  }, [detalle]);


  const filasDiferencias = useMemo(() => {
    return detalle
      .filter((d) => (d.diferencia_cierre ?? 0) !== 0)
      .sort((a, b) => Math.abs(b.diferencia_cierre ?? 0) - Math.abs(a.diferencia_cierre ?? 0));
  }, [detalle]);

  const gruposUI = useMemo(() => {
    const bloques = Array.isArray(almacenes) ? almacenes : [];

    const out = {};

    bloques.forEach((b) => {
      const est = Number(b.estatus);
      const regs = Array.isArray(b.registros) ? b.registros : [];

      const porBase = {};
      regs.forEach((r) => {
        const alm = (r.almacen || "").trim();
        const base = alm.includes("-") ? alm.split("-")[0] : alm;

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


  const indiceInicial = (paginaActual - 1) * registrosPorPagina;
  const indiceFinal = indiceInicial + registrosPorPagina;
  const datosPaginados = detalleFiltrado.slice(indiceInicial, indiceFinal);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);


 const exportarExcelMapa = async () => {

    const datosExportar = detalleFiltrado;

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
      "COBRO A PRECIO VENTA",
      "TRANSFERENCIAS",
      "CAMBIOS DE CÓDIGO",
      "SALIDAS PENDIENTES",
    ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mapa Operaciones", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // ===== HEADER =====
    const headerRow = worksheet.addRow(headers);

    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1);

      const esNuevaColumna =
        header === "COBRO A PRECIO VENTA" ||
        header === "TRANSFERENCIAS" ||
        header === "CAMBIOS DE CÓDIGO" ||
        header === "SALIDAS PENDIENTES";

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: esNuevaColumna ? "000000" : "9B1C1C" },
      };

      cell.font = {
        color: { argb: "FFFFFF" },
        bold: true,
        size: 12,
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
    });

    headerRow.height = 28;

    // ===== DATA =====
    datosExportar.forEach((item, i) => {

      const c1 = Number(item.conteo1 ?? 0);
      const c2 = Number(item.conteo2 ?? 0);
      const c3 = Number(item.conteo3 ?? 0);
      const c4 = Number(item.conteo4 ?? 0);
      const sap = Number(item.inventario_sap ?? 0);

      const ultimoConteo = obtenerUltimoConteo(item);

      const diferencia = Number((sap - ultimoConteo).toFixed(2));

      const row = worksheet.addRow([
        i + 1,
        item.almacen ?? "-",
        item.codigo ?? "-",
        item.nombre ?? "-",
        item.familia ?? "-",
        item.subfamilia ?? "-",
        Number(item.precio ?? 0),
        sap,
        c1,
        c2,
        c3,
        ...(mostrarConteo4 ? [c4] : []),
        diferencia,
        "", "", "", "" // Nuevas columnas vacías listas para capturar
      ]);

      row.eachCell((cell, colNumber) => {

        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        // Formato numérico
        if (colNumber >= 7 && colNumber <= headers.length) {
          cell.numFmt = "#,##0.00";
        }

        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 4 ? "left" : "center",
        };
      });

      // Color diferencia
      const diffColIndex = headers.indexOf("DIFERENCIA") + 1;
      const diffCell = row.getCell(diffColIndex);

      if (diferencia > 0) {
        diffCell.font = { color: { argb: "008000" }, bold: true };
      } else if (diferencia < 0) {
        diffCell.font = { color: { argb: "FF0000" }, bold: true };
      }
    });

    // ===== AUTO FILTER =====
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    // ===== AJUSTE DE ANCHOS =====
    worksheet.columns.forEach((column, index) => {
      let maxLength = 12;

      column.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) {
          maxLength = length;
        }
      });

      column.width = Math.min(maxLength + 3, 40);
    });

    // ===== DESCARGA =====
    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(
      blob,
      `mapa_${almacenSeleccionado || "almacen"}_${fecha}.xlsx`
    );
  };

 const fetchCatalogoCierre = async () => {

    let almacenRef = null;

    if (grupoSeleccionado?.almacenes?.length > 0) {
      almacenRef = grupoSeleccionado.almacenes[0];
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
          cia,
          almacen: almacenRef,
        },
      }
    );

    if (!res.data.success) {
      throw new Error(res.data.error || "Error al obtener catálogo de cierre.");
    }

    return res.data;
  };


 const confirmarCierre = async () => {
    try {

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

              <div style="margin-top:20px;">
              <label style="
                  display:block;
                  margin:0 0 8px;
                  font-weight:600;
                  color:#374151;
                  font-size:13px;
                  letter-spacing:.5px;
              ">
                Comentario (máx 30 caracteres)
              </label>

              <div style="position:relative;">
                <textarea
                  id="sw_comentario"
                  maxlength="30"
                  placeholder="Escribe un comentario para el cierre..."
                  style="
                    width:100%;
                    height:70px;
                    padding:12px 14px;
                    font-size:14px;
                    border-radius:10px;
                    border:1px solid #d1d5db;
                    outline:none;
                    resize:none;
                    transition:all .2s ease;
                    box-shadow:0 1px 3px rgba(0,0,0,.08);
                  "
                  onfocus="this.style.borderColor='#2563eb'; this.style.boxShadow='0 0 0 3px rgba(37,99,235,.15)'"
                  onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='0 1px 3px rgba(0,0,0,.08)'"
                  oninput="
                    if(this.value.length > 30) this.value = this.value.slice(0,30);
                    const counter = document.getElementById('sw_counter');
                    counter.innerText = this.value.length + '/30';
                    counter.style.color = this.value.length >= 30 ? '#dc2626' : '#6b7280';
                  "

                ></textarea>

                <div id="sw_counter" style="
                    position:absolute;
                    right:10px;
                    bottom:8px;
                    font-size:11px;
                    color:#6b7280;
                    font-weight:500;
                ">
                  0/30
                </div>
              </div>
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
          const comentario = document.getElementById("sw_comentario")?.value?.trim() || "";

          if (!cuentaEM) {
            Swal.showValidationMessage("Selecciona la cuenta EM (sobrante).");
            return;
          }

          if (!cuentaSM) {
            Swal.showValidationMessage("Selecciona la cuenta SM (salida).");
            return;
          }

          if (!comentario) {
            Swal.showValidationMessage("El comentario es obligatorio.");
            return;
          }

          if (comentario.length > 30) {
            Swal.showValidationMessage("El comentario no puede exceder 30 caracteres.");
            return;
          }

          return { proyecto, cuentaEM, cuentaSM, comentario };
        },

      });

      if (!isConfirmed) return;


      Swal.fire({
        title: "Procesando...",
        text: "Generando cierre del inventario...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });


      const almacenesACerrar = grupoSeleccionado
        ? grupoSeleccionado.almacenes
        : [almacenSeleccionado];

      if (!almacenesACerrar || almacenesACerrar.length === 0) {
        Swal.close();
        Swal.fire("Error", "No hay almacenes para cerrar.", "error");
        return;
      }


      for (const alm of almacenesACerrar) {
        const res = await axios.get(
          "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/cerrar_inventario_admin.php",
          {
            params: {
              cia,
              almacen: alm,
              fecha,
              usuario: sessionStorage.getItem("empleado"),
              proyecto: value.proyecto,
              cuenta_em: value.cuentaEM,
              cuenta_sm: value.cuentaSM,
              comentario: value.comentario,
            },
          }
        );

        if (!res.data || !res.data.success) {
          throw new Error(
            res.data?.error || `Error al cerrar el almacén ${alm}`
          );
        }
      }


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

  const fetchResumenSAP = async () => {
  try {
    const res = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/resumen_sap.php",
      {
        params: {
          cia,
          almacen: grupoSeleccionado
            ? grupoSeleccionado.almacenes.join(",")
            : almacenSeleccionado,
          fecha,
        },
      }
    );

    if (!res.data.success) {
      throw new Error(res.data.error || "Error al obtener resumen SAP");
    }

    setResumenSAP(res.data.data);
    setMostrarResumenSAP(true);

  } catch (e) {
    Swal.fire("Error", e.message, "error");
  }
};

const convertirImagenBase64 = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = error => reject(error);
    img.src = url;
  });
};

 const generarPDF = async () => {

  const logoBase64 = await convertirImagenBase64(logoDiniz);

  const bodyRows = resumenSAP.map(row => ([
    { text: row.almacen, alignment: "left", fontSize: 10 },
    { text: `$${Number(row.FALTANTE).toFixed(2)}`, alignment: "right", color: "green", fontSize: 10 },
    { text: `$${Number(row.SOBRANTE).toFixed(2)}`, alignment: "right", color: "red", fontSize: 10 },
    { text: `$${Number(row.TOTAL).toFixed(2)}`, alignment: "right", bold: true, fontSize: 10 },
    { text: row.DOC_FALTANTE !== "-" ? row.DOC_FALTANTE : row.DOC_SOBRANTE, alignment: "center", fontSize: 10 }
  ]));

  const docDefinition = {

    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [50, 70, 50, 80],

    header: {
      margin: [50, 20, 50, 0],
      columns: [
        {
          image: logoBase64,
          width: 90
        },
        {
          alignment: "right",
          stack: [
            { text: "Código:", fontSize: 8 },
            { text: `Fecha emisión: ${fecha}`, fontSize: 8 },
            { text: "Versión: 1", fontSize: 8 }
          ]
        }
      ]
    },

    content: [

      {
        canvas: [
          {
            type: "line",
            x1: 0, y1: 0,
            x2: 750, y2: 0,
            lineWidth: 0.5,
            lineColor: "#9ca3af"
          }
        ],
        margin: [0, 10, 0, 20]
      },

      {
        text: "RESUMEN CONTABLE DE AJUSTES SAP",
        alignment: "center",
        fontSize: 14,
        bold: true,
        margin: [0, 0, 0, 20]
      },

      {
        table: {
          headerRows: 1,
          widths: ["*", 90, 90, 90, 100],
          body: [
            [
              { text: "ALMACÉN", style: "tableHeader" },
              { text: "FALTANTE", style: "tableHeader", alignment: "right" },
              { text: "SOBRANTE", style: "tableHeader", alignment: "right" },
              { text: "TOTAL", style: "tableHeader", alignment: "right" },
              { text: "DOC SAP", style: "tableHeader", alignment: "center" }
            ],
            ...bodyRows
          ]
        },
        layout: {
          fillColor: (rowIndex, node) => {
            if (rowIndex === 0) return "#b91c1c";
            const row = node.table.body[rowIndex];
            if (row?.[0]?.text === "TOTAL GENERAL") return "#f3f4f6";
            return null;
          },
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          hLineColor: () => "#d1d5db",
          vLineColor: () => "#e5e7eb",
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        }
      },

      { text: "\n\n\n\n\n" },

      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "____________________________________________", alignment: "center" },
              { text: "FIRMA DEL GERENTE DE OPERACIONES", alignment: "center", fontSize: 9, margin: [0,5,0,0] }
            ]
          },
          {
            width: "*",
            stack: [
              { text: "____________________________________________", alignment: "center" },
              { text: "FIRMA DEL SUBGERENTE CONTABLE-ADMINISTRATIVO", alignment: "center", fontSize: 9, margin: [0,5,0,0] }
            ]
          }
        ]
      },

      { text: "\n\n\n" },

      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "____________________________________________", alignment: "center" },
              { text: "FIRMA DEL SUBGERENTE DE OPERACIONES", alignment: "center", fontSize: 9, margin: [0,5,0,0] }
            ]
          },
          {
            width: "*",
            stack: [
              { text: "____________________________________________", alignment: "center" },
              { text: "FIRMA DEL AUDITOR INTERNO", alignment: "center", fontSize: 9, margin: [0,5,0,0] }
            ]
          }
        ]
      }

    ],

    styles: {
      tableHeader: {
        color: "white",
        bold: true,
        fontSize: 9
      }
    }

  };

  pdfMake.createPdf(docDefinition).download(`Resumen_SAP_${fecha}.pdf`);
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


            <div className="p-8 bg-gray-50 min-h-[70vh]">

              {tabActiva === "resumen" ? (
                <>


            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">

              <div className="bg-white rounded-xl shadow-md p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total artículos</p>
                <p className="text-3xl font-extrabold text-gray-800 mt-2">
                  {resumenCierre.totalItems}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Con diferencia</p>
                <p className="text-3xl font-extrabold text-gray-800 mt-2">
                  {resumenCierre.itemsConDiferencia}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Sobrantes</p>
                <p className="text-3xl font-extrabold text-green-700 mt-2">
                  {resumenCierre.sobrantes.toFixed(2)}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-500">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Faltantes</p>
                <p className="text-3xl font-extrabold text-red-700 mt-2">
                  {resumenCierre.faltantes.toFixed(2)}
                </p>
              </div>

            </div>



              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-600">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Impacto Entrada</p>
                  <p className="text-3xl font-extrabold text-green-700 mt-2">
                    ${resumenCierre.importeEntrada.toFixed(2)}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-600">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Impacto Salida</p>
                  <p className="text-3xl font-extrabold text-red-700 mt-2">
                    ${resumenCierre.importeSalida.toFixed(2)}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl shadow-lg p-5">
                  <p className="text-xs text-slate-300 uppercase tracking-wide">Impacto Total</p>
                  <p className="text-3xl font-extrabold text-white mt-2">
                    ${resumenCierre.importeTotal.toFixed(2)}
                  </p>
                </div>

              </div>



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
                        <table className="w-full text-xs table-fixed">
                          <thead className="sticky top-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white text-xs uppercase tracking-wider shadow-lg z-10">
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
                              const tipo = dif < 0 ? "Entrada" : dif > 0 ? "Salida" : "-";


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
                                        dif < 0
                                          ? "bg-green-100 text-green-800"   // Entrada
                                          : dif > 0
                                          ? "bg-red-100 text-red-800"   // Salida
                                          : "bg-gray-100 text-gray-500"
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

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Detalle completo del inventario
                    </h3>

                    <div className="overflow-x-auto max-h-[65vh]">
                      <table className="w-full text-xs table-fixed">
                        <thead className="sticky top-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white text-xs uppercase tracking-wider shadow-lg z-10">
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
                            const tipo = dif < 0 ? "Entrada" : dif > 0 ? "Salida" : "-";


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
                                        : dif < 0
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

    {mostrarResumenSAP && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[700]">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6">

          <div className="flex justify-between items-center mb-4">

            <h2 className="text-xl font-bold text-gray-800">
              Resumen Contable SAP
            </h2>

            <div className="flex gap-3">

              <button
                onClick={generarPDF}
                className="px-2 py-1 bg-red-700 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-red-800"
              >
                📄 Descargar PDF
              </button>

              <button
                onClick={() => setMostrarResumenSAP(false)}
                className="text-gray-500 hover:text-black text-lg"
              >
                ×
              </button>

            </div>

          </div>


          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-10">

            {/* HEADER */}
            <div className="flex justify-between items-start border-b pb-6 mb-6">

              <div>
                <img src={logoDiniz} alt="Grupo Diniz" className="h-16 object-contain" />
              </div>

              <div className="text-right text-sm text-gray-700">
                <p><strong>Código:</strong> </p>
                <p><strong>Fecha emisión:</strong> {fecha}</p>
                <p><strong>Versión:</strong> 1</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center mb-8 tracking-wide">
              RESUMEN CONTABLE DE AJUSTES SAP
            </h2>

            {/* TABLA */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs table-fixed border border-gray-300">

            <thead>
              <tr className="bg-red-700 text-white text-xs uppercase">
                <th className="px-4 py-3 text-left">Almacén</th>
                <th className="px-4 py-3 text-right">Faltante</th>
                <th className="px-4 py-3 text-right">Sobrante</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Doc SAP</th>
              </tr>
            </thead>

            <tbody>
              {resumenSAP.map((row, i) => {

                const esTotal = row.almacen === "TOTAL GENERAL";

                return (
                  <tr
                    key={i}
                    className={`border-t ${
                      esTotal ? "bg-gray-100 font-bold text-base" : ""
                    }`}
                  >
                    <td className="px-4 py-3">{row.almacen}</td>

                    <td className="px-4 py-3 text-right text-green-700 font-semibold">
                      ${Number(row.FALTANTE).toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-right text-red-700 font-semibold">
                      ${Number(row.SOBRANTE).toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-right font-bold">
                      ${Number(row.TOTAL).toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {row.DOC_FALTANTE !== "-" ? row.DOC_FALTANTE : row.DOC_SOBRANTE}
                    </td>
                  </tr>
                );
              })}
            </tbody>

          </table>

            </div>

            {/* FIRMAS */}
            <div className="mt-16 grid grid-cols-2 gap-16 text-sm text-gray-800">

              <div>
                <div className="border-t-2 border-gray-400 pt-2 text-center">
                  FIRMA DEL GERENTE DE OPERACIONES
                </div>
              </div>

              <div>
                <div className="border-t-2 border-gray-400 pt-2 text-center">
                  FIRMA DEL SUBGERENTE CONTABLE-ADMINISTRATIVO
                </div>
              </div>

              <div>
                <div className="border-t-2 border-gray-400 pt-2 text-center">
                  FIRMA DEL SUBGERENTE DE OPERACIONES
                </div>
              </div>

              <div>
                <div className="border-t-2 border-gray-400 pt-2 text-center">
                  FIRMA DEL AUDITOR INTERNO
                </div>
              </div>

            </div>

          </div>



        </div>
      </div>
    )}


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
          className="border rounded-lg px-2 py-1 shadow-sm focus:ring-2 focus:ring-red-600"
        >
          <option value="">Selecciona CIA</option>
          <option value="recrefam">RECREFAM</option>
          <option value="veser">VESER</option>
          <option value="opardiv">OPARDIV</option>
        </select>
      </div>


      <div className="bg-white rounded-3xl shadow-2xl p-8 mb-10 border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <span className="text-indigo-600 text-3xl">📅</span>
            Fechas con datos
          </h2>

          {fecha && (
            <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-700 shadow-sm">
              Fecha seleccionada: {fecha}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          <div className="w-full md:w-1/2">
            <Calendar
              onClickDay={(value) => {
              const fechaSeleccionada = value.toISOString().split("T")[0];


              setGrupoSeleccionado(null);
              setAlmacenSeleccionado(null);
              setDetalle([]);
              setAlmacenes([]);
              setBusqueda("");
              setPaginaActual(1);
              setAlmacenFiltro("TODOS");
              setMostrarDrawer(false);
              setMostrarResumenSAP(false);
              setSapRefrescado(null);
              setEstatusInventario(null);


              setFecha(fechaSeleccionada);
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
              className="rounded-2xl border border-slate-200 shadow-lg p-4 w-full bg-slate-50"
            />
          </div>


          <div className="w-full md:w-1/2 bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-inner">
            <h3 className="text-md font-semibold text-gray-700 mb-3">📊 Indicadores de conteo</h3>
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4].map((k) => (
                <div
                  key={k}
                  className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-md border border-slate-200"
                >
                  <div className={`h-4 w-4 rounded-full ${coloresEstatus[k].color}`}></div>
                  <span className="text-sm font-semibold text-slate-700">
                    {coloresEstatus[k].label}
                  </span>
                </div>
              ))}
            </div>


          </div>
        </div>
      </div>


      {!almacenSeleccionado && !grupoSeleccionado ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">

         {Object.entries(gruposUI)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
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

              <div className="
                min-w-[380px]
                max-w-[420px]
                flex-shrink-0
                rounded-3xl
                overflow-hidden
                shadow-xl
                bg-white
                border
                border-slate-200
                transition-all
                duration-300
                hover:shadow-2xl
              ">
                {conjuntos.map((g, idx) => (
                  <div
                    key={`${estatus}-${g.base}-${idx}`}
                    className="min-w-[260px] flex-shrink-0 rounded-2xl overflow-hidden shadow-lg bg-white"
                  >
                    <div className={`
                      px-6 py-6
                      text-white
                      ${coloresEstatus[estatus]?.color}
                      bg-gradient-to-r
                      from-black/10
                      to-white/5
                    `}>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold tracking-wide">{g.base}</span>
                        <span className="text-2xl">{coloresEstatus[estatus]?.icono}</span>
                      </div>
                      <div className="text-sm opacity-90 mt-2">
                        {g.items.length} almacenes asociados
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


                className="
                        w-full
                        mb-5
                        px-4 py-3
                        rounded-xl
                        bg-gradient-to-r
                        from-slate-800
                        to-slate-700
                        text-white
                        text-sm
                        font-semibold
                        shadow-md
                        hover:from-slate-900
                        hover:to-slate-800
                        transition-all
                        duration-200
                      "
                      >
                        Ver detalle del grupo
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        {g.items.map((r, j) => (
                          <button
                            key={`${r.almacen}-${j}`}
                            onClick={() => setAlmacenSeleccionado(r.almacen)}
                            className="
                              px-3 py-3
                              rounded-xl
                              border
                              border-slate-200
                              text-sm
                              font-semibold
                              bg-white
                              hover:bg-slate-50
                              hover:shadow-sm
                              transition-all
                              duration-200
                            "
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
                group
                relative
                px-6 py-3
                rounded-xl
                bg-gradient-to-r from-amber-700 to-amber-600
                hover:from-amber-800 hover:to-amber-700
                text-white
                text-sm
                font-semibold
                tracking-wide
                shadow-lg
                hover:shadow-xl
                transition-all
                duration-300
                flex items-center gap-3
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
            >
              <div className="bg-white/15 p-2 rounded-lg">
                <svg
                  className={`w-5 h-5 ${procesandoRefresh ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582M20 20v-5h-.581M5.64 18.36A9 9 0 1021 12"
                  />
                </svg>
              </div>

              <span>
                {procesandoRefresh
                  ? "Sincronizando con SAP..."
                  : "Actualizar Datos SAP"}
              </span>
            </button>
            )}


           {estatusInventario === 4 && sapRefrescado === true && (
              <button
              onClick={() => setMostrarDrawer(true)}
              className="
                group
                relative
                px-6 py-3
                rounded-xl
                bg-gradient-to-r from-slate-800 to-slate-700
                hover:from-slate-900 hover:to-slate-800
                text-white
                text-sm
                font-semibold
                tracking-wide
                shadow-lg
                hover:shadow-xl
                transition-all
                duration-300
                flex items-center gap-3
              "
            >
              <div className="bg-white/10 p-2 rounded-lg">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 17v-2a4 4 0 018 0v2M5 11V7a7 7 0 1114 0v4M3 21h18"
                  />
                </svg>
              </div>

              <span>Revisar Cierre de Inventario</span>
            </button>
            )}


            {estatusInventario === 5 && (
              <button
              onClick={fetchResumenSAP}
              className="
                group
                relative
                px-6 py-3
                rounded-xl
                bg-gradient-to-r from-emerald-800 to-emerald-700
                hover:from-emerald-900 hover:to-emerald-800
                text-white
                text-sm
                font-semibold
                tracking-wide
                shadow-lg
                hover:shadow-xl
                transition-all
                duration-300
                flex items-center gap-3
              "
            >
              <div className="bg-white/15 p-2 rounded-lg">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 17v-6M13 17v-4M17 17v-8M5 19h14"
                  />
                </svg>
              </div>

              <span>Resumen Contable SAP</span>
            </button>
            )}




            <div className="flex gap-3">
              <button
                onClick={exportarExcelMapa}
                className="
                  group
                  relative
                  px-5 py-2.5
                  rounded-xl
                  bg-gradient-to-r from-emerald-700 to-emerald-600
                  hover:from-emerald-800 hover:to-emerald-700
                  text-white
                  text-sm
                  font-semibold
                  tracking-wide
                  shadow-lg
                  hover:shadow-xl
                  transition-all
                  duration-300
                  flex items-center gap-3
                "
              >
                <div className="bg-white/15 p-1.5 rounded-lg">
                  <img
                    src="https://img.icons8.com/color/20/microsoft-excel-2019.png"
                    alt="excel"
                    className="w-5 h-5"
                  />
                </div>

                <span>Exportar Reporte </span>
              </button>


              <button
                onClick={() => {
                  setAlmacenSeleccionado(null);
                  setGrupoSeleccionado(null);
                  setDetalle([]);
                  setBusqueda("");
                  setPaginaActual(1);
                }}
                className="
                  px-5 py-3
                  bg-gradient-to-r from-slate-800 to-slate-700
                  text-white
                  text-sm
                  font-semibold
                  rounded-xl
                  shadow-lg
                  transition-all
                  duration-200
                  hover:from-slate-900
                  hover:to-slate-800
                  hover:shadow-xl
                  active:scale-[0.98]
                  flex items-center gap-2
                "
              >
                🔄 Regresar Detalle Grupos
              </button>

            </div>
          </div>

         {detalle.length === 0 ? (
          <p className="text-gray-500">Sin registros para este almacén.</p>
        ) : (

          <div className="border rounded-lg">

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
                className="flex-1 px-2 py-1 border rounded-lg shadow-sm text-sm focus:ring-2 focus:ring-red-600"
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

            <table className="w-full text-xs table-fixed">
              <thead className="sticky top-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white text-xs uppercase tracking-wider shadow-lg z-10">
                <tr>
                  <th className="w-[60px] px-2 py-1 text-center">#</th>
                  <th className="px-2 py-1">Almacén</th>
                  <th className="px-2 py-1">Código</th>
                  <th className="px-2 py-1">Nombre</th>
                  <th className="px-2 py-1">Familia</th>
                  <th className="px-2 py-1">Subfamilia</th>
                  <th className="px-2 py-1">Precio</th>
                  <th className="px-2 py-1">Existencia SAP</th>
                  <th className="px-2 py-1">Conteo 1</th>
                  <th className="px-2 py-1">Conteo 2</th>
                  <th className="px-2 py-1">Conteo 3</th>

                  {mostrarConteo4 && (
                    <th className="px-2 py-1">Conteo 4</th>
                  )}

                  <th className="px-2 py-1">Diferencia</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-100">
                {Object.entries(detallePorAlmacen).map(([alm, items]) => (
                  <React.Fragment key={alm}>

                    <tr className="bg-slate-200">
                      <td
                        colSpan={mostrarConteo4 ? 12 : 11}
                        className="px-2 py-1 font-bold text-slate-800"
                      >
                        📦 {alm}
                      </td>
                    </tr>


                    {items.map((d, i) => {

                      const ultimoConteo = obtenerUltimoConteo(d);

                      const diferencia = Number(
                          (Number(d.inventario_sap ?? 0) - ultimoConteo).toFixed(2)
                        );

                      return (
                        <tr key={`${alm}-${i}`} className="hover:bg-gray-50">

                          <td className="px-2 py-1 text-center">
                            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                              {(paginaActual - 1) * registrosPorPagina + i + 1}
                            </span>
                          </td>
                          <td className="px-2 py-1 font-semibold text-slate-700">
                            {d.almacen}
                          </td>
                          <td className="px-2 py-1 font-mono text-red-900">
                            {d.codigo}
                          </td>
                          <td className="px-2 py-1 text-gray-800">
                            {d.nombre}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {d.familia ?? "-"}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {d.subfamilia ?? "-"}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {d.precio ?? "-"}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {d.inventario_sap.toFixed(2)}
                          </td>

                          <td className="px-2 py-1 text-center">{d.conteo1 ?? "-"}</td>
                          <td className="px-2 py-1 text-center">{d.conteo2 ?? "-"}</td>
                          <td className="px-2 py-1 text-center">{d.conteo3 ?? "-"}</td>

                          {mostrarConteo4 && (
                            <td className="px-2 py-1 text-center">
                              {d.conteo4 ?? "-"}
                            </td>
                          )}

                          <td className="px-2 py-1 text-center">
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
