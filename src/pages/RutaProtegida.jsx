import { Navigate } from "react-router-dom";

export default function RutaProtegida({ children, permitidos = [] }) {
  let roles = [];

  try {
    roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
  } catch {
    roles = [];
  }

  const idsRol = roles
    .map((r) => {
      if (typeof r === "number" || typeof r === "string") {
        return Number(r);
      }

      if (r && typeof r === "object") {
        return Number(r.id || r.rol_id || r.role_id);
      }

      return null;
    })
    .filter((id) => Number.isFinite(id));

  const permisosNormalizados = permitidos.map((id) => Number(id));

  const tienePermiso = idsRol.some((id) => permisosNormalizados.includes(id));

  if (!tienePermiso) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
