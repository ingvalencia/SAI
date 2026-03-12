import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useEffect, useState, useRef, useMemo } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Select from "react-select";
import LectorCodigo from "../components/LectorCodigo";
import EscanerCamaraQuagga from "../components/EscanerCamaraQuagga";


const MySwal = withReactContent(Swal);


export default function CapturaInventario() {
  const [almacen, setAlmacen] = useState("");
  const [fecha, setFecha] = useState("");
  const [modo, setModo] = useState(null);
  const [datos, setDatos] = useState([]);
  const [bloqueado, setBloqueado] = useState(false);
  const [loadingInventario, setLoadingInventario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const navigate = useNavigate();
  const [mensajeModo, setMensajeModo] = useState("");
  const [mostrarComparar, setMostrarComparar] = useState(false);
  const [mensajeValidacion, setMensajeValidacion] = useState("");
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState("");
  const [subfamiliaSeleccionada, setSubfamiliaSeleccionada] = useState("");
  const [catalogoAlmacenes, setCatalogoAlmacenes] = useState([]);
  const [ciaSeleccionada, setCiaSeleccionada] = useState("");
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [lectorActivo, setLectorActivo] = useState(true);
  const [mostrarEscanerCamara, setMostrarEscanerCamara] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 100;
  const [capturaActiva, setCapturaActiva] = useState(false);
  const ultimaFirma = useRef(null);

  const nombre = sessionStorage.getItem("nombre") || "";
  const empleadoSesion = sessionStorage.getItem("empleado") || "";

  const empleado = sessionStorage.getItem("empleado");
  const location = useLocation();
  const { estatus: estatusDesdeRuta } = location.state || {};
  const [estatus, setEstatus] = useState(0);

  const [ciasPermitidas, setCiasPermitidas] = useState([]);

  const [historial, setHistorial] = useState([]);
  const [mostrarModoRapido, setMostrarModoRapido] = useState(false);
  const temporizadorLectura = useRef(null);
  const UMBRAL_SCANNER = 8; //

  const [asignacionCargada, setAsignacionCargada] = useState(false);
  const [idConfig, setIdConfig] = useState(null);
  const [tipoConteo, setTipoConteo] = useState("");
  const [nroConteo, setNroConteo] = useState(null);
  const [ciaAsignada, setCiaAsignada] = useState("");
  const [almacenAsignado, setAlmacenAsignado] = useState("");
  const [fechaAsignada, setFechaAsignada] = useState("");
  const [esBrigada, setEsBrigada] = useState(false);
  const [compaListo, setCompaListo] = useState(false);
  const [bloquearSeleccion, setBloquearSeleccion] = useState(false);



  const esCuartoConteo = Number(estatus) === 7;
  const aplicarVistaDiferenciasBrigada =esBrigada && (Number(estatus) === 3 || Number(estatus) === 7);
  const [historialConteo, setHistorialConteo] = useState({});

  const [modoLectura, setModoLectura] = useState("barra");

  const [editandoCelda, setEditandoCelda] = useState(false);

 useEffect(() => {
    const empleado = sessionStorage.getItem("empleado");
    if (!empleado) return;

    const fetchAsignacion = async () => {
      try {
        const res = await axios.get(
          `https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/verificar_asignacion.php?empleado=${empleado}`
        );

        if (res.data?.success && res.data.asignacion) {
          const a = res.data.asignacion;
          setAsignacionCargada(true);
          setIdConfig(a.id_config);
          setTipoConteo(a.tipo_conteo);
          setNroConteo(a.nro_conteo);
          setCiaAsignada(a.cia);
          setAlmacenAsignado(a.almacen);
         const fechaNormalizada = toISODate(a.fecha);
          setFechaAsignada(fechaNormalizada);

          setEsBrigada(a.tipo_conteo === "Brigada");
          setBloquearSeleccion(true);
          setEstatus(Number(a.estatus ?? a.nro_conteo ?? 1));

        } else {
          setAsignacionCargada(false);
          setBloquearSeleccion(false);
          MySwal.fire({
          icon: "info",
          title: "Sin asignación activa",
          text: "No tienes conteos asignados. Contacta al administrador.",
          confirmButtonText: "Aceptar",
          allowOutsideClick: false,
          allowEscapeKey: false,
        }).then((result) => {
          if (result.isConfirmed) {
            sessionStorage.clear();
            localStorage.clear();
            navigate("/login", { replace: true });
          }
        });

        }
      } catch (err) {
        console.error("Error al verificar asignación:", err);
      }
    };

    fetchAsignacion();
  }, []);


  // === Detección de conexión y errores de red ===
  useEffect(() => {

    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (!error.response) {
          Swal.fire({
            icon: "error",
            title: "❌ Error de conexión",
            text: "No se pudo conectar con el servidor. Verifica tu conexión a internet o inténtalo más tarde.",
            confirmButtonText: "Aceptar",
            allowOutsideClick: false,
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "⚠️ Error en la respuesta del servidor",
            text: `Código: ${error.response.status} - ${error.response.statusText}`,
            confirmButtonText: "Aceptar",
            allowOutsideClick: false,
          });
        }
        return Promise.reject(error);
      }
    );

    let estabaOffline = !navigator.onLine;

    const verificarConexion = async () => {
      const online = navigator.onLine;

      if (!online && !estabaOffline) {
        estabaOffline = true;
        Swal.fire({
          icon: "warning",
          title: "Sin conexión a internet",
          text: "Revisa tu conexión antes de continuar.",
          allowOutsideClick: false,
          allowEscapeKey: false,
          confirmButtonText: "Reintentar",
          didClose: () => {
            if (!navigator.onLine) Swal.showLoading();
          },
        });
      }

      if (online && estabaOffline) {
        estabaOffline = false;
        Swal.close();
      }
    };

    const intervalo = setInterval(verificarConexion, 3000);

    window.addEventListener("online", verificarConexion);
    window.addEventListener("offline", verificarConexion);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener("online", verificarConexion);
      window.removeEventListener("offline", verificarConexion);
    };
  }, []);



  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  useEffect(() => {
    setModo(null);
    setDatos([]);
    setBloqueado(false);
    setCapturaActiva(false);
    ultimaFirma.current = null;
  }, [almacen, fecha, ciaSeleccionada]);



  const esTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

  const esIPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  const ua = navigator.userAgent || "";

  const esTelefono = /Android.*Mobile|iPhone|iPod/i.test(ua);

  const esTablet =
    /iPad/i.test(ua) ||
    esIPadOS ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua));

  const esDispositivoMovilOTablet = esTelefono || esTablet || esTouch;

    const getEmpleadoSeguro = () => {
      return (
        sessionStorage.getItem("empleado") ||
        localStorage.getItem("empleado") ||
        empleado ||
        ""
      );
    };


  const getParametrosEfectivos = () => {
    const emp = getEmpleadoSeguro();

    const ciaEf = asignacionCargada ? ciaAsignada : ciaSeleccionada;
    const almEf = asignacionCargada ? almacenAsignado : almacen;
    const fecEf = asignacionCargada ? fechaAsignada : fecha;

    return {
      cia: ciaEf?.toString().trim() || "",
      almacen: almEf?.toString().trim() || "",
      fecha: toISODate(fecEf),
      empleado: emp?.toString().trim() || "",
      estatus: Number(estatus) || 0,
    };
  };


  const getFirmaParametros = (p = null) => {
    const { cia, almacen, fecha, empleado, estatus } = p || getParametrosEfectivos();
    return JSON.stringify({ cia, almacen, fecha, empleado, estatus });
  };

  const soportaCamara =
  typeof window !== "undefined" &&
  !!navigator.mediaDevices &&
  !!navigator.mediaDevices.getUserMedia &&
  window.isSecureContext;

  const toISODate = (v) => {
    if (!v) return "";

    const s = String(v).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;

    const m3 = s.match(
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/i
    );

    if (m3) {
      const meses = {
        jan: "01", feb: "02", mar: "03", apr: "04",
        may: "05", jun: "06", jul: "07", aug: "08",
        sep: "09", oct: "10", nov: "11", dec: "12"
      };

      const mm = meses[m3[1].toLowerCase()];
      const dd = String(m3[2]).padStart(2, "0");
      const yy = m3[3];

      return `${yy}-${mm}-${dd}`;
    }

    return "";
  };

  const normalizarValorEscaneado = (valor) => {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .replace(/[\s\r\n-]+/g, "");
  };

  const generarVariantesCodigo = (valor) => {
    const limpio = normalizarValorEscaneado(valor);
    const variantes = new Set();

    if (!limpio) return [];

    variantes.add(limpio);

    if (/^\d+$/.test(limpio)) {
      variantes.add(limpio.replace(/^0+/, ""));
      variantes.add(`0${limpio}`);
      variantes.add(`00${limpio}`);

      if (limpio.length > 1 && limpio.startsWith("0")) {
        variantes.add(limpio.slice(1));
      }
    }

    return Array.from(variantes).filter(Boolean);
  };


  const iniciarCaptura = async () => {
    const cia = asignacionCargada ? ciaAsignada : ciaSeleccionada;
    const alm = asignacionCargada ? almacenAsignado : almacen;
    const fec = asignacionCargada ? fechaAsignada : fecha;

    const fecISO = toISODate(fec);
    const empSeguro = getEmpleadoSeguro();

    if (!cia || !alm || !fecISO || !empSeguro) {
      await MySwal.fire({
        icon: "error",
        title: "Datos incompletos",
        html: `
          <div style="text-align:left;font-size:13px">
            <b>CIA:</b> ${cia || "❌"}<br/>
            <b>Almacén:</b> ${alm || "❌"}<br/>
            <b>Fecha:</b> ${fecISO || "❌"}<br/>
            <b>Empleado:</b> ${empSeguro || "❌"}
          </div>
        `,
        confirmButtonText: "Aceptar",
        allowOutsideClick: false,
      });
      return;
    }

  const nroAsignado = asignacionCargada ? nroConteo : estatus;
  const emp =
    sessionStorage.getItem("empleado") ||
    localStorage.getItem("empleado") ||
    empleado;

  if (!alm || !fec || !emp || !cia) {
    MySwal.fire("Faltan datos", "Completa todos los campos", "warning");
    return;
  }

  const firmaActual = getFirmaParametros({
    cia,
    almacen: alm,
    fecha: fecISO,
    empleado: emp,
    estatus: nroAsignado,
  });

  if (capturaActiva && ultimaFirma.current === firmaActual) {
    MySwal.fire({
      icon: "info",
      title: "Captura ya activa",
      text: `CIA ${cia} | ${alm} | ${fecISO} | Conteo ${nroAsignado}`,
      timer: 1400,
      showConfirmButton: false,
    });
    return;
  }

  try {

    MySwal.fire({
      title: "Procesando...",
      text: "Contactando con servidor, por favor espera",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    const estatusRes = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/verifica_estatus.php",
      { params: { almacen: alm, fecha: fecISO, empleado: emp, cia } }
    );

    if (!estatusRes.data.success)
      throw new Error(estatusRes.data.error);

    if (estatusRes.data.estatus >= 4) {
      const conteoExistente = Number(estatusRes.data.nro_conteo || 0);

      Swal.close();
      return navigate("/comparar", {
        state: {
          almacen: alm,
          fecha: fecISO,
          empleado: emp,
          cia,
          estatus: conteoExistente || (asignacionCargada ? Number(nroConteo) : Number(estatus)),
        },
      });
    }

    let estatusReal = nroAsignado;

    if (!asignacionCargada) {

      estatusReal = estatusRes.data.estatus || nroAsignado || 1;
    }

    setEstatus(estatusReal);
    if (estatusReal >= 4  && estatusReal !== 7) {
        Swal.close();
        await MySwal.fire({
          icon: "info",
          title: "Proceso finalizado",
          text: "Los conteos están cerrados. Ya no puedes capturar inventario.",
          confirmButtonText: "OK",
        });

        return navigate("/comparar", {
          state: {
            almacen: alm,
            fecha: fecISO,
            empleado: emp,
            cia,
            estatus: estatusReal,
          },
        });
      }

    Swal.update({
      title: "Procesando...",
      text: "Verificando modo de captura",
    });

    const r1 = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/control_carga_inventario.php",
      {
        params: {
          almacen: alm,
          fecha: fecISO,
          empleado: emp,
          cia,
          nro_conteo: estatusReal, //
        },
      }
    );

    if (r1.data.error?.includes("bloqueado")) {
        Swal.fire("Bloqueado", r1.data.error, "error");
        setBloqueado(true);
        return;
    }


    if (!r1.data.success) throw new Error(r1.data.error);

    const modo = r1.data.modo;
    const mensaje = r1.data.mensaje || "";
    const capturista = r1.data.capturista || null;

    setModo(modo);

    const debeBloquear = (modo === "solo lectura");
    setBloqueado(debeBloquear);

    setMensajeModo(mensaje);

    const esCapturista =
      capturista === null || parseInt(capturista) === parseInt(emp);
    setMostrarComparar(modo === "solo lectura" && esCapturista);

     Swal.update({
      title: "Procesando...",
      text: "Cargando inventario físico desde base de datos",
    });

    const r2 = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/obtener_inventario.php",
      {
        params: {
          almacen: alm,
          fecha: fecISO,
          empleado: emp,
          estatus: estatusReal, //
          cia,
        },
      }
    );

    if (!r2.data.success) throw new Error(r2.data.error);

    setDatos(r2.data.data || []);

    Swal.close();

    ultimaFirma.current = getFirmaParametros({
      cia,
      almacen: alm,
      fecha: fecISO,
      empleado: emp,
      estatus: estatusReal,
    });

    setCapturaActiva(true);

    MySwal.fire({
      icon: "success",
      title: "Captura iniciada",
      text: `Modo: ${tipoConteo || "Manual"} | CIA: ${cia} | Almacén: ${alm} | Fecha: ${fecISO}`,
      timer: 1800,
      showConfirmButton: false,
    });

  } catch (error) {
    Swal.close();
    MySwal.fire("Error", error.message, "error");
    setLoadingInventario(false);
    setCapturaActiva(false);
  }
};


  const cambiarCantidad = (uid, valor) => {
    const nuevo = [...datos];
    const idx = nuevo.findIndex(
      x => `${x.ItemCode}-${x.almacen}` === uid
    );

    if (idx !== -1) {
      nuevo[idx].cant_invfis = valor;
      setDatos(nuevo);
    }
  };


  const calcularTotalDesdeInput = (rawInput, actualValue) => {
    let raw = (rawInput ?? "").toString().trim().replace(/\s+/g, "");
    if (raw === "") return { ok: true, total: "" };

    if (!/^[0-9+\-\.]+$/.test(raw)) {
      return { ok: false, error: "Formato inválido. Usa 10+20, +5 o -3" };
    }

    let total;

    try {

      if (raw.startsWith("+") || raw.startsWith("-")) {
        total = actualValue + Function(`return ${raw}`)();
      } else {

        total = Function(`return ${raw}`)();
      }
    } catch {
      return { ok: false, error: "Expresión inválida" };
    }

    if (isNaN(total)) {
      return { ok: false, error: "Resultado inválido" };
    }

    if (total < 0) {
      return { ok: false, error: "La cantidad no puede ser negativa" };
    }

    return { ok: true, total };
  };


 const autoGuardar = async (item, cantidad) => {
  try {

    const form = new FormData();
    form.append("id_inventario", item.id_inventario);

    const conteoFinal = Number(estatus);

    form.append("nro_conteo", conteoFinal);

    const cantidadFinal = Number(cantidad);

    form.append(
      "cantidad",
      Number.isFinite(cantidadFinal) ? cantidadFinal : 0
    );

    form.append("usuario", empleado);

    const res = await axios.post(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/guardar_conteo.php",
      form
    );

    if (!res.data.success) {
      console.error("Error guardando conteo:", res.data.error);
    } else {
      console.log("Conteo guardado:", item.ItemCode, cantidad);
    }
  } catch (err) {
    console.error("Error guardando conteo:", err.message);
  }
};

  const confirmarInventario = async () => {

  /*
  const hayCaptura = datos.some(
    (item) =>
      item.cant_invfis !== "" &&
      item.cant_invfis !== null &&
      !isNaN(parseFloat(item.cant_invfis)) &&
      parseFloat(item.cant_invfis) > 0
  );
  if (!hayCaptura) {
    await MySwal.fire(
      "Sin captura",
      "Debes ingresar al menos un inventario físico antes de confirmar.",
      "warning"
    );
    return;
  }*/


  const confirmacion = await MySwal.fire({
    title: "¿Confirmar inventario?",
    text: "Esta acción es irreversible. ¿Estás seguro?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, confirmar",
    cancelButtonText: "Cancelar",
  });
  if (!confirmacion.isConfirmed) return;


  const estatusFinal = asignacionCargada ? nroConteo : estatus;
  const loteTamaño = 200;
  const lotes = [];
  for (let i = 0; i < datos.length; i += loteTamaño) {
    lotes.push(datos.slice(i, i + loteTamaño));
  }


  Swal.fire({
    title: "Procesando Registros...",
    html: `
      <div id="progresoWrap" style="width:100%; text-align:left; margin-top:10px;">
        <div id="barraProgreso" style="width:100%; background:#eee; border-radius:8px; overflow:hidden; height:26px; position:relative;">
          <div id="progresoInterno" style="width:0%; background:linear-gradient(90deg, #4caf50, #43a047); height:26px; transition:width 0.3s ease;"></div>
          <div id="spinner" style="position:absolute; right:10px; top:50%; transform:translateY(-50%);">
            <svg width="16" height="16" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="35" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round">
                <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 50 50" to="360 50 50" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>
        </div>
        <p id="porcentajeTexto" style="margin-top:6px; font-weight:bold; font-size:14px; color:#222;">0%</p>
        <p id="mensajeLote" style="margin-top:4px; font-size:13px; color:#555;">Iniciando...</p>
      </div>
    `,
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => {
      const progreso = document.getElementById("progresoInterno");
      const porcentajeTexto = document.getElementById("porcentajeTexto");
      const mensaje = document.getElementById("mensajeLote");
      progreso.style.width = "0%";
      porcentajeTexto.textContent = "0%";
      mensaje.textContent = "Preparando confirmación...";
    },
  });

  try {

    const { cia, almacen: almEf, fecha: fecEf, empleado: empEf } = getParametrosEfectivos();

    for (let i = 0; i < lotes.length; i++) {
      const payload = new FormData();
      payload.append("almacen", almEf);
      payload.append("fecha", fecEf);
      payload.append("empleado", empEf);
      payload.append("cia", cia);
      payload.append("estatus", asignacionCargada ? parseInt(nroConteo) : parseInt(estatusFinal));

      payload.append("datos", JSON.stringify(lotes[i]));

      const endpoint = esBrigada
        ? "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/confirmar_inventario.php"
        : "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/confirmar_inventario_individual.php";

      const res = await axios.post(endpoint, payload);

      if (!res.data.success) throw new Error(res.data.error);

      const progreso = document.getElementById("progresoInterno");
      const porcentajeTexto = document.getElementById("porcentajeTexto");
      const mensaje = document.getElementById("mensajeLote");

      const porcentaje = Math.round(((i + 1) / lotes.length) * 100);
      if (progreso) progreso.style.width = `${porcentaje}%`;
      if (porcentajeTexto) porcentajeTexto.textContent = `${porcentaje}%`;
      if (mensaje)
        mensaje.textContent = `Lote ${i + 1} de ${lotes.length} confirmado (${lotes[i].length} registros)...`;

      await new Promise((r) => setTimeout(r, 150));
    }

    Swal.close();
    setBloqueado(true);

    await MySwal.fire({
      title: "Confirmado ✅",
      text: `Todos los ${datos.length} registros fueron confirmados exitosamente.`,
      icon: "success",
      confirmButtonText: "OK",
      allowOutsideClick: false,
    });

    navigate("/comparar", {
    state: (() => {
      const p = getParametrosEfectivos();
      return {
        almacen: p.almacen,
        fecha: p.fecha,
        empleado: p.empleado,
        cia: p.cia,
        estatus: asignacionCargada ? parseInt(nroConteo) : parseInt(estatusFinal),


      };
    })(),
  });

  } catch (error) {
    Swal.close();
    await MySwal.fire("Error", error.message, "error");
  }
  };


  const exportarExcel = async () => {
    const datosFiltrados = datos.filter((item) =>
      item.ItemCode.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.Itemname.toLowerCase().includes(busqueda.toLowerCase())
    );

    const headers = [
      "#", "CIA", "ALMACÉN", "FAMILIA", "SUBFAMILIA",
      "CÓDIGO", "NOMBRE", "CÓDIGO BARRAS", "INVENTARIO FÍSICO"
    ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Captura");

    worksheet.addRow(headers);

    headers.forEach((_, idx) => {
      const cell = worksheet.getRow(1).getCell(idx + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "CC0000" },
      };
      cell.font = {
        color: { argb: "FFFFFF" },
        bold: true,
      };
    });

    datosFiltrados.forEach((item, i) => {
      worksheet.addRow([
        i + 1,
        item.cias,
        item.almacen,
        item.nom_fam,
        item.nom_subfam,
        item.ItemCode,
        item.Itemname,
        item.codebars,
        item.cant_invfis ?? 0,
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

    const p = getParametrosEfectivos();
    saveAs(blob, `captura_${p.almacen}_${p.fecha}.xlsx`);

  };


  const familiasDisponibles = [...new Set(datos.map(item => item.nom_fam))];
  const subfamiliasDisponibles = [...new Set(
    datos
      .filter(item => item.nom_fam === familiaSeleccionada)
      .map(item => item.nom_subfam)
  )];

  const opcionesAlmacenes = catalogoAlmacenes.map((alm) => ({
    value: alm.codigo,
    label: `${alm.codigo} - ${alm.nombre}`,
  }));

  const valorPrevioRef = useRef({});
  const inputRefs = useRef([]);

  let tiempoUltimo = 0;
  let bufferCodigo = "";

  const pushHistorial = (producto, cantidadFinal) => {
    const codigo = producto?.ItemCode || "";
    const nombre = producto?.Itemname || "";
    const qty = Number(cantidadFinal ?? 0);

    setHistorial((prev) => {

      const idx = prev.findIndex((h) => h.codigo === codigo);
      if (idx !== -1) {
        const copia = [...prev];
        const nuevoQty = Number(copia[idx].cantidad ?? 0) + qty;
        copia[idx] = { ...copia[idx], cantidad: nuevoQty };
        return copia;
      }


      const nuevo = [{ codigo, nombre, cantidad: qty }, ...prev];
      return nuevo.slice(0, 20);
    });
  };

  const indiceBusqueda = useMemo(() => {
    const map = new Map();

    datos.forEach((item) => {
      const codebars = normalizarValorEscaneado(item.codebars);
      const itemCode = normalizarValorEscaneado(item.ItemCode);

      if (codebars) map.set(codebars, item);
      if (itemCode) map.set(itemCode, item);
    });

    return map;
  }, [datos]);

  const quitarCerosIzquierda = (valor) => {
  const limpio = normalizarValorEscaneado(valor);
  return limpio.replace(/^0+/, "") || "0";
};

const esCodigoValidoEnTabla = (codigoLeido) => {
  if (!codigoLeido) return false;

  const producto = buscarProductoEscaneado(codigoLeido);
  return !!producto;
};

  const validarCodigoEscaneado = (codigoLeido, origen = "barra") => {
    const limpio = normalizarValorEscaneado(codigoLeido);

    if (!limpio) {
      return { ok: false, motivo: "Código vacío" };
    }

    if (!/^[0-9a-z]+$/i.test(limpio)) {
      return { ok: false, motivo: "Caracteres inválidos" };
    }

    if (limpio.length < 4 || limpio.length > 25) {
      return { ok: false, motivo: "Longitud inválida" };
    }

    const producto = buscarProductoEscaneado(limpio);

    if (!producto) {
      return { ok: false, motivo: "No existe en la tabla actual" };
    }

    return {
      ok: true,
      codigo: limpio,
      producto,
      origen,
    };
  };

  const buscarProductoEscaneado = (valor) => {
    const scan = normalizarValorEscaneado(valor);
    const scanSinCeros = quitarCerosIzquierda(valor);

    for (const item of datos) {
      const codebars = normalizarValorEscaneado(item.codebars);
      const itemCode = normalizarValorEscaneado(item.ItemCode);

      if (scan === codebars || scan === itemCode) {
        return item;
      }
    }

    for (const item of datos) {
      const codebarsSinCeros = quitarCerosIzquierda(item.codebars);
      const itemCodeSinCeros = quitarCerosIzquierda(item.ItemCode);

      if (
        scanSinCeros === codebarsSinCeros ||
        scanSinCeros === itemCodeSinCeros
      ) {
        return item;
      }
    }

    return null;
  };

  const handleCodigoDetectado = async (codigo) => {
    if (modalActivo) return;
    setModalActivo(true);

    try {
      const codigoNormalizado = normalizarValorEscaneado(codigo);
      const producto = buscarProductoEscaneado(codigoNormalizado);

      const index = producto
        ? datos.findIndex(
            (item) =>
              item.ItemCode === producto.ItemCode &&
              item.almacen === producto.almacen
          )
        : -1;

      if (index !== -1) {
        setBusqueda(producto.ItemCode);

        const { value: cantidad } = await MySwal.fire({
          title: `<div class="text-xl font-bold text-gray-800 text-center">
                    Producto encontrado: ${producto.Itemname}
                  </div>`,
          html: `
            <div class="text-left text-sm text-gray-700 leading-relaxed mb-2">
              <p>🧾 <strong>Código:</strong> ${producto.ItemCode}</p>
              <p>🏬 <strong>Almacén:</strong> ${producto.almacen}</p>
              <p>📁 <strong>Familia:</strong> ${producto.nom_fam}</p>
              <p class="mt-2 text-blue-700 font-semibold">
                📦 Cantidad actual: ${parseFloat(producto.cant_invfis) || 0}
              </p>
              <p class="text-xs text-gray-500 mt-1">
                Usa <strong>+ / -</strong> para sumar o restar (ej: +10, -5)
              </p>
            </div>

            <input
              type="text"
              id="cantidad"
              class="swal2-input text-center text-lg font-bold"
              placeholder="Ej: 10+20+30 o +5"
              inputmode="text"
            />
          `,
          focusConfirm: false,
          confirmButtonText: "Guardar",
          showCancelButton: true,
          cancelButtonText: "Cancelar",
          allowOutsideClick: false,
          didOpen: () => {
            const input = document.getElementById("cantidad");
            if (input) {
              input.focus();
              input.addEventListener("keydown", (e) => {
                const ahora = Date.now();
                const delta = ahora - tiempoUltimo;
                tiempoUltimo = ahora;

                if (delta < 35 && /^[0-9]$/.test(e.key)) {
                  bufferCodigo += e.key;
                  clearTimeout(window.timerScanner);
                  window.timerScanner = setTimeout(() => {
                    if (bufferCodigo.length >= 6) {
                      document.querySelector(".swal2-confirm")?.click();
                    }
                    bufferCodigo = "";
                  }, 80);
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  document.querySelector(".swal2-confirm")?.click();
                }
              });
            }
          },
          preConfirm: () => {
            let raw = document.getElementById("cantidad").value || "";
            raw = raw.trim().replace(/\s+/g, "");

            if (!raw) {
              Swal.showValidationMessage("Ingresa una cantidad");
              return false;
            }

            const base = parseFloat(producto.cant_invfis) || 0;
            const { ok, total, error } = calcularTotalDesdeInput(raw, base);

            if (!ok) {
              Swal.showValidationMessage(error);
              return false;
            }

            return total;
          },
        });

        if (cantidad !== undefined) {
          const nuevo = [...datos];
          nuevo[index].cant_invfis = cantidad;
          setDatos(nuevo);

          await autoGuardar(producto, cantidad);
          pushHistorial(producto, cantidad);

          setBusqueda("");

          const inputPrincipal = document.getElementById("inputCaptura");
          if (inputPrincipal) inputPrincipal.focus();

          const elemento = document.getElementById(`fila-${producto.ItemCode}-${producto.almacen}`);
          if (elemento) {
            elemento.scrollIntoView({ behavior: "smooth", block: "center" });
            elemento.classList.add("ring-2", "ring-green-400");
            setTimeout(() => {
              elemento.classList.remove("ring-2", "ring-green-400");
            }, 1500);
          }
        }
      } else {
        const inputPrincipal = document.getElementById("inputCaptura");
        setLectorActivo(false);
        inputPrincipal?.blur();

        await new Promise((r) => setTimeout(r, 150));

        await MySwal.fire({
          title: "No encontrado",
          text: `El código ${codigoNormalizado} no está en la tabla actual`,
          icon: "warning",
          confirmButtonText: "OK",
          allowOutsideClick: false,
          allowEnterKey: false,
          heightAuto: false,
        });

        setLectorActivo(true);
        inputPrincipal?.focus();
      }
    } finally {
      setModalActivo(false);
    }
  };


  const datosFiltrados = useMemo(() => {
    const q = normalizarValorEscaneado(busqueda);

    return datos.filter((item) => {
      const itemCode = normalizarValorEscaneado(item.ItemCode);
      const itemName = String(item.Itemname || "").toLowerCase().trim();
      const codebars = normalizarValorEscaneado(item.codebars);

      const matchBusqueda =
        q === "" ||
        itemCode.includes(q) ||
        itemName.includes(busqueda.toLowerCase().trim()) ||
        codebars.includes(q);

      const matchFamilia =
        !familiaSeleccionada || item.nom_fam === familiaSeleccionada;

      const matchSubfamilia =
        !subfamiliaSeleccionada || item.nom_subfam === subfamiliaSeleccionada;

      return matchBusqueda && matchFamilia && matchSubfamilia;
    });
  }, [
    datos,
    busqueda,
    familiaSeleccionada,
    subfamiliaSeleccionada,
    estatus,
    esBrigada
  ]);



  const indiceInicial = (paginaActual - 1) * registrosPorPagina;
  const indiceFinal = indiceInicial + registrosPorPagina;
  const datosPaginados = datosFiltrados.slice(indiceInicial, indiceFinal);

  const [modalActivo, setModalActivo] = useState(false);


  useEffect(() => {
      setPaginaActual(1);
  }, [busqueda, familiaSeleccionada, subfamiliaSeleccionada]);

 useEffect(() => {
  const mantenerFoco = setInterval(() => {
    const haySwal = document.querySelector(".swal2-container");
    if (haySwal && haySwal.style.display !== "none") return;

    const activo = document.activeElement;
    const esCampoEditable =
      activo &&
      (activo.tagName === "INPUT" || activo.tagName === "SELECT" || activo.tagName === "TEXTAREA");

    if (esCampoEditable || editandoCelda) return;


    const input = document.getElementById("inputCaptura");
    if (input && document.activeElement !== input) input.focus();
  }, 1000);

  return () => clearInterval(mantenerFoco);
}, []);


  return (

    <div className="w-full max-w-none mx-auto px-3 md:px-6">

      <h1 className="text-3xl md:text-4xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-red-700 via-indigo-600 to-green-600 tracking-tight drop-shadow-sm text-center">
        📦 Captura de Inventario Físico
      </h1>
      {datos.length > 0 && !soportaCamara && lectorActivo && (
        <LectorCodigo
          onCodigoDetectado={(codigo) => {
            console.log(">>> entro a LectorCodigo con", codigo);
            handleCodigoDetectado(codigo);
          }}
        />
      )}

      {datos.length > 0 && soportaCamara && esDispositivoMovilOTablet && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              setModoLectura("barra");
              setMostrarEscanerCamara(true);
              setLectorActivo(false);
            }}
            className={`px-3 py-2 rounded text-white text-sm font-semibold ${
              modoLectura === "barra" ? "bg-blue-700" : "bg-blue-500"
            }`}
          >
            Escanear Barras
          </button>

          <button
            onClick={() => {
              setModoLectura("ocr");
              setMostrarEscanerCamara(true);
              setLectorActivo(false);
            }}
            className={`px-3 py-2 rounded text-white text-sm font-semibold ${
              modoLectura === "ocr" ? "bg-purple-700" : "bg-purple-500"
            }`}
          >
            Escanear Número
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 mb-6">

        {asignacionCargada ? (

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">📌 Selección de captura</h2>
            <p className="text-sm text-gray-700">
              <strong>Tipo de captura:</strong> {tipoConteo}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Conteo asignado:</strong> {Number(nroConteo) === 7 ? "Cuarto conteo" : nroConteo}
            </p>

            <p className="text-sm text-gray-700">
              <strong>CIA:</strong> {ciaAsignada}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Almacén:</strong> {almacenAsignado}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Fecha:</strong> {fechaAsignada}
            </p>

            <div className="mt-4">
              <button
                onClick={iniciarCaptura}
                disabled={capturaActiva}
                className={`w-full px-4 py-2 text-white font-semibold rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition
                  ${capturaActiva ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {capturaActiva ? "Captura activa" : "Iniciar captura"}
              </button>


            </div>
          </div>
        ) : (

          <>

          </>
        )}
      </div>


      {modo && (
        <div className="mt-8">
          <p className={`flex items-center gap-2 mb-4 text-lg font-medium ${bloqueado ? "text-red-600" : "text-green-600"}`}>
            {mensajeModo}

          </p>

          {esDispositivoMovilOTablet && (
            <div className="flex justify-center mb-6">
              <button
                onClick={() => setMostrarModoRapido((prev) => !prev)}
                className={`px-5 py-3 rounded-full font-semibold text-sm shadow-md transition
                  ${mostrarModoRapido
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                ⚡ {mostrarModoRapido ? "Ocultar modo rápido" : "Modo rápido"}
              </button>
            </div>
          )}

          {(!esDispositivoMovilOTablet || mostrarModoRapido) && (
            <div className="relative bg-gradient-to-br from-white via-gray-50 to-white border border-gray-200 rounded-3xl shadow-2xl p-10 mb-10">
              {/* Encabezado */}
              <h2 className="text-center text-3xl font-extrabold text-gray-800 mb-10 tracking-tight flex items-center justify-center gap-3">
                <span className="text-4xl">📦</span>
                <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                  Captura rápida de artículos
                </span>
              </h2>

              <div className="flex items-center justify-center mb-8">
                <input
                  id="inputCaptura"
                  type="text"
                  placeholder="🔍 Escanea con el lector o escribe un código y presiona Enter..."
                  className="w-full text-center text-2xl font-bold px-6 py-6
                            rounded-3xl border-4 border-green-500 shadow-xl bg-gradient-to-r from-white to-gray-50
                            focus:outline-none focus:ring-4 focus:ring-green-400 focus:border-green-500
                            placeholder-gray-400 transition duration-300 ease-in-out"
                  autoFocus
                  onKeyDown={(e) => {
                    const ahora = Date.now();
                    const delta = ahora - tiempoUltimo;
                    tiempoUltimo = ahora;


                    if (e.key === "Enter") {
                      const codigo = e.currentTarget?.value?.trim() || "";
                      if (codigo !== "") handleCodigoDetectado(codigo);


                      const inputEl = e.currentTarget;
                      if (inputEl && document.body.contains(inputEl)) inputEl.value = "";

                      bufferCodigo = "";
                      return;
                    }


                    if (delta < 40 && e.key.length === 1) {
                      bufferCodigo += e.key;
                      clearTimeout(window.timerScanner);
                      window.timerScanner = setTimeout(() => {
                        if (bufferCodigo.length >= 6) {
                          handleCodigoDetectado(bufferCodigo);


                          const campo = document.getElementById("inputCaptura");
                          if (campo) campo.value = "";
                        }
                        bufferCodigo = "";
                      }, 60);
                    } else {

                      bufferCodigo = e.key.length === 1 ? e.key : "";
                    }
                  }}

                />


              </div>


              <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl shadow-inner p-6">
                <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
                  🕑 Últimos escaneos
                </h3>
                {historial.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center">Aún no hay registros</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {historial.map((h, i) => (
                      <li
                        key={i}
                        className="flex justify-between items-center bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition"
                      >
                        <span className="font-mono text-gray-700 text-sm bg-gray-100 px-2 py-1 rounded-lg">
                          {h.codigo}
                        </span>
                        <span className="flex-1 text-gray-700 ml-4 font-medium truncate">{h.nombre}</span>
                        <span className="font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full text-xs ml-3">
                          x{h.cantidad}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}


                {historial.length > 0 && (
                  <button
                    onClick={() => {
                      const ultimo = historial[0];
                      const nuevo = [...datos];
                      const idx = nuevo.findIndex((x) => x.ItemCode === ultimo.codigo);
                      if (idx !== -1) {
                        nuevo[idx].cant_invfis = "";
                        setDatos(nuevo);
                      }
                      setHistorial((prev) => prev.slice(1));
                    }}
                    className="mt-5 w-full px-4 py-3 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 shadow-md"
                  >
                    ↩️ Deshacer último
                  </button>
                )}
              </div>


              <p className="text-center mt-8 text-sm text-gray-600 italic">
                Usa el lector o escribe manualmente y confirma con <span className="font-semibold">Enter</span>
              </p>
            </div>
          )}

          <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">🎯 Filtros de captura</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Familia</label>
                <select
                  value={familiaSeleccionada}
                  onFocus={() => setLectorActivo(false)}
                  onBlur={() => setTimeout(() => setLectorActivo(true), 300)}
                  onChange={(e) => {
                    setFamiliaSeleccionada(e.target.value);
                    setSubfamiliaSeleccionada("");
                    setBusqueda("");
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <option value="">Todas las familias</option>
                  {familiasDisponibles.map((fam, i) => (
                    <option key={i} value={fam}>{fam}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Subfamilia</label>
                <select
                  value={subfamiliaSeleccionada}
                  onFocus={() => setLectorActivo(false)}
                  onBlur={() => setTimeout(() => setLectorActivo(true), 300)}
                  onChange={(e) => {
                    setSubfamiliaSeleccionada(e.target.value);
                    setBusqueda("");
                  }}
                  disabled={!familiaSeleccionada}
                  className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">Todas las subfamilias</option>
                  {subfamiliasDisponibles.map((sub, i) => (
                    <option key={i} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Buscar por código o nombre</label>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={busqueda}
                  onFocus={() => setLectorActivo(false)}
                  onBlur={() => {
                    setTimeout(() => {
                      const ae = document.activeElement;
                      const tag = ae?.tagName?.toUpperCase() || "";
                      if (tag !== "INPUT" && tag !== "SELECT") setLectorActivo(true);

                    }, 500);
                  }}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />

              </div>

              {mostrarComparar && (
                <button
                  onClick={() =>
                    navigate("/comparar", {
                      state: (() => {
                        const p = getParametrosEfectivos();
                        return {
                          almacen: p.almacen,
                          fecha: p.fecha,
                          empleado: p.empleado,
                          cia: p.cia,
                          estatus: p.estatus,
                        };
                      })(),
                    })
                  }
                  className="px-4 py-2 bg-red-200 hover:bg-red-300 text-red-900 font-semibold rounded-lg shadow-md text-sm transition-all duration-200 whitespace-nowrap"
                >
                  📊 Ver inventario (Conteos)
                </button>
              )}

            </div>
          </div>

         {loadingInventario ? (
            <div className="flex items-center justify-center h-40 border rounded-lg bg-white shadow-inner text-red-600 text-base font-medium animate-pulse gap-2">
              <svg className="animate-spin h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Cargando inventario, por favor espera...
            </div>
          ) : (


            <div className="w-full overflow-x-auto overflow-y-auto max-h-[70vh] border rounded-lg shadow-md bg-white"style={{ WebkitOverflowScrolling: "touch" }}>
              <table className="w-full min-w-[1100px] text-xs md:text-sm table-auto">
                <thead className="sticky top-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white text-[10px] md:text-xs uppercase tracking-wider shadow-lg z-10">
                  <tr>
                    <th className="p-3 text-left w-10">#</th>
                    <th className="p-3 text-left">CIA</th>
                    <th className="p-3 text-left">Almacen</th>
                    <th className="p-3 text-left">Familia</th>
                    <th className="p-3 text-left">Subfamilia</th>
                    <th className="p-3 text-left">Código</th>
                    <th className="p-3 text-left w-64 max-w-[16rem]">NOMBRE</th>
                    <th className="p-3 text-left">Código de Barras</th>

                    {aplicarVistaDiferenciasBrigada && (
                      <>
                        <th className="p-3 text-left bg-blue-100 text-blue-800 hidden">
                          Conteo 1
                        </th>
                        <th className="p-3 text-left bg-amber-100 text-amber-800 hidden">
                          Conteo 2
                        </th>

                        {Number(estatus) === 7 && (
                          <th className="p-3 text-left bg-yellow-200 text-yellow-900 hidden">
                            Conteo 3
                          </th>
                        )}
                      </>
                    )}

                    <th className="p-3 text-left">Inventario Físico</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100">
                  {datosPaginados.map((item, i) => {

                    const uid = `${item.ItemCode}-${item.almacen}`;

                    const k = `${item.ItemCode}-${item.almacen}`;
                    const valor = item.cant_invfis ?? ""; //
                    const editado = parseFloat(valor) > 0;
                    const invalido = valor === "" || isNaN(Number(valor)) || parseFloat(valor) <= 0;

                    return (
                      <tr
                        key={uid}
                        id={`fila-${uid}`}
                        className="hover:bg-red-50 transition duration-150 ease-in-out"
                      >
                        <td className="p-3 text-sm text-gray-500 font-semibold whitespace-nowrap">
                          {indiceInicial + i + 1}
                        </td>

                        <td className="px-2 py-2 md:px-3 md:py-3 text-xs md:text-sm text-gray-700 whitespace-nowrap">{item.cias}</td>
                        <td className="px-2 py-2 md:px-3 md:py-3 text-xs md:text-sm text-gray-700 whitespace-nowrap">{item.almacen}</td>
                        <td className="px-2 py-2 md:px-3 md:py-3 text-xs md:text-sm text-gray-700 whitespace-nowrap">{item.nom_fam}</td>
                        <td className="px-2 py-2 md:px-3 md:py-3 text-xs md:text-sm text-gray-700 whitespace-nowrap">{item.nom_subfam}</td>
                        <td className="px-2 py-2 md:px-3 md:py-3 text-xs md:text-sm text-gray-700 whitespace-nowrap">{item.ItemCode}</td>

                        <td className="px-2 py-2 md:px-3 md:py-3 text-xs md:text-sm text-gray-700 min-w-[180px] max-w-[220px] md:max-w-[280px] whitespace-normal break-words leading-snug">
                          {item.Itemname}
                        </td>


                        <td className="px-2 py-2 md:px-3 md:py-3 text-xs md:text-sm text-gray-700 whitespace-nowrap">{item.codebars}</td>

                        {aplicarVistaDiferenciasBrigada && (
                          <>
                            <td className="p-3 text-sm font-semibold text-blue-800 bg-blue-50 text-center hidden">
                              {Number(item.conteo_1 ?? 0).toFixed(2)}
                            </td>

                            <td className="p-3 text-sm font-semibold text-amber-800 bg-amber-50 text-center hidden">
                              {Number(item.conteo_2 ?? 0).toFixed(2)}
                            </td>

                            {Number(estatus) === 7 && (
                              <td className="p-3 text-sm font-semibold text-yellow-900 bg-yellow-50 text-center hidden">
                                {Number(item.conteo_3 ?? item.conteo3 ?? 0).toFixed(2)}
                              </td>
                            )}
                          </>
                        )}



                        <td className="p-3">
                          {bloqueado || estatus === 4 ? (
                            <span className="text-gray-600 text-sm font-medium">{valor}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={valor}
                                className="w-20 md:w-24 px-2 py-1 border rounded text-xs md:text-sm text-right"
                                onFocus={(e) => {
                                  setEditandoCelda(true);
                                  setLectorActivo(false);

                                  const historial = historialConteo[uid];
                                  const actual = parseFloat(item.cant_invfis) || 0;
                                  valorPrevioRef.current[uid] = actual;

                                  if (historial) {
                                    e.target.value = historial;
                                    cambiarCantidad(uid, historial);

                                  } else if (actual === 0) {
                                    e.target.value = "";
                                    cambiarCantidad(uid, "");
                                  }
                                }}

                                onChange={(e) => cambiarCantidad(uid, e.target.value)}

                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  }
                                }}
                                onBlur={async (e) => {
                                  setEditandoCelda(false);
                                  setTimeout(() => setLectorActivo(true), 200);
                                  if (bloqueado) return;

                                  const raw = e.target.value.trim();
                                  const base = valorPrevioRef.current[uid] ?? 0;


                                  const { ok, total, error } = calcularTotalDesdeInput(raw, base);

                                  const nuevo = [...datos];
                                  const idx = nuevo.findIndex(
                                    (x) => `${x.ItemCode}-${x.almacen}` === uid
                                  );

                                  if (idx === -1) return;

                                  if (!ok) {
                                    await MySwal.fire("Cantidad inválida", error, "warning");
                                    nuevo[idx].cant_invfis = base;
                                    setDatos(nuevo);
                                    return;
                                  }


                                  if (raw !== "" && /[+\-]/.test(raw)) {
                                    setHistorialConteo((prev) => ({
                                      ...prev,
                                      [uid]: raw.replace(/\s+/g, "")

                                    }));
                                  }

                                  const totalFinal = total === "" ? "" : total;
                                  nuevo[idx].cant_invfis = totalFinal;
                                  setDatos(nuevo);

                                  await autoGuardar(item, totalFinal === "" ? 0 : totalFinal);
                                }}
                              />


                              {historialConteo[uid] && (
                                <span className="text-xs text-gray-400 italic whitespace-nowrap">
                                  {historialConteo[uid]}
                                </span>
                              )}
                            </div>
                          )}
                        </td>


                      </tr>
                    );
                  })}
                </tbody>
              </table>

            </div>
          )}

          <div className="mt-4 flex flex-col md:flex-row justify-center items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-700 font-medium">
            <button
              onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
              disabled={paginaActual === 1}
              className={`px-3 py-1 rounded border ${
                paginaActual === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-white hover:bg-red-100 text-red-700"
              }`}
            >
              ⬅️ Anterior
            </button>

            <span>
              Página {paginaActual} de {Math.ceil(datosFiltrados.length / registrosPorPagina)}
            </span>

            <button
              onClick={() =>
                setPaginaActual((prev) =>
                  prev < Math.ceil(datosFiltrados.length / registrosPorPagina)
                    ? prev + 1
                    : prev
                )
              }
              disabled={paginaActual >= Math.ceil(datosFiltrados.length / registrosPorPagina)}
              className={`px-3 py-1 rounded border ${
                paginaActual >= Math.ceil(datosFiltrados.length / registrosPorPagina)
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-white hover:bg-red-100 text-red-700"
              }`}
            >
              Siguiente ➡️
            </button>
          </div>



         {!loadingInventario && !bloqueado && estatus !== 4 && (

            <div className="mt-4 flex justify-between items-center">

              <button
                onClick={exportarExcel}
                className="w-40 h-10 px-3 rounded-full text-sm font-semibold bg-green-300 text-green-900 hover:bg-green-400 flex items-center justify-center gap-2 transition"
              >
                <img src="https://img.icons8.com/color/20/microsoft-excel-2019.png" alt="excel" />
                Exportar Excel
              </button>


              <button
                onClick={confirmarInventario}
                className="w-44 h-11 px-4 rounded-xl text-sm font-semibold
                          bg-gradient-to-r from-green-600 to-emerald-600
                          text-white shadow-md
                          hover:from-green-700 hover:to-emerald-700
                          active:scale-[0.98]
                          focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2
                          transition-all duration-200
                          flex items-center justify-center gap-2"
              >
                <span className="text-base">✔</span>
                <span>Confirmar inventario</span>
              </button>

            </div>


          )}


        </div>
      )}

      {mostrarEscanerCamara && (
        <EscanerCamaraQuagga
          modo={modoLectura}
          onScanSuccess={async (codigo) => {
            const validacion = validarCodigoEscaneado(codigo, modoLectura);

            if (!validacion.ok) {
              await MySwal.fire({
                icon: "warning",
                title: "Lectura descartada",
                text: `Se detectó "${codigo}" pero no se aceptó: ${validacion.motivo}`,
                timer: 1200,
                showConfirmButton: false,
              });
              return;
            }

            setMostrarEscanerCamara(false);
            setLectorActivo(false);

            await handleCodigoDetectado(validacion.codigo);

            setTimeout(() => {
              setLectorActivo(true);
              const inputPrincipal = document.getElementById("inputCaptura");
              inputPrincipal?.focus();
            }, 300);
          }}
          onClose={() => {
            setMostrarEscanerCamara(false);
            setTimeout(() => {
              setLectorActivo(true);
              const inputPrincipal = document.getElementById("inputCaptura");
              inputPrincipal?.focus();
            }, 300);
          }}
        />
      )}

    </div>

);
}
