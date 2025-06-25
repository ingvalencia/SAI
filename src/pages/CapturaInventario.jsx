import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

export default function CapturaInventario() {
  const [almacen, setAlmacen] = useState("");
  const [fecha, setFecha] = useState("");
  const [empleado, setEmpleado] = useState("");
  const [modo, setModo] = useState(null);
  const [datos, setDatos] = useState([]);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    setModo(null);
    setDatos([]);
    setBloqueado(false);
  }, [almacen, fecha, empleado]);

  const iniciarCaptura = async () => {
    if (!almacen || !fecha || !empleado) {
      MySwal.fire("Faltan datos", "Completa todos los campos", "warning");
      return;
    }

    try {
      const r1 = await axios.get("https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/control_carga_inventario.php", {
        params: { almacen, fecha, empleado },
      });

      if (!r1.data.success) throw new Error(r1.data.error);
      setModo(r1.data.modo);
      setBloqueado(r1.data.modo === "solo lectura");

      const r2 = await axios.get("https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/obtener_inventario.php", {
        params: { almacen, fecha, empleado },
      });

      if (!r2.data.success) throw new Error(r2.data.error);
      setDatos(r2.data.data);
    } catch (error) {
      MySwal.fire("Error", error.message, "error");
    }
  };

  const cambiarCantidad = (index, valor) => {
    const nuevo = [...datos];
    nuevo[index].cant_invfis = valor;
    setDatos(nuevo);
  };

  const confirmarInventario = async () => {
    const incompletos = datos.some(
      (item) =>
        item.cant_invfis === "" ||
        item.cant_invfis === null ||
        isNaN(parseFloat(item.cant_invfis)) ||
        parseFloat(item.cant_invfis) <= 0
    );

    if (incompletos) {
      MySwal.fire("Campos incompletos", "Todos los productos deben tener inventario físico capturado.", "warning");
      return;
    }

    const confirmacion = await MySwal.fire({
      title: "¿Confirmar inventario?",
      text: "Esta acción es irreversible. ¿Estás seguro?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const payload = new FormData();
      payload.append("almacen", almacen);
      payload.append("fecha", fecha);
      payload.append("empleado", empleado);
      payload.append("datos", JSON.stringify(datos));

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/confirmar_inventario.php",
        payload
      );

      if (!res.data.success) throw new Error(res.data.error);

      MySwal.fire("Confirmado", res.data.mensaje, "success");
      setBloqueado(true);
    } catch (error) {
      MySwal.fire("Error", error.message, "error");
    }
  };

  return (

    <div className="max-w-7xl mx-auto p-6">


      <h1 className="text-3xl font-bold mb-6 text-gray-800 flex items-center gap-2">
         Captura de Inventario Físico
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-end">
        <input
          type="text"
          placeholder="Almacén"
          value={almacen}
          onChange={(e) => setAlmacen(e.target.value)}
          className="border border-gray-300 rounded px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        />
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-gray-300 rounded px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        />
        <input
          type="number"
          placeholder="Empleado"
          value={empleado}
          onChange={(e) => setEmpleado(e.target.value)}
          className="border border-gray-300 rounded px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        />
        <button
          onClick={iniciarCaptura}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded shadow transition flex items-center gap-2 justify-center"
        >
           Iniciar captura
        </button>
      </div>

      {modo && (
        <div className="mt-8">
          <p className={`flex items-center gap-2 mb-4 text-lg font-medium ${bloqueado ? "text-red-600" : "text-green-600"}`}>
            {bloqueado ? "🔒 Modo: Solo lectura (otro usuario está capturando)" : "✍️ Modo: Edición habilitada"}
          </p>

          <div className="overflow-auto max-h-[70vh] border rounded-lg shadow-md">
            <table className="min-w-full text-sm table-auto">
              <thead className="sticky top-0 bg-gradient-to-r from-blue-100 via-white to-blue-100 text-gray-800 text-xs uppercase tracking-wider shadow-md z-10">
                <tr>
                  <th className="p-3 text-left w-10">#</th>
                  <th className="p-3 text-left">Familia</th>
                  <th className="p-3 text-left">Subfamilia</th>
                  <th className="p-3 text-left">Código</th>
                  <th className="p-3 text-left">Nombre</th>
                  <th className="p-3 text-left">Inventario Físico</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {datos.map((item, i) => {
                  const valor = item.cant_invfis;
                  const editado = parseFloat(valor) > 0;
                  const invalido = valor === "" || valor === null || isNaN(Number(valor)) || parseFloat(valor) <= 0;

                  return (
                    <tr key={i} className="hover:bg-blue-50 transition duration-150 ease-in-out">
                      <td className="p-3 text-sm text-gray-500 font-semibold whitespace-nowrap">{i + 1}</td>
                      <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.nom_fam}</td>
                      <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.nom_subfam}</td>
                      <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.ItemCode}</td>
                      <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{item.Itemname}</td>
                      <td className="p-3">
                        {bloqueado ? (
                          <span className="text-gray-600 text-sm font-medium">{valor}</span>
                        ) : (
                          <input
                            type="number"
                            className={`border rounded px-3 py-1 w-24 text-center text-sm font-semibold transition-all duration-200 ease-in-out ${editado ? "bg-green-100 border-green-500 ring-1 ring-green-200" : ""} ${invalido ? "bg-red-100 border-red-500 ring-1 ring-red-200 animate-pulse" : ""}`}
                            value={valor}
                            onChange={(e) => cambiarCantidad(i, e.target.value)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!bloqueado && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={confirmarInventario}
                className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition duration-200 ease-in-out transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                ✅ Confirmar inventario
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
