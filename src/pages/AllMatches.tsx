import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getLocalDate } from '../lib/utils';
import { Athlete, Match } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, ArrowLeft, Users, Calendar, Filter, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export default function AllMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [athletes, setAthletes] = useState<Record<string, Athlete>>({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const athleteFilter = searchParams.get('athlete');

  useEffect(() => {
    // Fetch all athletes for reference
    const fetchAthletes = async () => {
      const q = query(collection(db, 'athletes'));
      const snapshot = await getDocs(q);
      const athletesData: Record<string, Athlete> = {};
      snapshot.forEach(doc => {
        athletesData[doc.id] = { id: doc.id, ...doc.data() } as Athlete;
      });
      setAthletes(athletesData);
    };

    fetchAthletes();

    // Listen to matches
    const qMatches = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsubscribeMatches = onSnapshot(qMatches, (snapshot) => {
      const matchesData: Match[] = [];
      snapshot.forEach(doc => {
        matchesData.push({ id: doc.id, ...doc.data() } as Match);
      });
      setMatches(matchesData);
      setLoading(false);
    });

    return () => unsubscribeMatches();
  }, []);

  // Group matches by date formatted nicely
  const groupedMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    
    // Apply athlete filter if present
    const filteredMatches = athleteFilter 
      ? matches.filter(m => m.blueTeam.includes(athleteFilter) || m.yellowTeam.includes(athleteFilter))
      : matches;

    filteredMatches.forEach(match => {
      try {
        const dateStr = format(getLocalDate(match.date), "dd 'de' MMMM, yyyy", { locale: ptBR });
        if (!groups[dateStr]) {
          groups[dateStr] = [];
        }
        groups[dateStr].push(match);
      } catch (error) {
        // Fallback if date is invalid
        const fallbackStr = "Outros";
        if (!groups[fallbackStr]) {
          groups[fallbackStr] = [];
        }
        groups[fallbackStr].push(match);
      }
    });
    return Object.entries(groups);
  }, [matches]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Activity className="h-8 w-8 text-blue-600 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-semibold mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o Início
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <Calendar className="h-8 w-8 text-blue-600" />
          Histórico de Partidas
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          Todas as partidas registradas divididas por data.
        </p>

        {athleteFilter && athletes[athleteFilter] && (
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-semibold">
            <Filter className="h-4 w-4" />
            Filtrando por: {athletes[athleteFilter].name}
            <button 
              onClick={() => setSearchParams({})}
              className="ml-2 hover:bg-blue-100 p-0.5 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-10">
        {groupedMatches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-gray-500">Nenhuma partida registrada ainda.</p>
          </div>
        ) : (
          groupedMatches.map(([dateStr, dateMatches]) => (
            <section key={dateStr} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h2 className="text-lg font-bold text-gray-800 capitalize">
                  {dateStr}
                </h2>
                <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
                  {dateMatches.length} {dateMatches.length === 1 ? 'partida' : 'partidas'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dateMatches.map(match => {
                  const isCompleted = match.status === 'completed';
                  let winner: 'blue' | 'yellow' | null = null;
                  if (isCompleted) {
                    const bScore = match.blueScore;
                    const yScore = match.yellowScore;
                    const bTb = match.blueTiebreakScore || 0;
                    const yTb = match.yellowTiebreakScore || 0;
                    if ((bScore >= 7 && yScore === 0) || (yScore >= 7 && bScore === 0)) {
                      winner = bScore > yScore ? 'blue' : 'yellow';
                    } else if (bScore === 9 && yScore === 9) {
                      winner = bTb >= 3 ? 'blue' : (yTb >= 3 ? 'yellow' : (bTb > yTb ? 'blue' : 'yellow'));
                    } else {
                      winner = bScore > yScore ? 'blue' : 'yellow';
                    }
                  }

                  return (
                    <Link 
                      to={`/match/${match.id}`} 
                      key={match.id} 
                      className="block group"
                    >
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 relative">
                        {match.status === 'in_progress' && (
                          <div className="absolute top-0 inset-x-0 h-1 bg-red-500 animate-pulse" />
                        )}
                        
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5">
                            {match.matchNumber && (
                              <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm">
                                Partida #{match.matchNumber}
                              </span>
                            )}
                            <span className="text-gray-400 font-mono text-[10px]">
                              ID: {match.id.substring(0, 8)}
                            </span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            match.status === 'in_progress' ? 'bg-red-100 text-red-700' :
                            match.status === 'completed' ? 'bg-green-100 text-green-700' :
                            'bg-gray-200 text-gray-700'
                          }`}>
                            {match.status === 'in_progress' ? 'Ao Vivo' : match.status === 'completed' ? 'Finalizada' : 'Agendada'}
                          </span>
                        </div>
                        
                        <div className="p-5 flex items-center justify-between gap-2">
                          {/* Blue Team */}
                          <div className="flex-1 text-center min-w-0">
                            <div className={`text-2xl font-black mb-1 ${
                              isCompleted 
                                ? (winner === 'blue' ? 'text-green-600' : 'text-gray-700') 
                                : 'text-blue-600'
                            }`}>
                              {match.blueScore}
                              {match.blueScore === 9 && match.yellowScore === 9 && match.blueTiebreakScore !== undefined && (
                                <span className="text-xs font-bold text-blue-400 ml-1">({match.blueTiebreakScore})</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Time Azul</div>
                            <div className="flex flex-col space-y-1">
                              {match.blueTeam.map(id => (
                                <span 
                                  key={id} 
                                  className={`text-xs truncate block px-1 ${
                                    isCompleted && winner === 'blue'
                                      ? 'font-black text-green-700 bg-green-50 py-0.5 rounded border border-green-100'
                                      : 'font-semibold text-gray-700'
                                  }`} 
                                  title={athletes[id]?.name || 'Atleta'}
                                >
                                  {athletes[id]?.name || '...'}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="text-gray-300 font-black text-sm px-2 shrink-0">X</div>
                          
                          {/* Yellow Team */}
                          <div className="flex-1 text-center min-w-0">
                            <div className={`text-2xl font-black mb-1 ${
                              isCompleted 
                                ? (winner === 'yellow' ? 'text-green-600' : 'text-gray-700') 
                                : 'text-yellow-500'
                            }`}>
                              {match.yellowScore}
                              {match.blueScore === 9 && match.yellowScore === 9 && match.yellowTiebreakScore !== undefined && (
                                <span className="text-xs font-bold text-yellow-600 ml-1">({match.yellowTiebreakScore})</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Time Amarelo</div>
                            <div className="flex flex-col space-y-1">
                              {match.yellowTeam.map(id => (
                                <span 
                                  key={id} 
                                  className={`text-xs truncate block px-1 ${
                                    isCompleted && winner === 'yellow'
                                      ? 'font-black text-green-700 bg-green-50 py-0.5 rounded border border-green-100'
                                      : 'font-semibold text-gray-700'
                                  }`} 
                                  title={athletes[id]?.name || 'Atleta'}
                                >
                                  {athletes[id]?.name || '...'}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
