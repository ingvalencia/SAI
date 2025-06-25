import React, { useState } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import * as XLSX from "xlsx";

const MySwal = withReactContent(Swal);

const dataPrueba = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  nombre: `Elemento ${i + 1}`,
}));

export default function Dashboard() {
  const [pagina, setPagina] = useState(1);
  const porPagina = 5;

  const totalPaginas = Math.ceil(dataPrueba.length / porPagina);
  const datosPaginados = dataPrueba.slice((pagina - 1) * porPagina, pagina * porPagina);

  const exportarExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(dataPrueba);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    XLSX.writeFile(workbook, "datos_sai.xlsx");
  };

  const mostrarAlerta = () => {
    MySwal.fire({
      title: "Bienvenido a SAI",
      text: "Todo está funcionando correctamente 🚀",
      icon: "success",
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Dashboard de prueba</h1>

      <div className="mb-4 flex gap-2">
        <button onClick={mostrarAlerta} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Mostrar Alerta
        </button>

        <button onClick={exportarExcel} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Exportar a Excel
        </button>
      </div>

      <ul className="bg-white shadow rounded divide-y">
        {datosPaginados.map((item) => (
          <li key={item.id} className="p-3 hover:bg-gray-100">
            {item.nombre}
          </li>
        ))}
      </ul>

      <div className="flex justify-center mt-4 space-x-2">
        {Array.from({ length: totalPaginas }, (_, i) => (
          <button
            key={i}
            className={`px-3 py-1 border rounded ${
              pagina === i + 1 ? "bg-blue-500 text-white" : "bg-white"
            }`}
            onClick={() => setPagina(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
