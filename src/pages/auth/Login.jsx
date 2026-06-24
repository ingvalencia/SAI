import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import logoDiniz from "../../assets/logo-diniz.png";
import logoDinizF from "../../assets/logo-diniz-transparente.png";

const Login = () => {
  const [empleado, setEmpleado] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/auth/login.php",
        { empleado, password }
      );

      if (res.data.success) {
        sessionStorage.setItem("empleado", res.data.empleado);
        sessionStorage.setItem("nombre", res.data.nombre);
        sessionStorage.setItem("roles", JSON.stringify(res.data.roles));
        sessionStorage.setItem("token_sesion", res.data.token_sesion);

        const roles = res.data.roles.map((r) => r.id);

        let destino = "";

        if (roles.includes(1) || roles.includes(2) || roles.includes(3)) {
          destino = "/admin";
        } else if (roles.includes(4)) {
          destino = "/captura";
        } else {
          setError("No tienes permisos asignados");
          setLoading(false);
          return;
        }

        setLoading(false);
        setLoginSuccess(true);

        setTimeout(() => {
          navigate(destino, { replace: true });
        }, 2300);

        return;
      } else {
        setError(res.data.error || "Credenciales incorrectas");
      }
    } catch (err) {
      setError("Error de red o servidor");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-[#611232] border-[#611232]/30 rounded-full animate-spin"></div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800">
                Validando credenciales
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Accediendo al sistema SICAF
              </p>
            </div>

            <div className="w-48 h-1 bg-gray-200 rounded overflow-hidden">
              <div className="h-full bg-[#611232] animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {loginSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#10070c] via-[#1d1418] to-[#111827] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(97,18,50,0.40),transparent_45%)]"></div>

          <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-[0.08]">
            <img
              src={logoDiniz}
              alt="Grupo Diniz"
              className="w-[360px] h-auto object-contain grayscale"
            />
          </div>

          <div className="absolute left-10 bottom-10 opacity-[0.08]">
            <img
              src={logoDiniz}
              alt="Grupo Diniz"
              className="w-[180px] h-auto object-contain grayscale"
            />
          </div>

          <div className="absolute w-[720px] h-[720px] rounded-full border border-white/5"></div>
          <div className="absolute w-[560px] h-[560px] rounded-full border border-[#611232]/20"></div>
          <div className="absolute w-[400px] h-[400px] rounded-full border border-white/10"></div>

          <div className="relative flex flex-col items-center justify-center text-center px-6">
            <div className="absolute w-[480px] h-[480px] rounded-full bg-[#611232]/30 blur-3xl"></div>

            <div className="relative w-[300px] h-[300px] rounded-full bg-white/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)] border border-white/70 flex items-center justify-center">
              <div className="absolute inset-4 rounded-full border border-[#611232]/20"></div>
              <div className="absolute inset-8 rounded-full border border-gray-200"></div>

              <div className="relative w-[215px] h-[215px] rounded-full bg-gradient-to-br from-white to-gray-100 shadow-2xl flex items-center justify-center p-3">
                <img
                  src={`${process.env.PUBLIC_URL}/icons/icon-512.png`}
                  alt="SICAF"
                  className="w-full h-full object-contain rounded-full drop-shadow-xl"
                />
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-5xl font-extrabold tracking-[0.18em] text-white drop-shadow-lg">
                SICAF
              </h2>

              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="w-12 h-[2px] bg-[#611232]"></span>
                <p className="text-sm font-semibold text-gray-300 uppercase tracking-[0.35em]">
                  Acceso autorizado
                </p>
                <span className="w-12 h-[2px] bg-[#611232]"></span>
              </div>
            </div>

            <div className="mt-9 w-[520px] max-w-[90vw] bg-white/10 border border-white/10 rounded-2xl px-10 py-7 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="flex items-center justify-center gap-6">
                <div className="w-16 h-16 rounded-full bg-[#611232]/80 flex items-center justify-center shadow-lg">
                  <span className="text-white text-4xl leading-none">✓</span>
                </div>

                <div className="text-left">
                  <h3 className="text-white text-2xl font-bold">
                    Bienvenido al sistema
                  </h3>
                  <p className="text-gray-300 text-sm mt-1">
                    Preparando entorno corporativo de inventarios
                  </p>
                </div>
              </div>

              <div className="mt-7 w-full h-1 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-gradient-to-r from-[#611232] via-white to-[#611232] rounded-full animate-pulse"></div>
              </div>
            </div>

            <div className="mt-7 flex items-center gap-3 opacity-80">

              <span className="text-gray-400 text-xs tracking-[0.25em] uppercase">
                Grupo Diniz
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="hidden md:flex flex-col items-center justify-center text-white px-12 relative overflow-hidden bg-gradient-to-br from-[#0b0508] via-[#1a1014] to-[#111827]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(97,18,50,0.42),transparent_46%)]"></div>

        <div className="absolute inset-0 opacity-[0.08]">
          <div className="absolute left-[-120px] top-1/2 -translate-y-1/2 w-[520px] h-[520px] border-[2px] border-white/30 rotate-45"></div>
          <div className="absolute left-[-70px] top-1/2 -translate-y-1/2 w-[360px] h-[360px] border-[2px] border-white/20 rotate-45"></div>
          <div className="absolute right-[-160px] top-1/2 -translate-y-1/2 w-[560px] h-[560px] border-[2px] border-white/20 rotate-45"></div>
          <div className="absolute right-[-90px] top-1/2 -translate-y-1/2 w-[380px] h-[380px] border-[2px] border-white/10 rotate-45"></div>
        </div>

        <div className="absolute inset-0 opacity-[0.10]">
          <div className="absolute top-24 left-24 grid grid-cols-8 gap-3">
            {Array.from({ length: 48 }).map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-white"></span>
            ))}
          </div>

          <div className="absolute bottom-24 right-24 grid grid-cols-8 gap-3">
            {Array.from({ length: 48 }).map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-white"></span>
            ))}
          </div>
        </div>

        <div className="absolute w-[720px] h-[720px] rounded-full border border-white/5"></div>
        <div className="absolute w-[540px] h-[540px] rounded-full border border-[#611232]/25"></div>
        <div className="absolute w-[380px] h-[380px] rounded-full border border-white/10"></div>
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[#611232]/20 blur-3xl"></div>

        <div className="relative max-w-md text-center">
          <div className="relative mx-auto mb-10 w-52 h-52 flex items-center justify-center">
  <div className="absolute inset-0 rounded-full bg-[#611232]/30 blur-3xl animate-pulse"></div>

  <div className="absolute inset-2 rounded-full border border-white/20"></div>
  <div className="absolute inset-[-10px] rounded-full border border-white/10"></div>

  <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.75),transparent,rgba(97,18,50,0.65),transparent)] animate-[sicafOrbit_10s_linear_infinite]"></div>

  <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-[#ffffff] via-[#f8f8f8] to-[#e8e8e8] shadow-[0_35px_90px_rgba(0,0,0,0.55)] border border-white/80"></div>

  <div className="absolute inset-[18px] rounded-full border border-[#611232]/15"></div>
  <div className="absolute inset-[30px] rounded-full border border-gray-200/80"></div>

  <div className="absolute top-5 left-14 w-2 h-2 rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.9)] animate-[sicafSpark_3s_ease-in-out_infinite]"></div>
  <div className="absolute bottom-8 right-12 w-1.5 h-1.5 rounded-full bg-white/70 shadow-[0_0_16px_rgba(255,255,255,0.8)] animate-[sicafSpark_4s_ease-in-out_infinite]"></div>
  <div className="absolute top-16 right-5 w-1 h-1 rounded-full bg-white/60 shadow-[0_0_14px_rgba(255,255,255,0.7)] animate-[sicafSpark_5s_ease-in-out_infinite]"></div>

  <div className="relative w-40 h-40 rounded-full bg-white flex items-center justify-center p-3 overflow-hidden shadow-[inset_0_0_20px_rgba(97,18,50,0.08)]">
    <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-[#611232]/10"></div>

    <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.95)_45%,transparent_70%)] translate-x-[-140%] animate-[sicafLuxuryShine_5s_ease-in-out_infinite]"></div>

              <img
                src={`${process.env.PUBLIC_URL}/icons/icon-512.png`}
                alt="SICAF"
                className="relative z-10 w-full h-full object-contain rounded-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.32)] animate-[sicafLogoFloat_4s_ease-in-out_infinite]"
              />
            </div>

            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-3 bg-black/30 blur-xl rounded-full"></div>

            <style>
              {`
                @keyframes sicafOrbit {
                  0% {
                    transform: rotate(0deg);
                    opacity: 0.85;
                  }
                  50% {
                    opacity: 1;
                  }
                  100% {
                    transform: rotate(360deg);
                    opacity: 0.85;
                  }
                }

                @keyframes sicafLuxuryShine {
                  0% {
                    transform: translateX(-140%) skewX(-18deg);
                    opacity: 0;
                  }
                  18% {
                    opacity: 0;
                  }
                  45% {
                    opacity: 0.9;
                  }
                  72% {
                    opacity: 0;
                  }
                  100% {
                    transform: translateX(140%) skewX(-18deg);
                    opacity: 0;
                  }
                }

                @keyframes sicafLogoFloat {
                  0%, 100% {
                    transform: translateY(0) scale(1);
                    filter: brightness(1) contrast(1);
                  }
                  50% {
                    transform: translateY(-3px) scale(1.035);
                    filter: brightness(1.14) contrast(1.05);
                  }
                }

                @keyframes sicafSpark {
                  0%, 100% {
                    opacity: 0.25;
                    transform: scale(0.8);
                  }
                  50% {
                    opacity: 1;
                    transform: scale(1.25);
                  }
                }
              `}
            </style>
          </div>

          <h1 className="text-6xl font-extrabold tracking-tight mb-6"></h1><div className="relative mb-6">
            <h1 className="relative z-10 text-7xl font-black tracking-[0.18em] text-white drop-shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
              SICAF
            </h1>

            <div className="absolute inset-0 text-7xl font-black tracking-[0.18em] text-[#611232] blur-xl opacity-70">
              SICAF
            </div>

            <div className="absolute inset-0 overflow-hidden">
              <div className="h-full w-24 bg-gradient-to-r from-transparent via-white/80 to-transparent -skew-x-12 animate-[sicafTextShine_4s_ease-in-out_infinite]"></div>
            </div>

            <style>
              {`
                @keyframes sicafTextShine {
                  0% {
                    transform: translateX(-180%) skewX(-12deg);
                    opacity: 0;
                  }
                  35% {
                    opacity: 0;
                  }
                  55% {
                    opacity: 0.9;
                  }
                  100% {
                    transform: translateX(520%) skewX(-12deg);
                    opacity: 0;
                  }
                }
              `}
            </style>
          </div>

          <h2 className="text-xl font-semibold mb-4 text-gray-200">
            Sistema de Captura de Inventarios Físicos
          </h2>

          <p className="text-gray-300 leading-relaxed text-sm">
            Plataforma corporativa para la gestión de inventarios físicos,
            diseñada para capturas rápidas, control de conteos y conciliación
            contra SAP en tiempo real.
          </p>

          <div className="mt-10 border-t border-white/20 pt-4 text-xs text-gray-300">
            <p>Versión 1.2</p>
            <p>GRUPO DINIZ · ÁREA DE TI · DESARROLLO SAP</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-[#f3f4f6] px-6 py-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(97,18,50,0.08)_0%,transparent_35%,rgba(17,24,39,0.08)_100%)]"></div>

        <div className="absolute top-[-180px] right-[-160px] w-[520px] h-[520px] rounded-full bg-[#611232]/10 blur-3xl"></div>
        <div className="absolute bottom-[-160px] left-[-140px] w-[420px] h-[420px] rounded-full bg-gray-900/10 blur-3xl"></div>

        <div className="absolute inset-0 opacity-[0.18]">
          <div className="absolute top-20 right-20 w-[260px] h-[260px] border border-[#611232]/20 rotate-45"></div>
          <div className="absolute top-32 right-36 w-[160px] h-[160px] border border-gray-900/10 rotate-45"></div>
          <div className="absolute bottom-24 left-24 w-[220px] h-[220px] border border-[#611232]/10 rotate-45"></div>
        </div>

        <div className="relative w-full max-w-md">
          <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-[#611232]/20 via-white/60 to-gray-900/10 blur-2xl"></div>

          <div className="relative bg-white/80 backdrop-blur-2xl shadow-[0_40px_120px_rgba(15,23,42,0.22)] rounded-[2rem] w-full p-10 border border-white/80">
            <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#611232]/40 to-transparent"></div>

            <div className="flex justify-center mb-9">
              <div className="relative group w-52 h-36 flex items-center justify-center">
                <div className="absolute inset-0 rounded-[2rem] bg-[#611232]/10 blur-2xl group-hover:bg-[#611232]/20 transition-all duration-500"></div>

                <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-r from-transparent via-[#611232]/35 to-transparent opacity-70 blur-sm animate-[dinizGlow_4s_ease-in-out_infinite]"></div>

                <div className="relative z-10 flex items-center justify-center">
                  <img
                    src={logoDinizF}
                    alt="Grupo Diniz"
                    className="w-44 h-auto object-contain mix-blend-multiply drop-shadow-[0_12px_22px_rgba(0,0,0,0.20)] transition-all duration-500 group-hover:scale-[1.04] group-hover:brightness-110"
                  />
                </div>

                <style>
                  {`
                    @keyframes dinizGlow {
                      0%, 100% {
                        transform: translateX(-20%);
                        opacity: 0.25;
                      }
                      50% {
                        transform: translateX(20%);
                        opacity: 0.75;
                      }
                    }
                  `}
                </style>
              </div>
            </div>

            <div className="text-center mb-9">
              <div className="mx-auto mb-5 w-16 h-1 rounded-full bg-gradient-to-r from-transparent via-[#611232] to-transparent"></div>

              <h2 className="text-4xl font-black text-gray-950 tracking-tight">
                Iniciar sesión
              </h2>

              <p className="text-sm text-gray-500 mt-3 font-medium">
                Acceso corporativo al sistema SICAF
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-gray-800 text-sm font-bold mb-2">
                  Número de empleado
                </label>
                <input
                  type="text"
                  value={empleado}
                  onChange={(e) => setEmpleado(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#611232]/10 focus:border-[#611232] text-gray-900 transition-all bg-white/90 shadow-sm"
                  placeholder="Ej. 12345"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-800 text-sm font-bold mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#611232]/10 focus:border-[#611232] text-gray-900 transition-all bg-white/90 shadow-sm"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-700 text-center font-semibold bg-red-50 border border-red-100 rounded-2xl py-3 px-4 shadow-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="relative group w-full overflow-hidden bg-[#611232] text-white font-extrabold py-4 rounded-2xl transition-all duration-300 shadow-[0_18px_45px_rgba(97,18,50,0.35)] hover:shadow-[0_24px_60px_rgba(97,18,50,0.48)] hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-[#3d0b20] via-[#611232] to-[#8a1b48]"></span>
                <span className="absolute inset-0 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent"></span>

                <span className="relative z-10 tracking-wide">
                  Entrar al sistema
                </span>
              </button>
            </form>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => navigate("/observaciones")}
                className="w-full px-6 py-3 rounded-xl border border-[#611232]/20 bg-white text-[#611232] font-black shadow-sm hover:bg-[#611232]/5 hover:-translate-y-0.5 transition-all"
              >
                💬 Observaciones y sugerencias
              </button>

              <p className="text-center text-xs text-gray-400 mt-3">
                Comparte comentarios, incidencias o sugerencias del proyecto SICAF.
              </p>
            </div>

            <div className="mt-10 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center gap-3">
                <span className="w-10 h-[1px] bg-gray-300"></span>
                <p className="text-center text-xs text-gray-500 font-medium">
                  © {new Date().getFullYear()} SICAF
                </p>
                <span className="w-10 h-[1px] bg-gray-300"></span>
              </div>

              <p className="text-center text-[10px] text-gray-400 mt-2 tracking-[0.28em] uppercase">
                Grupo Diniz · Tecnología e Inventarios
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
