import { Navigate } from "react-router-dom";

export default function RutaProtegida({ children, permitidos = [] }) {
  const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
  const idsRol = roles.map((r) => r.id);

  const tienePermiso = idsRol.some((id) => permitidos.includes(id));

  return tienePermiso ? children : <Navigate to="/login" />;
}
