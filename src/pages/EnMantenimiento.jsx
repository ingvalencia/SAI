import { TerminalSquare } from "lucide-react";

export default function EnMantenimiento() {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-green-400 font-mono px-6">
      <div className="border border-green-400 p-8 rounded-xl shadow-lg w-full max-w-xl text-center relative">
        <div className="absolute top-[-20px] left-4 bg-black px-2 text-sm text-green-300 tracking-widest uppercase">
          Terminal - SAI
        </div>

        <div className="flex justify-center mb-4">
          <TerminalSquare className="w-12 h-12 text-green-400 animate-pulse" />
        </div>

        <h1 className="text-2xl mb-2">🛠 Sistema en mantenimiento</h1>

        <p className="text-green-300 mb-6">
          El sistema <span className="text-white">SAI</span> está siendo actualizado.
          <br />
          Agradecemos tu paciencia.
        </p>

        <div className="bg-green-900 bg-opacity-10 p-4 rounded text-left text-green-300 text-sm border border-green-700">
          <p><span className="text-green-500">#</span> Fecha: {new Date().toLocaleDateString()}</p>
          <p><span className="text-green-500">#</span> Modo: <span className="text-yellow-400">Mantenimiento programado</span></p>
          <p><span className="text-green-500">#</span> Intenta más tarde...</p>
        </div>

        <p className="mt-6 text-xs text-green-600">
          v1.0.0 - Administración de Inventarios SAI
        </p>
      </div>
    </div>
  );
}
