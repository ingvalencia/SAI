import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import Swal from "sweetalert2";
import logoDiniz from "../../assets/logo-diniz.png";
import Select from "react-select";
import ReactDOM from "react-dom/client";

pdfMake.vfs = pdfFonts.vfs;

const coloresEstatus = {
  0: { color: "bg-slate-600", label: "Sin conteo", icono: "📦" },
  1: { color: "bg-red-600", label: "Conteo 1", icono: "🔴" },
  2: { color: "bg-amber-500", label: "Conteo 2", icono: "🟡" },
  3: { color: "bg-green-600", label: "Conteo 3", icono: "🟢" },
  4: { color: "bg-indigo-700", label: "Validación Físico vs SAP", icono: "🔒" },
  5: { color: "bg-[#611232]", label: "Finalizado", icono: "✔️" },
  7: { color: "bg-indigo-700", label: "Validación Físico vs SAP", icono: "🔒" },
};

const obtenerUltimoConteo = (item) => {
  const sap = Number(item.inventario_sap ?? 0);
  const c1 = Number(item.conteo1 ?? 0);
  const c2 = Number(item.conteo2 ?? 0);
  const c3 = Number(item.conteo3 ?? 0);
  const c4 = Number(item.conteo4 ?? 0);

  const debeIrAC3 =
    c1 !== c2 ||
    (c1 === sap && c2 !== sap) ||
    (c2 === sap && c1 !== sap) ||
    (c1 === c2 && c1 !== sap);

  if (!debeIrAC3) {
    return c2;
  }

  const casoEspecialSapCeroConExistencia =
    sap === 0 && c1 > 0 && c2 > 0 && c3 > 0;

  const c3EsIgualAC1YC2PeroDistintoASap = c3 === c1 && c3 === c2 && c3 !== sap;

  const c3EsIgualASap = c3 === sap;
  const c3EsCeroIgualASap = c3 === 0 && sap === 0;

  const debeIrAC4 =
    casoEspecialSapCeroConExistencia ||
    c3EsIgualAC1YC2PeroDistintoASap ||
    (!c3EsIgualASap && !c3EsCeroIgualASap);

  if (!debeIrAC4) {
    return c3;
  }

  const c4EsCeroIgualASap = c4 === 0 && sap === 0;

  if (c4EsCeroIgualASap) {
    return c4;
  }

  return c4;
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

  const [sapRefrescado, setSapRefrescado] = useState(null);
  const [grupoCompleto, setGrupoCompleto] = useState(false);
  const [procesandoRefresh, setProcesandoRefresh] = useState(false);

  const [mostrarConteo4, setMostrarConteo4] = useState(false);

  const [mostrarResumenSAP, setMostrarResumenSAP] = useState(false);
  const [resumenSAP, setResumenSAP] = useState([]);

  const [ordenTabla, setOrdenTabla] = useState({
    campo: null,
    direccion: "asc",
  });

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
        { params: { cia: ciaActiva } },
      );

      Swal.close();

      if (res.data.success) {
        setFechasDisponibles(res.data.data);
        if (res.data.data.length === 0) {
          Swal.fire(
            "Sin datos",
            "No se encontraron fechas con registros para esta CIA.",
            "info",
          );
        }
      } else {
        Swal.fire(
          "Error",
          res.data.error || "Error al obtener las fechas.",
          "error",
        );
      }
    } catch (err) {
      Swal.close();
      console.error("Error al cargar fechas:", err);
      Swal.fire(
        "Error",
        "No se pudieron cargar las fechas disponibles.",
        "error",
      );
    }
  };

  useEffect(() => {
    if (cia) {
      fetchFechasDisponibles(cia);
    }
  }, [cia]);

  const fetchAlmacenes = async () => {
    if (!cia || !fecha) {
      Swal.fire(
        "Faltan datos",
        "Debes seleccionar una CIA y una fecha.",
        "warning",
      );
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
        { params: { cia, fecha } },
      );

      Swal.close();

      if (res.data.success) {
        const data = Array.isArray(res.data.data) ? res.data.data : [];

        const listaAplanada =
          data.length > 0 && data[0]?.registros
            ? data.flatMap((b) =>
                Array.isArray(b.registros) ? b.registros : [],
              )
            : data; //

        if (res.data.success) {
          const bloques = Array.isArray(res.data.data) ? res.data.data : [];

          setAlmacenes(bloques);

          if (bloques.length === 0) {
            Swal.fire(
              "Sin datos",
              "No se encontraron almacenes para la CIA y fecha seleccionada.",
              "warning",
            );
          }
        }

        if (listaAplanada.length === 0) {
          Swal.fire(
            "Sin datos",
            "No se encontraron almacenes para la CIA y fecha seleccionada.",
            "warning",
          );
        }
      } else {
        Swal.fire(
          "Error",
          res.data.error || "Error desconocido en la carga de datos.",
          "error",
        );
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
      const c4 = Number(item.conteo4 ?? 0);

      const conteo_final = obtenerUltimoConteo(item);
      const sap_final = Number(item.inventario_sap ?? 0);
      const diferencia_cierre = Number((conteo_final - sap_final).toFixed(2));

      return {
        ...item,
        conteo1: c1,
        conteo2: c2,
        conteo3: c3,
        conteo4: c4,
        inventario_sap: sap_final,
        conteo_final,
        sap_final,
        diferencia_cierre,
      };
    });
  };

  const actualizarDatosVista = async () => {
    if (!cia || !fecha) {
      Swal.fire("Faltan datos", "Selecciona una CIA y una fecha.", "warning");
      return;
    }

    try {
      Swal.fire({
        title: "Actualizando...",
        text: "Recargando información del mapa",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await fetchAlmacenes();

      if (grupoSeleccionado) {
        await fetchDetalleGrupo(grupoSeleccionado);
      } else if (almacenSeleccionado) {
        await fetchDetalle();
      }

      Swal.close();
    } catch (error) {
      Swal.close();
      Swal.fire("Error", "No se pudo actualizar la información.", "error");
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
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/mapa_detalle.php",
        { params: { almacen: almacenSeleccionado, fecha, cia } },
      );

      Swal.close();

      if (res.data.success) {
        setEstatusInventario(Number(res.data.estatus));

        try {
          const resp = await axios.get(
            "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/estado_refresh_sap.php",
            { params: { almacen: almacenSeleccionado, fecha, cia } },
          );

          if (resp.data.success) {
            setSapRefrescado(Number(resp.data.sap_refrescado) === 1);
          } else {
            setSapRefrescado(null);
          }
        } catch {
          setSapRefrescado(null);
        }

        const hayConteo4 = (
          Array.isArray(res.data.data) ? res.data.data : []
        ).some(
          (row) =>
            row.conteo4 !== null &&
            row.conteo4 !== undefined &&
            String(row.conteo4).trim() !== "",
        );

        setMostrarConteo4(hayConteo4);

        const detalleConFinal = normalizarDetalle(res.data.data);

        setDetalle(filtrarArticulosValidos(detalleConFinal));
        setPaginaActual(1);

        if (res.data.data.length === 0) {
          Swal.fire(
            "Sin datos",
            "No hay información para este almacén y fecha.",
            "info",
          );
        }
      } else {
        Swal.fire(
          "Error",
          res.data.error || "No se pudo obtener el detalle.",
          "error",
        );
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
        },
      );

      const hayConteo4 = (
        Array.isArray(res.data.data) ? res.data.data : []
      ).some(
        (row) =>
          row.conteo4 !== null &&
          row.conteo4 !== undefined &&
          String(row.conteo4).trim() !== "",
      );

      setMostrarConteo4(hayConteo4);

      Swal.close();

      if (!res.data.success) {
        Swal.fire(
          "Error",
          res.data.error || "Error al obtener detalle del grupo",
          "error",
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
          },
        );

        if (resp.data && resp.data.success) {
          setSapRefrescado(resp.data.sap_refrescado === 1);
          setGrupoCompleto(Number(resp.data.total) === grupo.almacenes.length);
        } else {
          setSapRefrescado(null);
          setGrupoCompleto(false);
        }
      } catch (e) {
        setSapRefrescado(null);
        setGrupoCompleto(false);
      }

      const detalleConFinal = (
        Array.isArray(res.data.data) ? res.data.data : []
      ).map((item) => {
        const c1 = Number(item.conteo1 ?? 0);
        const c2 = Number(item.conteo2 ?? 0);
        const c3 = Number(item.conteo3 ?? 0);
        const c4 = Number(item.conteo4 ?? 0);

        const conteo_final = obtenerUltimoConteo(item);

        const sap_final = Number(item.inventario_sap ?? 0);
        const diferencia_cierre = Number((conteo_final - sap_final).toFixed(2));

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
    detalle.forEach((d) => {
      if (d.almacen) set.add(d.almacen);
    });
    return Array.from(set).sort();
  }, [detalle]);

  const cambiarOrdenTabla = (campo) => {
    setOrdenTabla((prev) => {
      if (prev.campo === campo) {
        return {
          campo,
          direccion: prev.direccion === "asc" ? "desc" : "asc",
        };
      }

      return {
        campo,
        direccion: "asc",
      };
    });
  };

  const iconoOrden = (campo) => {
    if (ordenTabla.campo !== campo) return "↕";
    return ordenTabla.direccion === "asc" ? "↑" : "↓";
  };

  const ordenarDatosNumericos = (lista = []) => {
    if (!ordenTabla.campo) return lista;

    return [...lista].sort((a, b) => {
      const valorA = Number(a[ordenTabla.campo] ?? 0);
      const valorB = Number(b[ordenTabla.campo] ?? 0);

      return ordenTabla.direccion === "asc" ? valorA - valorB : valorB - valorA;
    });
  };

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

  const detalleOrdenado = useMemo(() => {
    return ordenarDatosNumericos(detalleFiltrado);
  }, [detalleFiltrado, ordenTabla]);

  const detallePaginado = useMemo(() => {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;

    return detalleOrdenado.slice(inicio, fin);
  }, [detalleOrdenado, paginaActual]);

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
      const dif = Number(d.diferencia_cierre ?? 0);
      const precio = Number(d.precio ?? 0);

      if (dif !== 0) {
        itemsConDiferencia++;

        if (dif > 0) {
          sobrantes += dif;
        } else if (dif < 0) {
          faltantes += Math.abs(dif);
        }

        const impacto = Math.abs(dif * precio);

        if (dif > 0) {
          importeEntrada += impacto;
        } else if (dif < 0) {
          importeSalida += impacto;
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
      importeTotal: importeEntrada - importeSalida,
    };
  }, [detalle]);

  const filasDiferencias = useMemo(() => {
    return detalle
      .filter((d) => (d.diferencia_cierre ?? 0) !== 0)
      .sort(
        (a, b) =>
          Math.abs(b.diferencia_cierre ?? 0) -
          Math.abs(a.diferencia_cierre ?? 0),
      );
  }, [detalle]);

  const gruposUI = useMemo(() => {
    const bloques = Array.isArray(almacenes) ? almacenes : [];

    const gruposPorBase = {};

    bloques.forEach((b) => {
      const regs = Array.isArray(b.registros) ? b.registros : [];

      regs.forEach((r) => {
        const alm = (r.almacen || "").trim();
        const base = alm.includes("-") ? alm.split("-")[0] : alm;
        const estatusAlmacen = Number(r.estatus ?? b.estatus);

        if (!gruposPorBase[base]) {
          gruposPorBase[base] = [];
        }

        gruposPorBase[base].push({
          ...r,
          estatus: estatusAlmacen,
        });
      });
    });

    const out = {};

    Object.entries(gruposPorBase).forEach(([base, items]) => {
      const estatusLista = items.map((x) => Number(x.estatus));

      const todosFinalizados = estatusLista.every((e) => e === 5);

      const estatusGrupo = todosFinalizados
        ? 5
        : Math.min(...estatusLista.filter((e) => e < 5));

      if (!out[estatusGrupo]) {
        out[estatusGrupo] = [];
      }

      out[estatusGrupo].push({
        base,
        items,
      });
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
        "",
        "",
        "",
        "", //
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

      if (diferencia === 0) {
        diffCell.font = { color: { argb: "FFD700" }, bold: true };
      } else if (diferencia < 0) {
        diffCell.font = { color: { argb: "008000" }, bold: true };
      } else {
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

      column.eachCell({ includeEmpty: true }, (cell) => {
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

    saveAs(blob, `mapa_${almacenSeleccionado || "almacen"}_${fecha}.xlsx`);
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
      },
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

      const opcionesCuentas = cuentas.map((c) => ({
        value: c.numero_cuenta,
        label: `${c.numero_cuenta} - ${c.nombre_cuenta}`,
      }));

      let cuentaEMSeleccionada = null;
      let cuentaSMSeleccionada = null;

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
                <div id="sw_em_container"></div>
              </div>

              <div>
                <label style="display:block; margin:0 0 6px;">Cuenta SM (Salida)</label>
                <div id="sw_sm_container"></div>
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
                Comentario (máx 50 caracteres)
              </label>

              <div style="position:relative;">
                <textarea
                  id="sw_comentario"
                  maxlength="50"
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
                    if(this.value.length > 50) this.value = this.value.slice(0,50);
                    const counter = document.getElementById('sw_counter');
                    counter.innerText = this.value.length + '/50';
                    counter.style.color = this.value.length >= 50 ? '#dc2626' : '#6b7280';
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
                  0/50
                </div>
              </div>
            </div>


            </div>
          </div>
        `,
        didOpen: () => {
  const popup = Swal.getPopup();
  if (popup) popup.style.overflow = "visible";

  const emContainer = document.getElementById("sw_em_container");
  const smContainer = document.getElementById("sw_sm_container");

  if (emContainer) {
    const rootEM = ReactDOM.createRoot(emContainer);

    rootEM.render(
      <Select
        options={opcionesCuentas}
        placeholder="-- Selecciona cuenta EM --"
        isSearchable
        isClearable
        menuPortalTarget={document.body}
        styles={{
          menuPortal: (base) => ({
            ...base,
            zIndex: 99999,
          }),
          control: (base) => ({
            ...base,
            minHeight: "40px",
            fontSize: "14px",
            textAlign: "left",
          }),
          menu: (base) => ({
            ...base,
            zIndex: 99999,
            textAlign: "left",
          }),
          option: (base) => ({
            ...base,
            fontSize: "13px",
            textAlign: "left",
          }),
          singleValue: (base) => ({
            ...base,
            fontSize: "13px",
            textAlign: "left",
          }),
          placeholder: (base) => ({
            ...base,
            fontSize: "13px",
            textAlign: "left",
          }),
        }}
        onChange={(opcion) => {
          cuentaEMSeleccionada = opcion ? opcion.value : null;
        }}
      />,
    );
  }

  if (smContainer) {
    const rootSM = ReactDOM.createRoot(smContainer);

    rootSM.render(
      <Select
        options={opcionesCuentas}
        placeholder="-- Selecciona cuenta SM --"
        isSearchable
        isClearable
        menuPortalTarget={document.body}
        styles={{
          menuPortal: (base) => ({
            ...base,
            zIndex: 99999,
          }),
          control: (base) => ({
            ...base,
            minHeight: "40px",
            fontSize: "14px",
            textAlign: "left",
          }),
          menu: (base) => ({
            ...base,
            zIndex: 99999,
            textAlign: "left",
          }),
          option: (base) => ({
            ...base,
            fontSize: "13px",
            textAlign: "left",
          }),
          singleValue: (base) => ({
            ...base,
            fontSize: "13px",
            textAlign: "left",
          }),
          placeholder: (base) => ({
            ...base,
            fontSize: "13px",
            textAlign: "left",
          }),
        }}
        onChange={(opcion) => {
          cuentaSMSeleccionada = opcion ? opcion.value : null;
        }}
      />,
    );
  }
},
        preConfirm: () => {
          const proyecto = document
            .getElementById("sw_proyecto")
            ?.value?.trim();
          const cuentaEM = cuentaEMSeleccionada;
          const cuentaSM = cuentaSMSeleccionada;
          const comentario =
            document.getElementById("sw_comentario")?.value?.trim() || "";

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

          if (comentario.length > 50) {
            Swal.showValidationMessage(
              "El comentario no puede exceder 50 caracteres.",
            );
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
        ? Array.from(new Set(detalle.map((x) => x.almacen).filter(Boolean)))
        : [almacenSeleccionado];

      console.log("ALMACENES A CERRAR:", almacenesACerrar);

      if (!almacenesACerrar || almacenesACerrar.length === 0) {
        Swal.close();
        Swal.fire("Error", "No hay almacenes para cerrar.", "error");
        return;
      }

      const erroresCierre = [];

      for (const alm of almacenesACerrar) {
        try {
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
            },
          );

          console.log("RESPUESTA CIERRE:", alm, res.data);

          if (!res.data || !res.data.success) {
            erroresCierre.push(
              `${alm}: ${res.data?.error || "Error desconocido"}`,
            );
          }
        } catch (error) {
          erroresCierre.push(`${alm}: ${error.message}`);
        }
      }

      if (erroresCierre.length > 0) {
        throw new Error(erroresCierre.join("\n"));
      }

      Swal.close();

      await Swal.fire(
        "Éxito",
        grupoSeleccionado
          ? "Cierre generado correctamente para todos los almacenes del grupo."
          : "Cierre generado correctamente.",
        "success",
      );

      setMostrarDrawer(false);

      await fetchAlmacenes();

      if (grupoSeleccionado) {
        await fetchDetalleGrupo(grupoSeleccionado);
      } else {
        await fetchDetalle();
      }
    } catch (e) {
      Swal.close();
      Swal.fire("Error", e.message || "No se pudo generar el cierre", "error");
    }
  };

  const refreshSAP = async () => {
    if (!grupoSeleccionado || !grupoSeleccionado.almacenes?.length) {
      Swal.fire(
        "Acción no permitida",
        "La actualización de datos SAP solo aplica para detalle de grupo.",
        "warning",
      );
      return;
    }

    const confirm = await Swal.fire({
      title: "¿Actualizar datos desde SAP?",
      icon: "warning",
      width: 650,
      showCancelButton: true,
      confirmButtonText: "Sí, actualizar",
      cancelButtonText: "Cancelar",
      focusConfirm: false,
      html: `
      <div style="text-align:left; font-size:14px;">
        <p style="margin:0 0 16px 0; color:#4b5563; text-align:center;">
          Este proceso solo se puede ejecutar una vez y no tiene vuelta atrás.
        </p>

        <div style="display:grid; grid-template-columns:1fr; gap:14px;">
          <div>
            <label style="display:block; margin-bottom:6px; font-weight:600; color:#374151;">
              Nombre del responsable
            </label>
            <input
              id="sw_responsable_nombre"
              class="swal2-input"
              type="text"
              placeholder="Ej. Juan Pérez"
              style="width:100%; margin:0;"
            />
          </div>

          <div>
            <label style="display:block; margin-bottom:6px; font-weight:600; color:#374151;">
              Número de empleado
            </label>
            <input
              id="sw_responsable_empleado"
              class="swal2-input"
              type="text"
              inputmode="numeric"
              placeholder="Ej. 42371"
              style="width:100%; margin:0;"
              oninput="this.value = this.value.replace(/[^0-9]/g, '')"
            />
          </div>
        </div>
      </div>
    `,
      didOpen: () => {
        const confirmButton = Swal.getConfirmButton();
        const nombreInput = document.getElementById("sw_responsable_nombre");
        const empleadoInput = document.getElementById(
          "sw_responsable_empleado",
        );

        if (confirmButton) {
          confirmButton.disabled = true;
        }

        const validar = () => {
          const nombre = nombreInput?.value?.trim() || "";
          const empleado = empleadoInput?.value?.trim() || "";

          if (confirmButton) {
            confirmButton.disabled = !(
              nombre.length > 0 && empleado.length > 0
            );
          }
        };

        nombreInput?.addEventListener("input", validar);
        empleadoInput?.addEventListener("input", validar);
      },
      preConfirm: () => {
        const responsableNombre = document
          .getElementById("sw_responsable_nombre")
          ?.value?.trim();

        const responsableEmpleado = document
          .getElementById("sw_responsable_empleado")
          ?.value?.trim();

        if (!responsableNombre) {
          Swal.showValidationMessage("Captura el nombre del responsable.");
          return false;
        }

        if (!responsableEmpleado) {
          Swal.showValidationMessage("Captura el número de empleado.");
          return false;
        }

        return {
          responsableNombre,
          responsableEmpleado,
        };
      },
    });

    if (!confirm.isConfirmed) return;

    const responsableNombre = confirm.value.responsableNombre;
    const responsableEmpleado = confirm.value.responsableEmpleado;

    try {
      setProcesandoRefresh(true);

      Swal.fire({
        title: "Procesando...",
        text: "Reconsultando datos desde SAP",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const almacenesRefresh = grupoSeleccionado.almacenes.join(",");
      const grupoRefresh = grupoSeleccionado.base;

      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/refresh_sap.php",
        {
          params: {
            almacen: almacenesRefresh,
            grupo: grupoRefresh,
            fecha,
            cia,
            responsable_nombre: responsableNombre,
            responsable_empleado: responsableEmpleado,
            usuario_sesion: sessionStorage.getItem("empleado"),
          },
        },
      );

      Swal.close();

      if (!res.data || !res.data.success) {
        throw new Error(res.data?.error || "Error al refrescar SAP");
      }

      await Swal.fire("Listo", res.data.mensaje, "success");

      setSapRefrescado(1);

      await fetchDetalleGrupo(grupoSeleccionado);
    } catch (e) {
      Swal.close();
      Swal.fire("Error", e.message || "Error al refrescar SAP", "error");
    } finally {
      setProcesandoRefresh(false);
    }
  };

  const fetchResumenSAP = async () => {
    try {
      Swal.fire({
        title: "Validando...",
        text: "Verificando si el cierre ya fue procesado en SAP.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

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
        },
      );

      Swal.close();

      if (!res.data.success) {
        Swal.fire(
          "Pendiente de procesamiento",
          res.data.error ||
            "Aún no se ha procesado a SAP, favor de contactar al administrador.",
          "warning",
        );
        return;
      }

      setResumenSAP(res.data.data);
      setMostrarResumenSAP(true);
    } catch (e) {
      Swal.close();
      Swal.fire(
        "Error",
        e.message || "No se pudo obtener el resumen contable SAP.",
        "error",
      );
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
      img.onerror = (error) => reject(error);
      img.src = url;
    });
  };

  const generarPDF = async () => {
    const logoBase64 = await convertirImagenBase64(logoDiniz);

    const usuarioSesion =
      sessionStorage.getItem("nombre") ||
      sessionStorage.getItem("nombre_usuario") ||
      document
        .querySelector("body")
        ?.innerText?.match(/Usuario:\s*(.*?)\s*\(/)?.[1] ||
      "USUARIO";

    const bodyRows = resumenSAP.map((row) => [
      { text: row.almacen, alignment: "left", fontSize: 10 },
      {
        text: `$${Number(row.FALTANTE).toFixed(2)}`,
        alignment: "right",
        color: "red",
        fontSize: 10,
      },
      {
        text: `$${Number(row.SOBRANTE).toFixed(2)}`,
        alignment: "right",
        color: "green",
        fontSize: 10,
      },
      {
        text: `$${Number(row.TOTAL).toFixed(2)}`,
        alignment: "right",
        bold: true,
        fontSize: 10,
      },
      { text: row.DOC_FALTANTE || "-", alignment: "center", fontSize: 10 },
      { text: row.DOC_SOBRANTE || "-", alignment: "center", fontSize: 10 },
    ]);

    const docDefinition = {
      pageOrientation: "landscape",
      pageSize: "A4",
      pageMargins: [50, 70, 50, 80],

      header: {
        margin: [50, 20, 50, 0],
        columns: [
          {
            image: logoBase64,
            width: 90,
          },
          {
            alignment: "right",
            stack: [
              { text: "Código:", fontSize: 8 },
              { text: `Fecha emisión: ${fecha}`, fontSize: 8 },
              { text: "Versión: 1", fontSize: 8 },
              { text: `Emitido por: ${usuarioSesion}`, fontSize: 8 },
            ],
          },
        ],
      },

      content: [
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 750,
              y2: 0,
              lineWidth: 0.5,
              lineColor: "#9ca3af",
            },
          ],
          margin: [0, 10, 0, 20],
        },

        {
          text: "RESUMEN CONTABLE DE AJUSTES SAP",
          alignment: "center",
          fontSize: 14,
          bold: true,
          margin: [0, 0, 0, 20],
        },

        {
          table: {
            headerRows: 1,
            widths: ["*", 90, 90, 90, 120, 120],
            body: [
              [
                { text: "ALMACÉN", style: "tableHeader" },
                { text: "FALTANTE", style: "tableHeader", alignment: "right" },
                { text: "SOBRANTE", style: "tableHeader", alignment: "right" },
                { text: "TOTAL", style: "tableHeader", alignment: "right" },
                {
                  text: "DOC SAP FALTANTE",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "DOC SAP SOBRANTE",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...bodyRows,
            ],
          },
          layout: {
            fillColor: (rowIndex, node) => {
              if (rowIndex === 0) return "#611232";
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
          },
        },

        { text: "\n\n\n\n\n" },

        {
          columns: [
            {
              width: "*",
              stack: [
                {
                  text: "____________________________________________",
                  alignment: "center",
                },
                {
                  text: usuarioSesion.toUpperCase(),
                  alignment: "center",
                  fontSize: 9,
                  bold: true,
                  margin: [0, 3, 0, 0],
                },
                {
                  text: "GERENTE DE OPERACIONES",
                  alignment: "center",
                  fontSize: 9,
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            {
              width: "*",
              stack: [
                {
                  text: "____________________________________________",
                  alignment: "center",
                },
                {
                  text: "FIRMA DEL SUBGERENTE CONTABLE-ADMINISTRATIVO",
                  alignment: "center",
                  fontSize: 9,
                  margin: [0, 5, 0, 0],
                },
              ],
            },
          ],
        },

        { text: "\n\n\n" },

        {
          columns: [
            {
              width: "*",
              stack: [
                {
                  text: "____________________________________________",
                  alignment: "center",
                },
                {
                  text: "FIRMA DEL SUBGERENTE DE OPERACIONES",
                  alignment: "center",
                  fontSize: 9,
                  margin: [0, 5, 0, 0],
                },
              ],
            },
            {
              width: "*",
              stack: [
                {
                  text: "____________________________________________",
                  alignment: "center",
                },
                {
                  text: "FIRMA DEL AUDITOR INTERNO",
                  alignment: "center",
                  fontSize: 9,
                  margin: [0, 5, 0, 0],
                },
              ],
            },
          ],
        },
      ],

      styles: {
        tableHeader: {
          color: "white",
          bold: true,
          fontSize: 9,
        },
      },
    };

    pdfMake.createPdf(docDefinition).download(`Resumen_SAP_${fecha}.pdf`);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-3 py-4 sm:px-4 md:px-6 lg:px-8">
      <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 mb-6">
        📊 Mapa de Operaciones
      </h1>

      {mostrarDrawer &&
        createPortal(
          <div className="fixed inset-0 z-[600] flex items-start justify-center bg-slate-950/70 p-0 sm:p-4 backdrop-blur-sm">
            <div className="relative h-screen w-full overflow-hidden bg-white shadow-2xl sm:h-[95vh] sm:max-w-[1400px] sm:rounded-3xl">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#611232] via-[#8a1b4a] to-slate-950" />

              <div className="sticky top-0 z-[650] border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMostrarDrawer(false)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-[#611232]/30 hover:bg-[#611232]/5 hover:text-[#611232] active:scale-[0.98]"
                  >
                    ← Regresar
                  </button>

                  <div className="min-w-0 flex-1 text-center">
                    <div className="mx-auto mb-1 inline-flex items-center rounded-full border border-[#611232]/15 bg-[#611232]/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#611232]">
                      Cierre de inventario
                    </div>

                    <h2 className="truncate text-sm font-black text-slate-900 sm:text-base lg:text-lg">
                      {grupoSeleccionado
                        ? `Grupo ${grupoSeleccionado.base}`
                        : almacenSeleccionado}
                      {" · "}
                      {fecha}
                    </h2>
                  </div>

                  <button
                    onClick={() => setMostrarDrawer(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-black text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 active:scale-[0.98]"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="sticky top-[66px] z-[650] border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-5">
                <div className="flex gap-2 overflow-x-auto py-2">
                  <button
                    onClick={() => setTabActiva("resumen")}
                    className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition ${
                      tabActiva === "resumen"
                        ? "bg-[#611232] text-white shadow-md shadow-[#611232]/20"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    Resumen
                  </button>

                  <button
                    onClick={() => setTabActiva("detalle")}
                    className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition ${
                      tabActiva === "detalle"
                        ? "bg-[#611232] text-white shadow-md shadow-[#611232]/20"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    Detalle Completo
                  </button>
                </div>
              </div>

              <div className="h-[calc(100vh-120px)] overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:h-[calc(95vh-120px)] sm:p-5 lg:p-6">
                {tabActiva === "resumen" ? (
                  <>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Total artículos
                        </p>
                        <p className="mt-2 text-2xl font-black text-slate-900">
                          {resumenCierre.totalItems}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Con diferencia
                        </p>
                        <p className="mt-2 text-2xl font-black text-[#611232]">
                          {resumenCierre.itemsConDiferencia}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                          Sobrantes
                        </p>
                        <p className="mt-2 text-2xl font-black text-emerald-700">
                          {resumenCierre.sobrantes.toFixed(2)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">
                          Faltantes
                        </p>
                        <p className="mt-2 text-2xl font-black text-red-700">
                          {resumenCierre.faltantes.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Impacto Entrada
                        </p>
                        <p className="mt-2 text-2xl font-black text-emerald-700">
                          ${resumenCierre.importeEntrada.toFixed(2)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Impacto Salida
                        </p>
                        <p className="mt-2 text-2xl font-black text-red-700">
                          ${resumenCierre.importeSalida.toFixed(2)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-[#611232] p-4 shadow-lg shadow-slate-900/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                          Impacto Total
                        </p>
                        <p className="mt-2 text-2xl font-black text-white">
                          ${resumenCierre.importeTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                      <div className="flex flex-col gap-1 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
                        <h3 className="text-base font-black text-slate-900">
                          Artículos con diferencia
                        </h3>
                        <p className="text-xs font-medium text-slate-500">
                          Ordenados por impacto de ajuste.
                        </p>
                      </div>

                      {filasDiferencias.length === 0 ? (
                        <div className="p-8 text-center">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                            ✓
                          </div>

                          <p className="text-sm font-black text-slate-800">
                            No hay diferencias en este inventario.
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-[52vh] overflow-auto">
                          <table className="w-full min-w-[900px] table-fixed text-[11px]">
                            <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#611232] via-[#7a173e] to-slate-950 text-white uppercase tracking-[0.12em] shadow-md">
                              <tr>
                                <th className="w-[110px] px-3 py-3 text-left font-black">
                                  Código
                                </th>
                                <th className="w-[360px] px-3 py-3 text-left font-black">
                                  Nombre
                                </th>
                                <th className="w-[100px] px-3 py-3 text-center font-black">
                                  SAP
                                </th>
                                <th className="w-[100px] px-3 py-3 text-center font-black">
                                  Físico
                                </th>
                                <th className="w-[110px] px-3 py-3 text-center font-black">
                                  Diferencia
                                </th>
                                <th className="w-[110px] px-3 py-3 text-center font-black">
                                  Ajuste
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 bg-white">
                              {filasDiferencias.map((d, i) => {
                                const dif = d.diferencia_cierre ?? 0;
                                const tipo =
                                  dif > 0
                                    ? "Entrada"
                                    : dif < 0
                                      ? "Salida"
                                      : "-";

                                return (
                                  <tr
                                    key={i}
                                    className="transition hover:bg-[#611232]/5"
                                  >
                                    <td className="px-3 py-3">
                                      <span className="inline-flex rounded-lg border border-[#611232]/10 bg-[#611232]/5 px-2 py-1 font-mono text-[10px] font-black text-[#611232]">
                                        {d.codigo}
                                      </span>
                                    </td>

                                    <td className="px-3 py-3">
                                      <div className="line-clamp-2 font-bold leading-snug text-slate-800">
                                        {d.nombre}
                                      </div>
                                    </td>

                                    <td className="px-3 py-3 text-center font-black text-slate-700">
                                      {d.sap_final}
                                    </td>

                                    <td className="px-3 py-3 text-center font-black text-slate-700">
                                      {d.conteo_final}
                                    </td>

                                    <td className="px-3 py-3 text-center">
                                      <span
                                        className={`inline-flex min-w-16 justify-center rounded-full px-3 py-1 text-[10px] font-black ${
                                          dif === 0
                                            ? "bg-slate-100 text-slate-500"
                                            : dif > 0
                                              ? "bg-emerald-100 text-emerald-700"
                                              : "bg-red-100 text-red-700"
                                        }`}
                                      >
                                        {dif}
                                      </span>
                                    </td>

                                    <td className="px-3 py-3 text-center">
                                      <span
                                        className={`inline-flex min-w-20 justify-center rounded-full px-3 py-1 text-[10px] font-black ${
                                          dif === 0
                                            ? "bg-slate-100 text-slate-500"
                                            : dif > 0
                                              ? "bg-emerald-100 text-emerald-700"
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
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                      <div className="flex flex-col gap-1 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
                        <h3 className="text-base font-black text-slate-900">
                          Detalle completo del inventario
                        </h3>
                        <p className="text-xs font-medium text-slate-500">
                          Comparativo de SAP, conteos físicos, conteo final y
                          ajuste.
                        </p>
                      </div>

                      <div className="max-h-[62vh] overflow-auto">
                        <table className="w-full min-w-[980px] table-fixed text-[11px]">
                          <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#611232] via-[#7a173e] to-slate-950 text-white uppercase tracking-[0.12em] shadow-md">
                            <tr>
                              <th className="w-[110px] px-3 py-3 text-left font-black">
                                Código
                              </th>
                              <th className="w-[330px] px-3 py-3 text-left font-black">
                                Nombre
                              </th>
                              <th className="w-[85px] px-3 py-3 text-center font-black">
                                SAP
                              </th>
                              <th className="w-[75px] px-3 py-3 text-center font-black">
                                C1
                              </th>
                              <th className="w-[75px] px-3 py-3 text-center font-black">
                                C2
                              </th>
                              <th className="w-[75px] px-3 py-3 text-center font-black">
                                C3
                              </th>

                              {mostrarConteo4 && (
                                <th className="w-[75px] px-3 py-3 text-center font-black">
                                  Validación Fisico vs SAP
                                </th>
                              )}

                              <th className="w-[85px] px-3 py-3 text-center font-black">
                                Final
                              </th>
                              <th className="w-[85px] px-3 py-3 text-center font-black">
                                Diferencia
                              </th>
                              <th className="w-[100px] px-3 py-3 text-center font-black">
                                Ajuste
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100 bg-white">
                            {detalle.map((d, i) => {
                              const dif = d.diferencia_cierre ?? 0;
                              const tipo =
                                dif > 0 ? "Entrada" : dif < 0 ? "Salida" : "-";

                              return (
                                <tr
                                  key={i}
                                  className="transition hover:bg-[#611232]/5"
                                >
                                  <td className="px-3 py-3">
                                    <span className="inline-flex rounded-lg border border-[#611232]/10 bg-[#611232]/5 px-2 py-1 font-mono text-[10px] font-black text-[#611232]">
                                      {d.codigo}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3">
                                    <div className="line-clamp-2 font-bold leading-snug text-slate-800">
                                      {d.nombre}
                                    </div>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="inline-flex min-w-12 justify-center rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-800">
                                      {d.sap_final}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="inline-flex min-w-10 justify-center rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">
                                      {d.conteo1}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="inline-flex min-w-10 justify-center rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                                      {d.conteo2}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span className="inline-flex min-w-10 justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                                      {d.conteo3}
                                    </span>
                                  </td>

                                  {mostrarConteo4 && (
                                    <td className="px-3 py-3 text-center">
                                      <span className="inline-flex min-w-10 justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">
                                        {d.conteo4}
                                      </span>
                                    </td>
                                  )}

                                  <td className="px-3 py-3 text-center">
                                    <span className="inline-flex min-w-12 justify-center rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black text-white">
                                      {d.conteo_final}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span
                                      className={`inline-flex min-w-14 justify-center rounded-full px-2 py-1 text-[10px] font-black ${
                                        dif === 0
                                          ? "bg-slate-100 text-slate-500"
                                          : dif > 0
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {dif}
                                    </span>
                                  </td>

                                  <td className="px-3 py-3 text-center">
                                    <span
                                      className={`inline-flex min-w-20 justify-center rounded-full px-3 py-1 text-[10px] font-black ${
                                        dif === 0
                                          ? "bg-slate-100 text-slate-500"
                                          : dif > 0
                                            ? "bg-emerald-100 text-emerald-700"
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

              {estatusInventario !== 5 && (
                <div className="sticky bottom-0 z-[650] border-t border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
                  <div className="flex justify-center">
                    <button
                      onClick={confirmarCierre}
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-700/20 transition-all duration-200 hover:from-emerald-800 hover:to-emerald-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/20 active:scale-[0.98]"
                    >
                      Confirmar y Generar Cierre SAP
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {mostrarResumenSAP && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
          <div className="relative max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-950/30">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#611232] via-[#8a1b4a] to-slate-950" />

            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#611232]/15 bg-[#611232]/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#611232]">
                  Resumen SAP
                </div>

                <h2 className="mt-2 text-lg font-black text-slate-900">
                  Resumen Contable SAP
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={generarPDF}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#611232] px-4 py-2 text-xs font-black text-white shadow-md shadow-[#611232]/20 transition-all hover:bg-[#4f0e28] active:scale-[0.98]"
                >
                  <span className="rounded-lg bg-white/10 p-1">📄</span>
                  Descargar PDF
                </button>

                <button
                  onClick={() => setMostrarResumenSAP(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-black text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 active:scale-[0.98]"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="max-h-[calc(94vh-86px)] overflow-y-auto bg-slate-50 p-4 sm:p-5">
              <div className="w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5 sm:p-6 lg:p-8">
                <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <img
                      src={logoDiniz}
                      alt="Grupo Diniz"
                      className="h-14 object-contain sm:h-16"
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs font-bold text-slate-700">
                    <p>
                      <strong>Código:</strong>{" "}
                    </p>
                    <p>
                      <strong>Fecha emisión:</strong> {fecha}
                    </p>
                    <p>
                      <strong>Versión:</strong> 1
                    </p>
                  </div>
                </div>

                <h2 className="mb-7 text-center text-xl font-black tracking-wide text-slate-900 sm:text-2xl">
                  RESUMEN CONTABLE DE AJUSTES SAP
                </h2>

                <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                  <table className="w-full min-w-[850px] table-fixed text-xs">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#611232] via-[#7a173e] to-slate-950 text-white uppercase tracking-[0.12em]">
                        <th className="w-[220px] px-4 py-3 text-left font-black">
                          Almacén
                        </th>
                        <th className="w-[120px] px-4 py-3 text-right font-black">
                          Faltante
                        </th>
                        <th className="w-[120px] px-4 py-3 text-right font-black">
                          Sobrante
                        </th>
                        <th className="w-[120px] px-4 py-3 text-right font-black">
                          Total
                        </th>
                        <th className="w-[140px] px-4 py-3 text-center font-black">
                          Doc SAP Faltante
                        </th>
                        <th className="w-[140px] px-4 py-3 text-center font-black">
                          Doc SAP Sobrante
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {resumenSAP.map((row, i) => {
                        const esTotal = row.almacen === "TOTAL GENERAL";

                        return (
                          <tr
                            key={i}
                            className={`transition hover:bg-[#611232]/5 ${
                              esTotal ? "bg-slate-100 font-black" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-black text-slate-800">
                              {row.almacen}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <span className="font-black text-red-700">
                                ${Number(row.FALTANTE).toFixed(2)}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <span className="font-black text-emerald-700">
                                ${Number(row.SOBRANTE).toFixed(2)}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <span className="font-black text-slate-900">
                                ${Number(row.TOTAL).toFixed(2)}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                              {row.DOC_FALTANTE}
                            </td>

                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                              {row.DOC_SOBRANTE}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-12 grid grid-cols-1 gap-10 text-xs font-black uppercase tracking-wide text-slate-700 sm:grid-cols-2 sm:gap-16">
                  <div>
                    <div className="border-t-2 border-slate-400 pt-3 text-center">
                      Firma del Gerente de Operaciones
                    </div>
                  </div>

                  <div>
                    <div className="border-t-2 border-slate-400 pt-3 text-center">
                      Firma del Subgerente Contable-Administrativo
                    </div>
                  </div>

                  <div>
                    <div className="border-t-2 border-slate-400 pt-3 text-center">
                      Firma del Subgerente de Operaciones
                    </div>
                  </div>

                  <div>
                    <div className="border-t-2 border-slate-400 pt-3 text-center">
                      Firma del Auditor Interno
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 items-end">
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
          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 shadow-sm text-sm focus:ring-2 focus:ring-[#611232] focus:border-[#611232]"
        >
          <option value="">Selecciona CIA</option>
          <option value="recrefam">RECREFAM</option>
          <option value="veser">VESER</option>
          <option value="opardiv">OPARDIV</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 lg:p-8 mb-8 border border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <span className="text-indigo-600 text-3xl">📅</span>
            Fechas con datos
          </h2>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {fecha && (
              <div className="w-full sm:w-auto px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-700 shadow-sm">
                Fecha seleccionada: {fecha}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 items-start">
          <div className="w-full">
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
                  const registro = fechasDisponibles.find(
                    (f) => f.fecha === fechaStr,
                  );

                  if (registro) {
                    const estado =
                      coloresEstatus[registro.estatus] || coloresEstatus[0];

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
                const registro = fechasDisponibles.find(
                  (f) => f.fecha === fechaStr,
                );
                return registro ? "font-semibold bg-gray-50 rounded-lg" : "";
              }}
              className="rounded-2xl border border-slate-200 shadow-lg p-4 w-full bg-slate-50"
            />
          </div>

          <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-inner">
            <h3 className="text-md font-semibold text-gray-700 mb-3">
              📊 Indicadores de conteo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5].map((k) => (
                <div
                  key={k}
                  className="flex items-center gap-3 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200"
                >
                  <div
                    className={`h-4 w-4 rounded-full ${coloresEstatus[k].color}`}
                  ></div>
                  <span className="text-sm font-semibold text-slate-700">
                    {coloresEstatus[k].label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-start mt-6">
            <button
              onClick={actualizarDatosVista}
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[#611232] hover:bg-[#7a163f] text-white text-sm font-semibold shadow-md transition-all min-w-[220px]"
            >
              Actualizar información
            </button>
          </div>
        </div>
      </div>

      {!almacenSeleccionado && !grupoSeleccionado ? (
        <div className="relative">
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-lg shadow-slate-900/5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#611232]/15 bg-[#611232]/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#611232] mb-2">
                  Mapa operativo
                </div>

                <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                  Grupos de Inventario
                </h2>

                <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                  Visualiza el avance por grupo, estatus y almacenes asociados.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(gruposUI).map(
                  ([estatus, conjuntos]) =>
                    conjuntos.length > 0 && (
                      <div
                        key={`resumen-${estatus}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${coloresEstatus[estatus]?.color || "bg-gray-400"}`}
                          />
                          <span className="text-[9px] font-black uppercase tracking-wide text-slate-500 truncate">
                            {coloresEstatus[estatus]?.label}
                          </span>
                        </div>

                        <div className="mt-1 text-lg font-black text-slate-900">
                          {conjuntos.length}
                        </div>
                      </div>
                    ),
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {Object.entries(gruposUI)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(
                ([estatus, conjuntos]) =>
                  conjuntos.length > 0 && (
                    <div key={estatus} className="space-y-4">
                      <h3
                        className={`
                  relative overflow-hidden rounded-xl px-4 py-3 text-white shadow-md
                  ${coloresEstatus[estatus]?.color || "bg-gray-400"}
                `}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-white/5 to-black/10" />

                        <div className="relative flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[9px] uppercase tracking-[0.18em] font-black opacity-80">
                              Estatus
                            </div>
                            <div className="mt-1 text-sm font-black tracking-wide">
                              {coloresEstatus[estatus]?.icono}{" "}
                              {coloresEstatus[estatus]?.label}
                            </div>
                          </div>

                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm shadow-inner">
                            {conjuntos.length}
                          </div>
                        </div>
                      </h3>

                      <div className="flex flex-col gap-4">
                        {conjuntos.map((g, idx) => (
                          <div
                            key={`${estatus}-${g.base}-${idx}`}
                            className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-900/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                          >
                            <div
                              className={`
                        relative overflow-hidden px-4 py-4 text-white
                        ${coloresEstatus[estatus]?.color}
                      `}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-white/5 to-black/10" />

                              <div className="relative flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/75">
                                    Grupo
                                  </div>

                                  <div className="mt-1 text-xl font-black tracking-wide">
                                    {g.base}
                                  </div>

                                  <div className="mt-2 inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white">
                                    {g.items.length} almacenes asociados
                                  </div>
                                </div>

                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl shadow-inner">
                                  {coloresEstatus[estatus]?.icono}
                                </div>
                              </div>
                            </div>

                            <div className="p-4 space-y-3">
                              <button
                                onClick={() => {
                                  setAlmacenSeleccionado(null);
                                  setGrupoSeleccionado({
                                    base: g.base,
                                    almacenes: g.items.map((x) => x.almacen),
                                    estatus: Number(estatus),
                                  });
                                }}
                                className="w-full rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-[#611232] px-4 py-2.5 text-xs font-black text-white shadow-md transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
                              >
                                Ver detalle del grupo
                              </button>

                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                                  Almacenes
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {g.items.map((r, j) => (
                                    <button
                                      key={`${r.almacen}-${j}`}
                                      onClick={() =>
                                        setAlmacenSeleccionado(r.almacen)
                                      }
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition-all duration-200 hover:border-[#611232]/30 hover:bg-[#611232]/5 hover:text-[#611232] active:scale-[0.98]"
                                    >
                                      {r.almacen}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
              )}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#611232] via-[#8a1b4a] to-slate-950" />

          <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 mb-5">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#611232]/15 bg-[#611232]/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#611232] mb-2">
                    Detalle operativo
                  </div>

                  <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                    🔎 Detalle:{" "}
                    {grupoSeleccionado
                      ? `Grupo ${grupoSeleccionado.base}`
                      : almacenSeleccionado}
                  </h2>

                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                    Consulta existencias SAP, conteos físicos y diferencias por
                    artículo.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:flex xl:flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (grupoSeleccionado) {
                        fetchDetalleGrupo(grupoSeleccionado);
                      } else if (almacenSeleccionado) {
                        fetchDetalle();
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#611232] px-3 py-2 text-xs font-black text-white shadow-md transition-all duration-200 hover:bg-[#4f0e28] active:scale-[0.98]"
                  >
                    <span className="bg-white/10 p-1 rounded-md">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 12a9 9 0 11-3.51-7.03"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 3v6h-6"
                        />
                      </svg>
                    </span>
                    Actualizar
                  </button>

                  {grupoSeleccionado &&
                    [4, 7].includes(Number(estatusInventario)) &&
                    sapRefrescado === false &&
                    grupoCompleto === true && (
                      <button
                        onClick={refreshSAP}
                        disabled={procesandoRefresh}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 px-3 py-2 text-xs font-black text-white shadow-md transition-all duration-300 hover:from-amber-800 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                      >
                        <div className="bg-white/15 p-1 rounded-md">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 12a9 9 0 11-3.51-7.03"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 3v6h-6"
                            />
                          </svg>
                        </div>

                        <span>
                          {procesandoRefresh
                            ? "Sincronizando..."
                            : "Actualizar SAP"}
                        </span>
                      </button>
                    )}

                  {(([4, 7].includes(Number(estatusInventario)) &&
                    sapRefrescado === true) ||
                    Number(estatusInventario) === 5) && (
                    <button
                      onClick={() => setMostrarDrawer(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-3 py-2 text-xs font-black text-white shadow-md transition-all duration-300 hover:from-slate-950 hover:to-slate-800 active:scale-[0.98]"
                    >
                      <div className="bg-white/10 p-1 rounded-md">
                        <svg
                          className="w-3.5 h-3.5"
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

                      <span>Cierre</span>
                    </button>
                  )}

                  {estatusInventario === 5 && (
                    <button
                      onClick={fetchResumenSAP}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-700 px-3 py-2 text-xs font-black text-white shadow-md transition-all duration-300 hover:from-emerald-900 hover:to-emerald-800 active:scale-[0.98]"
                    >
                      <div className="bg-white/15 p-1 rounded-md">
                        <svg
                          className="w-3.5 h-3.5"
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

                      <span>Resumen SAP</span>
                    </button>
                  )}

                  <button
                    onClick={exportarExcelMapa}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-3 py-2 text-xs font-black text-white shadow-md transition-all duration-300 hover:from-emerald-800 hover:to-emerald-700 active:scale-[0.98]"
                  >
                    <div className="bg-white/15 p-1 rounded-md">
                      <img
                        src="https://img.icons8.com/color/18/microsoft-excel-2019.png"
                        alt="excel"
                        className="w-4 h-4"
                      />
                    </div>

                    <span>Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      setAlmacenSeleccionado(null);
                      setGrupoSeleccionado(null);
                      setDetalle([]);
                      setBusqueda("");
                      setPaginaActual(1);
                      setGrupoCompleto(false);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-3 py-2 text-xs font-black text-white shadow-md transition-all duration-200 hover:from-slate-950 hover:to-slate-800 active:scale-[0.98]"
                  >
                    🔄 Grupos
                  </button>
                </div>
              </div>

              {detalle.length > 0 && (
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Total registros
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-900">
                      {detalleFiltrado.length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Página actual
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#611232]">
                      {paginaActual}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Almacenes visibles
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-900">
                      {Object.keys(detallePorAlmacen).length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#611232]/20 bg-[#611232]/5 p-3 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#611232]">
                      Por página
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#611232]">
                      {registrosPorPagina}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {detalle.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  📦
                </div>

                <p className="text-sm font-black text-slate-800">
                  Sin registros para este almacén.
                </p>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  Actualiza la información o regresa al listado de grupos.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                <div className="border-b border-slate-200 bg-white p-3">
                  <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
                    <select
                      value={almacenFiltro}
                      onChange={(e) => {
                        setAlmacenFiltro(e.target.value);
                        setPaginaActual(1);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-700 shadow-sm transition focus:border-[#611232] focus:outline-none focus:ring-2 focus:ring-[#611232]/15"
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
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-700 shadow-sm transition placeholder:text-slate-400 focus:border-[#611232] focus:outline-none focus:ring-2 focus:ring-[#611232]/15"
                    />
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600">
                    <span>
                      Mostrando{" "}
                      <strong className="text-slate-900">
                        {(paginaActual - 1) * registrosPorPagina + 1}–
                        {Math.min(
                          paginaActual * registrosPorPagina,
                          detalleFiltrado.length,
                        )}
                      </strong>{" "}
                      de{" "}
                      <strong className="text-slate-900">
                        {detalleFiltrado.length}
                      </strong>{" "}
                      registros
                    </span>

                    <span>
                      Página{" "}
                      <strong className="text-[#611232]">{paginaActual}</strong>{" "}
                      de{" "}
                      <strong className="text-slate-900">
                        {Math.ceil(detalleFiltrado.length / registrosPorPagina)}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="min-w-[1080px] w-full text-[10px] table-fixed">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#611232] via-[#7a173e] to-slate-950 text-white uppercase tracking-[0.12em] shadow-md">
                      <tr>
                        <th className="w-[42px] px-2 py-3 text-center font-black">
                          #
                        </th>
                        <th className="w-[78px] px-2 py-3 text-left font-black">
                          Almacén
                        </th>
                        <th className="w-[88px] px-2 py-3 text-left font-black">
                          Código
                        </th>
                        <th className="w-[210px] px-2 py-3 text-left font-black">
                          Nombre
                        </th>
                        <th className="w-[105px] px-2 py-3 text-left font-black">
                          Familia
                        </th>
                        <th className="w-[95px] px-2 py-3 text-left font-black">
                          Subfamilia
                        </th>
                        <th
                          onClick={() => cambiarOrdenTabla("precio")}
                          className="w-[75px] px-2 py-3 text-center font-black cursor-pointer select-none hover:bg-white/10"
                        >
                          Precio {iconoOrden("precio")}
                        </th>

                        <th
                          onClick={() => cambiarOrdenTabla("inventario_sap")}
                          className="w-[78px] px-2 py-3 text-center font-black cursor-pointer select-none hover:bg-white/10"
                        >
                          SAP {iconoOrden("inventario_sap")}
                        </th>
                        <th className="w-[60px] px-2 py-3 text-center font-black">
                          C1
                        </th>
                        <th className="w-[60px] px-2 py-3 text-center font-black">
                          C2
                        </th>
                        <th className="w-[60px] px-2 py-3 text-center font-black">
                          C3
                        </th>

                        {mostrarConteo4 && (
                          <th className="w-[60px] px-2 py-3 text-center font-black">
                            Validación Físico vs SAP
                          </th>
                        )}

                        <th
                          onClick={() => cambiarOrdenTabla("diferencia_cierre")}
                          className="w-[82px] px-2 py-3 text-center font-black cursor-pointer select-none hover:bg-white/10"
                        >
                          Dif {iconoOrden("diferencia_cierre")}
                        </th>
                      </tr>
                    </thead>

                    <tbody className="bg-white divide-y divide-slate-100">
                      {Object.entries(detallePorAlmacen).map(([alm, items]) => (
                        <React.Fragment key={alm}>
                          <tr className="bg-gradient-to-r from-slate-200 via-slate-100 to-white">
                            <td
                              colSpan={mostrarConteo4 ? 13 : 12}
                              className="px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black text-white shadow-sm">
                                  📦 {alm}
                                </div>

                                <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                  {items.length} registros
                                </div>
                              </div>
                            </td>
                          </tr>

                          {items.map((d, i) => {
                            const diferencia = Number(d.diferencia_cierre ?? 0);

                            return (
                              <tr
                                key={`${alm}-${i}`}
                                className="group transition-all duration-200 hover:bg-[#611232]/5"
                              >
                                <td className="px-2 py-2 text-center">
                                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-slate-100 px-1 text-[10px] font-black text-slate-700 transition group-hover:bg-[#611232] group-hover:text-white">
                                    {indiceInicial +
                                      detallePaginado.indexOf(d) +
                                      1}
                                  </span>
                                </td>

                                <td className="px-2 py-2 truncate">
                                  <span className="inline-flex max-w-full items-center rounded-lg bg-slate-900 px-2 py-1 text-[9px] font-black text-white">
                                    {d.almacen}
                                  </span>
                                </td>

                                <td className="px-2 py-2">
                                  <span className="inline-flex max-w-full items-center rounded-lg border border-[#611232]/10 bg-[#611232]/5 px-2 py-1 font-mono text-[9px] font-black text-[#611232]">
                                    {d.codigo}
                                  </span>
                                </td>

                                <td className="px-2 py-2 text-slate-800">
                                  <div className="font-bold leading-snug line-clamp-2">
                                    {d.nombre}
                                  </div>
                                </td>

                                <td className="px-2 py-2 text-slate-700">
                                  <span className="inline-flex max-w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold truncate">
                                    {d.familia ?? "-"}
                                  </span>
                                </td>

                                <td className="px-2 py-2 text-slate-700">
                                  <span className="inline-flex max-w-full items-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold truncate">
                                    {d.subfamilia ?? "-"}
                                  </span>
                                </td>

                                <td className="px-2 py-2 text-center">
                                  <span className="font-black text-slate-700">
                                    {d.precio ?? "-"}
                                  </span>
                                </td>

                                <td className="px-2 py-2 text-center">
                                  <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-800">
                                    {d.inventario_sap.toFixed(2)}
                                  </span>
                                </td>

                                <td className="px-2 py-2 text-center">
                                  <span className="inline-flex items-center justify-center min-w-9 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">
                                    {d.conteo1 ?? "-"}
                                  </span>
                                </td>

                                <td className="px-2 py-2 text-center">
                                  <span className="inline-flex items-center justify-center min-w-9 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                                    {d.conteo2 ?? "-"}
                                  </span>
                                </td>

                                <td className="px-2 py-2 text-center">
                                  <span className="inline-flex items-center justify-center min-w-9 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-black text-green-700">
                                    {d.conteo3 ?? "-"}
                                  </span>
                                </td>

                                {mostrarConteo4 && (
                                  <td className="px-2 py-2 text-center">
                                    <span className="inline-flex items-center justify-center min-w-9 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">
                                      {d.conteo4 ?? "-"}
                                    </span>
                                  </td>
                                )}

                                <td className="px-2 py-2 text-center">
                                  <span
                                    className={`inline-flex items-center justify-center min-w-14 rounded-full px-2 py-1 text-[10px] font-black shadow-sm ${
                                      diferencia === 0
                                        ? "bg-amber-400 text-amber-950"
                                        : diferencia > 0
                                          ? "bg-green-100 text-green-700 border border-green-200"
                                          : "bg-red-100 text-red-700 border border-red-200"
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
                </div>

                <div className="border-t border-slate-200 bg-white px-3 py-4">
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-3 text-xs font-black text-slate-700">
                    <button
                      onClick={() =>
                        setPaginaActual((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={paginaActual === 1}
                      className={`w-full sm:w-auto rounded-xl border px-4 py-2 font-black transition ${
                        paginaActual === 1
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                          : "bg-slate-900 text-white hover:bg-[#611232] border-slate-900"
                      }`}
                    >
                      ⬅️ Anterior
                    </button>

                    <span className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                      Página{" "}
                      <span className="font-black text-[#611232]">
                        {paginaActual}
                      </span>{" "}
                      de{" "}
                      <span className="font-black text-slate-900">
                        {Math.ceil(detalleFiltrado.length / registrosPorPagina)}
                      </span>
                    </span>

                    <button
                      onClick={() =>
                        setPaginaActual((prev) =>
                          prev <
                          Math.ceil(detalleFiltrado.length / registrosPorPagina)
                            ? prev + 1
                            : prev,
                        )
                      }
                      disabled={
                        paginaActual >=
                        Math.ceil(detalleFiltrado.length / registrosPorPagina)
                      }
                      className={`w-full sm:w-auto rounded-xl border px-4 py-2 font-black transition ${
                        paginaActual >=
                        Math.ceil(detalleFiltrado.length / registrosPorPagina)
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                          : "bg-slate-900 text-white hover:bg-[#611232] border-slate-900"
                      }`}
                    >
                      Siguiente ➡️
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
