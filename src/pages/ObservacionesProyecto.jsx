import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { endpoint } from "../config/apiConfig";

const MySwal = withReactContent(Swal);

export default function ObservacionesProyecto() {
  const [form, setForm] = useState({
    cia: "",
    cef: "",
    fecha_observacion: new Date().toISOString().slice(0, 10),
    responsable: "",
    tipo_observacion: "",
    descripcion: "",
    accion_sugerida: "",
  });

  const [tipos, setTipos] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [comprimiendo, setComprimiendo] = useState(false);

  useEffect(() => {
    cargarTipos();
  }, []);

  const cargarTipos = async () => {
    try {
      const res = await axios.get(
        await endpoint("observaciones_tipos.php")
      );

      if (res.data.success) {
        setTipos(res.data.data || []);
      }
    } catch (error) {
      console.error("Error al cargar tipos:", error.message);
    }
  };

  const cambiarCampo = (campo, valor) => {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  const validar = () => {
    if (!form.cef.trim()) return "El CEF es obligatorio.";
    if (!form.fecha_observacion) return "La fecha es obligatoria.";
    if (!form.responsable.trim()) return "El responsable es obligatorio.";
    if (!form.tipo_observacion) return "El tipo de observación es obligatorio.";
    if (!form.descripcion.trim()) return "La descripción es obligatoria.";
    return null;
  };

  const comprimirImagen = (file) => {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        resolve(file);
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
          const maxWidth = 1280;
          const maxHeight = 1280;

          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("No se pudo comprimir la imagen."));
                return;
              }

              const nombreBase = file.name.replace(/\.[^/.]+$/, "");
              const archivoComprimido = new File(
                [blob],
                `${nombreBase}_comprimida.jpg`,
                {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                }
              );

              resolve(archivoComprimido);
            },
            "image/jpeg",
            0.55
          );
        };

        img.onerror = () => reject(new Error("No se pudo leer la imagen."));
        img.src = event.target.result;
      };

      reader.onerror = () => reject(new Error("No se pudo procesar el archivo."));
      reader.readAsDataURL(file);
    });
  };

  const guardarObservacion = async () => {
    const errorValidacion = validar();

    if (errorValidacion) {
      MySwal.fire("Faltan datos", errorValidacion, "warning");
      return;
    }

    const confirmacion = await MySwal.fire({
      title: "¿Guardar observación?",
      text: "La observación quedará registrada en el portal del proyecto.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#611232",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setGuardando(true);

      MySwal.fire({
        title: "Guardando...",
        text: "Por favor espera",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const payload = new FormData();
      payload.append("cia", form.cia);
      payload.append("cef", form.cef);
      payload.append("fecha_observacion", form.fecha_observacion);
      payload.append("responsable", form.responsable);
      payload.append("tipo_observacion", form.tipo_observacion);
      payload.append("descripcion", form.descripcion);
      payload.append("accion_sugerida", form.accion_sugerida);
      payload.append("usuario_creacion", localStorage.getItem("empleado") || "");

      if (archivo) {
        payload.append("evidencia", archivo);
      }

      const res = await axios.post(
        await endpoint("guardar_observacion_proyecto.php"),
        payload
      );

      Swal.close();

      if (!res.data.success) {
        throw new Error(res.data.error || "No se pudo guardar la observación.");
      }

      await MySwal.fire({
        title: "Observación guardada",
        text: "El registro fue almacenado correctamente.",
        icon: "success",
        confirmButtonColor: "#611232",
      });

      setForm({
        cia: "",
        cef: "",
        fecha_observacion: new Date().toISOString().slice(0, 10),
        responsable: "",
        tipo_observacion: "",
        descripcion: "",
        accion_sugerida: "",
      });

      setArchivo(null);

      const inputFile = document.getElementById("evidencia_observacion");
      if (inputFile) inputFile.value = "";
    } catch (error) {
      Swal.close();
      MySwal.fire("Error", error.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-[28px] shadow-[0_25px_70px_rgba(15,23,42,0.16)] border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#4a0d26] via-[#611232] to-[#7a1740] px-8 py-7">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <p className="text-white/70 text-xs font-black tracking-[0.24em] uppercase">

                </p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2">
                  Observaciones del Proyecto
                </h1>
                <p className="text-white/75 text-sm mt-2 max-w-2xl">
                  Registro formal de incidencias, hallazgos y acciones sugeridas durante el cierre de inventario.
                </p>
              </div>

              <div className="hidden md:flex items-center gap-3 rounded-2xl bg-white/10 border border-white/20 px-5 py-4">
                <img
                  src={`${process.env.PUBLIC_URL}/icons/icon-512.png`}
                  alt="SICAF"
                  className="w-12 h-12 rounded-xl shadow-md"
                />

                <div>
                  <p className="text-xs text-white/60 font-black tracking-[0.18em]">
                    SICAF
                  </p>
                  <p className="text-lg font-black text-white leading-none">
                    Inventarios
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-[0.18em] mb-2">
                  CIA
                </label>
                <select
                  value={form.cia}
                  onChange={(e) => cambiarCampo("cia", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm font-semibold outline-none transition focus:bg-white focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                >
                  <option value="">Selecciona CIA</option>
                  <option value="recrefam">RECREFAM</option>
                  <option value="veser">VESER</option>
                  <option value="opardiv">OPARDIV</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-[0.18em] mb-2">
                  CEF
                </label>
                <input
                  type="text"
                  value={form.cef}
                  onChange={(e) => cambiarCampo("cef", e.target.value.toUpperCase())}
                  placeholder="Ej. PTMUP"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm font-semibold outline-none transition focus:bg-white focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-[0.18em] mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={form.fecha_observacion}
                  onChange={(e) => cambiarCampo("fecha_observacion", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm font-semibold outline-none transition focus:bg-white focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-[0.18em] mb-2">
                  Responsable
                </label>
                <input
                  type="text"
                  value={form.responsable}
                  onChange={(e) => cambiarCampo("responsable", e.target.value.toUpperCase())}
                  placeholder="Ej. GO"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm font-semibold outline-none transition focus:bg-white focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 uppercase tracking-[0.18em] mb-2">
                  Tipo de observación
                </label>
                <select
                  value={form.tipo_observacion}
                  onChange={(e) => cambiarCampo("tipo_observacion", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm font-semibold outline-none transition focus:bg-white focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
                >
                  <option value="">Selecciona tipo</option>
                  {tipos.map((tipo) => (
                    <option key={tipo.id_tipo} value={tipo.nombre}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-black text-gray-700 uppercase tracking-[0.18em] mb-2">
                Descripción
              </label>
              <textarea
                value={form.descripcion}
                onChange={(e) => cambiarCampo("descripcion", e.target.value)}
                placeholder="Describe la observación detectada..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm outline-none resize-none transition focus:bg-white focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-black text-gray-700 uppercase tracking-[0.18em] mb-2">
                Acción sugerida
              </label>
              <textarea
                value={form.accion_sugerida}
                onChange={(e) => cambiarCampo("accion_sugerida", e.target.value)}
                placeholder="Indica la acción recomendada..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm outline-none resize-none transition focus:bg-white focus:border-[#611232] focus:ring-4 focus:ring-[#611232]/10"
              />
            </div>

            <div className="mb-8">
              <label className="block text-xs font-black text-gray-700 uppercase tracking-[0.18em] mb-2">
                Adjuntar evidencia opcional
              </label>

              <div className="flex flex-col md:flex-row md:items-center gap-4 rounded-xl border border-dashed border-[#611232]/25 bg-[#611232]/[0.03] p-4">
                <div className="w-11 h-11 rounded-xl bg-[#611232] text-white flex items-center justify-center text-xl shadow-md">
                  📎
                </div>

                <div className="flex-1">
                  <p className="text-sm font-black text-gray-900">
                    Evidencia de soporte
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Imagen, PDF, Excel o documento. Máximo 1 MB. Las imágenes se comprimen antes de guardar.
                  </p>
                </div>

                <input
                  id="evidencia_observacion"
                  type="file"
                  accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
                  onChange={async (e) => {
                      const file = e.target.files[0] || null;

                      if (!file) {
                        setArchivo(null);
                        return;
                      }

                      try {
                        setComprimiendo(true);

                        const archivoFinal = await comprimirImagen(file);

                        if (archivoFinal.size > 1024 * 1024) {
                          MySwal.fire(
                            "Archivo pesado",
                            "La evidencia sigue pesando más de 1 MB. Intenta con otra imagen.",
                            "warning"
                          );

                          setArchivo(null);
                          e.target.value = "";
                          return;
                        }

                        setArchivo(archivoFinal);
                      } catch (error) {
                        MySwal.fire("Error", error.message, "error");
                        setArchivo(null);
                        e.target.value = "";
                      } finally {
                        setComprimiendo(false);
                      }
                    }}
                  className="block w-full md:w-auto text-sm text-gray-600 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:bg-[#611232] file:text-white file:font-black hover:file:bg-[#4a0d26]"
                />
              </div>

              {comprimiendo && (
                <div className="mt-3 rounded-xl bg-yellow-50 border border-yellow-100 px-4 py-3 text-xs font-bold text-yellow-700">
                  Comprimiendo imagen...
                </div>
              )}

              {archivo && !comprimiendo && (
                <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs font-bold text-[#611232]">
                  Archivo listo: {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-gray-100 pt-6">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-[0.22em]">
                  Control · Operación · Evidencia
                </p>
                <p className="text-sm text-gray-500 mt-1">
                 La observación y su evidencia quedarán guardadas en base de datos.
                </p>
              </div>

              <button
                onClick={guardarObservacion}
                disabled={guardando || comprimiendo}
                className="px-8 py-3 rounded-xl bg-[#611232] text-white font-black shadow-[0_14px_35px_rgba(97,18,50,0.32)] hover:bg-[#4a0d26] hover:-translate-y-0.5 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Guardar observación
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
