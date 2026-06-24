import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Select from "react-select";


const MySwal = withReactContent(Swal);

export default function Control() {
  const [usuarios, setUsuarios] = useState([]);
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroCiaUsuario, setFiltroCiaUsuario] = useState("");
  const [filtroLocalUsuario, setFiltroLocalUsuario] = useState("");
  const [vista, setVista] = useState("usuarios");

  const rolesSesion = JSON.parse(sessionStorage.getItem("roles") || "[]");
  const rolLogueado =
  rolesSesion.length > 0
    ? Number(rolesSesion[0].id ?? rolesSesion[0].rol_id ?? rolesSesion[0])
    : null;

  const puedeGestionarAcciones = [1, 2].includes(Number(rolLogueado));
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
    fetchConfiguraciones();
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

    if (rolLogueado === 1 || rolLogueado === 2) {
      base = usuarios;
    }

    if (rolLogueado === 3) {
      base = usuarios.filter((u) => Number(u.rol) === 4);
    }

    if (filtroRol) {
      base = base.filter((u) => String(u.rol) === filtroRol);
    }

    if (filtroCiaUsuario) {
      base = base.filter(
        (u) => String(u.cia_asignada || "").toLowerCase() === filtroCiaUsuario.toLowerCase()
      );
    }

    if (filtroLocalUsuario) {
      base = base.filter((u) =>
        Array.isArray(u.locales) &&
        u.locales.some((l) =>
          String(l)
            .toLowerCase()
            .startsWith(filtroLocalUsuario.toLowerCase())
        )
      );
    }

    return base;
  }, [
    usuarios,
    rolLogueado,
    filtroRol,
    filtroCiaUsuario,
    filtroLocalUsuario,
    empleadoSesion,
  ]);

  const ciasUsuarios = useMemo(() => {
    return Array.from(
      new Set(
        usuarios
          .map((u) => u.cia_asignada)
          .filter((cia) => cia && cia !== "Sin asignación")
      )
    ).sort();
  }, [usuarios]);

  const localesUsuarios = useMemo(() => {
    return Array.from(
      new Set(
        configuraciones
          .map((c) => c.almacen)
          .filter((l) => l && l !== "Sin asignación")
          .map((l) => String(l).split("-")[0])
      )
    ).sort();
  }, [configuraciones]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroRol, filtroCiaUsuario, filtroLocalUsuario, usuarios]);

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
    <div className="w-full max-w-[1400px] mx-auto px-3 py-4 sm:px-4 md:px-6 lg:px-8">
      <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 mb-6">
        ⚙️ Control de Operaciones
      </h1>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
        <button
          onClick={() => setVista("usuarios")}
          className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all ${
            vista === "usuarios"
              ? "bg-[#611232] text-white"
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
                ? "bg-[#611232] text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Fecha de gestión
          </button>
        )}
      </div>

      {vista === "usuarios" && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10">
  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#611232] via-[#8a1b4a] to-slate-900" />

  <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-col gap-5 mb-7">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#611232]/15 bg-[#611232]/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#611232] mb-3">
            Panel administrativo
          </div>

          <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Gestión de Usuarios
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Consulta, filtra y administra usuarios registrados en el sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFiltroRol("");
            setFiltroCiaUsuario("");
            setFiltroLocalUsuario("");
          }}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-[#611232] text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-slate-900/20 hover:shadow-[#611232]/25"
        >
          Limpiar filtros
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(rolLogueado === 1 || rolLogueado === 2) && (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.18em] mb-2">
              Filtrar por perfil
            </label>
            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-700 font-semibold focus:outline-none focus:ring-4 focus:ring-[#611232]/10 focus:border-[#611232] transition"
            >
              <option value="">Todos</option>
              <option value="1">Administrador TI</option>
              <option value="2">Administrador Sistema</option>
              <option value="3">Jefe Mesa Control</option>
              <option value="4">Operador Inventario</option>
            </select>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.18em] mb-2">
            Filtrar por CIA
          </label>
          <select
            value={filtroCiaUsuario}
            onChange={(e) => setFiltroCiaUsuario(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-700 font-semibold focus:outline-none focus:ring-4 focus:ring-[#611232]/10 focus:border-[#611232] transition"
          >
            <option value="">Todas</option>
            {ciasUsuarios.map((cia) => (
              <option key={cia} value={cia}>
                {cia.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.18em] mb-2">
            Filtrar por local
          </label>
          <select
            value={filtroLocalUsuario}
            onChange={(e) => setFiltroLocalUsuario(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-700 font-semibold focus:outline-none focus:ring-4 focus:ring-[#611232]/10 focus:border-[#611232] transition"
          >
            <option value="">Todos</option>
            {localesUsuarios.map((local) => (
              <option key={local} value={local}>
                {local}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#611232] via-[#7a163f] to-slate-950 text-white text-[11px] uppercase tracking-[0.16em]">
            <tr>
              <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">#</th>
              <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Empleado</th>
              <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Nombre</th>
              <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Responsable</th>
              <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">CIA</th>
              <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Local</th>
              <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Estado</th>

              {puedeGestionarAcciones && <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Acciones</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {usuariosPaginados.map((u, i) => {
              const numero = (paginaActual - 1) * porPagina + i + 1;

              return (
                <tr
                  key={i}
                  className="group hover:bg-gradient-to-r hover:from-[#611232]/5 hover:via-white hover:to-slate-50 transition-all duration-200"
                >
                  <td className="px-4 md:px-6 py-4">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600 group-hover:bg-[#611232] group-hover:text-white transition">
                      {numero}
                    </span>
                  </td>

                  <td className="px-4 md:px-6 py-4">
                    <span className="inline-flex items-center rounded-lg bg-[#611232]/8 px-3 py-1.5 font-mono text-xs font-black text-[#611232] border border-[#611232]/10">
                      {u.empleado}
                    </span>
                  </td>

                  <td className="px-4 md:px-6 py-4">
                    <div className="font-bold text-slate-900">
                      {u.nombre}
                    </div>
                  </td>

                  <td className="px-4 md:px-6 py-4 text-slate-700">
                    <span className="font-medium">
                      {u.responsable_nombre || "—"}
                    </span>
                  </td>

                  <td className="px-4 md:px-6 py-4">
                    {u.cia_asignada && u.cia_asignada !== "Sin asignación" ? (
                      <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white shadow-sm">
                        {u.cia_asignada.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold">—</span>
                    )}
                  </td>

                  <td className="px-4 md:px-6 py-4 text-slate-700">
                    {Array.isArray(u.locales) && u.locales.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                        {u.locales.map((local, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                          >
                            {local}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-semibold">—</span>
                    )}
                  </td>

                  <td className="px-4 md:px-6 py-4">
                    {u.activo ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-emerald-50 text-emerald-700 font-black border border-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-slate-100 text-slate-600 font-black border border-slate-200">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        Inactivo
                      </span>
                    )}
                  </td>

                  {puedeGestionarAcciones && (
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex flex-col xl:flex-row gap-2">
                        <button
                          onClick={() => toggleActivo(u.id, u.activo)}
                          className={`w-full xl:w-auto px-4 py-2 rounded-xl text-xs font-black text-white transition-all duration-200 shadow-sm
                            ${
                              u.activo
                                ? "bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/25"
                                : "bg-slate-600 hover:bg-slate-700 hover:shadow-slate-600/25"
                            }`}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>

                        <button
                          onClick={() => eliminarUsuario(u.id)}
                          className="w-full xl:w-auto px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all duration-200 shadow-sm hover:shadow-red-600/25"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Paginación */}
    <div className="flex justify-center mt-7">
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 bg-white border border-slate-200 rounded-2xl px-4 md:px-6 py-4 shadow-lg shadow-slate-900/5 w-full sm:w-auto">
        <button
          disabled={paginaActual === 1}
          onClick={() => setPaginaActual((p) => p - 1)}
          className="w-full sm:w-auto px-5 py-2 rounded-xl text-sm font-black bg-slate-900 text-white hover:bg-[#611232] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
        >
          ← Anterior
        </button>

        <span className="text-sm font-bold text-slate-700">
          Página{" "}
          <span className="inline-flex items-center justify-center min-w-8 rounded-lg bg-[#611232]/10 px-2 py-1 font-black text-[#611232]">
            {paginaActual}
          </span>{" "}
          de{" "}
          <span className="font-black text-slate-900">
            {totalPaginas || 1}
          </span>
        </span>

        <button
          disabled={paginaActual === totalPaginas || totalPaginas === 0}
          onClick={() => setPaginaActual((p) => p + 1)}
          className="w-full sm:w-auto px-5 py-2 rounded-xl text-sm font-black bg-slate-900 text-white hover:bg-[#611232] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
        >
          Siguiente →
        </button>
      </div>
    </div>
  </div>
</div>
      )}

      {vista === "fecha" && (
        <div className="max-w-7xl mx-auto space-y-8">
  <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10">
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#611232] via-[#8a1b4a] to-slate-950" />

    <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 mb-7">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#611232]/15 bg-[#611232]/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#611232] mb-3">
              Control operativo
            </div>

            <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Fechas de Gestión
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Consulta las configuraciones activas por CIA, almacén, fecha, tipo de captura y nivel de conteo.
            </p>
          </div>

          <button
            onClick={() => {
              setFiltroAlmacen("");
              setFiltroConteo("");
              setFiltroFecha("");
            }}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-[#611232] text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-slate-900/20 hover:shadow-[#611232]/25"
          >
            Limpiar filtros
          </button>
        </div>

        {/* FILTROS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.18em] mb-2">
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
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: 44,
                  borderRadius: 12,
                  borderColor: state.isFocused ? "#611232" : "#cbd5e1",
                  boxShadow: state.isFocused ? "0 0 0 4px rgba(97,18,50,0.10)" : "none",
                  fontSize: 14,
                  fontWeight: 600,
                }),
                menu: (base) => ({
                  ...base,
                  zIndex: 9999,
                  borderRadius: 12,
                  overflow: "hidden",
                }),
                option: (base, state) => ({
                  ...base,
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: state.isFocused ? "rgba(97,18,50,0.08)" : "white",
                  color: "#334155",
                }),
              }}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.18em] mb-2">
              Nivel Conteo
            </label>
            <select
              value={filtroConteo}
              onChange={(e) => setFiltroConteo(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-700 font-semibold focus:outline-none focus:ring-4 focus:ring-[#611232]/10 focus:border-[#611232] transition"
            >
              <option value="">Todos</option>
              <option value="1">Conteo 1</option>
              <option value="2">Conteo 2</option>
              <option value="3">Conteo 3</option>
              <option value="7">Conteo 4</option>
              <option value="4">Finalizado</option>
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.18em] mb-2">
              Fecha
            </label>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-700 font-semibold focus:outline-none focus:ring-4 focus:ring-[#611232]/10 focus:border-[#611232] transition"
            />
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#611232] via-[#7a163f] to-slate-950 text-white text-[11px] uppercase tracking-[0.16em]">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">#</th>
                <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">CIA</th>
                <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Almacén</th>
                <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Fecha</th>
                <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Tipo</th>
                <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Conteo</th>
                <th className="px-4 md:px-6 py-4 text-left whitespace-nowrap font-black">Equipo</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {configuracionesPaginadas.map((c, i) => {
                const numero = (paginaFechas - 1) * porPaginaFechas + i + 1;

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
                  <tr
                    key={i}
                    className="group hover:bg-gradient-to-r hover:from-[#611232]/5 hover:via-white hover:to-slate-50 transition-all duration-200"
                  >
                    <td className="px-4 md:px-6 py-4">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600 group-hover:bg-[#611232] group-hover:text-white transition">
                        {numero}
                      </span>
                    </td>

                    <td className="px-4 md:px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white shadow-sm">
                        {c.cia}
                      </span>
                    </td>

                    <td className="px-4 md:px-6 py-4">
                      <div className="font-bold text-slate-900">
                        {c.almacen}
                      </div>
                    </td>

                    <td className="px-4 md:px-6 py-4">
                      <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
                        {formatSoloFecha(c.fecha_asignacion)}
                      </span>
                    </td>

                    <td className="px-4 md:px-6 py-4">
                      <span className="inline-flex items-center rounded-lg bg-[#611232]/8 px-3 py-1.5 text-xs font-black text-[#611232] border border-[#611232]/10">
                        {c.tipo_conteo}
                      </span>
                    </td>

                    <td className="px-4 md:px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black shadow-sm
                        ${estilosConteo[ultimoConteo] || "bg-slate-100 text-slate-700 border-slate-300"}`}
                      >
                        {etiquetaConteo}
                      </span>
                    </td>

                    <td className="px-4 md:px-6 py-4 text-slate-700 whitespace-pre-wrap">
                      {c.equipo ? (
                        <div className="max-w-[360px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-700">
                          {c.equipo}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-semibold">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINACIÓN */}
      <div className="flex justify-center mt-7">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 bg-white border border-slate-200 rounded-2xl px-4 md:px-6 py-4 shadow-lg shadow-slate-900/5 w-full sm:w-auto">
          <button
            disabled={paginaFechas === 1}
            onClick={() => setPaginaFechas((p) => p - 1)}
            className="w-full sm:w-auto px-5 py-2 rounded-xl text-sm font-black bg-slate-900 text-white hover:bg-[#611232] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
          >
            ← Anterior
          </button>

          <span className="text-sm font-bold text-slate-700">
            Página{" "}
            <span className="inline-flex items-center justify-center min-w-8 rounded-lg bg-[#611232]/10 px-2 py-1 font-black text-[#611232]">
              {paginaFechas}
            </span>{" "}
            de{" "}
            <span className="font-black text-slate-900">
              {totalPaginasFechas || 1}
            </span>
          </span>

          <button
            disabled={paginaFechas === totalPaginasFechas || totalPaginasFechas === 0}
            onClick={() => setPaginaFechas((p) => p + 1)}
            className="w-full sm:w-auto px-5 py-2 rounded-xl text-sm font-black bg-slate-900 text-white hover:bg-[#611232] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
      )}



    </div>
  );
}
