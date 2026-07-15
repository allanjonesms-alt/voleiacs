import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Athlete } from '../types';
import { Activity, Users, ChevronRight, X, Trophy, Frown, Percent, Calendar, Medal } from 'lucide-react';
import { Link } from 'react-router-dom';

const calculateAge = (birthDate?: string) => {
  if (!birthDate) return null;
  const today = new Date();
  const [year, month, day] = birthDate.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export default function AthletesList() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'athletes'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const athletesData: Athlete[] = [];
      snapshot.forEach(doc => {
        athletesData.push({ id: doc.id, ...doc.data() } as Athlete);
      });
      setAthletes(athletesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredAthletes = athletes.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Activity className="h-8 w-8 text-blue-600 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            Atletas
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Lista completa de todos os atletas registrados.
          </p>
        </div>
        <div>
          <input
            type="text"
            placeholder="Buscar atleta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64 px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAthletes.map(athlete => (
          <div 
            key={athlete.id} 
            onClick={() => setSelectedAthlete(athlete)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all active:scale-95 group"
          >
            {athlete.photoUrl ? (
              <img src={athlete.photoUrl} alt={athlete.name} className="w-14 h-14 rounded-full object-cover bg-gray-100 border-2 border-transparent group-hover:border-blue-100 transition-colors" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl border-2 border-transparent group-hover:border-blue-100 transition-colors shrink-0">
                {athlete.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{athlete.name}</h3>
              <p className="text-xs text-gray-500 truncate">
                {athlete.wins} V - {athlete.losses} D
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
        ))}
      </div>

      {filteredAthletes.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500">Nenhum atleta encontrado.</p>
        </div>
      )}

      {/* Modal Perfil do Atleta */}
      {selectedAthlete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setSelectedAthlete(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-white/80 rounded-full p-1 z-10 backdrop-blur-sm transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="h-24 bg-gradient-to-br from-blue-500 to-indigo-600 relative">
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                {selectedAthlete.photoUrl ? (
                  <img src={selectedAthlete.photoUrl} alt={selectedAthlete.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md bg-white" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white text-blue-600 border-4 border-white shadow-md flex items-center justify-center text-3xl font-black">
                    {selectedAthlete.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-12 pb-6 px-6 flex flex-col items-center flex-1">
              <h2 className="text-2xl font-black text-gray-900 text-center">{selectedAthlete.name}</h2>
              
              <div className="flex items-center gap-2 mt-2 text-gray-500 text-sm font-medium">
                {selectedAthlete.gender && (
                  <span className="bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                    {selectedAthlete.gender.toLowerCase()}
                  </span>
                )}
                {selectedAthlete.birthDate && (
                  <span className="bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {calculateAge(selectedAthlete.birthDate)} anos
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 w-full mt-6">
                <div className="flex flex-col items-center p-3 bg-blue-50 rounded-xl border border-blue-100/50">
                  <Trophy className="h-5 w-5 text-blue-600 mb-1" />
                  <span className="text-xl font-black text-blue-700">{selectedAthlete.wins || 0}</span>
                  <span className="text-[10px] text-blue-600/80 font-bold uppercase tracking-wider">Vitórias</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-red-50 rounded-xl border border-red-100/50">
                  <Frown className="h-5 w-5 text-red-500 mb-1" />
                  <span className="text-xl font-black text-red-600">{selectedAthlete.losses || 0}</span>
                  <span className="text-[10px] text-red-500/80 font-bold uppercase tracking-wider">Derrotas</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100/50">
                  <Percent className="h-5 w-5 text-emerald-600 mb-1" />
                  <span className="text-xl font-black text-emerald-700">
                    {selectedAthlete.wins + selectedAthlete.losses > 0 
                      ? Math.round((selectedAthlete.wins / (selectedAthlete.wins + selectedAthlete.losses)) * 100) 
                      : 0}%
                  </span>
                  <span className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-wider">Aprov.</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <Link
                to={`/matches?athlete=${selectedAthlete.id}`}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <Activity className="h-4 w-4" />
                Ver Histórico de Partidas
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
