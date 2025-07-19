
import React from 'react';
import { useAppContext } from '../App';

const LandingPage: React.FC = () => {
  const { navigateTo } = useAppContext();
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center bg-brand-dark p-4 overflow-hidden"
    >
        <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center filter grayscale blur-[2px]"
            style={{ backgroundImage: "url('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVPbXJQnIT00ZWX_irph8pcork2Em78_fnPC_Uwg04cYBvowPTLGtj68A&s')" }}
        />
      <div className="absolute inset-0 bg-black/70"></div>
      <div className="relative z-10 flex flex-col items-center text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-lg">
          <span className="text-indigo-400">ScanStudents</span> AI
        </h1>
        <p className="mt-4 text-xl md:text-2xl text-gray-300 max-w-2xl">
          La Surveillance au Rendez-Vous.
        </p>
        <div className="mt-12 flex flex-col md:flex-row gap-6">
          <button
            onClick={() => navigateTo('admin')}
            className="group relative inline-flex items-center justify-center px-10 py-5 overflow-hidden font-medium text-indigo-300 transition-all duration-300 bg-indigo-800 rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500"
          >
            <span className="absolute top-0 left-0 w-0 h-0 transition-all duration-300 border-t-2 border-indigo-300 group-hover:w-full ease"></span>
            <span className="absolute bottom-0 right-0 w-0 h-0 transition-all duration-300 border-b-2 border-indigo-300 group-hover:w-full ease"></span>
            <span className="absolute top-0 left-0 w-full h-0 transition-all duration-300 delay-200 -translate-y-full bg-indigo-600 group-hover:translate-y-0 ease"></span>
            <span className="absolute bottom-0 left-0 w-full h-0 transition-all duration-300 delay-200 translate-y-full bg-indigo-600 group-hover:translate-y-0 ease"></span>
            <span className="absolute inset-0 w-full h-full duration-300 delay-300 bg-indigo-800 opacity-0 group-hover:opacity-100"></span>
            <span className="relative text-xl transition-colors duration-200 ease-in-out group-hover:text-white">ADMINISTRATION</span>
          </button>
          <button
            onClick={() => navigateTo('surveillance')}
            className="group relative inline-flex items-center justify-center px-10 py-5 overflow-hidden font-medium text-pink-300 transition-all duration-300 bg-pink-800 rounded-lg shadow-lg hover:bg-pink-700 focus:outline-none focus:ring-4 focus:ring-pink-500"
          >
            <span className="absolute top-0 left-0 w-0 h-0 transition-all duration-300 border-t-2 border-pink-300 group-hover:w-full ease"></span>
            <span className="absolute bottom-0 right-0 w-0 h-0 transition-all duration-300 border-b-2 border-pink-300 group-hover:w-full ease"></span>
            <span className="absolute top-0 left-0 w-full h-0 transition-all duration-300 delay-200 -translate-y-full bg-pink-600 group-hover:translate-y-0 ease"></span>
            <span className="absolute bottom-0 left-0 w-full h-0 transition-all duration-300 delay-200 translate-y-full bg-pink-600 group-hover:translate-y-0 ease"></span>
            <span className="absolute inset-0 w-full h-full duration-300 delay-300 bg-pink-800 opacity-0 group-hover:opacity-100"></span>
            <span className="relative text-xl transition-colors duration-200 ease-in-out group-hover:text-white">SURVEILLANCE</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
