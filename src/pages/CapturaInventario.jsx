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

  //
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
          setFechaAsignada(a.fecha);
          setEsBrigada(a.tipo_conteo === "Brigada");
          setBloquearSeleccion(true);
          setEstatus(a.nro_conteo || 1);
        } else {
          setAsignacionCargada(false);
          setBloquearSeleccion(false);
          MySwal.fire({
            icon: "info",
            title: "Sin asignación activa",
            text: "No tienes conteos asignados. Contacta al administrador.",
            confirmButtonText: "Aceptar"
          });
        }
      } catch (err) {
        console.error("Error al verificar asignación:", err);
      }
    };

    fetchAsignacion();
  }, []);



  useEffect(() => {
    const cargarCiasPermitidas = async () => {
      try {
        const res = await axios.get("https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/catalogo_cias_usuario.php", {
          params: { empleado: sessionStorage.getItem("empleado") },
        });

        if (res.data.success && Array.isArray(res.data.data)) {
          setCiasPermitidas(res.data.data);
        } else {
          setCiasPermitidas([]);
        }
      } catch (error) {
        console.error("Error al cargar CIAs permitidas:", error.message);
        setCiasPermitidas([]);
      }
    };

    cargarCiasPermitidas();
  }, []);

  // === Detección de conexión y errores de red ===
  useEffect(() => {
    // Interceptor global de errores Axios
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

    // Monitoreo constante de conexión
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

    // Verifica cada 3 segundos el estado
    const intervalo = setInterval(verificarConexion, 3000);

    // También escucha eventos nativos
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



  const esMovil = navigator.userAgentData?.mobile ??
                /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const getParametrosEfectivos = () => {
    const emp = sessionStorage.getItem("empleado") || empleado;
    return {
      cia: asignacionCargada ? ciaAsignada : ciaSeleccionada,
      almacen: asignacionCargada ? almacenAsignado : almacen,
      fecha: asignacionCargada ? fechaAsignada : fecha,
      empleado: emp,
      estatus: estatus || 0,
    };
  };

  const getFirmaParametros = (p = null) => {
    const { cia, almacen, fecha, empleado, estatus } = p || getParametrosEfectivos();
    return JSON.stringify({ cia, almacen, fecha, empleado, estatus });
  };



  const soportaCamara = !!(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;

  //
  const toISODate = (v) => {
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // ya es yyyy-mm-dd
    const d = new Date(v);
    if (isNaN(d)) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };


  const iniciarCaptura = async () => {
  const cia = asignacionCargada ? ciaAsignada : ciaSeleccionada;
  const alm = asignacionCargada ? almacenAsignado : almacen;
  const fec = asignacionCargada ? fechaAsignada : fecha;
  const nroAsignado = asignacionCargada ? nroConteo : estatus;
  const emp =
    sessionStorage.getItem("empleado") ||
    localStorage.getItem("empleado") ||
    empleado;

  if (!alm || !fec || !emp || !cia) {
    MySwal.fire("Faltan datos", "Completa todos los campos", "warning");
    return;
  }

  const fecISO = toISODate(fec);

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
    // =======================
    //  Modal de carga
    // =======================
    MySwal.fire({
      title: "Procesando...",
      text: "Contactando con servidor, por favor espera",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    // =======================
    // 1️Obtener estatus real (SOLO para modo manual)
    // =======================
    const estatusRes = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/verifica_estatus.php",
      { params: { almacen: alm, fecha: fecISO, empleado: emp, cia } }
    );

    if (!estatusRes.data.success)
      throw new Error(estatusRes.data.error);

    // ======================================================
    // Si ya existe el conteo, NO capturar.
    // Redirigir DIRECTO a comparar.
    // ======================================================
    if (estatusRes.data.existe_conteo === true) {
      Swal.close();
      return navigate("/comparar", {
        state: {
          almacen: alm,
          fecha: fecISO,
          empleado: emp,
          cia,
          estatus: estatusRes.data.nro_conteo
        },
      });
    }

    //  ESTE ES EL CAMBIO CLAVE:
    // Si hay asignación, NO usamos lo que diga la BD
    let estatusReal = nroAsignado; // 1 o 2 según asignación

    if (!asignacionCargada) {
      // solo modo manual usa estatus de BD
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

    // =======================
    // 2️ Consultar modo de captura
    // =======================
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
          nro_conteo: estatusReal, // 👈 AHORA SIEMPRE MANDA 1 o 2 correcto
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

    // 🔒 Bloquear SIEMPRE que el backend diga "solo lectura"
    const debeBloquear = (modo === "solo lectura");
    setBloqueado(debeBloquear);

    // mensaje tal cual viene del backend
    setMensajeModo(mensaje);

    // Mostrar botón de comparar solo si es solo lectura
    const esCapturista =
      capturista === null || parseInt(capturista) === parseInt(emp);
    setMostrarComparar(modo === "solo lectura" && esCapturista);


    // =======================
    // 3️Cargar inventario
    // =======================
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
          estatus: estatusReal, // 👈 YA COINCIDE
          cia,
        },
      }
    );

    if (!r2.data.success) throw new Error(r2.data.error);

    setDatos(r2.data.data || []);

    Swal.close();

    // Guardar firma
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




  const cambiarCantidad = (id, valor) => {
    const nuevo = [...datos];
    const idx = nuevo.findIndex(x => x.id === id);
    if (idx !== -1) {
      nuevo[idx].cant_invfis = valor;
      setDatos(nuevo);
    }
  };


 const autoGuardar = async (item, cantidad) => {
  try {
    const form = new FormData();
    form.append("id_inventario", item.id);
    form.append("nro_conteo", asignacionCargada ? parseInt(nroConteo) : parseInt(estatus));


    form.append("cantidad", cantidad === "" ? 0 : parseInt(cantidad, 10));
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
  // 1️ Validar captura
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
  }

  // 2️ Confirmación del usuario
  const confirmacion = await MySwal.fire({
    title: "¿Confirmar inventario?",
    text: "Esta acción es irreversible. ¿Estás seguro?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, confirmar",
    cancelButtonText: "Cancelar",
  });
  if (!confirmacion.isConfirmed) return;

  // 3️ Configuración inicial
  const estatusFinal = asignacionCargada ? nroConteo : estatus;

  //console.log(">>> Enviando estatusFinal:", estatusFinal, "nroConteo:", nroConteo, "estatus:", estatus);

  const loteTamaño = 200; // Lotes pequeños para estabilidad
  const lotes = [];
  for (let i = 0; i < datos.length; i += loteTamaño) {
    lotes.push(datos.slice(i, i + loteTamaño));
  }

  // 4️ Modal persistente de progreso
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
    // 5️ Obtener parámetros efectivos
    const { cia, almacen: almEf, fecha: fecEf, empleado: empEf } = getParametrosEfectivos();

    // 6️ Procesar cada lote secuencialmente
    for (let i = 0; i < lotes.length; i++) {
      const payload = new FormData();
      payload.append("almacen", almEf);
      payload.append("fecha", fecEf);
      payload.append("empleado", empEf);
      payload.append("cia", cia);
      payload.append("estatus", asignacionCargada ? parseInt(nroConteo) : parseInt(estatusFinal));


      payload.append("datos", JSON.stringify(lotes[i]));

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/confirmar_inventario.php",
        payload
      );

      if (!res.data.success) throw new Error(res.data.error);

      // 7️ Actualizar barra de progreso
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

    // 8️ Finalización
    Swal.close();
    setBloqueado(true);

    await MySwal.fire({
      title: "Confirmado ✅",
      text: `Todos los ${datos.length} registros fueron confirmados exitosamente.`,
      icon: "success",
      confirmButtonText: "OK",
      allowOutsideClick: false,
    });

    // 9️ Navegar con parámetros efectivos
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

    // Agrega encabezados
    worksheet.addRow(headers);

    // Estilo de encabezado: rojo con blanco
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

    // Agrega filas
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

    // Aplica autofiltro
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    // Guarda archivo
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

  //
  const inputRefs = useRef([]);

  //


 // === Detección automática de escáner o entrada manual ===
let tiempoUltimo = 0;
let bufferCodigo = "";

const handleCodigoDetectado = async (codigo) => {
  if (modalActivo) return; // evita múltiples ejecuciones mientras hay modal
  setModalActivo(true);

  const codigoNormalizado = (codigo || "")
    .toString()
    .trim()
    .replace(/[\s\r\n]+/g, "")
    .toLowerCase();

  const index = datos.findIndex(
    (item) => item.codebars?.toLowerCase().trim() === codigoNormalizado
  );

  if (index !== -1) {
    const producto = datos[index];
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
        </div>
        <input
          type="number"
          id="cantidad"
          class="swal2-input text-center text-lg font-bold"
          placeholder="Cantidad"
          min="0"
          step="any"
          maxlength="6"
          oninput="if(this.value.length > 6) this.value = this.value.slice(0, 6)"
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
            // Si la entrada es manual, se usa Enter
            const ahora = Date.now();
            const delta = ahora - tiempoUltimo;
            tiempoUltimo = ahora;

            // Escáner: entrada muy rápida → autoguarda
            if (delta < 35 && /^[0-9]$/.test(e.key)) {
              bufferCodigo += e.key;
              clearTimeout(window.timerScanner);
              window.timerScanner = setTimeout(() => {
                if (bufferCodigo.length >= 6) {
                  document.querySelector(".swal2-confirm").click();
                }
                bufferCodigo = "";
              }, 80);
            }

            // Manual: Enter explícito
            if (e.key === "Enter") {
              e.preventDefault();
              document.querySelector(".swal2-confirm").click();
            }
          });
        }
      },
      preConfirm: () => {
        const valor = document.getElementById("cantidad").value;
        if (!valor || isNaN(valor) || parseFloat(valor) < 0) {
          Swal.showValidationMessage("Ingrese una cantidad válida.");
          return false;
        }
        return parseFloat(valor);
      },
    });

    if (cantidad !== undefined) {
      const nuevo = [...datos];
      nuevo[index].cant_invfis = cantidad;
      setDatos(nuevo);

      // Guarda en backend inmediato igual que desde la tabla
      await autoGuardar(producto, cantidad);

      setBusqueda("");
      const inputPrincipal = document.getElementById("inputCaptura");
      if (inputPrincipal) inputPrincipal.focus();

      const elemento = document.getElementById(`fila-${index}`);
      if (elemento) {
        elemento.scrollIntoView({ behavior: "smooth", block: "center" });
        elemento.classList.add("ring-2", "ring-green-400");
        setTimeout(() => elemento.classList.remove("ring-2", "ring-green-400"), 1500);
      }

      setHistorial((prev) => {
        const nuevoHistorial = [
          { codigo: producto.ItemCode, nombre: producto.Itemname, cantidad },
          ...prev,
        ];
        return nuevoHistorial.slice(0, 5);
      });
    }
  } else {
    const inputPrincipal = document.getElementById("inputCaptura");

    // pausa entradas mientras hay modal
    setLectorActivo(false);
    inputPrincipal?.blur();

    // traga el Enter residual del escáner
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

  setModalActivo(false); // desbloquea al terminar
};



  const datosFiltrados = useMemo(() => {
      const q = busqueda.trim().toLowerCase();

      return datos.filter((item) => {
        const matchBusqueda =
          (item.ItemCode && item.ItemCode.toLowerCase().includes(q)) ||
          (item.Itemname && item.Itemname.toLowerCase().includes(q)) ||
          (item.codebars && item.codebars.toLowerCase().includes(q)) ||
          (item.almacen && item.almacen.toLowerCase().includes(q)) ||
          (item.cias && item.cias.toLowerCase().includes(q));

        const matchFamilia = !familiaSeleccionada || item.nom_fam === familiaSeleccionada;
        const matchSubfamilia = !subfamiliaSeleccionada || item.nom_subfam === subfamiliaSeleccionada;

        return matchBusqueda && matchFamilia && matchSubfamilia;
      });
  }, [datos, busqueda, familiaSeleccionada, subfamiliaSeleccionada]);


  const indiceInicial = (paginaActual - 1) * registrosPorPagina;
  const indiceFinal = indiceInicial + registrosPorPagina;
  const datosPaginados = datosFiltrados.slice(indiceInicial, indiceFinal);

  const [modalActivo, setModalActivo] = useState(false);


  useEffect(() => {
      setPaginaActual(1);
  }, [busqueda, familiaSeleccionada, subfamiliaSeleccionada]);

  // Mantener siempre el foco en el input de captura rápida
 useEffect(() => {
  const mantenerFoco = setInterval(() => {
    const haySwal = document.querySelector(".swal2-container");
    if (haySwal && haySwal.style.display !== "none") return;

    // detectar si el usuario está en otro input o select
    const activo = document.activeElement;
    const esCampoEditable =
      activo &&
      (activo.tagName === "INPUT" || activo.tagName === "SELECT" || activo.tagName === "TEXTAREA");

    if (esCampoEditable) return; // 🔒 no robar foco cuando manipulas filtros

    const input = document.getElementById("inputCaptura");
    if (input && document.activeElement !== input) input.focus();
  }, 1000);

  return () => clearInterval(mantenerFoco);
}, []);


  return (

    <div className="max-w-7xl mx-auto p-6">

      <h1 className="text-3xl md:text-4xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-red-700 via-indigo-600 to-green-600 tracking-tight drop-shadow-sm text-center">
        📦 Captura de Inventario Físico
      </h1>

      {/* Lector invisible solo si NO es móvil */}
      {datos.length > 0 && !soportaCamara && lectorActivo && (
        <LectorCodigo
          onCodigoDetectado={(codigo) => {
            console.log(">>> entro a LectorCodigo con", codigo);
            handleCodigoDetectado(codigo);
          }}
        />
      )}


      {/* Botón escaneo en vivo - solo en móviles */}
      {datos.length > 0 && soportaCamara && esMovil && (
        <button
          onClick={() => {
            setLectorActivo(false); // Desactiva escáner invisible
            setMostrarEscanerCamara(true); // Activa Quagga
          }}
          className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded shadow-sm text-sm"
        >
          🎥 Escanear código
        </button>
      )}

      {/* BLOQUE DE SELECCIÓN PRINCIPAL EN ESTILO TARJETA */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">📌 Selección de captura</h2>

        {/* Si hay asignación cargada */}
        {asignacionCargada ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
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

            {/* Botón para iniciar captura */}
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
          /* Bloque normal (modo manual si no hay asignación) */
          <>
            {/* Select de CIA */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">CIA a Capturar</label>
              <select
                value={ciaSeleccionada}
                onChange={(e) => {
                  setCiaSeleccionada(e.target.value);
                  setAlmacen("");
                  setFecha("");
                  setCatalogoAlmacenes([]);
                  setMostrarCatalogo(false);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="">-- Selecciona una CIA --</option>
                {ciasPermitidas.map((cia) => (
                  <option key={cia} value={cia}>{cia.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Grid: almacén, fecha, empleado, botón */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Almacén */}
              <div className="w-full">
                <Select
                  options={catalogoAlmacenes.map((alm) => ({
                    value: alm.codigo,
                    label: `${alm.codigo} - ${alm.nombre}`,
                  }))}
                  placeholder="Escribe o selecciona un almacén (ej: AAA-G)"
                  isDisabled={ciaSeleccionada === ""}
                  onMenuOpen={async () => {
                    if (ciaSeleccionada === "") {
                      setMensajeValidacion("⚠ Debes seleccionar una CIA primero.");
                      return;
                    }
                    if (catalogoAlmacenes.length === 0) {
                      try {
                        const res = await axios.get(
                          "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/catalogo_almacenes_usuario.php",
                          { params: { cia: ciaSeleccionada, empleado: sessionStorage.getItem("empleado") } }
                        );

                        if (res.data.success && res.data.data) {
                          setCatalogoAlmacenes(res.data.data);
                          setMensajeValidacion("");
                        } else {
                          setMensajeValidacion("⚠ No se encontraron almacenes para esa CIA.");
                        }
                      } catch (error) {
                        console.error("Error al obtener almacenes:", error.message);
                        setMensajeValidacion("❌ Error al consultar el catálogo.");
                      }
                    }
                  }}
                  value={
                    almacen
                      ? {
                          value: almacen,
                          label:
                            catalogoAlmacenes.find((a) => a.codigo === almacen)?.codigo +
                            " - " +
                            catalogoAlmacenes.find((a) => a.codigo === almacen)?.nombre,
                        }
                      : null
                  }
                  onChange={async (opcion) => {
                    const valor = opcion?.value || "";
                    setAlmacen(valor);
                    setMensajeValidacion("");

                    try {
                      const res = await axios.get(
                        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/catalogo_almacenes_usuario.php",
                        { params: { cia: ciaSeleccionada, empleado: sessionStorage.getItem("empleado") } }
                      );

                      if (res.data.success && Array.isArray(res.data.data)) {
                        setCatalogoAlmacenes(res.data.data);

                        // Buscar la fecha correspondiente al almacén seleccionado
                        const almacénSeleccionado = res.data.data.find(a => a.codigo === valor);
                        if (almacénSeleccionado && almacénSeleccionado.fecha_gestion) {
                          const partes = almacénSeleccionado.fecha_gestion.split("/");
                          if (partes.length === 3) {
                            const yyyy_mm_dd = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                            setFecha(yyyy_mm_dd); // formato aceptado por input type="date"
                          }
                        } else {
                          setFecha("");
                        }
                      }
                    } catch (error) {
                      console.error("Error al obtener almacenes:", error.message);
                    }
                  }}
                  isClearable
                  noOptionsMessage={() => "No encontrado"}
                  filterOption={(option, inputValue) =>
                    option.label.toLowerCase().includes(inputValue.toLowerCase())
                  }
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: mensajeValidacion ? "#f87171" : base.borderColor,
                      boxShadow: mensajeValidacion ? "0 0 0 1px #f87171" : base.boxShadow,
                      minHeight: "42px",
                    }),
                  }}
                />
                {mensajeValidacion && (
                  <div className="mt-1 text-xs text-red-600 font-mono whitespace-nowrap">
                    {mensajeValidacion}
                  </div>
                )}
              </div>

              {/* Fecha */}
              <input
                type="date"
                value={fecha}
                readOnly
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
              />

              {/* Empleado */}
              <input
                type="number"
                placeholder="Empleado"
                value={empleado}
                readOnly
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
              />

              {/* Botón */}
              <button
                onClick={iniciarCaptura}
                className="w-full px-4 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition"
              >
                Iniciar captura
              </button>
            </div>
          </>
        )}
      </div>


      {modo && (
        <div className="mt-8">
          <p className={`flex items-center gap-2 mb-4 text-lg font-medium ${bloqueado ? "text-red-600" : "text-green-600"}`}>
            {mensajeModo}

          </p>

          {/* Botón Modo Rápido - solo visible en móvil */}
          {esMovil && (
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


          {/* Input de captura universal - solo visible en escritorio */}
          {(!esMovil || mostrarModoRapido) && (
            <div className="relative bg-gradient-to-br from-white via-gray-50 to-white border border-gray-200 rounded-3xl shadow-2xl p-10 mb-10">
              {/* Encabezado */}
              <h2 className="text-center text-3xl font-extrabold text-gray-800 mb-10 tracking-tight flex items-center justify-center gap-3">
                <span className="text-4xl">📦</span>
                <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                  Captura rápida de artículos
                </span>
              </h2>

              {/* Input central con estilo llamativo */}

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

                    // Caso: entrada manual (espera Enter)
                    if (e.key === "Enter") {
                      const codigo = e.currentTarget?.value?.trim() || "";
                      if (codigo !== "") handleCodigoDetectado(codigo);

                      // Verificación de existencia antes de limpiar
                      const inputEl = e.currentTarget;
                      if (inputEl && document.body.contains(inputEl)) inputEl.value = "";

                      bufferCodigo = "";
                      return;
                    }

                    // Caso: lector de código (entrada muy rápida)
                    if (delta < 40 && e.key.length === 1) {
                      bufferCodigo += e.key;
                      clearTimeout(window.timerScanner);
                      window.timerScanner = setTimeout(() => {
                        if (bufferCodigo.length >= 6) {
                          handleCodigoDetectado(bufferCodigo);

                          // Protección antes de limpiar el valor
                          const campo = document.getElementById("inputCaptura");
                          if (campo) campo.value = "";
                        }
                        bufferCodigo = "";
                      }, 60);
                    } else {
                      // reinicia si el intervalo es lento (tecleo manual)
                      bufferCodigo = e.key.length === 1 ? e.key : "";
                    }
                  }}

                />


              </div>

              {/* Historial de últimos escaneos */}
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

                {/* Botón deshacer */}
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

              {/* Nota inferior */}
              <p className="text-center mt-8 text-sm text-gray-600 italic">
                Usa el lector o escribe manualmente y confirma con <span className="font-semibold">Enter</span>
              </p>
            </div>
          )}



          <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">🎯 Filtros de captura</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Familia</label>
                <select
                  value={familiaSeleccionada}
                  onFocus={() => setLectorActivo(false)}
                  onBlur={() => setTimeout(() => setLectorActivo(true), 300)}
                  onChange={(e) => {
                    setFamiliaSeleccionada(e.target.value);
                    setSubfamiliaSeleccionada("");
                    setBusqueda(""); // limpiar búsqueda al cambiar
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
                    setBusqueda(""); // limpiar búsqueda al cambiar
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


            <div className="overflow-auto max-h-[70vh] border rounded-lg shadow-md">
              <table className="min-w-full text-sm table-auto">
                <thead className="sticky top-0 bg-gradient-to-r from-red-100 via-white to-red-100 text-gray-800 text-xs uppercase tracking-wider shadow-md z-10">
                  <tr>
                    <th className="p-3 text-left w-10">#</th>
                    <th className="p-3 text-left">CIA</th>
                    <th className="p-3 text-left">Almacen</th>
                    <th className="p-3 text-left">Familia</th>
                    <th className="p-3 text-left">Subfamilia</th>
                    <th className="p-3 text-left">Código</th>
                    <th className="p-3 text-left w-64 max-w-[16rem]">NOMBRE</th>
                    <th className="p-3 text-left">Código de Barras</th>
                    <th className="p-3 text-left">Inventario Físico</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
        {datosPaginados.map((item, i) => {
          const k = `${item.ItemCode}-${item.almacen}`;
          const valor = item.cant_invfis ?? ""; // siempre string
          const editado = parseFloat(valor) > 0;
          const invalido =
            valor === "" || isNaN(Number(valor)) || parseFloat(valor) <= 0;

          return (
            <tr
              key={k}
              id={`fila-${item.id}`}
              className="hover:bg-red-50 transition duration-150 ease-in-out"
            >
              <td className="p-3 text-sm text-gray-500 font-semibold whitespace-nowrap">
                {indiceInicial + i + 1}
              </td>
              <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                {item.cias}
              </td>
              <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                {item.almacen}
              </td>
              <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                {item.nom_fam}
              </td>
              <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                {item.nom_subfam}
              </td>
              <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                {item.ItemCode}
              </td>
              <td className="p-3 text-sm text-gray-700 whitespace-nowrap truncate max-w-[16rem]">
                {item.Itemname}
              </td>
              <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                {item.codebars}
              </td>
              <td className="p-3">
                {(bloqueado || estatus === 4) ? (
                  <span className="text-gray-600 text-sm font-medium">{valor}</span>
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={valor}
                    onChange={(e) => cambiarCantidad(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur(); // dispara onBlur -> 1 solo guardado
                      }
                    }}
                    onBlur={(e) => {
                      setTimeout(() => setLectorActivo(true), 200);
                      if (!bloqueado) autoGuardar(item, e.target.value);

                    }}
                  />




                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              </table>
            </div>
          )}

          <div className="mt-4 flex justify-center items-center gap-4 text-sm text-gray-700 font-medium">
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
              {/* Botón Exportar Excel */}
              <button
                onClick={exportarExcel}
                className="w-40 h-10 px-3 rounded-full text-sm font-semibold bg-green-300 text-green-900 hover:bg-green-400 flex items-center justify-center gap-2 transition"
              >
                <img src="https://img.icons8.com/color/20/microsoft-excel-2019.png" alt="excel" />
                Exportar Excel
              </button>

              {/* Botón Confirmar Inventario */}
              <button
                onClick={confirmarInventario}
                className="w-40 h-10 px-3 rounded-full text-sm font-semibold bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 transition"
              >
                ✅ Confirmar
              </button>
            </div>


          )}


        </div>
      )}

      {mostrarEscanerCamara && (
        <EscanerCamaraQuagga
          onScanSuccess={(codigo) => handleCodigoDetectado(codigo)}
          onClose={() => {
            setMostrarEscanerCamara(false);
            setTimeout(() => setLectorActivo(true), 300);
          }}
        />
      )}

    </div>

);
}
