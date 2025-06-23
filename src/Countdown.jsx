import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function Countdown() {
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes en secondes
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    socket.on('duration_update', (duration) => {
      setTimeLeft(duration * 60);
      setIsActive(false);
    });

    socket.on('timer_control', (data) => {
      if (data.action === 'set_active') {
        setIsActive(data.value);
      } else if (data.action === 'reset') {
        setTimeLeft(30 * 60);
        setIsActive(false);
      }
    });

    return () => {
      socket.off('duration_update');
      socket.off('timer_control');
    };
  }, []);

  useEffect(() => {
    let interval = null;
    
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // Calculer heures, minutes et secondes
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  
  // Affichage spécial pour la dernière minute
  const showOnlySeconds = timeLeft <= 60;
  
  // Effet de pulsation géré directement par Tailwind (animate-pulse)
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* En-tête */}
      <div className={`py-8 px-4 text-center transition-opacity duration-500 ${showOnlySeconds ? 'opacity-30' : 'opacity-100'}`}>
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent">
          ENTREE LE TITRE DU COMPTE A REBOURS
        </h1>
        <p className="text-gray-500 mt-3 text-lg md:text-xl">
          ENTRER LA DATE POUR L'EVENEMENT
        </p>
      </div>
      
      {/* Compteur principal */}
      <div className="flex-grow flex flex-col items-center justify-center py-12 px-4 relative">
        {/* Compteur normal */}
        <div className={`flex flex-wrap justify-center gap-4 transition-opacity duration-500 ${showOnlySeconds ? 'opacity-0' : 'opacity-100'}`}>
          {/* Heures */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-10 rounded-xl shadow-lg transform transition-all hover:scale-105 min-w-[200px]">
            <div className="text-[15rem] font-bold text-center leading-none animate-pulse-slow">{hours.toString().padStart(2, '0')}</div>
            <div className="text-3xl font-bold text-center mt-6">HEURES</div>
          </div>

          {/* Minutes */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-10 rounded-xl shadow-lg transform transition-all hover:scale-105 min-w-[200px]">
            <div className="text-[15rem] font-bold text-center leading-none animate-pulse-slow">{minutes.toString().padStart(2, '0')}</div>
            <div className="text-3xl font-bold text-center mt-6">MINUTES</div>
          </div>

          {/* Secondes */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white p-10 rounded-xl shadow-lg transform transition-all hover:scale-105 min-w-[200px]">
            <div className="text-[15rem] font-bold text-center leading-none animate-pulse-slow">{seconds.toString().padStart(2, '0')}</div>
            <div className="text-3xl font-bold text-center mt-6">SECONDES</div>
          </div>
        </div>
        
        {/* Mode compte à rebours final (60s) */}
        {showOnlySeconds && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center ${
            timeLeft <= 10 ? 'bg-red-600' : 
            timeLeft <= 30 ? 'bg-orange-500' : 
            'bg-black'
          }`}>
            <div
              key={timeLeft} // Force le redémarrage de l'animation à chaque seconde
              className={`text-white font-bold ${
                timeLeft === 0 ? 'animate-finalZoom' : 'zoom-once'
              }`}
              style={{
                fontSize: '12rem',
                textShadow: '0 0 30px rgba(255,255,255,0.9)',
                lineHeight: 1,
              }}
            >
              {timeLeft}
            </div>
          </div>
        )}
        
        
        <div className="mt-12 text-center">
          <div className={`inline-flex items-center px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm shadow-sm transition-opacity duration-500 ${showOnlySeconds ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span>{isActive ? 'Compteur en cours' : 'En attente'}</span>
          </div>
        </div>
      </div>
      
      {/* Vagues de fond */}
      <div className={`relative w-full h-48 transition-opacity duration-500 ${showOnlySeconds ? 'opacity-30' : 'opacity-100'}`}>
        {/* Troisième vague (vert) */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-full">
            <path fill="#4CAF50" fillOpacity="0.5" d="M0,32L48,69.3C96,107,192,181,288,186.7C384,192,480,128,576,128C672,128,768,192,864,218.7C960,245,1056,235,1152,202.7C1248,171,1344,117,1392,90.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
        
        {/* Deuxième vague (blanc) */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-full">
            <path fill="#FFFFFF" fillOpacity="0.4" d="M0,128L48,149.3C96,171,192,213,288,218.7C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
        
        
        {/* Première vague (orange) */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-full">
            <path fill="#FFA500" fillOpacity="0.3" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,186.7C1248,149,1344,107,1392,85.3L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
        
        {/* Logo ou texte en bas */}
        {/* <div className="absolute bottom-0 left-0 right-0 mb-8 flex justify-center">
          <div className="px-8 py-2 bg-white bg-opacity-70 rounded-lg border-2 border-blue-400 text-blue-600 font-bold">
            YOUR LOGO
          </div>
        </div> */}
      </div>
      
      {/* Style pour l'effet de pulse et zoom */}
      <style jsx>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          20% { transform: scale(1.05); }
          40% { transform: scale(1); }
          60% { transform: scale(1.05); }
          80% { transform: scale(1); }
          100% { transform: scale(1); }
        }
        
        @keyframes zoomOnce {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          30% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes finalZoom {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          100% {
            transform: scale(1.5);
            opacity: 1;
          }
        }
        
        .zoom-once {
          animation: zoomOnce 1s ease-out forwards;
        }
        
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        
        .heartbeat {
          animation: heartbeat 1s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
