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

  //
  const [tabRegistro, setTabRegistro] = useState("operador");

  //

  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);

  //

  //
  const [busquedaOperador, setBusquedaOperador] = useState("");

  //
  const [ordenAlmacenes, setOrdenAlmacenes] = useState({});



  const [form, setForm] = useState({
    empleado: "",
    nombre: "",
    email: "",
    password: "",
    rol_id: 4,
    locales: [],
    cia: "",
  });

  //Usuarios disponibles
  const fetchUsuariosDisponibles = async () => {
    try {
      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/usuarios_disponibles.php"
      );
      if (res.data.success) {
        setUsuariosDisponibles(res.data.data);
      }
    } catch (e) {
      setUsuariosDisponibles([]);
    }
  };

  useEffect(() => {
    if (tabRegistro === "operador") {
      fetchUsuariosDisponibles();
      setUsuariosSeleccionados([]);
    }
  }, [tabRegistro, tipoConteo]);



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
    const empleadoSesion = sessionStorage.getItem("empleado") || "";

    if (!fechaAsignacion) throw new Error("Debes seleccionar la fecha.");
    if (!ciaSeleccionada) throw new Error("Debes seleccionar la CIA.");
    if (!form.locales.length) throw new Error("Selecciona al menos un almacén.");

    if (tipoConteo === "Individual" && usuariosSeleccionados.length !== 1) {
      throw new Error("Individual requiere 1 operador.");
    }

    if (tipoConteo === "Brigada" && usuariosSeleccionados.length !== 2) {
      throw new Error("Brigada requiere 2 operadores.");
    }

    const almacenesOrdenados = form.locales.map((alm) => ({
      almacen: alm,
      orden_trabajo: Number(ordenAlmacenes[alm]),
    }));

    if (almacenesOrdenados.some(a => !a.orden_trabajo || a.orden_trabajo <= 0)) {
      throw new Error("Todos los almacenes deben tener un orden válido");
    }

    const ordenes = almacenesOrdenados.map(a => a.orden_trabajo);
    if (new Set(ordenes).size !== ordenes.length) {
      throw new Error("El orden de almacenes no puede repetirse");
    }

    const res = await axios.get(
      "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/asignar_operador_existente.php",
      {
        params: {
          tipo_conteo: tipoConteo,
          usuarios: usuariosSeleccionados.join(","),
          almacenes: form.locales.join(","),
          almacenes_orden: JSON.stringify(almacenesOrdenados),
          cia: ciaSeleccionada,
          fecha: fechaAsignacion,
          creado_por: empleadoSesion,
        },
      }
    );

    if (!res.data?.success) {
      throw new Error(res.data?.error || "Error en asignación");
    }

    await MySwal.fire({
      icon: "success",
      title: "Asignación correcta",
      timer: 2000,
      showConfirmButton: false,
    });

    setUsuariosSeleccionados([]);
    setForm((p) => ({ ...p, locales: [] }));
    setOrdenAlmacenes({});
    setFechaAsignacion("");
    setTipoConteo("Individual");

  } catch (err) {
    MySwal.fire("Error", err.message, "error");
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

  const buscarUsuarioMysql = async (empleado) => {
    if (!empleado) return;

    try {
      const res = await axios.get(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/mysql_buscar_usuario.php",
        { params: { empleado } }
      );

      if (!res.data.success) {
        throw new Error(res.data.error);
      }

      const u = res.data.data;
      setForm({
        ...form,
        empleado: u.empleado,
        nombre: u.nombre,
        email: u.email || "",
        password: u.password || "",
      });
    } catch (err) {
      MySwal.fire("No encontrado", err.message, "warning");
      setForm({ empleado, nombre: "", email: "", password: "", rol_id: 4, locales: [], cia: "" });
    }
  };


  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">👥 Gestión de Usuarios</h1>

      <div className="flex gap-4 mb-6">
        <button
          type="button"
          onClick={() => setTabRegistro("base")}
          className={`px-4 py-2 rounded font-semibold ${
            tabRegistro === "base"
              ? "bg-red-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Registros de Usuarios
        </button>

        <button
          type="button"
          onClick={() => setTabRegistro("operador")}
          className={`px-4 py-2 rounded font-semibold ${
            tabRegistro === "operador"
              ? "bg-red-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Registro Operador Inventario
        </button>

        <button
          type="button"
          onClick={() => setTabRegistro("admin")}
          className={`px-4 py-2 rounded font-semibold ${
            tabRegistro === "admin"
              ? "bg-red-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Registro Administrador
        </button>
      </div>



      {/* Formulario */}
      {tabRegistro === "base" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const res = await axios.post(
                "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/registrar_usuario_base.php",
                {
                  empleado: form.empleado,
                  nombre: form.nombre,
                  email: form.email,
                  password: form.password,
                  creado_por: empleadoSesion,
                }
              );

              if (!res.data.success) throw new Error(res.data.error);

              await MySwal.fire("Éxito", "Usuario base registrado correctamente", "success");

              setForm({
                empleado: "",
                nombre: "",
                email: "",
                password: "",
                rol_id: 4,
                locales: [],
                cia: "",
              });
            } catch (err) {
              MySwal.fire("Error", err.message, "error");
            } finally {
              setLoading(false);
            }
          }}
          className="bg-white p-6 rounded-xl shadow-lg mb-10"
        >
          <h2 className="text-lg font-bold mb-6 text-gray-800">
            Registro base de usuarios
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              required
              placeholder="Empleado"
              className="border rounded-lg px-3 py-2"
              value={form.empleado}
              onChange={(e) => {
                const value = e.target.value;

                // si se limpia, se limpia todo el formulario
                if (!value) {
                  setForm({
                    empleado: "",
                    nombre: "",
                    email: "",
                    password: "",
                    rol_id: form.rol_id,
                    locales: [],
                    cia: "",
                  });
                  return;
                }

                setForm({ ...form, empleado: value });
              }}
              onBlur={(e) => buscarUsuarioMysql(e.target.value)}
            />


            <input
              type="text"
              placeholder="Nombre"
              readOnly
              className="border rounded-lg px-3 py-2 bg-gray-100"
              value={form.nombre}
            />

            <input
              type="email"
              placeholder="Correo"
              readOnly
              className="border rounded-lg px-3 py-2 bg-gray-100"
              value={form.email}
            />

            <input
              type="password"
              placeholder="Contraseña"
              readOnly
              className="border rounded-lg px-3 py-2 bg-gray-100"
              value={form.password}
            />
          </div>

          <div className="mt-6 flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-3 rounded-lg text-white font-semibold ${
                loading ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Registrando..." : "Registrar usuario base"}
            </button>
          </div>
        </form>
      )}

      {tabRegistro === "operador" && (
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
              {/* selector de usuario (reemplaza Empleado/Nombre/Email/Password) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Operador inventario
                </label>

                <input
                  type="text"
                  list="usuarios-list"
                  placeholder="Buscar por empleado o nombre"
                  className="border rounded-lg px-3 py-2 w-full shadow-sm focus:ring-2 focus:ring-red-600"
                  onChange={(e) => {
                    const value = e.target.value;

                    const encontrado = usuariosDisponibles.find(
                      (u) =>
                        `${u.empleado} - ${u.nombre}`.toLowerCase() === value.toLowerCase()
                    );

                    if (encontrado) {
                      setUsuariosSeleccionados([encontrado.id]);
                    } else {
                      setUsuariosSeleccionados([]);
                    }
                  }}
                />

                <datalist id="usuarios-list">
                  {usuariosDisponibles.map((u) => (
                    <option
                      key={u.id}
                      value={`${u.empleado} - ${u.nombre}`}
                    />
                  ))}
                </datalist>
              </div>


              {/*  */}
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nivel de conteo
              </label>

              <input
                type="text"
                value="Conteo 1"
                readOnly
                className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-100 text-gray-700"
              />

              <p className="text-xs text-gray-500 mt-1 md:col-span-2">
                El conteo individual siempre es de nivel 1.
              </p>
            </div>
          )}


          {/* Si es Brigada, mostramos dos juegos de campos */}
          {tipoConteo === "Brigada" && (
            <div className="space-y-6">
              {/* selección de brigada (2 usuarios) */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Selecciona Brigada (2 operadores)</h3>
                <input
                  type="text"
                  placeholder="Buscar por empleado o nombre"
                  value={busquedaOperador}
                  onChange={(e) => setBusquedaOperador(e.target.value)}
                  className="w-full mb-2 px-3 py-2 border rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-red-600"
                />

                <div className="grid grid-cols-1 gap-2 border rounded-lg p-3 bg-gray-50">
                  {usuariosDisponibles
                    .filter((u) =>
                      `${u.empleado} ${u.nombre}`
                        .toLowerCase()
                        .includes(busquedaOperador.toLowerCase())
                    )
                    .map((u) => (

                    <label key={u.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={usuariosSeleccionados.includes(u.id)}
                        disabled={
                          !usuariosSeleccionados.includes(u.id) &&
                          usuariosSeleccionados.length >= 2
                        }
                        onChange={() => {
                          setUsuariosSeleccionados((prev) =>
                            prev.includes(u.id)
                              ? prev.filter((x) => x !== u.id)
                              : [...prev, u.id]
                          );
                        }}
                      />
                      {u.empleado} - {u.nombre}
                    </label>
                  ))}
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Debes seleccionar exactamente 2 operadores para brigada.
                </p>
              </div>

              {/*  niveles solo informativos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nivel de conteo (Operador 1)
                  </label>
                  <input
                    type="text"
                    value="Conteo 1"
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-100 text-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nivel de conteo (Operador 2)
                  </label>
                  <input
                    type="text"
                    value="Conteo 2"
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-100 text-gray-700"
                  />
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
              disabled
              className="w-full px-4 py-2 border rounded-lg shadow-sm bg-gray-100 cursor-not-allowed"
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
                        onChange={() => {
                          handleLocalesChange(l.codigo);

                          setOrdenAlmacenes(prev => {
                            const copy = { ...prev };
                            if (!form.locales.includes(l.codigo)) {
                              const usados = Object.values(copy).map(Number).filter(n => n > 0);
                              const siguiente = usados.length ? Math.max(...usados) + 1 : 1;
                              copy[l.codigo] = siguiente;
                            }
                            else {
                              delete copy[l.codigo];
                            }
                            return copy;
                          });
                        }}
                      />

                      <span>{l.codigo} - {l.nombre}</span>

                      <input
                        type="number"
                        min="1"
                        className="w-14 ml-2 border rounded px-1 text-xs"
                        disabled={!form.locales.includes(l.codigo)}
                        value={ordenAlmacenes[l.codigo] ?? ""}
                        onChange={(e) =>
                          setOrdenAlmacenes(prev => ({
                            ...prev,
                            [l.codigo]: e.target.value
                          }))
                        }
                      />

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
      )}

      {tabRegistro === "admin" && (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            const rolesSesion = JSON.parse(sessionStorage.getItem("roles") || "[]");
            const rol_creador = rolesSesion.length > 0 ? rolesSesion[0].id : 1;
            const creado_por = sessionStorage.getItem("empleado") || "";

            const payload = {
              empleado: form.empleado,
              nombre: form.nombre,
              email: form.email,
              password: form.password,
              rol_id: form.rol_id, // 1,2,3
              cia: null,
              locales: [],
              rol_creador,
              creado_por,
            };

            const res = await axios.post(
              "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/crear_usuario.php",
              payload,
              { withCredentials: true }
            );

            if (!res.data.success) throw new Error(res.data.error);

            await MySwal.fire("Éxito", "Administrador registrado correctamente", "success");
            fetchUsuarios();

            setForm({
              empleado: "",
              nombre: "",
              email: "",
              password: "",
              rol_id: 1,
              locales: [],
              cia: "",
            });
          } catch (err) {
            MySwal.fire("Error", err.message, "error");
          } finally {
            setLoading(false);
          }
        }}
        className="bg-white p-6 rounded-xl shadow-lg"
      >
        <h2 className="text-lg font-bold mb-6 text-gray-800">
          Registrar Administrador
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            required
            placeholder="Empleado"
            className="border rounded-lg px-3 py-2"
            value={form.empleado}
            onChange={(e) => {
              const value = e.target.value;

              // si se limpia, se limpia todo el formulario
              if (!value) {
                setForm({
                  empleado: "",
                  nombre: "",
                  email: "",
                  password: "",
                  rol_id: form.rol_id,
                  locales: [],
                  cia: "",
                });
                return;
              }

              setForm({ ...form, empleado: value });
            }}
            onBlur={(e) => buscarUsuarioMysql(e.target.value)}
          />

          <input
            type="text"
            required
            placeholder="Nombre"
            className="border rounded-lg px-3 py-2 bg-gray-100 cursor-not-allowed"
            value={form.nombre}
            readOnly
          />

          <input
            type="email"
            required
            placeholder="Correo electrónico"
            className="border rounded-lg px-3 py-2 bg-gray-100 cursor-not-allowed"
            value={form.email}
            readOnly
          />

          <input
            type="password"
            required
            placeholder="Contraseña"
            className="border rounded-lg px-3 py-2 bg-gray-100 cursor-not-allowed"
            value={form.password}
            readOnly
          />


          <select
            value={form.rol_id}
            onChange={(e) => setForm({ ...form, rol_id: parseInt(e.target.value) })}
            className="border rounded-lg px-3 py-2 md:col-span-2"
          >
            {roles
              .filter((r) => r.id !== 4)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
          </select>

        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3 rounded-lg text-white font-semibold ${
              loading ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {loading ? "Registrando..." : "Registrar Administrador"}
          </button>
        </div>
      </form>
    )}


    </div>
  );
}
