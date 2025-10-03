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

  const nombre = sessionStorage.getItem("nombre") || "";
  const empleadoSesion = sessionStorage.getItem("empleado") || "";

  const empleado = sessionStorage.getItem("empleado");
  const location = useLocation();
  const { estatus: estatusDesdeRuta } = location.state || {};
  const [estatus, setEstatus] = useState(0);

  const [ciasPermitidas, setCiasPermitidas] = useState([]);

  const [historial, setHistorial] = useState([]);


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



  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  useEffect(() => {
      setModo(null);
      setDatos([]);
      setBloqueado(false);
  }, [almacen, fecha]);



  const esMovil = navigator.userAgentData?.mobile ??
                /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const soportaCamara = !!(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;



  const iniciarCaptura = async () => {
  if (!almacen || !fecha || !empleado) {
    MySwal.fire("Faltan datos", "Completa todos los campos", "warning");
    return;
  }

  try {
    // ✅ 1. Obtener el estatus real desde la BD
    const estatusRes = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/verifica_estatus.php",
      { params: { almacen, fecha, empleado, cia: ciaSeleccionada } }
    );

    if (!estatusRes.data.success) throw new Error(estatusRes.data.error);

    const estatusReal = estatusRes.data.estatus || 0;
    setEstatus(estatusReal);
    console.log("📌 Estatus detectado desde BD:", estatusReal);

    // ✅ 2. Consultar el modo de captura
    const r1 = await axios.get("https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/control_carga_inventario.php", {
      params: { almacen, fecha, empleado, cia: ciaSeleccionada },
    });

    if (!r1.data.success) throw new Error(r1.data.error);

    const modo = r1.data.modo;
    const mensaje = r1.data.mensaje || "";
    const capturista = r1.data.capturista || null;

    setModo(modo);

    // ✅ 3. Reglas de bloqueo dinámico
    const debeBloquear = modo === "solo lectura" && estatusReal === 1;
    setBloqueado(debeBloquear);

    let mensajeFinal = mensaje;

    if (modo === "solo lectura") {
      if (estatusReal === 2) mensajeFinal = "📝 Modo: Segundo conteo";
      else if (estatusReal === 3) mensajeFinal = "📝 Modo: Tercer conteo";
    }

    setMensajeModo(mensajeFinal);

    const esCapturista = capturista === null || parseInt(capturista) === parseInt(empleado);
    setMostrarComparar(modo === "solo lectura" && esCapturista);

    setLoadingInventario(true);

    // ✅ 4. Cargar datos de inventario usando el estatus real
    const r2 = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/obtener_inventario.php",
      { params: { almacen, fecha, empleado, estatus: estatusReal, cia: ciaSeleccionada } }
    );

    if (!r2.data.success) throw new Error(r2.data.error);
    setDatos(r2.data.data || []);
    setLoadingInventario(false);

  } catch (error) {
    MySwal.fire("Error", error.message, "error");
    setLoadingInventario(false);
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
    form.append("nro_conteo", estatus);
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

  const hayCaptura = datos.some(
      (item) =>
        item.cant_invfis !== "" &&
        item.cant_invfis !== null &&
        !isNaN(parseFloat(item.cant_invfis)) &&
        parseFloat(item.cant_invfis) > 0
    );
    if (!hayCaptura) {
      await MySwal.fire("Sin captura", "Debes ingresar al menos un inventario físico antes de confirmar.", "warning");
      return;
    }

    const confirmacion = await MySwal.fire({
      title: "¿Confirmar inventario?",
      text: "Esta acción es irreversible. ¿Estás seguro?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmacion.isConfirmed) return;

    try {
      // NO AWAIT aquí
      MySwal.fire({
        title: "Procesando...",
        text: "Por favor espera",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const payload = new FormData();
      payload.append("almacen", almacen);
      payload.append("fecha", fecha);
      payload.append("empleado", empleado);
      payload.append("cia", ciaSeleccionada);
      payload.append("estatus", estatus);
      payload.append("datos", JSON.stringify(datos));

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/confirmar_inventario.php",
        payload
      );

      Swal.close(); // cierra el loading

      if (!res.data.success) throw new Error(res.data.error);

      setBloqueado(true);

      // Espera a que cierren el modal de éxito antes de navegar
      await MySwal.fire({
        title: "Confirmado",
        text: res.data.mensaje,
        icon: "success",
        confirmButtonText: "OK",
        allowOutsideClick: false,
      });

      navigate("/comparar", {
      state: { almacen, fecha, empleado, cia: ciaSeleccionada, estatus },
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

    saveAs(blob, `captura_${almacen}_${fecha}.xlsx`);
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

      // 🔑 Guarda en backend inmediato igual que desde la tabla
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
                        setFecha(yyyy_mm_dd); // <-- formato que acepta el input type="date"
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
            className="w-full px-4 py-2 bg-red-800 hover:bg-red-800 text-white font-semibold rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition"
          >
            Iniciar captura
          </button>

        </div>
      </div>

      {modo && (
        <div className="mt-8">
          <p className={`flex items-center gap-2 mb-4 text-lg font-medium ${bloqueado ? "text-red-600" : "text-green-600"}`}>
            {mensajeModo}

          </p>


          {/* Input de captura universal - solo visible en escritorio */}
          {!esMovil && (
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
                  className="w-full md:w-3/4 lg:w-2/3 text-center text-3xl font-extrabold tracking-widest px-10 py-8
                            rounded-3xl border-4 border-green-500 shadow-xl bg-gradient-to-r from-white to-gray-50
                            focus:outline-none focus:ring-4 focus:ring-green-400 focus:border-green-500
                            placeholder-gray-400 transition duration-300 ease-in-out animate-pulse"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim() !== "") {
                      const codigo = e.currentTarget.value.trim();
                      handleCodigoDetectado(codigo);
                      e.currentTarget.value = "";
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
                       state: { almacen, fecha, empleado, cia: ciaSeleccionada, estatus },
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
                autoGuardar(item, e.target.value); // <— ÚNICO lugar donde se llama
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
