import { useState, useEffect } from "react";
import axios from "axios";
import Select from "react-select";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [locales, setLocales] = useState([]);
  const [ciaSeleccionada, setCiaSeleccionada] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    empleado: "",
    nombre: "",
    password: "",
    locales: [],
    cia: "",
  });

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

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/admin/crear_usuario.php",
        form,
        { withCredentials: true }
      );
      if (res.data.success) {
        await MySwal.fire({
          icon: "success",
          title: "Usuario registrado",
          text: `El capturista ${form.nombre} fue creado correctamente.`,
          timer: 1800,
          showConfirmButton: false,
        });
        fetchUsuarios();
        setForm({ empleado: "", nombre: "", password: "", locales: [], cia: "" });
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

  const handleLocalesChange = (codigo) => {
    setForm((prev) => {
      const selected = prev.locales.includes(codigo)
        ? prev.locales.filter((l) => l !== codigo)
        : [...prev.locales, codigo];
      return { ...prev, locales: selected };
    });
  };

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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Usuarios</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6">
        <h2 className="font-semibold mb-3">Registrar Capturista</h2>

        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
            CIA a Capturar
          </label>
          <select
            value={ciaSeleccionada}
            onChange={async (e) => {
              const cia = e.target.value;
              setCiaSeleccionada(cia);
              setForm((prev) => ({ ...prev, cia, locales: [] }));
              if (cia) await fetchLocales(cia);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">-- Selecciona una CIA --</option>
            <option value="recrefam">RECREFAM</option>
            <option value="veser">VESER</option>
            <option value="opardiv">OPARDIV</option>
          </select>
        </div>

        <div className="mb-2">
          <label className="block text-sm font-medium">Empleado</label>
          <input
            type="text"
            value={form.empleado}
            onChange={(e) => setForm({ ...form, empleado: e.target.value })}
            className="border rounded px-3 py-1 w-full"
            required
          />
        </div>

        <div className="mb-2">
          <label className="block text-sm font-medium">Nombre</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="border rounded px-3 py-1 w-full"
            required
          />
        </div>

        <div className="mb-2">
          <label className="block text-sm font-medium">Contraseña</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border rounded px-3 py-1 w-full"
            required
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium">Locales asignados</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-2 rounded">
            {locales.map((l) => (
              <label key={l.codigo} className="flex items-center gap-2 text-sm">
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

        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${
            loading ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Registrando..." : "Registrar"}
        </button>
      </form>

      <h2 className="font-semibold mb-4 text-lg">Usuarios registrados</h2>
      <div className="overflow-auto rounded border border-gray-300 shadow-sm">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-blue-600 text-white uppercase tracking-wide text-xs">
            <tr>
              <th className="px-4 py-2">Empleado</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Locales asignados</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {usuarios.map((u, i) => (
              <tr key={i} className="hover:bg-blue-50 transition">
                <td className="px-4 py-2 font-mono text-blue-900">{u.empleado}</td>
                <td className="px-4 py-2 text-gray-800">{u.nombre}</td>
                <td className="px-4 py-2 text-gray-700">
                  {u.locales?.length > 0 ? (
                    u.locales.join(", ")
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {u.activo ? (
                    <span className="text-green-600 font-semibold">Activo</span>
                  ) : (
                    <span className="text-gray-500">Inactivo</span>
                  )}
                </td>
                <td className="px-4 py-2 flex gap-2">
                  <button
                    onClick={() => toggleActivo(u.id, u.activo)}
                    className={`px-3 py-1 rounded text-white text-xs ${
                      u.activo
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-400 hover:bg-gray-500"
                    }`}
                  >
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => eliminarUsuario(u.id)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
