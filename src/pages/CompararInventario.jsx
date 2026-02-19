import React, { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts.vfs;


export default function CompararInventario() {
  const location = useLocation();
  const navigate = useNavigate();
  const { almacen, fecha, cia } = location.state || {};


  const [datos, setDatos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [diferenciaConfirmada, setDiferenciaConfirmada] = useState(false);
  const empleado = sessionStorage.getItem("empleado");

  const { estatus: estatusRuta } = location.state || {};
  const [estatus, setEstatus] = useState(estatusRuta || 1);

  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 100;

  const [mostrarSoloDiferencias, setMostrarSoloDiferencias] = useState(false);
  const [mostrarDiferenciasBrigada, setMostrarDiferenciasBrigada] = useState(false);
  const [esBrigada, setEsBrigada] = useState(false);
  const [mostrarTercerConteo, setMostrarTercerConteo] = useState(false);
  const [resGlobal, setResGlobal] = useState({});
  const [hayDiferenciasBrigada, setHayDiferenciasBrigada] = useState(false);
  const [empleadoCompanero, setEmpleadoCompanero] = useState(null);
  const [miEmpleado, setMiEmpleado] = useState(empleado);
  const [nroConteoMio, setNroConteoMio] = useState(1);
  const [nroConteoComp, setNroConteoComp] = useState(2);
  const [bloqueado, setBloqueado] = useState(false);
  const [mostrarCuartoConteo, setMostrarCuartoConteo] = useState(false);
  const [modoResuelto, setModoResuelto] = useState(false);
  const [conteoBase, setConteoBase] = useState(null);


 const exportarExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Diferencias");

    const headers = [
      "#", "No Empleado", "Almacén", "CIA", "Código", "Nombre",
      "Código de Barras", "Captura SAP", "Conteo 1", "Conteo 2", "Conteo 3", "Conteo 4", "Diferencia"
    ];

    worksheet.addRow(headers);

    headers.forEach((_, idx) => {
      const cell = worksheet.getRow(1).getCell(idx + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "CC0000" },
      };
      cell.font = {
        color: { argb: "FFFFFF" },
        bold: true,
      };
    });

    datos.forEach((item, i) => {
      const conteo1 = item.conteo1 ?? 0;
      const conteo2 = item.conteo2 ?? 0;
      const conteo3 = item.conteo3 ?? 0;
      const conteo4 = item.conteo4 ?? 0;
      const sap = item.cant_sap ?? 0;

      const conteoActual =
        estatusCalc === 7 ? conteo4 :
        estatusCalc === 3 ? conteo3 :
        estatusCalc === 2 ? conteo2 :
        conteo1;


      const diferencia = parseFloat((sap - conteoActual).toFixed(2));

      const row = worksheet.addRow([
        i + 1,
        item.usuario,
        item.almacen,
        item.cias,
        item.ItemCode,
        item.Itemname ,
        item.codebars,
        sap,
        conteo1,
        conteo2,
        conteo3,
        conteo4,
        diferencia,
      ]);


      if (diferencia < 0) {
        const diffCell = row.getCell(13);
        diffCell.font = { color: { argb: "000000" } };
      }
    });


    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };


    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `comparacion_${almacen}_${fecha}.xlsx`);
  };

 const exportarPDF = () => {
  const headers = [
    "#", "No Empleado", "Almacén", "CIA", "Código", "Nombre",
    "Código de Barras", "SAP", "Conteo 1", "Conteo 2", "Conteo 3", "Diferencia"
  ];

  const body = [
    headers,
    ...datos.map((item, i) => {
      const c1 = item.conteo1 ?? 0;
      const c2 = item.conteo2 ?? 0;
      const c3 = item.conteo3 ?? 0;
      const c4 = item.conteo4 ?? 0;
      const sap = item.cant_sap ?? item.sap ?? 0;
      const conteoActual =
      estatusCalc === 7 ? c4 :
      estatusCalc === 3 ? c3 :
      estatusCalc === 2 ? c2 :
      c1;

      const dif = Number((sap - conteoActual).toFixed(2));

      return [
        i + 1,
        item.usuario ?? "",
        item.almacen ?? "",
        item.cias ?? "",
        item.ItemCode  ?? "",
        item.Itemname  ?? "",
        item.codebars ?? "",
        sap.toFixed(2),
        c1.toFixed(2),
        c2.toFixed(2),
        c3.toFixed(2),
        c4.toFixed(2),
        { text: dif.toFixed(2), color: dif > 0 ? "orange" : dif < 0 ? "red" : "green", bold: true }
      ];
    }),
  ];

  const docDefinition = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [20, 60, 20, 80],

    defaultStyle: {
      font: "Roboto"
    },

    header: {
      columns: [
        { text: "Comparación de Inventarios", style: "title" },
        { text: `${fecha}  |  ${almacen}  |  ${cia ?? ""}`, alignment: "right", style: "meta" },
      ],
      margin: [20, 20, 20, 0],
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `Subgerente de Administración: ${empleado}`, alignment: "left", margin: [20, 0, 0, 0] },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: "right", margin: [0, 0, 20, 0] },
      ],
      margin: [20, 0, 20, 20],
    }),
    content: [
      {
        table: {
          headerRows: 1,
          widths: [
          "auto", "auto", "auto", "auto", "auto", "*", "auto",
          "auto", "auto", "auto", "auto", "auto", "auto"
        ],

          body,
        },
        layout: "lightHorizontalLines",
        fontSize: 7,
      },
      { text: "\n" },
      {
        columns: [
          { text: "_____________________________\nSubgerente de Administración", alignment: "center" },
          { text: "_____________________________\nGerente de Administración", alignment: "center" },
        ],
        margin: [0, 20, 0, 0],
      },
    ],
    styles: {
      title: { fontSize: 12, bold: true },
      meta: { fontSize: 8, color: "gray" },
    },
  };

  pdfMake.createPdf(docDefinition).download(`comparacion_${almacen}_${fecha}.pdf`);
};



  useEffect(() => {
    if (!almacen || !fecha || !empleado) {
      navigate("/");
      return;
    }

    if (datos.length === 0) {

   const obtenerComparacion = async () => {
        try {
          const res = await axios.get(
            "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/comparar_inventarios.php",
            { params: { almacen, fecha, usuario: empleado, cia } }
          );

          if (!res.data.success) throw new Error(res.data.error);

          setResGlobal(res.data);

         if (res.data.error?.includes("bloqueado")) {
            setBloqueado(true);
          } else {
            setBloqueado(false);
          }

          const esBrig = res.data.brigada == true || res.data.brigada == "1";
          const hayDif = res.data.hay_diferencias_brigada == true || res.data.hay_diferencias_brigada == "1";
          const tercerAsignado = res.data.tercer_conteo_asignado == true || res.data.tercer_conteo_asignado == "1";

          setMiEmpleado(res.data.mi_empleado);
          setEmpleadoCompanero(res.data.empleado_companero);
          setNroConteoMio(Number(res.data.mi_nro_conteo));

          if (!conteoBase) {
            setConteoBase(Number(res.data.mi_nro_conteo));
          }


          setNroConteoComp(Number(res.data.nro_conteo_companero));
          setHayDiferenciasBrigada(hayDif);

          let estatusActual;

          if (res.data.brigada == true || res.data.brigada == "1") {
            estatusActual = Number(res.data.nro_conteo ?? 1);
          } else {
            estatusActual = Number(res.data.nro_conteo ?? res.data.estatus ?? 1);
          }

          setEstatus(estatusActual);


          const hayDifVsSap =
            (res.data.hay_dif_mio_vs_sap == true || res.data.hay_dif_mio_vs_sap == "1") ||
            (res.data.hay_dif_comp_vs_sap == true || res.data.hay_dif_comp_vs_sap == "1");

          setMostrarCuartoConteo(estatusActual === 3 && hayDifVsSap && !bloqueado);

          setEsBrigada(esBrig);
          setModoResuelto(true);

          const mostrarTercer =
                esBrig &&
                hayDif &&
                !tercerAsignado &&
                Number(res.data.estatus_global) < 7;


          setMostrarTercerConteo(mostrarTercer);

          const datosFinal = res.data.data.map((item) => {
            const sap = Number(item.cant_sap ?? 0);
            const c1 = Number(item.conteo1 ?? 0);
            const c2 = Number(item.conteo2 ?? 0);
            const c3 = Number(item.conteo3 ?? 0);
            const c4 = Number(item.conteo4 ?? 0);

            const conteoActual = estatusActual === 3 ? c3 : estatusActual === 2 ? c2 : c1;

            return {
              ...item,
              cant_sap: sap,
              conteo1: c1,
              conteo2: c2,
              conteo3: c3,
              conteo4: c4,
              diferencia: Number((sap - conteoActual).toFixed(2)),

              diferenciaBrigada: Number((c1 - c2).toFixed(2)),
            };
          });



          setDatos(datosFinal);

          if (estatusActual === 4) setDiferenciaConfirmada(true);

        } catch (error) {
          console.error("Error al obtener diferencias", error.message);
        } finally {
          setLoading(false);
        }
      };

      obtenerComparacion();
    }
  }, [almacen, fecha, empleado, navigate, datos.length]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);


  if (loading) return <p className="text-center mt-10 text-gray-600">Cargando diferencias...</p>;


  const confirmarDiferencia = async () => {
    const resultado = await Swal.fire({
      title: "¿Confirmar diferencias?",
      text: "¿Deseas confirmar las diferencias proporcionadas?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "No estoy de acuerdo",
    });

    if (!resultado.isConfirmed) {
      Swal.fire("Cancelado", "Debe completar el proceso para continuar.", "info");
      return;
    }

    try {
      Swal.fire({
        title: "Procesando...",
        text: "Por favor espera",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const formData = new FormData();
      formData.append("almacen", almacen);
      formData.append("fecha", fecha);
      formData.append("empleado", empleado);
      formData.append("cia", cia);


      formData.append("estatus", resGlobal.nro_conteo);

      const res = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/cerrar_inventario.php",
        formData
      );

      Swal.close();

      if (!res.data.success) throw new Error(res.data.error);

      const { mensaje, next_status } = res.data;

      await Swal.fire({
        title: "Confirmado",
        text: mensaje,
        icon: "success",
        confirmButtonText: "Continuar",
      });

      if (next_status < 4) {
        navigate("/captura", {
          state: { almacen, fecha, cia, empleado, estatus: next_status },
        });
      } else {
        setDiferenciaConfirmada(true);
        setEstatus(4);
      }
    } catch (error) {
      Swal.close();
      Swal.fire("Error", error.message, "error");
    }
  };



  function getColor(diferencia) {
      if (diferencia > 0) return "orange";
      if (diferencia < 0) return "red";
      return "green";
    }

  const estatusCalc = Number(estatus) === 4
  ? Number(resGlobal?.nro_conteo ?? 1)
  : Number(estatus);

  let conteosPermitidos = [1, 2, 3, 7];

  if (esBrigada) {
    conteosPermitidos = [];

    const miActual = Number(resGlobal.mi_nro_conteo);
    const comp = Number(resGlobal.nro_conteo_companero);


    let baseOriginal = null;

    if (miActual === 3 || miActual === 7) {
      
      baseOriginal = comp === 1 ? 2 : 1;
    } else {
      baseOriginal = miActual;
    }

    if (baseOriginal) {
      conteosPermitidos.push(baseOriginal);
    }

    if (estatus >= 3) {
      conteosPermitidos.push(3);
    }

    if (estatus >= 7) {
      conteosPermitidos.push(7);
    }
  }



      let datosFiltrados = datos.filter((item) => {
      const texto = busqueda.toLowerCase();
      return (
        item.ItemCode?.toLowerCase().includes(texto) ||
        item.codebars?.toLowerCase().includes(texto) ||
        item.Itemname ?.toLowerCase().includes(texto)
      );
    });


    if (mostrarSoloDiferencias) {
      datosFiltrados = datosFiltrados.filter(
        (row) => Number(row.diferencia) !== 0
      );
    }

    if (mostrarDiferenciasBrigada) {
      datosFiltrados = datosFiltrados.filter(
        (row) => Number(row.diferenciaBrigada) !== 0
      );
    }



    const totalPaginas = Math.max(1, Math.ceil(datosFiltrados.length / registrosPorPagina));
    const pagina = Math.min(paginaActual, totalPaginas); //

    const indiceInicial = (pagina - 1) * registrosPorPagina;
    const indiceFinal = indiceInicial + registrosPorPagina;

    const datosPaginados = datosFiltrados.slice(indiceInicial, indiceFinal);

    const iniciarTercerConteo = async () => {
        const resModal = await Swal.fire({
          title: "¿Quién realizará el Tercer Conteo?",
          html: `
            <div style="
              display:flex;
              flex-direction:column;
              gap:14px;
              margin-top:16px;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            ">

              <div style="
                text-align:center;
                font-size:14px;
                color:#374151;
                margin-bottom:6px;
              ">
                Selecciona quién realizará el <strong>Tercer Conteo</strong>
              </div>

              <button
                id="btnA"
                class="swal2-confirm swal2-styled"
                style="
                  background:#1d4ed8;
                  padding:14px;
                  border-radius:10px;
                  display:flex;
                  flex-direction:column;
                  align-items:center;
                  gap:4px;
                  box-shadow:0 4px 10px rgba(0,0,0,0.15);
                "
              >
                <span style="font-size:12px; opacity:0.85;">Usuario asignado</span>
                <span style="font-size:16px; font-weight:600;">
                  ${resGlobal.mi_empleado}
                </span>
              </button>

              <button
                id="btnB"
                class="swal2-confirm swal2-styled"
                style="
                  background:#047857;
                  padding:14px;
                  border-radius:10px;
                  display:flex;
                  flex-direction:column;
                  align-items:center;
                  gap:4px;
                  box-shadow:0 4px 10px rgba(0,0,0,0.15);
                "
              >
                <span style="font-size:12px; opacity:0.85;">Usuario compañero</span>
                <span style="font-size:16px; font-weight:600;">
                  ${resGlobal.empleado_companero}
                </span>
              </button>

            </div>
          `,

          showConfirmButton: false,
          allowOutsideClick: false,
          didRender: () => {
            document.getElementById("btnA").addEventListener("click", () => {
              Swal.close();
              asignarTercerConteo(resGlobal.mi_empleado);
            });
            document.getElementById("btnB").addEventListener("click", () => {
              Swal.close();
              asignarTercerConteo(resGlobal.empleado_companero);
            });
          },
        });
      };

      const asignarTercerConteo = async (empleadoElegido) => {
    try {
      Swal.fire({
        title: "Asignando tercer conteo...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const formData = new FormData();
      formData.append("almacen", almacen);
      formData.append("fecha", fecha);
      formData.append("cia", cia);
      formData.append("empleado_elegido", empleadoElegido);

      const r = await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/asignar_tercer_conteo.php",
        formData
      );

      Swal.close();

      if (!r.data.success) throw new Error(r.data.error);

      await Swal.fire("Listo", "Tercer conteo asignado correctamente.", "success");

      navigate("/captura", {
        state: { almacen, fecha, cia, empleado: empleadoElegido, estatus: 3 },
      });
    } catch (error) {
      Swal.close();
      Swal.fire("Error", error.message, "error");
    }
  };


    const getConteoActual = (item) => {


      if (esBrigada) {
        if (estatus === 3) return item.conteo3 ?? 0;
        if (estatus === 2) return item.conteo2 ?? 0;
        return item.conteo1 ?? 0;
      }

          return item.conteo1 ?? 0;
    };



  const getDiferenciaSAP = (item) => {
    const sap = item.cant_sap ?? 0;
    const conteo = getConteoActual(item);
    return Number((sap - conteo).toFixed(2));
  };

 const iniciarCuartoConteo = async () => {

    if (estatus !== 3) {
      Swal.fire("No permitido", "El cuarto conteo solo se puede iniciar después del tercer conteo.", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "¿Iniciar cuarto conteo?",
      text: "Se capturará nuevamente SOLO lo que sigue diferente vs SAP.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      Swal.fire({ title: "Procesando...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const formData7 = new FormData();
      formData7.append("almacen", almacen);
      formData7.append("fecha", fecha);
      formData7.append("empleado", empleado);
      formData7.append("estatus", 7);

      await axios.post(
        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/actualizar_estatus.php",
        formData7
      );

      Swal.close();

      navigate("/captura", {
        state: { almacen, fecha, cia, empleado, estatus: 7 },
      });
    } catch (e) {
      Swal.close();
      Swal.fire("Error", "No se pudo iniciar el cuarto conteo.", "error");
    }
  };

  const labelConteo = (nro) => {
    switch (Number(nro)) {
      case 1: return "Primer conteo";
      case 2: return "Segundo conteo";
      case 3: return "Tercer conteo";
      case 4: return "Cuarto conteo";
      default: return "";
    }
  };


  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 flex items-center gap-2">
        {`Comparación de Inventarios - ${
          estatus === 1
            ? "Primer Conteo"
            : estatus === 2
            ? "Segundo Conteo"
            : estatus === 3
            ? "Tercer Conteo"
            : estatus === 7
            ? "Cuarto Conteo"
            : estatus === 4
            ? "Diferencia Confirmada"
            : "Sin Estatus"
        }`}
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      {modoResuelto && !bloqueado && !esBrigada && resGlobal?.modo !== "solo lectura" && (


        <div className="flex items-center gap-2">
          {["Primer Conteo", "Segundo Conteo", "Tercer Conteo"].map((label, index) => {
            const conteoNumero = index + 1;
            const activo = estatus === conteoNumero;

            return (
              <button
                key={label}
                onClick={async () => {
                  if (conteoNumero === 1) {
                    if (estatus === 1) {
                      Swal.fire("No permitido", "Ya se realizo el primer conteo.", "warning");
                      return;
                    }
                    if ([2, 3, 4].includes(estatus)) {
                      Swal.fire("No permitido", "Ya no se puede realizar primer conteo.", "warning");
                      return;
                    }
                  }

                  else if (conteoNumero === 2) {
                    if ([2, 3, 4].includes(estatus)) {
                      Swal.fire("No permitido", "Ya no se puede realizar segundo conteo.", "warning");
                      return;
                    }

                    if (estatus === 1) {
                      const confirm = await Swal.fire({
                        title: "¿Iniciar segundo conteo?",
                        text: "¿Estás seguro de avanzar al segundo conteo?",
                        icon: "question",
                        showCancelButton: true,
                        confirmButtonText: "Sí",
                        cancelButtonText: "Cancelar",
                      });

                      if (!confirm.isConfirmed) return;

                      try {
                        const formData = new FormData();
                        formData.append("almacen", almacen);
                        formData.append("fecha", fecha);
                        formData.append("empleado", empleado);
                        formData.append("estatus", 2);

                        await axios.post(
                          "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/actualizar_estatus.php",
                          formData
                        );

                        navigate("/captura", {
                          state: { almacen, fecha, cia, empleado, estatus: 2 },
                        });
                      } catch (error) {
                        console.error("Error al actualizar estatus", error);
                        Swal.fire("Error", "No se pudo actualizar el estatus. Revisa la consola.", "error");
                      }
                    }
                  }

                  else if (conteoNumero === 3) {
                    if (estatus === 1) {
                      Swal.fire("No permitido", "Debe hacer el segundo conteo previamente.", "warning");
                      return;
                    }
                    if ([3, 4].includes(estatus)) {
                      Swal.fire("No permitido", "Ya no se puede hacer ningún conteo.", "warning");
                      return;
                    }

                    const confirm = await Swal.fire({
                      title: "¿Iniciar tercer conteo?",
                      text: "¿Estás seguro de avanzar al tercer conteo?",
                      icon: "question",
                      showCancelButton: true,
                      confirmButtonText: "Sí",
                      cancelButtonText: "Cancelar",
                    });

                    if (!confirm.isConfirmed) return;

                    try {
                      const formData3 = new FormData();
                      formData3.append("almacen", almacen);
                      formData3.append("fecha", fecha);
                      formData3.append("empleado", empleado);
                      formData3.append("estatus", 3);

                      await axios.post(
                        "https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/actualizar_estatus.php",
                        formData3
                      );

                      navigate("/captura", {
                        state: { almacen, fecha, cia, empleado, estatus: 3 },
                      });
                    } catch (error) {
                      console.error("Error al actualizar estatus", error);
                      Swal.fire("Error", "No se pudo actualizar el estatus. Revisa la consola.", "error");
                    }
                  }
                }}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                  activo
                    ? "bg-red-600 text-white"
                    : "bg-red-100 text-red-700 hover:bg-red-200"
                }`}
              >
                {label}
              </button>


            );
          })}
        </div>
      )}



      </div>



      <div className="w-full bg-white p-4 mb-4 rounded-lg shadow border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">🔎 Buscar artículo</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Escribe código, nombre o código de barras..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-4 py-2 border border-red-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
          />
          <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center mb-4 gap-3">

        {/*
        {esBrigada && (
          <button
            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2
                      bg-blue-200 text-blue-900 hover:bg-blue-300 transition shadow-sm"
            onClick={() => setMostrarDiferenciasBrigada(!mostrarDiferenciasBrigada)}
          >
            {mostrarDiferenciasBrigada
              ? "Mostrar todo"
              : "Diferencias Brigada"}
          </button>
        )}
        */}

        {/*
        <button
          className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2
                    bg-yellow-200 text-yellow-900 hover:bg-yellow-300 transition shadow-sm"
          onClick={() => setMostrarSoloDiferencias(!mostrarSoloDiferencias)}
        >
          {mostrarSoloDiferencias ? "Mostrar todo" : "Mostrar solo diferencias"}
        </button>
        */}

        <button
          onClick={exportarExcel}
          className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2
                    bg-green-200 text-green-900 hover:bg-green-300 transition shadow-sm"
        >
          <img
            src="https://img.icons8.com/color/24/microsoft-excel-2019.png"
            alt="excel"
            className="w-5 h-5"
          />
          Exportar a Excel
        </button>

        {/*
        <button
          onClick={exportarPDF}
          className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2
                    bg-red-200 text-red-900 hover:bg-red-300 transition shadow-sm"
        >
          📄
          Exportar a PDF
        </button>
        */}

        {!bloqueado && mostrarTercerConteo && (
          <button
            onClick={iniciarTercerConteo}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-200 text-purple-900 hover:bg-purple-300 transition shadow-sm"
          >
            Iniciar Tercer Conteo
          </button>


        )}

        {!bloqueado && mostrarCuartoConteo && (
          <button
            onClick={iniciarCuartoConteo}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-fuchsia-200 text-fuchsia-900 hover:bg-fuchsia-300 transition shadow-sm"
          >
            Iniciar Cuarto Conteo
          </button>
        )}

        {!diferenciaConfirmada && estatusCalc === 7 && (
          <button
            onClick={confirmarDiferencia}
            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2
           bg-indigo-600 text-white hover:bg-indigo-700
           transition shadow-sm"

          >
            ✔ Confirmar diferencias
          </button>


        )}



      </div>

      <div className="relative overflow-auto max-h-[70vh] border rounded-lg shadow-md">

        <table className="min-w-full text-sm table-auto">
          <thead className="sticky top-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white text-xs uppercase tracking-wider shadow-lg z-10">
            <tr>
              <th className="p-3 text-left w-10">#</th>
              <th className="p-3 text-left">No Empleado</th>
              <th className="p-3 text-left">Almacen</th>
              <th className="p-3 text-left">CIA</th>
              <th className="p-3 text-left">Código</th>
              <th className="p-3 text-left w-64 max-w-[16rem]">NOMBRE</th>
              <th className="p-3 text-left">Código de Barras</th>
              {/*
              <th className="p-3 text-right">Existencia SAP</th>
              */}

              {conteosPermitidos.includes(1) && (
                <th className={`p-3 text-right ${estatus === 1 ? "bg-yellow-100 text-gray-900 font-extrabold" : ""}`}>
                  Conteo 1
                </th>
              )}


              {conteosPermitidos.includes(2) && (
                <th className={`p-3 text-right ${estatus === 2 ? "bg-yellow-100 text-gray-900 font-extrabold" : ""}`}>
                  Conteo 2
                </th>
              )}


              {conteosPermitidos.includes(3) && (
                <th className={`p-3 text-right ${estatus === 3 ? "bg-yellow-100 text-gray-900 font-extrabold" : ""}`}>
                  Conteo 3
                </th>
              )}


              {conteosPermitidos.includes(7) && (
                <th className={`p-3 text-right ${estatus === 7 ? "bg-yellow-100 text-gray-900 font-extrabold" : ""}`}>
                  Conteo 4
                </th>
              )}


              {/*
              <th className="p-3 text-right">Diferencia SAP</th>
              */}

              {/*
              {esBrigada && (
                <>
                  <th className="p-3 text-right">Dif. Brigada</th>
                </>
              )}
              */}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-100">
            {datosPaginados.map((item, i) => {
              const c1 = Number(item.conteo1 ?? item.conteo_mio ?? 0);
              const c2 = Number(item.conteo2 ?? item.conteo_comp ?? 0);
              const c3 = Number(item.conteo3 ?? 0); //
              const c4 = Number(item.conteo4 ?? 0);
              const sap = Number(item.cant_sap ?? 0);

              const conteoActual =
              estatusCalc === 7 ? c4 :
              estatusCalc === 3 ? c3 :
              estatusCalc === 2 ? c2 :
              c1;

              const difRaw = sap - conteoActual;
              const difSap = Math.abs(Number(difRaw.toFixed(2)));
              const colorDifSap =
                difRaw > 0 ? "green" :
                difRaw < 0 ? "red" :
                "gray";


              const claseConteo = (n) =>
                `p-3 text-sm text-right font-semibold ${
                  estatus === n ? "bg-yellow-100 text-gray-900 ring-2 ring-yellow-400" : "bg-gray-50 text-gray-700"
                }`;

              return (
                <tr
                  key={i}
                  className="hover:bg-red-50 transition duration-150 ease-in-out"
                >

                  <td className="p-3 text-sm text-gray-500 font-semibold whitespace-nowrap">
                    {indiceInicial + i + 1}
                  </td>

                  <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                    {item.usuario ?? "-"}
                  </td>

                  <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                    {item.almacen ?? "-"}
                  </td>

                  <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                    {item.cias ?? "-"}
                  </td>

                  <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                    {item.ItemCode ?? "-"}
                  </td>

                  <td className="p-3 text-sm text-gray-700 whitespace-nowrap truncate max-w-[16rem]">
                    {item.Itemname ?? "-"}
                  </td>

                  <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                    {item.codebars ?? "-"}
                  </td>

                  {/*
                  <td className="p-3 text-sm text-right text-gray-700">
                    {sap.toFixed(2)}
                  </td>
                  */}


                  {conteosPermitidos.includes(1) && (
                    <td className={claseConteo(1)}>
                      <div>{c1.toFixed(2)}</div>
                      {estatus === 1 && (
                        <div className="text-[10px] text-gray-500">
                          Conteo activo
                        </div>
                      )}
                    </td>
                  )}



                  {conteosPermitidos.includes(2) && (
                    <td className={claseConteo(2)}>
                      <div>{c2.toFixed(2)}</div>
                      {estatus === 2 && (
                        <div className="text-[10px] text-gray-500">
                          Conteo activo
                        </div>
                      )}
                    </td>
                  )}



                  {conteosPermitidos.includes(3) && (
                    <td className={claseConteo(3)}>
                      <div>{c3.toFixed(2)}</div>
                      {estatus === 3 && (
                        <div className="text-[10px] text-gray-500">
                          Conteo activo
                        </div>
                      )}
                    </td>
                  )}



                  {conteosPermitidos.includes(7) && (
                    <td className={claseConteo(7)}>
                      <div>{c4.toFixed(2)}</div>
                      {estatus === 7 && (
                        <div className="text-[10px] text-gray-500">
                          Conteo activo
                        </div>
                      )}
                    </td>
                  )}



                  {/*
                  <td
                    className="p-3 text-sm text-right font-bold"
                    style={{ color: colorDifSap }}
                  >
                    {difSap.toFixed(2)}
                  </td>
                  */}

                  {/*
                  {esBrigada && (

                    <td
                      className="p-3 text-sm text-right font-bold"
                      style={{ color: Number(item.diferenciaBrigada ?? 0) === 0 ? "green" : "red" }}
                    >
                      {Number(item.diferenciaBrigada ?? 0).toFixed(2)}
                    </td>


                  )}
                  */}

                </tr>
              );
            })}
          </tbody>
        </table>

        {diferenciaConfirmada && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
            <div className="text-[5rem] font-bold text-gray-600 opacity-20 rotate-[-20deg]">
              Proceso completado
            </div>
          </div>
        )}

      </div>

      <div className="mt-4 flex justify-center items-center gap-4 text-sm text-gray-700 font-medium">
            <button
              onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
              disabled={paginaActual === 1}
              className={`px-3 py-1 rounded border ${
                paginaActual === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-white hover:bg-red-100 text-red-700"
              }`}
            >
              ⬅️ Anterior
            </button>

            <span>
              Página {paginaActual} de {Math.ceil(datosFiltrados.length / registrosPorPagina)}
            </span>

            <button
              onClick={() =>
                setPaginaActual((prev) =>
                  prev < Math.ceil(datosFiltrados.length / registrosPorPagina)
                    ? prev + 1
                    : prev
                )
              }
              disabled={paginaActual >= Math.ceil(datosFiltrados.length / registrosPorPagina)}
              className={`px-3 py-1 rounded border ${
                paginaActual >= Math.ceil(datosFiltrados.length / registrosPorPagina)
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-white hover:bg-red-100 text-red-700"
              }`}
            >
              Siguiente ➡️
            </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 justify-between items-center relative">

        {/*
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded"
        >
          Volver
        </button>
        */}

        {diferenciaConfirmada && (
          <div className="absolute top-10 right-0 text-5xl text-gray-300 opacity-10 select-none pointer-events-none transform rotate-[-30deg]">
            Proceso completado
          </div>
        )}
      </div>


    </div>
  );
}
