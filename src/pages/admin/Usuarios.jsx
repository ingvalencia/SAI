import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [locales, setLocales] = useState([]);
  const [roles, setRoles] = useState([]);
  const [ciaSeleccionada, setCiaSeleccionada] = useState("");
  const [loading, setLoading] = useState(false);

  const rolesSesion = JSON.parse(sessionStorage.getItem("roles") || "[]");
  const rolLogueado = rolesSesion.length > 0 ? rolesSesion[0].id : null;
  const empleadoSesion = sessionStorage.getItem("empleado") || "";

  const [filtroRol, setFiltroRol] = useState("");

  const [busquedaLocal, setBusquedaLocal] = useState("");

  //
  const [asignarConfig, setAsignarConfig] = useState(false);
  const [tipoConteo, setTipoConteo] = useState("Individual");
  const [nroConteo, setNroConteo] = useState(1);
  const [fechaAsignacion, setFechaAsignacion] = useState("");
  const [brigadista2, setBrigadista2] = useState("");

  //
  const [nivelConteo1, setNivelConteo1] = useState(1);
  const [nivelConteo2, setNivelConteo2] = useState(2);



  const [form, setForm] = useState({
    empleado: "",
    nombre: "",
    email: "",
    password: "",
    rol_id: 4,
    locales: [],
    cia: "",
  });

  // === Fetch usuarios ===
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

  // === Fetch locales por CIA ===
  const fetchLocales = async (cia) => {
    try {
      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/catalogo_almacenes.php",
        { params: { cia }, withCredentials: true }
      );
      if (res.data.success) setLocales(res.data.data);
      else setLocales([]);
    } catch {
      setLocales([]);
    }
  };

  // === Fetch roles ===
  const fetchRoles = async () => {
    try {
      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/catalogo_roles.php"
      );
      if (res.data.success) setRoles(res.data.data);
    } catch {
      setRoles([]);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    if (rolLogueado === 1 || rolLogueado === 2) {
      fetchRoles();
    }
  }, []);

  // === Crear usuario ===
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const rolesSesion = JSON.parse(sessionStorage.getItem("roles") || "[]");
      const rol_creador = rolesSesion.length > 0 ? rolesSesion[0].id : 4;
      const empleadoSesion = sessionStorage.getItem("empleado") || "";

      // === VALIDACIONES GENERALES ===
      if (!fechaAsignacion) throw new Error("Debes seleccionar la fecha de asignación.");
      if (!form.cia && !ciaSeleccionada) throw new Error("Debes seleccionar la CIA.");
      if (!form.locales || form.locales.length === 0) {
        throw new Error("Debes seleccionar al menos un almacén.");
      }

      // === VALIDACIONES POR TIPO DE CAPTURA ===
      if (tipoConteo === "Individual") {
        // Solo Conteo 1 permitido
        if (nivelConteo1 !== 1) throw new Error("El conteo individual solo puede ser nivel 1.");
      }

      if (tipoConteo === "Brigada") {
        // Dos capturistas, niveles distintos
        if (!brigadista2?.empleado || !brigadista2?.nombre) {
          throw new Error("Debes capturar los datos del segundo capturista.");
        }
        if (nivelConteo1 === nivelConteo2) {
          throw new Error("Los capturistas no pueden tener el mismo nivel de conteo.");
        }
      }

      const cia = form.cia || ciaSeleccionada;

      // =========================================
      // 1) CREAR CAPTURISTA(S)
      // =========================================

      let usuariosCreados = [];

      // --- Capturista 1 ---
      const res1 = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/crear_usuario.php",
        { ...form, rol_creador, creado_por: empleadoSesion },
        { withCredentials: true }
      );

      if (!res1.data.success) {
        throw new Error(res1.data.error || "No se pudo registrar el primer usuario.");
      }

      // Obtener ID del primer capturista
      let idCapturista1 = null;
      const resList1 = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/usuarios.php"
      );
      if (resList1.data?.success) {
        const lista = resList1.data.data || [];
        const encontrado = lista.find(
          (u) => String(u.empleado) === String(form.empleado)
        );
        idCapturista1 = encontrado?.id;
      }
      if (!idCapturista1) throw new Error("No se pudo obtener el ID del primer capturista.");

      usuariosCreados.push({ id: idCapturista1, nivel: nivelConteo1 });

      // --- Capturista 2 (solo si brigada) ---
      let idCapturista2 = null;
      if (tipoConteo === "Brigada") {
        const dataCapt2 = {
          empleado: brigadista2.empleado,
          nombre: brigadista2.nombre,
          email: brigadista2.email || "",
          password: brigadista2.password || "",
          rol_id: 4,
          locales: form.locales,
          cia: cia,
        };

        const res2 = await axios.post(
          "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/crear_usuario.php",
          { ...dataCapt2, rol_creador, creado_por: empleadoSesion },
          { withCredentials: true }
        );

        if (!res2.data.success) {
          throw new Error(res2.data.error || "No se pudo registrar el segundo usuario.");
        }

        const resList2 = await axios.get(
          "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/usuarios.php"
        );
        if (resList2.data?.success) {
          const lista2 = resList2.data.data || [];
          const encontrado2 = lista2.find(
            (u) => String(u.empleado) === String(brigadista2.empleado)
          );
          idCapturista2 = encontrado2?.id;
        }
        if (!idCapturista2) throw new Error("No se pudo obtener el ID del segundo capturista.");

        usuariosCreados.push({ id: idCapturista2, nivel: nivelConteo2 });
      }

      // =========================================
      // 2) CREAR ASIGNACIÓN(ES)
      // =========================================
      for (const almacenSel of form.locales) {
        const usuariosAsignados = usuariosCreados.map((u) => u.id);

        // Conteo = nivel del capturista 1 en Individual, o ambos en Brigada
        for (const usuario of usuariosCreados) {
          const payload = {
            tipo_conteo: tipoConteo,
            nro_conteo: usuario.nivel,
            usuarios: usuariosAsignados,
            cia,
            almacen: almacenSel,
            fecha: fechaAsignacion,
            usuario: empleadoSesion,
          };

          const resCfg = await axios.post(
            "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/guardar_config_conteo.php",
            payload
          );

          if (!resCfg.data?.success) {
            throw new Error(
              `Error al asignar el almacén ${almacenSel}: ${resCfg.data?.error || "no se pudo crear la configuración."}`
            );
          }
        }
      }

      // =========================================
      // 3) ÉXITO TOTAL
      // =========================================
      await MySwal.fire({
        icon: "success",
        title: "Usuarios registrados",
        text:
          tipoConteo === "Individual"
            ? `Capturista individual creado y asignado correctamente.`
            : `Brigada creada correctamente con ambos capturistas asignados.`,
        timer: 2500,
        showConfirmButton: false,
      });

      // Reset
      await fetchUsuarios();
      setForm({
        empleado: "",
        nombre: "",
        email: "",
        password: "",
        rol_id: 4,
        locales: [],
        cia: "",
      });
      setCiaSeleccionada("");
      setLocales([]);
      setTipoConteo("Individual");
      setNivelConteo1(1);
      setNivelConteo2(2);
      setFechaAsignacion("");
      setBrigadista2({});

    } catch (err) {
      await MySwal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Ocurrió un error",
      });
    } finally {
      setLoading(false);
    }
  };



  // === Toggle locales en formulario ===
  const handleLocalesChange = (codigo) => {
    setForm((prev) => {
      const selected = prev.locales.includes(codigo)
        ? prev.locales.filter((l) => l !== codigo)
        : [...prev.locales, codigo];
      return { ...prev, locales: selected };
    });
  };

  // === Eliminar usuario ===
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

  // === Activar / Desactivar usuario ===
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

  // === Filtrar usuarios ===
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">👥 Gestión de Usuarios</h1>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg mb-10">
        <h2 className="text-lg font-bold mb-6 text-gray-800">Registrar nuevo usuario</h2>

        {/* Selección de tipo de captura */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Tipo de captura
            </label>
            <select
              value={tipoConteo}
              onChange={(e) => {
                const v = e.target.value;
                setTipoConteo(v);
                if (v === "Individual") setNroConteo(1);
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="Individual">Individual</option>
              <option value="Brigada">Brigada</option>
            </select>
          </div>


          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Fecha asignación
            </label>
            <input
              type="date"
              value={fechaAsignacion}
              onChange={(e) => setFechaAsignacion(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>


        {/* CIA */}
        {!(rolLogueado === 4) && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">CIA a Capturar</label>
            <select
              value={ciaSeleccionada}
              onChange={async (e) => {
                const cia = e.target.value;
                setCiaSeleccionada(cia);
                setForm((prev) => ({ ...prev, cia, locales: [] }));
                if (cia) await fetchLocales(cia);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:ring-2 focus:ring-red-600"
            >
              <option value="">— Selecciona una CIA —</option>
              <option value="recrefam">RECREFAM</option>
              <option value="veser">VESER</option>
              <option value="opardiv">OPARDIV</option>
            </select>
          </div>


        )}

        {/* Datos generales */}
        {/* Si es Individual, mostramos los campos actuales */}
        {tipoConteo === "Individual" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" required placeholder="Empleado"
              className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
              value={form.empleado}
              onChange={(e) => setForm({ ...form, empleado: e.target.value })}
            />
            <input type="text" required placeholder="Nombre"
              className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            {(rolLogueado === 1 || rolLogueado === 2) && (
              <input type="email" required placeholder="Correo electrónico"
                className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            )}
            <input type="password" required placeholder="Contraseña"
              className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

             <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nivel de conteo
              </label>
              <input
                type="text"
                value="Conteo 1"
                readOnly
                className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-100 text-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">
                El conteo individual siempre es de nivel 1.
              </p>
          </div>


        )}

        {/* Si es Brigada, mostramos dos juegos de campos */}
        {tipoConteo === "Brigada" && (
          <div className="space-y-6">
            {/* Primer capturista */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Capturista 1</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" required placeholder="Empleado"
                  className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
                  value={form.empleado}
                  onChange={(e) => setForm({ ...form, empleado: e.target.value })}
                />
                <input type="text" required placeholder="Nombre"
                  className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
                {(rolLogueado === 1 || rolLogueado === 2) && (
                  <input type="email" required placeholder="Correo electrónico"
                    className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                )}
                <input type="password" required placeholder="Contraseña"
                  className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              {/* Nivel de conteo para Capturista 1 */}
              <div className="mt-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nivel de conteo (Capturista 1)
                </label>
                <select
                  value={nivelConteo1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val === nivelConteo2) {
                      Swal.fire("Error", "Los capturistas no pueden tener el mismo nivel de conteo", "error");
                      return;
                    }
                    setNivelConteo1(val);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value={1}>Conteo 1</option>
                  <option value={2}>Conteo 2</option>
                </select>
              </div>

            </div>

            {/* Segundo capturista */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Capturista 2</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Empleado"
                  className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-blue-600"
                  value={brigadista2?.empleado || ""}
                  onChange={(e) => setBrigadista2({ ...(brigadista2 || {}), empleado: e.target.value })}
                />
                <input type="text" placeholder="Nombre"
                  className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-blue-600"
                  value={brigadista2?.nombre || ""}
                  onChange={(e) => setBrigadista2({ ...(brigadista2 || {}), nombre: e.target.value })}
                />
                {(rolLogueado === 1 || rolLogueado === 2) && (
                  <input type="email" placeholder="Correo electrónico"
                    className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-blue-600"
                    value={brigadista2?.email || ""}
                    onChange={(e) => setBrigadista2({ ...(brigadista2 || {}), email: e.target.value })}
                  />
                )}
                <input type="password" placeholder="Contraseña"
                  className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-blue-600"
                  value={brigadista2?.password || ""}
                  onChange={(e) => setBrigadista2({ ...(brigadista2 || {}), password: e.target.value })}
                />
              </div>

              {/* Nivel de conteo para Capturista 2 */}
              <div className="mt-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nivel de conteo (Capturista 2)
                </label>
                <select
                  value={nivelConteo2}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val === nivelConteo1) {
                      Swal.fire("Error", "Los capturistas no pueden tener el mismo nivel de conteo", "error");
                      return;
                    }
                    setNivelConteo2(val);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value={1}>Conteo 1</option>
                  <option value={2}>Conteo 2</option>
                </select>
              </div>

            </div>
          </div>
        )}


        {/* Rol */}
        {(rolLogueado === 1 || rolLogueado === 2) && (
          <div className="my-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
            <select
              value={form.rol_id}
              onChange={(e) => setForm({ ...form, rol_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-red-600"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Locales */}
        {rolLogueado !== 4 && (
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Seleccione  almenos un almacén para la asignación
            </label>

            {/* Buscador rápido */}
            <input
              type="text"
              placeholder="Buscar local..."
              value={busquedaLocal}
              onChange={(e) => setBusquedaLocal(e.target.value)}
              className="w-full mb-2 px-3 py-2 border rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-blue-500"
            />

            {/* Lista filtrada */}
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border p-3 rounded-lg bg-gray-50">
              {locales
                .filter((l) =>
                  `${l.codigo} - ${l.nombre}`.toLowerCase().includes(busquedaLocal.toLowerCase())
                )
                .map((l) => (
                  <label key={l.codigo} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.locales.includes(l.codigo)}
                      onChange={() => handleLocalesChange(l.codigo)}
                    />
                    {l.codigo} - {l.nombre}
                  </label>
                ))}
            </div>
          </div>
        )}


        <br></br>
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3 rounded-lg shadow-md text-white font-semibold transition ${
              loading ? "bg-red-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {loading ? "Registrando..." : "Registrar usuario"}
          </button>
        </div>
      </form>


    </div>
  );
}
