import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [empleado, setEmpleado] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post(
        'https://diniz.com.mx/diniz/servicios/services/admin_inventarios_sap/auth/login.php',
        { empleado, password }
      );

      if (res.data.success) {
        // Guarda usuario en sessionStorage o contexto (ajustar según arquitectura)
        sessionStorage.setItem('empleado', res.data.empleado);
        sessionStorage.setItem('nombre', res.data.nombre);
        sessionStorage.setItem('roles', JSON.stringify(res.data.roles));
        navigate('/'); // Redirige al inicio
      } else {
        setError('Credenciales incorrectas');
      }
    } catch (err) {
      setError('Error de red o servidor');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-md rounded-xl w-full max-w-sm p-6">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Iniciar sesión</h2>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-1">Empleado</label>
            <input
              type="text"
              value={empleado}
              onChange={(e) => setEmpleado(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Número de empleado"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="mb-4 text-sm text-red-600 text-center">{error}</div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
