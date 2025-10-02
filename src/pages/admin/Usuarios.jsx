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

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/crear_usuario.php",
        { ...form, rol_creador, creado_por: empleadoSesion },
        { withCredentials: true }
      );

      if (res.data.success) {
        await MySwal.fire({
          icon: "success",
          title: "Usuario registrado",
          text: `El usuario ${form.nombre} fue creado correctamente.`,
          timer: 1800,
          showConfirmButton: false,
        });
        fetchUsuarios();
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
      } else {
        MySwal.fire({
          icon: "error",
          title: "Error",
          text: res.data.error || "No se pudo registrar",
        });
      }
    } catch (err) {
      MySwal.fire({
        icon: "error",
        title: "Error de red",
        text: "No se pudo registrar el usuario",
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
        {!(rolLogueado === 4) && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Locales asignados</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-3 rounded-lg bg-gray-50">
              {locales.map((l) => (
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

        <button
          type="submit"
          disabled={loading}
          className={`px-6 py-3 rounded-lg shadow-md text-white font-semibold transition ${
            loading ? "bg-red-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {loading ? "Registrando..." : "Registrar usuario"}
        </button>
      </form>

      
    </div>
  );
}
