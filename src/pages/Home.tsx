import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getLocalDate } from '../lib/utils';
import { Athlete, Match } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, Frown, Users, Activity, Percent, Award, Candy, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [athletes, setAthletes] = useState<Record<string, Athlete>>({});
  const [topWins, setTopWins] = useState<Athlete[]>([]);
  const [topLosses, setTopLosses] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all athletes for reference and ranking
    const fetchAthletes = async () => {
      const q = query(collection(db, 'athletes'));
      const snapshot = await getDocs(q);
      const athletesData: Record<string, Athlete> = {};
      const athletesList: Athlete[] = [];
      
      snapshot.forEach(doc => {
        const data = { id: doc.id, ...doc.data() } as Athlete;
        athletesData[doc.id] = data;
        athletesList.push(data);
      });
      
      setAthletes(athletesData);
      
      // Sort for rankings
      const sortedByWins = [...athletesList].sort((a, b) => b.wins - a.wins).slice(0, 5);
      const sortedByLosses = [...athletesList].sort((a, b) => b.losses - a.losses).slice(0, 5);
      
      setTopWins(sortedByWins);
      setTopLosses(sortedByLosses);
    };

    fetchAthletes();

    // Listen to matches (fetch all to calculate total stats, slice to 10 for display)
    const qMatches = collection(db, 'matches');
    const unsubscribeMatches = onSnapshot(qMatches, (snapshot) => {
      const matchesData: Match[] = [];
      snapshot.forEach(doc => {
        matchesData.push({ id: doc.id, ...doc.data() } as Match);
      });
      // Sort matches client-side descending by createdAt / date
      const sortedMatches = matchesData.sort((a, b) => {
        const timeA = a.createdAt || a.date || 0;
        const timeB = b.createdAt || b.date || 0;
        return timeB - timeA;
      });
      setMatches(sortedMatches);
      setLoading(false);
    });

    return () => unsubscribeMatches();
  }, []);

  const completedMatches = useMemo(() => {
    return matches.filter(m => m.status === 'completed');
  }, [matches]);

  const liveMatch = useMemo(() => {
    return matches.find(m => m.status === 'in_progress');
  }, [matches]);

  const displayMatches = useMemo(() => {
    if (liveMatch) {
      return matches.filter(m => m.id !== liveMatch.id).slice(0, 3);
    }
    return matches.slice(0, 3);
  }, [matches, liveMatch]);

  const sortedByRate = useMemo(() => {
    const athletesList = Object.keys(athletes).map(key => athletes[key]);
    return athletesList
      .map(athlete => {
        const total = athlete.wins + athlete.losses;
        const rate = total > 0 ? (athlete.wins / total) * 100 : 0;
        return { ...athlete, total, rate };
      })
      .filter(a => a.total > 0)
      .sort((a, b) => {
        if (b.rate !== a.rate) {
          return b.rate - a.rate;
        }
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        return a.losses - b.losses;
      })
      .slice(0, 5);
  }, [athletes]);

  const bestTrio = useMemo(() => {
    const trioStats: Record<string, { ids: string[]; wins: number; winDates: number[] }> = {};

    const sortedMatchesAsc = [...completedMatches].sort((a, b) => {
      return (a.date || a.createdAt || 0) - (b.date || b.createdAt || 0);
    });

    sortedMatchesAsc.forEach(match => {
      let winnerTeam: string[] = [];
      if (match.blueScore > match.yellowScore) {
        winnerTeam = match.blueTeam;
      } else if (match.yellowScore > match.blueScore) {
        winnerTeam = match.yellowTeam;
      } else {
        return;
      }

      if (!winnerTeam || winnerTeam.length !== 3) return;
      
      const sortedIds = [...winnerTeam].sort();
      const key = sortedIds.join(',');
      
      if (!trioStats[key]) {
        trioStats[key] = {
          ids: sortedIds,
          wins: 0,
          winDates: []
        };
      }
      trioStats[key].wins += 1;
      trioStats[key].winDates.push(match.date || match.createdAt || 0);
    });

    const triosList = Object.keys(trioStats).map(key => trioStats[key]);
    const sortedTrios = triosList.sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      const lastA = a.winDates[a.wins - 1] || 0;
      const lastB = b.winDates[b.wins - 1] || 0;
      return lastA - lastB;
    });

    return sortedTrios[0] || null;
  }, [completedMatches]);

  const topPirulito = useMemo(() => {
    const pirulitoCounts: Record<string, number> = {};
    
    completedMatches.forEach(match => {
      if (match.blueScore === 7 && match.yellowScore === 0) {
        if (match.yellowTeam) {
          match.yellowTeam.forEach(id => {
            pirulitoCounts[id] = (pirulitoCounts[id] || 0) + 1;
          });
        }
      } else if (match.yellowScore === 7 && match.blueScore === 0) {
        if (match.blueTeam) {
          match.blueTeam.forEach(id => {
            pirulitoCounts[id] = (pirulitoCounts[id] || 0) + 1;
          });
        }
      }
    });

    return Object.entries(pirulitoCounts)
      .map(([id, count]) => {
        return {
          athlete: athletes[id],
          count
        };
      })
      .filter(item => item.athlete && item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [completedMatches, athletes]);

  if (loading) {
    return <div className="flex justify-center py-12"><Activity className="h-8 w-8 text-blue-600 animate-pulse" /></div>;
  }

  return (
    <div className="space-y-12">
      {/* Ações Rápidas */}
      <section className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Estatísticas e Rankings</h1>
          <p className="text-gray-500 text-sm mt-1">Acompanhe o desempenho de todos os atletas.</p>
        </div>
        <Link 
          to="/athletes"
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Users className="h-5 w-5" />
          Ver Todos os Atletas
        </Link>
      </section>

      {/* Partida ao vivo em destaque */}
      {liveMatch && (
        <section className="bg-gradient-to-br from-red-500 via-rose-500 to-red-600 rounded-3xl p-[3px] shadow-lg shadow-red-100 dark:shadow-none animate-fade-in">
          <Link to={`/match/${liveMatch.id}`} className="block bg-white dark:bg-gray-900 rounded-[21px] p-6 md:p-8 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
                </span>
                <span className="text-sm font-black uppercase tracking-wider text-red-600">
                  {liveMatch.matchNumber ? `Partida #${liveMatch.matchNumber} ao Vivo 🔴` : 'Partida ao Vivo 🔴'}
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {format(getLocalDate(liveMatch.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6 md:gap-12">
              {/* Blue Team */}
              <div className="text-center md:text-right">
                <div className="text-xl font-black text-blue-600 mb-2">Time Azul</div>
                <div className="flex flex-wrap justify-center md:justify-end gap-1.5">
                  {liveMatch.blueTeam.map(id => (
                    <span key={id} className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100 max-w-[150px] truncate" title={athletes[id]?.name}>
                      {athletes[id]?.name || '...'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Scoreboard block */}
              <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-2xl px-8 py-4 min-w-[200px] border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                  <span className="text-4xl md:text-5xl font-black text-blue-600">
                    {liveMatch.blueScore}
                  </span>
                  <span className="text-gray-300 font-bold text-xl">X</span>
                  <span className="text-4xl md:text-5xl font-black text-yellow-500">
                    {liveMatch.yellowScore}
                  </span>
                </div>
                {liveMatch.blueScore === 9 && liveMatch.yellowScore === 9 && (liveMatch.blueTiebreakScore !== undefined || liveMatch.yellowTiebreakScore !== undefined) && (
                  <div className="text-xs font-black text-gray-500 mt-2 bg-white dark:bg-gray-900 border px-2 py-0.5 rounded-full">
                    Tiebreak: ({liveMatch.blueTiebreakScore || 0} - {liveMatch.yellowTiebreakScore || 0})
                  </div>
                )}
                <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mt-2 animate-bounce">Acompanhar Placar</span>
              </div>

              {/* Yellow Team */}
              <div className="text-center md:text-left">
                <div className="text-xl font-black text-yellow-500 mb-2">Time Amarelo</div>
                <div className="flex flex-wrap justify-center md:justify-start gap-1.5">
                  {liveMatch.yellowTeam.map(id => (
                    <span key={id} className="bg-yellow-50 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full border border-yellow-100 max-w-[150px] truncate" title={athletes[id]?.name}>
                      {athletes[id]?.name || '...'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            Últimas Partidas
          </h2>
          {matches.length > 3 && (
            <Link 
              to="/matches" 
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              Ver todas
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayMatches.length === 0 ? (
            <p className="text-gray-500 col-span-full">Nenhuma partida registrada ainda.</p>
          ) : (
            displayMatches.map(match => {
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
                <Link to={`/match/${match.id}`} key={match.id} className="block group">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow relative">
                    {match.status === 'in_progress' && (
                      <div className="absolute top-0 inset-x-0 h-1 bg-red-500 animate-pulse"></div>
                    )}
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center text-sm">
                      <div className="flex items-center gap-1.5">
                        {match.matchNumber && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm">
                            Partida #{match.matchNumber}
                          </span>
                        )}
                        <span className="text-gray-500 font-medium text-xs">
                          {format(getLocalDate(match.date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        match.status === 'in_progress' ? 'bg-red-100 text-red-700' :
                        match.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {match.status === 'in_progress' ? 'Ao Vivo' : match.status === 'completed' ? 'Finalizada' : 'Agendada'}
                      </span>
                    </div>
                    
                    <div className="p-6 flex items-center justify-between">
                      <div className="flex-1 text-center">
                        <div className={`text-3xl font-black mb-2 ${
                          isCompleted 
                            ? (winner === 'blue' ? 'text-green-600' : 'text-gray-700') 
                            : 'text-blue-600'
                        }`}>
                          {match.blueScore}
                          {match.blueScore === 9 && match.yellowScore === 9 && match.blueTiebreakScore !== undefined && (
                            <span className="text-sm font-bold text-blue-400 ml-1">({match.blueTiebreakScore})</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Time Azul</div>
                        <div className="flex flex-col space-y-1">
                          {match.blueTeam.map(id => (
                            <span 
                              key={id} 
                              className={`text-sm truncate block ${
                                isCompleted && winner === 'blue'
                                  ? 'font-black text-green-700 bg-green-50 px-1 py-0.5 rounded border border-green-100'
                                  : 'font-medium text-gray-800'
                              }`} 
                              title={athletes[id]?.name || 'Desconhecido'}
                            >
                              {athletes[id]?.name || '...'}
                              {isCompleted && winner === 'blue' && ' 🏆'}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="px-4 text-gray-300 font-bold text-xl">X</div>
                      
                      <div className="flex-1 text-center">
                        <div className={`text-3xl font-black mb-2 ${
                          isCompleted 
                            ? (winner === 'yellow' ? 'text-green-600' : 'text-gray-700') 
                            : 'text-yellow-500'
                        }`}>
                          {match.yellowScore}
                          {match.blueScore === 9 && match.yellowScore === 9 && match.yellowTiebreakScore !== undefined && (
                            <span className="text-sm font-bold text-yellow-600 ml-1">({match.yellowTiebreakScore})</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Time Amarelo</div>
                        <div className="flex flex-col space-y-1">
                          {match.yellowTeam.map(id => (
                            <span 
                              key={id} 
                              className={`text-sm truncate block ${
                                isCompleted && winner === 'yellow'
                                  ? 'font-black text-green-700 bg-green-50 px-1 py-0.5 rounded border border-green-100'
                                  : 'font-medium text-gray-800'
                              }`} 
                              title={athletes[id]?.name || 'Desconhecido'}
                            >
                              {athletes[id]?.name || '...'}
                              {isCompleted && winner === 'yellow' && ' 🏆'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {matches.length > 3 && (
          <div className="mt-6 text-center">
            <Link 
              to="/matches" 
              className="inline-flex items-center justify-center px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-blue-600 hover:bg-gray-50 transition-colors shadow-xs hover:shadow-sm"
            >
              Ver todas as partidas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        )}
      </section>

      {/* Novas Estatísticas: Aproveitamento, Melhor Trio e Pirulito */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: Aproveitamento (%) */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Percent className="h-6 w-6 text-green-600" />
            Top 5 - Aproveitamento (%)
          </h2>
          <div className="space-y-3">
            {sortedByRate.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum atleta elegível com partidas jogadas.</p>
            ) : (
              sortedByRate.map((athlete, index) => (
                <div key={athlete.id} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-4 ${
                    index === 0 ? 'bg-green-100 text-green-700' : 
                    index === 1 ? 'bg-gray-200 text-gray-700' : 
                    index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'
                  }`}>
                    {index + 1}
                  </span>
                  {athlete.photoUrl ? (
                    <img src={athlete.photoUrl} alt={athlete.name} className="w-10 h-10 rounded-full object-cover mr-3 bg-gray-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{athlete.name}</p>
                    <p className="text-xs text-gray-500">{athlete.wins} Vitórias / {athlete.total} Partidas</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-base font-black text-green-600">{athlete.rate.toFixed(1)}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Card 2: Melhor Trio & Pirulito Stacked */}
        <div className="space-y-8">
          {/* MELHOR TRIO */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-500" />
              Melhor Trio 🏆
            </h2>
            {bestTrio ? (
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-100">
                <div className="flex items-center justify-center -space-x-4 mb-4">
                  {bestTrio.ids.map(id => {
                    const athlete = athletes[id];
                    return athlete?.photoUrl ? (
                      <img 
                        key={id} 
                        src={athlete.photoUrl} 
                        alt={athlete.name} 
                        className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md bg-gray-100" 
                      />
                    ) : (
                      <div 
                        key={id} 
                        className="w-14 h-14 rounded-full bg-yellow-100 border-2 border-white shadow-md flex items-center justify-center"
                      >
                        <Users className="h-6 w-6 text-yellow-600" />
                      </div>
                    );
                  })}
                </div>
                <div className="text-center space-y-2">
                  <div className="text-sm font-bold text-gray-800 flex flex-wrap justify-center gap-1.5 px-2">
                    {bestTrio.ids.map((id, idx) => (
                      <span key={id} className="bg-white px-2 py-0.5 rounded-full border border-yellow-200 text-xs shadow-sm">
                        {athletes[id]?.name || 'Atleta'}
                      </span>
                    ))}
                  </div>
                  <div className="pt-2">
                    <p className="text-xs text-amber-700 font-bold uppercase tracking-wider">Desempenho</p>
                    <p className="text-2xl font-black text-amber-600">{bestTrio.wins} {bestTrio.wins === 1 ? 'Vitória' : 'Vitórias'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">Nenhum trio com vitórias registrado ainda.</p>
            )}
          </section>

          {/* PIRULITO */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Candy className="h-6 w-6 text-pink-500" />
              Seção Pirulito 🍭
            </h2>
            {topPirulito.length === 0 ? (
              <div className="bg-pink-50 rounded-xl p-4 border border-pink-100 text-center">
                <p className="text-sm font-semibold text-pink-700">Nenhum "7 a 0" levado ainda! 👏</p>
                <p className="text-xs text-pink-500 mt-1">Os atletas estão jogando duro!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 mb-1">Jogadores que mais perderam de lavada (7 a 0):</p>
                {topPirulito.map((item, index) => (
                  <div key={item.athlete.id} className="flex items-center p-2.5 bg-pink-50/50 rounded-lg border border-pink-100/50">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold mr-3 bg-pink-100 text-pink-700">
                      {index + 1}
                    </span>
                    {item.athlete.photoUrl ? (
                      <img src={item.athlete.photoUrl} alt={item.athlete.name} className="w-9 h-9 rounded-full object-cover mr-2.5 bg-gray-100" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center mr-2.5">
                        <Users className="h-4 w-4 text-pink-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{item.athlete.name}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-black text-pink-600">{item.count} {item.count === 1 ? 'Derrota' : 'Derrotas'}</p>
                      <p className="text-[10px] text-pink-500 font-bold uppercase tracking-wider">por 7x0</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Top 5 - Mais Vitórias
          </h2>
          <div className="space-y-3">
            {topWins.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum atleta registrado.</p>
            ) : (
              topWins.map((athlete, index) => (
                <div key={athlete.id} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-4 ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                    index === 1 ? 'bg-gray-200 text-gray-700' : 
                    index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'
                  }`}>
                    {index + 1}
                  </span>
                  {athlete.photoUrl ? (
                    <img src={athlete.photoUrl} alt={athlete.name} className="w-10 h-10 rounded-full object-cover mr-3 bg-gray-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{athlete.name}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-black text-green-600">{athlete.wins} V</p>
                    <p className="text-xs text-gray-500">{athlete.losses} D</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Frown className="h-6 w-6 text-gray-400" />
            Top 5 - Mais Derrotas
          </h2>
          <div className="space-y-3">
            {topLosses.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum atleta registrado.</p>
            ) : (
              topLosses.map((athlete, index) => (
                <div key={athlete.id} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-4 text-gray-400">
                    {index + 1}
                  </span>
                  {athlete.photoUrl ? (
                    <img src={athlete.photoUrl} alt={athlete.name} className="w-10 h-10 rounded-full object-cover mr-3 bg-gray-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                      <Users className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{athlete.name}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-black text-red-500">{athlete.losses} D</p>
                    <p className="text-xs text-gray-500">{athlete.wins} V</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
