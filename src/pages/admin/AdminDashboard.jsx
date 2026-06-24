import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import ObservacionesProyecto from "../ObservacionesProyecto";
import ConsultaObservacionesProyecto from "../ConsultaObservacionesProyecto";
import EstadisticasInventario from "../EstadisticasInventario";
import EstadisticasObservaciones from "../EstadisticasObservaciones";
import Control from "./Control";
import Mapa from "./Mapa";
import Usuarios from "./Usuarios";
import MonitorTecnicoConteos from "./MonitorTecnicoConteos";

export default function AdminDashboard() {
  const [vista, setVista] = useState("inicio");
  const [collapsed, setCollapsed] = useState(false);
  const [esMovilAdmin, setEsMovilAdmin] = useState(false);

  const obtenerRolesUsuario = () => {
    const rolesSession = sessionStorage.getItem("roles");
    const rolesLocal = localStorage.getItem("roles");
    const rolSession = sessionStorage.getItem("rol");
    const rolLocal = localStorage.getItem("rol");
    const rolIdSession = sessionStorage.getItem("rol_id");
    const rolIdLocal = localStorage.getItem("rol_id");

    const valorRoles =
      rolesSession ||
      rolesLocal ||
      rolSession ||
      rolLocal ||
      rolIdSession ||
      rolIdLocal ||
      "[]";

    try {
      const parsed = JSON.parse(valorRoles);

      if (Array.isArray(parsed)) {
        return parsed
          .map((rol) => {
            if (typeof rol === "object" && rol !== null) {
              return Number(rol.id || rol.rol_id || rol.role_id || rol);
            }

            return Number(rol);
          })
          .filter((rol) => !Number.isNaN(rol));
      }

      if (typeof parsed === "object" && parsed !== null) {
        return [Number(parsed.id || parsed.rol_id || parsed.role_id)].filter(
          (rol) => !Number.isNaN(rol)
        );
      }

      return [Number(parsed)].filter((rol) => !Number.isNaN(rol));
    } catch {
      return valorRoles
        .split(",")
        .map((rol) => Number(rol.trim()))
        .filter((rol) => !Number.isNaN(rol));
    }
  };

  const rolesUsuario = obtenerRolesUsuario();
  const puedeVerExtras = rolesUsuario.includes(1) || rolesUsuario.includes(2);

  const empleadoSesion =
    sessionStorage.getItem("empleado") ||
    localStorage.getItem("empleado") ||
    "";

  const puedeVerMonitorTecnico = empleadoSesion === "0000";

  useEffect(() => {
    const vistasRestringidas = [
      "herramientas",
      "consulta_observaciones",
      "estadisticas_observaciones",
      "estadisticas",
    ];

    if (!puedeVerMonitorTecnico && vista === "monitor_tecnico") {
      setVista("inicio");
      return;
    }

    if (!puedeVerExtras && vistasRestringidas.includes(vista)) {
      setVista("inicio");
    }
  }, [vista, puedeVerExtras, puedeVerMonitorTecnico]);

  useEffect(() => {
    const validarDispositivoAdmin = () => {
      const esMovil =
        /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ||
        window.innerWidth < 768;

      setEsMovilAdmin(esMovil);

      if (esMovil && !sessionStorage.getItem("avisoMovilAdmin")) {
        sessionStorage.setItem("avisoMovilAdmin", "1");

        Swal.fire({
          icon: "warning",
          title: "Vista recomendada en laptop",
          html: `
            <p>La vista de administrador está diseñada para usarse en laptop o computadora.</p>
            <p style="margin-top:8px;">En móvil puede verse limitada por tablas, filtros, reportes y botones administrativos.</p>
          `,
          confirmButtonText: "Entendido",
          confirmButtonColor: "#611232",
        });
      }
    };

    validarDispositivoAdmin();

    window.addEventListener("resize", validarDispositivoAdmin);

    return () => {
      window.removeEventListener("resize", validarDispositivoAdmin);
    };
  }, []);

  const menuPrincipal = [
    { id: "usuarios", label: "Usuarios y permisos", icon: "👥" },
    { id: "control", label: "Control de operaciones", icon: "⚙️" },
    { id: "mapa", label: "Mapa de operaciones", icon: "🗺️" },
    ...(puedeVerMonitorTecnico
      ? [{ id: "monitor_tecnico", label: "Monitor técnico", icon: "🛠️" }]
      : []),
  ];

  const menuSecundario = [
    { id: "observaciones", label: "Observaciones", icon: "📝" },
    ...(puedeVerExtras
      ? [{ id: "herramientas", label: "Herramientas", icon: "🧰" }]
      : []),
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <aside
        className={`relative overflow-hidden bg-gradient-to-br from-[#0b0508] via-[#3d0b20] to-[#611232] text-white transition-all duration-300 ease-in-out shadow-2xl flex flex-col
        ${collapsed ? "w-20" : "w-72"}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%)]"></div>

        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <div className="absolute left-[-120px] top-24 w-[320px] h-[320px] border border-white/40 rotate-45"></div>
          <div className="absolute right-[-130px] bottom-20 w-[360px] h-[360px] border border-white/30 rotate-45"></div>
          <div className="absolute left-16 top-44 w-[220px] h-[220px] rounded-full border border-white/25"></div>
        </div>

        <div className="absolute inset-0 opacity-[0.10] pointer-events-none">
          <div className="absolute top-20 left-10 grid grid-cols-6 gap-2">
            {Array.from({ length: 36 }).map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-white"></span>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between px-4 h-16 border-b border-white/20">
            {!collapsed && (
              <div>
                <h2 className="text-lg font-bold tracking-wide">SICAF</h2>
                <p className="text-xs text-white/70">Administrador</p>
              </div>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="relative w-10 h-10 flex items-center justify-center group"
            >
              <div className="w-6 flex flex-col gap-1">
                <span
                  className={`block h-0.5 bg-white transition-all duration-300
                ${collapsed ? "rotate-45 translate-y-1.5" : ""}`}
                ></span>

                <span
                  className={`block h-0.5 bg-white transition-all duration-300
                ${collapsed ? "opacity-0" : ""}`}
                ></span>

                <span
                  className={`block h-0.5 bg-white transition-all duration-300
                ${collapsed ? "-rotate-45 -translate-y-1.5" : ""}`}
                ></span>
              </div>
            </button>
          </div>

          <nav className="mt-6 flex-1 px-2">
            <div className="space-y-2">
              <div className="mb-6 pb-6 border-b border-white/20">
                {!collapsed && (
                  <p className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    Acceso general
                  </p>
                )}

                <a
                  href="https://diniz.com.mx/diniz/generacion-codigos/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-white text-[#611232] shadow-lg hover:scale-[1.02]"
                >
                  <span className="text-xl">🏷️</span>

                  {!collapsed && (
                    <span className="whitespace-nowrap">
                      Generar códigos de barras
                    </span>
                  )}

                  {collapsed && (
                    <span className="absolute left-20 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50">
                      Generar códigos de barras
                    </span>
                  )}
                </a>
              </div>

              {menuPrincipal.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setVista(item.id)}
                  className={`group flex items-center gap-4 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${
                    vista === item.id
                      ? "bg-white text-[#611232] shadow-lg"
                      : "hover:bg-white/10 text-white/90"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>

                  {!collapsed && (
                    <span className="whitespace-nowrap">{item.label}</span>
                  )}

                  {collapsed && (
                    <span className="absolute left-20 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50">
                      {item.label}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-white/20 space-y-2">
              {!collapsed && (
                <p className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Extras
                </p>
              )}

              {menuSecundario.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "herramientas" && vista === "herramientas") {
                      setVista("inicio");
                    } else {
                      setVista(item.id);
                    }
                  }}
                  className={`group flex items-center gap-4 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${
                    vista === item.id
                      ? "bg-white text-[#611232] shadow-lg"
                      : "hover:bg-white/10 text-white/90"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>

                  {!collapsed && (
                    <span className="whitespace-nowrap">{item.label}</span>
                  )}

                  {collapsed && (
                    <span className="absolute left-20 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50">
                      {item.label}
                    </span>
                  )}
                </button>
              ))}

              {puedeVerExtras && vista === "herramientas" && !collapsed && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl bg-white/10 border border-white/15 p-3 shadow-inner">
                    <p className="text-xs text-white/60 font-bold uppercase tracking-[0.18em] mb-3 px-2">
                      Consultas y estadísticas
                    </p>

                    <button
                      onClick={() => setVista("consulta_observaciones")}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-white text-[#611232] shadow-lg hover:scale-[1.02] transition-all"
                    >
                      <span className="text-xl">📊</span>
                      <span className="whitespace-nowrap">
                        Consultar observaciones
                      </span>
                    </button>

                    <button
                      onClick={() => setVista("estadisticas_observaciones")}
                      className="mt-3 flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-white text-[#611232] shadow-lg hover:scale-[1.02] transition-all"
                    >
                      <span className="text-xl">📈</span>
                      <span className="whitespace-nowrap">
                        Estadísticas observaciones
                      </span>
                    </button>

                    <button
                      onClick={() => setVista("estadisticas")}
                      className="mt-3 flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-white text-[#611232] shadow-lg hover:scale-[1.02] transition-all"
                    >
                      <span className="text-xl">📉</span>
                      <span className="whitespace-nowrap">
                        Estadísticas inventario
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {!collapsed && (
            <div className="p-4 border-t border-white/20 text-xs text-white/70 text-center">
              © {new Date().getFullYear()} SICAF
            </div>
          )}
        </div>
      </aside>

      <main
        className={`flex-1 overflow-y-auto transition-all duration-300
        ${collapsed ? "p-6" : "p-10"}`}
      >
        {esMovilAdmin && (
          <div className="mb-4 rounded-xl border border-yellow-400 bg-yellow-100 px-4 py-3 text-center text-sm font-bold text-yellow-900 shadow-sm">
            ⚠ La experiencia del administrador está optimizada para laptop o computadora.
          </div>
        )}

        {vista === "inicio" && (
          <div className="min-h-full flex items-center justify-center px-2 py-6">
            <div className="relative overflow-hidden max-w-6xl w-full rounded-[2.5rem] bg-[#f8fafc] border border-white shadow-[0_40px_120px_rgba(15,23,42,0.22)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(97,18,50,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.12),transparent_36%)]"></div>

              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#3d0b20] via-[#611232] to-[#9f2241]"></div>

              <div className="absolute -top-28 -right-28 w-96 h-96 rounded-full bg-[#611232]/10 blur-3xl"></div>
              <div className="absolute -bottom-32 -left-32 w-[26rem] h-[26rem] rounded-full bg-slate-900/10 blur-3xl"></div>

              <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
                <div className="absolute left-10 top-16 grid grid-cols-10 gap-3">
                  {Array.from({ length: 90 }).map((_, i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-[#611232]"></span>
                  ))}
                </div>
              </div>

              <div className="relative p-8 md:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
                  <div className="text-left">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white border border-[#611232]/10 shadow-sm mb-6">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[11px] font-black tracking-[0.24em] uppercase text-[#611232]">
                        Panel administrativo
                      </span>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-black text-slate-950 tracking-tight leading-[1.02] mb-5">
                      Administrador
                      <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#611232] via-[#8a1b48] to-[#9f2241]">
                        SICAF
                      </span>
                    </h1>

                    <div className="w-28 h-1.5 bg-gradient-to-r from-[#611232] to-[#9f2241] rounded-full mb-7"></div>

                    <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-4">
                      Sistema de Captura de Inventarios Físicos
                    </h2>

                    <p className="text-slate-600 leading-relaxed max-w-2xl text-base md:text-lg">
                      Plataforma centralizada para supervisar operaciones de inventario,
                      gestionar capturistas, controlar avances, validar conteos y dar
                      seguimiento operativo dentro del sistema.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <div className="px-4 py-2 rounded-full bg-[#611232]/10 text-[#611232] text-xs font-black tracking-wide">
                        CONTROL OPERATIVO
                      </div>
                      <div className="px-4 py-2 rounded-full bg-slate-900/10 text-slate-800 text-xs font-black tracking-wide">
                        CONCILIACIÓN SAP
                      </div>
                      <div className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black tracking-wide">
                        SEGUIMIENTO EN TIEMPO REAL
                      </div>
                    </div>
                  </div>

                  <div className="relative flex justify-center lg:justify-end">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-72 h-72 rounded-full bg-[#611232]/10 blur-3xl"></div>
                    </div>

                    <div className="relative w-full max-w-sm rounded-[2.2rem] bg-gradient-to-br from-[#0b0508] via-[#3d0b20] to-[#611232] p-6 shadow-[0_35px_90px_rgba(97,18,50,0.38)] border border-white/15">
                      <div className="absolute inset-0 rounded-[2.2rem] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_38%)]"></div>

                      <div className="relative">
                        <div className="mx-auto mb-6 relative w-32 h-32">
                          <div className="absolute inset-0 rounded-[2.2rem] bg-white/20 blur-2xl scale-110"></div>

                          <div className="relative w-32 h-32 rounded-[2.2rem] bg-white flex items-center justify-center shadow-[0_24px_70px_rgba(0,0,0,0.35)] border border-white/70">
                            <img
                              src={`${process.env.PUBLIC_URL}/icons/icon-512.png`}
                              alt="SICAF"
                              className="w-24 h-24 rounded-3xl shadow-md object-cover"
                            />
                          </div>
                        </div>

                        <div className="text-center">
                          <p className="text-white/60 text-[11px] font-black tracking-[0.24em] uppercase mb-2">
                            Versión actual
                          </p>

                          <p className="text-5xl font-black text-white leading-none">
                            v1.2
                          </p>

                          <p className="text-white/70 text-sm mt-4 leading-relaxed">
                            Actualización con observaciones, herramientas administrativas
                            y mejoras de operación.
                          </p>
                        </div>

                        <div className="mt-7 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-center">
                            <p className="text-2xl font-black text-white">SAP</p>
                            <p className="text-[10px] text-white/60 font-black tracking-[0.18em] mt-1">
                              INTEGRACIÓN
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-center">
                            <p className="text-2xl font-black text-white">TI</p>
                            <p className="text-[10px] text-white/60 font-black tracking-[0.18em] mt-1">
                              SOPORTE
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
                    <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-[#611232]/8"></div>
                    <p className="text-3xl font-black text-[#611232]">v1.2</p>
                    <p className="text-xs text-slate-500 mt-2 tracking-[0.18em] font-black uppercase">
                      Versión del sistema
                    </p>
                  </div>

                  <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
                    <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-slate-900/8"></div>
                    <p className="text-lg font-black text-slate-950 tracking-wide">
                      Área de TI
                    </p>
                    <p className="text-xs text-slate-500 mt-3 tracking-[0.18em] font-black uppercase">
                      Desarrollo SAP
                    </p>
                  </div>

                  <div className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
                    <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/10"></div>
                    <p className="text-lg font-black text-slate-950 tracking-wide">
                      Grupo Diniz
                    </p>
                    <p className="text-xs text-slate-500 mt-3 tracking-[0.18em] font-black uppercase">
                      Inventarios físicos
                    </p>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-slate-200 text-center">
                  <p className="text-xs text-slate-400 tracking-[0.28em] uppercase font-bold">
                    Control · Operación · Conciliación SAP · Observaciones
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {vista === "usuarios" && <Usuarios />}
        {vista === "control" && <Control />}
        {vista === "mapa" && <Mapa drawerRootId="drawer-root" />}
        {puedeVerMonitorTecnico && vista === "monitor_tecnico" && (
          <MonitorTecnicoConteos />
        )}
        {vista === "observaciones" && <ObservacionesProyecto />}
        {puedeVerExtras && vista === "consulta_observaciones" && (
          <ConsultaObservacionesProyecto />
        )}
        {puedeVerExtras && vista === "estadisticas_observaciones" && (
          <EstadisticasObservaciones />
        )}
        {puedeVerExtras && vista === "estadisticas" && (
          <EstadisticasInventario />
        )}
      </main>

      <div id="drawer-root"></div>
    </div>
  );
}
