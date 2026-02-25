import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Select from "react-select";


const MySwal = withReactContent(Swal);

export default function Control() {
  const [usuarios, setUsuarios] = useState([]);
  const [filtroRol, setFiltroRol] = useState("");
  const [vista, setVista] = useState("usuarios");

  const rolesSesion = JSON.parse(sessionStorage.getItem("roles") || "[]");
  const rolLogueado = rolesSesion.length > 0 ? rolesSesion[0].id : null;
  const empleadoSesion = sessionStorage.getItem("empleado") || "";

  const [cia, setCia] = useState("");
  const [almacenesSeleccionados, setAlmacenesSeleccionados] = useState([]);
  const [fechaGestion, setFechaGestion] = useState("");
  const [almacenes, setAlmacenes] = useState([]);
  const [nivelConteo, setNivelConteo] = useState("");
  const [configuraciones, setConfiguraciones] = useState([]);
  const [filtroAlmacen, setFiltroAlmacen] = useState("");
  const [filtroConteo, setFiltroConteo] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [busquedaAlmacen, setBusquedaAlmacen] = useState("");
  const porPaginaFechas = 10;
  const [paginaFechas, setPaginaFechas] = useState(1);

  const fetchUsuarios = async () => {
    try {
      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/usuarios.php"
      );
      if (res.data.success) setUsuarios(res.data.data);
    } catch (err) {
      console.error("Error cargando usuarios:", err.message);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  useEffect(() => {
    if (vista === "fecha") {
      setCia("");
      setAlmacenes([]);
      setAlmacenesSeleccionados([]);
      setFechaGestion("");
      fetchConfiguraciones();
    }
  }, [vista]);


  const eliminarUsuario = async (id) => {
    const confirm = await MySwal.fire({
      title: "¿Eliminar usuario?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      const formData = new FormData();
      formData.append("id", id);

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/eliminar_usuario.php",
        formData
      );
      if (res.data.success) {
        await MySwal.fire("Eliminado", "Usuario borrado correctamente", "success");
        fetchUsuarios();
      } else {
        MySwal.fire("Error", res.data.error || "No se pudo eliminar", "error");
      }
    } catch {
      MySwal.fire("Error", "No se pudo conectar al servidor", "error");
    }
  };


  const eliminarConfiguracion = async (id) => {
    const confirm = await MySwal.fire({
      title: "¿Eliminar configuración?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/crud_configuracion_inventario.php?action=eliminar",
        { id }
      );

      if (res.data.success) {
        setConfiguraciones((prev) => prev.filter((c) => c.id !== id));
        MySwal.fire("Eliminado", "Configuración borrada", "success");
      } else {
        MySwal.fire("Error", res.data.error || "No se pudo eliminar", "error");
      }
    } catch {
      MySwal.fire("Error", "No se pudo conectar al servidor", "error");
    }
  };


  const editarConfiguracion = async (config) => {

    const fechaISO = config.fecha_gestion
      ? new Date(config.fecha_gestion).toISOString().split("T")[0]
      : "";

    const { value: formValues } = await MySwal.fire({
      title: "Editar configuración",
      html: `
        <div class="space-y-4 text-left">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">CIA</label>
            <input type="text" id="swal-cia" value="${config.cia}" readonly
              class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm bg-gray-100 cursor-not-allowed" />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Almacén</label>
            <input id="swal-almacen" value="${config.almacen}" readonly
              class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm bg-gray-100 cursor-not-allowed" />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Fecha de gestión</label>
            <input type="date" id="swal-fecha" value="${fechaISO}" readonly
              class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm bg-gray-100 cursor-not-allowed" />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Nivel de conteo</label>
            <select id="swal-conteo"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">—</option>
              <option value="0" ${config.conteo === 0 ? "selected" : ""}>Conteo 1</option>
              <option value="2" ${config.conteo === 2 ? "selected" : ""}>Conteo 2</option>
              <option value="3" ${config.conteo === 3 ? "selected" : ""}>Conteo 3</option>
            </select>
          </div>
        </div>
      `,
      focusConfirm: false,
      confirmButtonText: "💾 Guardar",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        return {
          cia: document.getElementById("swal-cia").value,
          fecha_gestion: document.getElementById("swal-fecha").value,
          almacen: document.getElementById("swal-almacen").value,
          conteo: document.getElementById("swal-conteo").value
        };
      }
    });

    if (!formValues) return;

    try {
      const payload = new FormData();
      payload.append("id", config.detalle_id);
      payload.append("cia", formValues.cia);
      payload.append("fecha_gestion", formValues.fecha_gestion);
      payload.append("almacen", formValues.almacen);
      payload.append("conteo", formValues.conteo);
      payload.append("usuario", empleadoSesion);

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/crud_configuracion_inventario.php?action=editar",
        payload
      );

      if (res.data.success) {
        await MySwal.fire("Actualizado", res.data.mensaje || "Configuración actualizada", "success");
        fetchConfiguraciones();
      } else {
        MySwal.fire("Error", res.data.error || "No se pudo actualizar", "error");
      }
    } catch {
      MySwal.fire("Error", "No se pudo conectar al servidor", "error");
    }
  };


  const toggleActivo = async (id, activo) => {
    try {
      const formData = new FormData();
      formData.append("id", id);
      formData.append("activo", activo ? 0 : 1);

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/toggle_usuario.php",
        formData
      );

      if (res.data.success) {
        await MySwal.fire({
          icon: "success",
          title: activo ? "Usuario desactivado" : "Usuario activado",
          timer: 1500,
          showConfirmButton: false,
        });

        setUsuarios((prev) =>
          prev.map((u) => (u.id === id ? { ...u, activo: activo ? 0 : 1 } : u))
        );
      } else {
        MySwal.fire("Error", res.data.error || "No se pudo actualizar", "error");
      }
    } catch {
      MySwal.fire("Error", "No se pudo conectar al servidor", "error");
    }
  };


  const usuariosFiltrados = useMemo(() => {
    let base = [];
    if (rolLogueado === 1 || rolLogueado === 2) base = usuarios;
    if (rolLogueado === 3) {
      base = usuarios.filter(
        (u) => u.rol === 4 && u.creado_por === empleadoSesion
      );
    }
    if (filtroRol) {
      base = base.filter((u) => String(u.rol) === filtroRol);
    }
    return base;
  }, [usuarios, rolLogueado, filtroRol, empleadoSesion]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroRol, usuarios]);

  const porPagina = 10;
  const [paginaActual, setPaginaActual] = useState(1);

  const usuariosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    const fin = inicio + porPagina;
    return usuariosFiltrados.slice(inicio, fin);
  }, [usuariosFiltrados, paginaActual]);

  const totalPaginas = Math.ceil(usuariosFiltrados.length / porPagina);

  const toggleAlmacen = (codigo) => {
    setAlmacenesSeleccionados((prev) =>
      prev.includes(codigo)
        ? prev.filter((c) => c !== codigo)
        : [...prev, codigo]
    );
  };


  const fetchAlmacenes = async (ciaSeleccionada) => {
    try {
      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/catalogo_almacenes.php",
        { params: { cia: ciaSeleccionada }, withCredentials: true }
      );
      if (res.data.success) setAlmacenes(res.data.data);
      else setAlmacenes([]);
    } catch {
      setAlmacenes([]);
    }
  };


  const fetchConfiguraciones = async () => {
    try {
      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/crud_configuracion_inventario.php",
        { params: { action: "listar" } }
      );

      if (res.data.success) {
        setConfiguraciones(res.data.data);
      } else {
        setConfiguraciones([]);
        MySwal.fire("Error", res.data.error || "No se pudo cargar configuraciones", "error");
      }
    } catch (err) {
      console.error("Error al cargar configuraciones:", err.message);
      setConfiguraciones([]);
    }
  };


  const guardarConfiguracion = async () => {
    if (!cia || !fechaGestion || almacenesSeleccionados.length === 0) {
      MySwal.fire("Faltan datos", "Debes seleccionar CIA, fecha y al menos un almacén", "warning");
      return;
    }

    const confirm = await MySwal.fire({
      title: "¿Guardar configuración?",
      html: `
        <div class="text-left text-sm">
          <p><strong>CIA:</strong> ${cia}</p>
          <p><strong>Fecha:</strong> ${fechaGestion}</p>
          <p><strong>Almacenes:</strong> ${almacenesSeleccionados.join(", ")}</p>
          <p><strong>Nivel de conteo:</strong> ${nivelConteo === "0" ? "Conteo 1" : nivelConteo === "2" ? "Conteo 2" : nivelConteo === "3" ? "Conteo 3" : "—"}</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar"
    });

    if (!confirm.isConfirmed) return;

    const formData = new FormData();
    formData.append("cia", cia);
    formData.append("fecha_gestion", fechaGestion);
    formData.append("actualizado_por", empleadoSesion);
    formData.append("nivel_conteo", nivelConteo);

    almacenesSeleccionados.forEach(a => {
      formData.append("almacenes[]", a);
    });

    try {
      MySwal.fire({
        title: "Guardando...",
        text: "Por favor espera",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/guardar_configuracion_inventario.php",
        formData,
        { withCredentials: true }
      );

      Swal.close();

      if (res.data.success) {
        await MySwal.fire("Guardado", res.data.mensaje || "Configuración actualizada", "success");

        setCia("");
        setAlmacenes([]);
        setAlmacenesSeleccionados([]);
        setFechaGestion("");
        setNivelConteo("");

        fetchConfiguraciones();
      } else {
        MySwal.fire("Error", res.data.error || "No se pudo guardar", "error");
      }
    } catch (err) {
      Swal.close();
      MySwal.fire("Error", "No se pudo conectar al servidor", "error");
    }
  };


  const formatSoloFecha = (valor) => {
    if (!valor) return "—";

    const meses = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
    };

    const partes = valor.trim().split(" ").filter(Boolean);

    if (partes.length < 3) return valor;

    const mes = meses[partes[0]];
    const dia = partes[1].padStart(2, "0");
    const anio = partes[2];

    return `${dia}/${mes}/${anio}`;
  };

  const toISODate = (valor) => {
    if (!valor) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0,10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
      const [d,m,y] = valor.split("/");
      return `${y}-${m}-${d}`;
    }
    const d = new Date(valor);
    if (isNaN(d)) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  };


  const configuracionesFiltradas = useMemo(() => {
    const iso = (v) => toISODate(v);
    return configuraciones
      .filter(c => {
        const coincideAlmacen = filtroAlmacen
        ? c.almacen?.trim().split("-")[0]?.trim() === filtroAlmacen
        : true;

        const coincideConteo = filtroConteo? String(c.conteos || "")
            .split(",")
            .map(v => Number(v))
            .pop() === Number(filtroConteo)
        : true;

        const coincideFecha   = filtroFecha ? iso(c.fecha_asignacion) === filtroFecha : true;

        return coincideAlmacen && coincideConteo && coincideFecha;
      })
      .sort((a, b) => iso(b.fecha_asignacion).localeCompare(iso(a.fecha_asignacion))); //
  }, [configuraciones, filtroAlmacen, filtroConteo, filtroFecha]);

  const totalPaginasFechas = Math.ceil(
    configuracionesFiltradas.length / porPaginaFechas
  );

  const configuracionesPaginadas = useMemo(() => {
    const inicio = (paginaFechas - 1) * porPaginaFechas;
    const fin = inicio + porPaginaFechas;
    return configuracionesFiltradas.slice(inicio, fin);
  }, [configuracionesFiltradas, paginaFechas]);

  useEffect(() => {
    setPaginaFechas(1);
  }, [filtroAlmacen, filtroConteo, filtroFecha, configuraciones]);

  const almacenesDisponibles = useMemo(() => {
    return Array.from(
      new Set(
        configuraciones
          .map(c => c.almacen)
          .filter(Boolean)
      )
    ).sort();
  }, [configuraciones]);

  const familiasAlmacen = useMemo(() => {
    const familias = configuraciones
      .map(c => c.almacen)
      .filter(Boolean)
      .map(a => a.split("-")[0]);

    return Array.from(new Set(familias))
      .sort()
      .map(f => ({ value: f, label: f }));
  }, [configuraciones]);

  const estilosConteo = {
      1: "bg-blue-100 text-blue-800 border-blue-300",
      2: "bg-yellow-100 text-yellow-800 border-yellow-300",
      3: "bg-orange-100 text-orange-800 border-orange-300",
      7: "bg-purple-100 text-purple-800 border-purple-300",
      4: "bg-green-100 text-green-800 border-green-300",
    };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">⚙️ Control de Operaciones</h1>

      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setVista("usuarios")}
          className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all ${
            vista === "usuarios"
              ? "bg-red-700 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Usuarios registrados
        </button>


        {(rolLogueado === 1 || rolLogueado === 2 || rolLogueado === 3) && (
          <button
            onClick={() => setVista("fecha")}
            className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all ${
              vista === "fecha"
                ? "bg-red-700 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Fecha de gestión
          </button>
        )}
      </div>

      {vista === "usuarios" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-8">

          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-800">
              Gestión de Usuarios
            </h2>

            {(rolLogueado === 1 || rolLogueado === 2) && (
              <div className="w-72">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Filtrar por rol
                </label>
                <select
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-700"
                >
                  <option value="">Todos</option>
                  <option value="1">Administrador TI</option>
                  <option value="2">Administrador Sistema</option>
                  <option value="3">Jefe Mesa Control</option>
                  <option value="4">Operador Inventario</option>
                </select>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white text-xs uppercase tracking-wider shadow-lg z-10">
                  <tr>
                    <th className="px-6 py-3 text-left">Empleado</th>
                    <th className="px-6 py-3 text-left">Nombre</th>
                    <th className="px-6 py-3 text-left">Responsable</th>
                    <th className="px-6 py-3 text-left">Estado</th>
                    <th className="px-6 py-3 text-left">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {usuariosPaginados.map((u, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-3 font-mono text-red-800">{u.empleado}</td>
                      <td className="px-6 py-3 text-slate-800">{u.nombre}</td>
                      <td className="px-6 py-3 text-slate-700">{u.responsable_nombre || "—"}</td>
                      <td className="px-6 py-3">
                        {u.activo ? (
                          <span className="px-3 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                            Activo
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-xs rounded-full bg-slate-200 text-slate-600">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 flex gap-2">
                        <button
                          onClick={() => toggleActivo(u.id, u.activo)}
                          className={`px-4 py-1.5 rounded-md text-xs font-semibold text-white transition
                            ${u.activo ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-500 hover:bg-slate-600"}`}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>

                        {(rolLogueado === 1 || rolLogueado === 2) && (
                          <button
                            onClick={() => eliminarUsuario(u.id)}
                            className="px-4 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition"
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          <div className="flex justify-center mt-8">
            <div className="flex items-center gap-6 bg-slate-50 border border-slate-200 rounded-xl px-6 py-3 shadow-sm">
              <button
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual(p => p - 1)}
                className="px-4 py-1.5 rounded-md text-sm font-semibold bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
              >
                ← Anterior
              </button>

              <span className="text-sm font-medium text-slate-700">
                Página <span className="font-semibold">{paginaActual}</span> de{" "}
                <span className="font-semibold">{totalPaginas || 1}</span>
              </span>

              <button
                disabled={paginaActual === totalPaginas || totalPaginas === 0}
                onClick={() => setPaginaActual(p => p + 1)}
                className="px-4 py-1.5 rounded-md text-sm font-semibold bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}

      {vista === "fecha" && (
        <div className="max-w-7xl mx-auto space-y-8">

          <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-8">

            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-800">
                Fechas de Gestión
              </h2>

              <button
                onClick={() => {
                  setFiltroAlmacen("");
                  setFiltroConteo("");
                  setFiltroFecha("");
                }}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition"
              >
                Limpiar filtros
              </button>
            </div>

            {/* FILTROS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Almacén
                </label>
                <Select
                  options={familiasAlmacen}
                  value={
                    filtroAlmacen
                      ? { value: filtroAlmacen, label: filtroAlmacen }
                      : null
                  }
                  onChange={(opcion) =>
                    setFiltroAlmacen(opcion ? opcion.value : "")
                  }
                  isClearable
                  placeholder="Seleccionar"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Nivel Conteo
                </label>
                <select
                  value={filtroConteo}
                  onChange={(e) => setFiltroConteo(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-700"
                >
                  <option value="">Todos</option>
                  <option value="1">Conteo 1</option>
                  <option value="2">Conteo 2</option>
                  <option value="3">Conteo 3</option>
                  <option value="7">Conteo 4</option>
                  <option value="4">Finalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-700"
                />
              </div>

            </div>

            {/* TABLA */}
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white text-xs uppercase tracking-wider shadow-lg z-10">
                    <tr>
                      <th className="px-6 py-3 text-left">CIA</th>
                      <th className="px-6 py-3 text-left">Almacén</th>
                      <th className="px-6 py-3 text-left">Fecha</th>
                      <th className="px-6 py-3 text-left">Tipo</th>
                      <th className="px-6 py-3 text-left">Conteo</th>
                      <th className="px-6 py-3 text-left">Equipo</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white">
                    {configuracionesPaginadas.map((c, i) => {
                      const ultimoConteo = Number(
                        String(c.conteos || "")
                          .split(",")
                          .map(v => Number(v))
                          .pop()
                      );

                      const etiquetaConteo =
                        {
                          1: "Conteo 1",
                          2: "Conteo 2",
                          3: "Conteo 3",
                          4: "Finalizado",
                          7: "Conteo 4",
                        }[ultimoConteo] || "—";

                      return (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-3 font-semibold text-slate-800">
                            {c.cia}
                          </td>

                          <td className="px-6 py-3 text-slate-700">
                            {c.almacen}
                          </td>

                          <td className="px-6 py-3 text-slate-700">
                            {formatSoloFecha(c.fecha_asignacion)}
                          </td>

                          <td className="px-6 py-3 text-slate-700">
                            {c.tipo_conteo}
                          </td>

                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold
                              ${estilosConteo[ultimoConteo] || "bg-slate-100 text-slate-700 border-slate-300"}`}
                            >
                              {etiquetaConteo}
                            </span>
                          </td>

                          <td className="px-6 py-3 text-slate-700 whitespace-pre-wrap">
                            {c.equipo || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGINACIÓN */}
            <div className="flex justify-center mt-8">
              <div className="flex items-center gap-6 bg-slate-50 border border-slate-200 rounded-xl px-6 py-3 shadow-sm">
                <button
                  disabled={paginaFechas === 1}
                  onClick={() => setPaginaFechas(p => p - 1)}
                  className="px-4 py-1.5 rounded-md text-sm font-semibold bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
                >
                  ← Anterior
                </button>

                <span className="text-sm font-medium text-slate-700">
                  Página <span className="font-semibold">{paginaFechas}</span> de{" "}
                  <span className="font-semibold">{totalPaginasFechas || 1}</span>
                </span>

                <button
                  disabled={paginaFechas === totalPaginasFechas || totalPaginasFechas === 0}
                  onClick={() => setPaginaFechas(p => p + 1)}
                  className="px-4 py-1.5 rounded-md text-sm font-semibold bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            </div>

          </div>
        </div>
      )}



    </div>
  );
}
