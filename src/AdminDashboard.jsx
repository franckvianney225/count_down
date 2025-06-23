import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [duration, setDuration] = useState(30);
  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleSetDuration = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/set-duration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ duration }),
      });

      if (response.ok) {
        setMessage('Durée mise à jour avec succès');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Erreur lors de la mise à jour');
      }
    } catch (error) {
      setMessage('Erreur de connexion au serveur');
    }
  };

  const toggleTimer = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/start-timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        setIsActive(!isActive);
      }
    } catch (error) {
      setMessage('Erreur de contrôle du timer');
    }
  };

  const resetTimer = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/reset-timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        setIsActive(false);
      }
    } catch (error) {
      setMessage('Erreur de réinitialisation');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Configuration du Timer</h2>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm text-white bg-red-500 bg-opacity-80 rounded-md hover:bg-opacity-100 transition-all duration-200 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="p-6 space-y-6">
          {/* Status message */}
          {message && (
            <div className={`p-3 rounded-lg text-center text-sm font-medium ${
              message.includes('succès') 
                ? 'bg-green-100 text-green-800 border-l-4 border-green-500' 
                : 'bg-red-100 text-red-800 border-l-4 border-red-500'
            }`}>
              {message}
            </div>
          )}

          {/* Timer status display */}
          <div className="flex items-center justify-center mb-2">
            <div className={`px-4 py-2 rounded-full font-medium text-sm ${
              isActive 
                ? 'bg-green-100 text-green-800 border border-green-300' 
                : 'bg-gray-100 text-gray-600 border border-gray-300'
            }`}>
              Status: {isActive ? 'Timer actif' : 'Timer inactif'}
            </div>
          </div>

          {/* Duration input */}
          <div className="space-y-2">
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
              Durée (minutes)
            </label>
            <div className="relative">
              <input
                id="duration"
                type="number"
                min="1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-gray-500">min</span>
              </div>
            </div>
          </div>

          {/* Control buttons */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              onClick={handleSetDuration}
              className="px-4 py-3 font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 shadow-sm"
            >
              Mettre à jour
            </button>
            <button
              onClick={toggleTimer}
              className={`px-4 py-3 font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all duration-200 shadow-sm ${
                isActive 
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              }`}
            >
              {isActive ? 'Arrêter' : 'Démarrer'}
            </button>
            <button
              onClick={resetTimer}
              className="px-4 py-3 font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition-all duration-200 shadow-sm"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-500">
          Panneau d'administration de timer — v1.0
        </div>
      </div>
    </div>
  );
}