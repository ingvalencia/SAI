import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEffect, useState, useRef, useMemo } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import * as XLSX from "xlsx";
import Select from "react-select";
import LectorCodigo from "../components/LectorCodigo";
import EscanerCamaraQuagga from "../components/EscanerCamaraQuagga";


const MySwal = withReactContent(Swal);


export default function CapturaInventario() {
  const [almacen, setAlmacen] = useState("");
  const [fecha, setFecha] = useState("");
  const [empleado, setEmpleado] = useState("");
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


  useEffect(() => {

    const emp = localStorage.getItem("empleado");
    if (emp) {
      setEmpleado(emp);
    }
    setModo(null);
    setDatos([]);
    setBloqueado(false);
  }, [almacen, fecha, empleado]);

  const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);


  const iniciarCaptura = async () => {
    if (!almacen || !fecha || !empleado) {
      MySwal.fire("Faltan datos", "Completa todos los campos", "warning");
      return;
    }

    try {
      const r1 = await axios.get("https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/control_carga_inventario.php", {
        params: { almacen, fecha, empleado, cia: ciaSeleccionada },
      });

      if (!r1.data.success) throw new Error(r1.data.error);


      const modo = r1.data.modo;
      const mensaje = r1.data.mensaje || "";
      const capturista = r1.data.capturista || null;

      setModo(modo);
      setBloqueado(modo === "solo lectura");
      setMensajeModo(mensaje);

      const esCapturista = capturista === null || parseInt(capturista) === parseInt(empleado);
      setMostrarComparar(modo === "solo lectura" && esCapturista);

      setLoadingInventario(true);


      const r2 = await axios.get("https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/obtener_inventario.php", {
        params: { almacen, fecha, empleado },
      });

      if (!r2.data.success) throw new Error(r2.data.error);
      setDatos(r2.data.data);
      setLoadingInventario(false);

    } catch (error) {
      MySwal.fire("Error", error.message, "error");
      setLoadingInventario(false);

    }
  };

  const cambiarCantidad = (index, valor) => {
    const nuevo = [...datos];
    nuevo[index].cant_invfis = valor;
    setDatos(nuevo);
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
      MySwal.fire("Sin captura", "Debes ingresar al menos un inventario físico antes de confirmar.", "warning");
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
      const payload = new FormData();
      payload.append("almacen", almacen);
      payload.append("fecha", fecha);
      payload.append("empleado", empleado);
      payload.append("cia", ciaSeleccionada);
      payload.append("datos", JSON.stringify(datos));


      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/confirmar_inventario.php",
        payload
      );

      if (!res.data.success) throw new Error(res.data.error);

      MySwal.fire("Confirmado", res.data.mensaje, "success");
      setBloqueado(true);

      // Redirigir a vista de comparación
      navigate("/comparar", {
        state: {
          almacen,
          fecha,
          empleado,
          cia: ciaSeleccionada,
        },
      });
    } catch (error) {
      MySwal.fire("Error", error.message, "error");
    }
  };

  const exportarExcel = () => {
    const datosFiltrados = datos.filter((item) =>
      item.ItemCode.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.Itemname.toLowerCase().includes(busqueda.toLowerCase())
    );

    const datosExportar = datosFiltrados.map((item, i) => ({
        "#": i + 1,
        CIA: item.cias,
        ALMACÉN: item.almacen,
        FAMILIA: item.nom_fam,
        SUBFAMILIA: item.nom_subfam,
        CÓDIGO: item.ItemCode,
        NOMBRE: item.Itemname,
        "CÓDIGO BARRAS": item.codebars,
        "INVENTARIO FÍSICO": item.cant_invfis,
      }));


      const worksheet = XLSX.utils.json_to_sheet(datosExportar);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Captura");

      XLSX.writeFile(workbook, `captura_${almacen}_${fecha}.xlsx`);
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
    const index = datos.findIndex((item) => item.codebars?.toLowerCase() === codigo.toLowerCase());

    if (index !== -1) {
      const producto = datos[index];

      // ✅ Aplicar filtro visual para mostrar solo el producto
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

        // ✅ Scroll al producto y resaltar visualmente
        const elemento = document.getElementById(`fila-${index}`);
        if (elemento) {
          elemento.scrollIntoView({ behavior: "smooth", block: "center" });
          elemento.classList.add("ring-2", "ring-green-400");
          setTimeout(() => elemento.classList.remove("ring-2", "ring-green-400"), 1500);
        }
      }
    } else {
      MySwal.fire("No encontrado", `El código ${codigo} no está en la tabla actual`, "warning");
    }
  };

  const datosFiltrados = useMemo(() => {
    return datos.filter((item) => {
      const matchBusqueda =
        item.ItemCode.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.Itemname.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.codebars.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.almacen.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.cias.toLowerCase().includes(busqueda.toLowerCase());

      const matchFamilia = !familiaSeleccionada || item.nom_fam === familiaSeleccionada;
      const matchSubfamilia = !subfamiliaSeleccionada || item.nom_subfam === subfamiliaSeleccionada;

      return matchBusqueda && matchFamilia && matchSubfamilia;
    });
  }, [datos, busqueda, familiaSeleccionada, subfamiliaSeleccionada]);

  const indiceInicial = (paginaActual - 1) * registrosPorPagina;
  const indiceFinal = indiceInicial + registrosPorPagina;
  const datosPaginados = datosFiltrados.slice(indiceInicial, indiceFinal);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, familiaSeleccionada, subfamiliaSeleccionada]);




  return (

    <div className="max-w-7xl mx-auto p-6">


      <h1 className="text-3xl md:text-4xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-green-600 tracking-tight drop-shadow-sm text-center">
        📦 Captura de Inventario Físico
      </h1>



      {/* Lector invisible solo si NO es móvil */}
      {datos.length > 0 && !esMovil && (
        <LectorCodigo
          lectorActivo={lectorActivo}
          onCodigoDetectado={(codigo) => {
            console.log("Código detectado:", codigo);
            handleCodigoDetectado(codigo);
          }}
        />
      )}


      {/* Botón escaneo en vivo solo en móviles */}
      {datos.length > 0 && esMovil && (
        <button
          onClick={() => {
            setLectorActivo(false); // Desactiva escáner invisible
            setMostrarEscanerCamara(true); // Activa Quagga
          }}
          className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded shadow-sm text-sm"
        >
          🎥 Escanear en vivo
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
            className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">-- Selecciona una CIA --</option>
            <option value="recrefam">RECREFAM</option>
            <option value="veser">VESER</option>
            <option value="opardiv">OPARDIV</option>
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
                      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/catalogo_almacenes.php",
                      { params: { cia: ciaSeleccionada } }
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
              onChange={(opcion) => {
                const valor = opcion?.value || "";
                setAlmacen(valor);
                setMensajeValidacion("");

                axios
                  .get(
                    "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/buscar_fecha_nexdate.php",
                    { params: { almacen: valor } }
                  )
                  .then((res) => {
                    if (res.data.success && res.data.fecha) {
                      setFecha(res.data.fecha);
                    } else {
                      setFecha("");
                    }
                  })
                  .catch((error) => {
                    console.error("Error al buscar fecha:", error.message);
                  });
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
            onChange={(e) => setFecha(e.target.value)}
            disabled={ciaSeleccionada === ""}
            className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-500"
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
                      if (
                        document.activeElement.tagName !== "INPUT" &&
                        document.activeElement.tagName !== "SELECT"
                      ) {
                        setLectorActivo(true);
                      }
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
                      state: { almacen, fecha, empleado },
                    })
                  }
                  className="px-4 py-2 bg-blue-200 hover:bg-blue-300 text-blue-900 font-semibold rounded-lg shadow-md text-sm transition-all duration-200 whitespace-nowrap"

                >
                  📊 Comparar inventario
                </button>
              )}
            </div>
          </div>

         {loadingInventario ? (
            <div className="flex items-center justify-center h-40 border rounded-lg bg-white shadow-inner text-blue-600 text-base font-medium animate-pulse gap-2">
              <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Cargando inventario, por favor espera...
            </div>
          ) : (


            <div className="overflow-auto max-h-[70vh] border rounded-lg shadow-md">
              <table className="min-w-full text-sm table-auto">
                <thead className="sticky top-0 bg-gradient-to-r from-blue-100 via-white to-blue-100 text-gray-800 text-xs uppercase tracking-wider shadow-md z-10">
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


                      const valor = item.cant_invfis;
                      const editado = parseFloat(valor) > 0;
                      const invalido =
                        valor === "" || valor === null || isNaN(Number(valor)) || parseFloat(valor) <= 0;

                      return (
                        <tr key={i} id={`fila-${i}`} className="hover:bg-blue-50 transition duration-150 ease-in-out">
                          <td className="p-3 text-sm text-gray-500 font-semibold whitespace-nowrap">{indiceInicial + i + 1}</td>
                          <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.cias}</td>
                          <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.almacen}</td>
                          <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.nom_fam}</td>
                          <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.nom_subfam}</td>
                          <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.ItemCode}</td>
                          <td className="p-3 text-sm text-gray-700 whitespace-nowrap truncate max-w-[16rem]">
                            {item.Itemname}
                          </td>
                          <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.codebars}</td>
                          <td className="p-3">
                            {bloqueado ? (
                              <span className="text-gray-600 text-sm font-medium">{valor}</span>
                            ) : (
                              <input
                                ref={(el) => (inputRefs.current[i] = el)}
                                type="number"
                                className={`border rounded px-3 py-1 w-24 text-center text-sm font-semibold transition-all duration-200 ease-in-out ${
                                  editado ? "bg-green-100 border-green-500 ring-1 ring-green-200" : ""
                                } ${
                                  invalido
                                    ? "bg-red-100 border-red-500 ring-1 ring-red-200 animate-pulse"
                                    : ""
                                }`}
                                value={valor}
                                onChange={(e) => cambiarCantidad(i, e.target.value)}
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
                  : "bg-white hover:bg-blue-100 text-blue-700"
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
                  : "bg-white hover:bg-blue-100 text-blue-700"
              }`}
            >
              Siguiente ➡️
            </button>
          </div>



         {!loadingInventario && !bloqueado && (
          <div className="mt-4 flex justify-between items-center">
            {/* Botón Exportar Excel */}
            <button
              onClick={exportarExcel}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition duration-200 ease-in-out flex items-center gap-2"
            >
              <img src="https://img.icons8.com/color/24/microsoft-excel-2019.png" alt="excel" />
              Exportar Excel
            </button>

            {/* Botón Confirmar Inventario */}
            <button
              onClick={confirmarInventario}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition duration-200 ease-in-out flex items-center gap-2"
            >
              ✅ Confirmar inventario
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
