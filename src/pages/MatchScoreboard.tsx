import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match, Athlete } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, RefreshCw, Trophy, ArrowLeft } from 'lucide-react';
import { useDialog } from '../contexts/DialogContext';

export default function MatchScoreboard() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [athletes, setAthletes] = useState<Record<string, Athlete>>({});
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  
  const [selectedWinner, setSelectedWinner] = useState<'blue' | 'yellow' | null>(null);
  const [isSevenZero, setIsSevenZero] = useState<boolean>(false);

  useEffect(() => {
    if (!matchId) return;

    // Fetch athletes for display
    const fetchAthletes = async () => {
      import('firebase/firestore').then(async ({ collection, getDocs }) => {
        const querySnapshot = await getDocs(collection(db, 'athletes'));
        const athletesData: Record<string, Athlete> = {};
        querySnapshot.forEach(doc => {
          athletesData[doc.id] = { id: doc.id, ...doc.data() } as Athlete;
        });
        setAthletes(athletesData);
      });
    };
    fetchAthletes();

    const unsubscribe = onSnapshot(doc(db, 'matches', matchId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Match;
        setMatch({ id: docSnap.id, ...data } as Match);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [matchId]);

  if (loading) return <div className="text-center py-12">Carregando Placar...</div>;
  if (!match) return <div className="text-center py-12">Partida não encontrada.</div>;

  const checkWinner = (
    bScore = match.blueScore, 
    yScore = match.yellowScore
  ) => {
    if ((bScore === 7 && yScore === 0) || (yScore === 7 && bScore === 0)) {
      return { hasWinner: true, isSevenZero: true, winner: bScore > yScore ? 'blue' : 'yellow' };
    }
    if ((bScore === 10 && yScore === 9) || (yScore === 10 && bScore === 9)) {
      return { hasWinner: true, isSevenZero: false, winner: bScore > yScore ? 'blue' : 'yellow' };
    }
    if (bScore !== yScore && (bScore > 0 || yScore > 0)) {
      return { hasWinner: true, isSevenZero: false, winner: bScore > yScore ? 'blue' : 'yellow' };
    }
    return { hasWinner: false, isSevenZero: false, winner: null };
  };

  const finishMatchDirect = async () => {
    if (!isAdmin || match.status === 'completed' || !selectedWinner) return;

    setFinishing(true);
    try {
      const finalBlueScore = selectedWinner === 'blue' ? (isSevenZero ? 7 : 10) : (isSevenZero ? 0 : 9);
      const finalYellowScore = selectedWinner === 'yellow' ? (isSevenZero ? 7 : 10) : (isSevenZero ? 0 : 9);

      await runTransaction(db, async (transaction) => {
        const matchRef = doc(db, 'matches', match.id);
        const matchSnap = await transaction.get(matchRef);

        if (!matchSnap.exists()) {
          throw new Error('A partida não existe mais.');
        }

        const matchData = matchSnap.data();
        if (matchData.status === 'completed') {
          throw new Error('Esta partida já foi encerrada anteriormente.');
        }

        const winnerDocs = [];
        const loserDocs = [];

        const winningTeam = selectedWinner === 'blue' ? matchData.blueTeam : matchData.yellowTeam;
        const losingTeam = selectedWinner === 'blue' ? matchData.yellowTeam : matchData.blueTeam;

        for (const athleteId of winningTeam) {
          const athleteRef = doc(db, 'athletes', athleteId);
          const athleteDoc = await transaction.get(athleteRef);
          winnerDocs.push({ ref: athleteRef, doc: athleteDoc });
        }

        for (const athleteId of losingTeam) {
          const athleteRef = doc(db, 'athletes', athleteId);
          const athleteDoc = await transaction.get(athleteRef);
          winnerDocs.push({ ref: athleteRef, doc: athleteDoc });
        }

        // Perform all writes after reads
        transaction.update(matchRef, { 
          blueScore: finalBlueScore,
          yellowScore: finalYellowScore,
          blueTiebreakScore: 0,
          yellowTiebreakScore: 0,
          status: 'completed' 
        });

        for (const item of winnerDocs) {
          if (item.doc.exists()) {
            transaction.update(item.ref, { wins: (item.doc.data().wins || 0) + 1 });
          }
        }

        for (const item of loserDocs) {
          if (item.doc.exists()) {
            transaction.update(item.ref, { losses: (item.doc.data().losses || 0) + 1 });
          }
        }
      });
      await showAlert('Partida encerrada com sucesso!', 'Sucesso', 'success');
    } catch (error) {
      console.error('Error finishing match:', error);
      await showAlert(error instanceof Error ? error.message : 'Erro ao encerrar partida.', 'Erro', 'danger');
    } finally {
      setFinishing(false);
    }
  };

  const reopenMatch = async () => {
    if (!isAdmin || match.status !== 'completed') return;
    const confirmed = await showConfirm('Tem certeza que deseja reabrir esta partida? O status voltará para "Em Andamento", o placar será resetado e as estatísticas dos atletas serão ajustadas.', 'Reabrir Partida', 'warning');
    if (!confirmed) {
      return;
    }

    setFinishing(true);
    try {
      const { hasWinner, winner } = checkWinner(match.blueScore, match.yellowScore);

      await runTransaction(db, async (transaction) => {
        const matchRef = doc(db, 'matches', match.id);
        const matchSnap = await transaction.get(matchRef);

        if (!matchSnap.exists()) {
          throw new Error('A partida não existe mais.');
        }

        const matchData = matchSnap.data();
        if (matchData.status !== 'completed') {
          throw new Error('Esta partida já está aberta.');
        }

        const winnerDocs = [];
        const loserDocs = [];

        if (hasWinner && winner) {
          const winningTeam = winner === 'blue' ? matchData.blueTeam : matchData.yellowTeam;
          const losingTeam = winner === 'blue' ? matchData.yellowTeam : matchData.blueTeam;

          for (const athleteId of winningTeam) {
            const athleteRef = doc(db, 'athletes', athleteId);
            const athleteDoc = await transaction.get(athleteRef);
            winnerDocs.push({ ref: athleteRef, doc: athleteDoc });
          }

          for (const athleteId of losingTeam) {
            const athleteRef = doc(db, 'athletes', athleteId);
            const athleteDoc = await transaction.get(athleteRef);
            winnerDocs.push({ ref: athleteRef, doc: athleteDoc });
          }
        }

        // Perform all writes after reads
        transaction.update(matchRef, { 
          status: 'in_progress',
          blueScore: 0,
          yellowScore: 0,
          blueTiebreakScore: 0,
          yellowTiebreakScore: 0
        });

        for (const item of winnerDocs) {
          if (item.doc.exists()) {
            const currentWins = item.doc.data().wins || 0;
            transaction.update(item.ref, { wins: Math.max(0, currentWins - 1) });
          }
        }

        for (const item of loserDocs) {
          if (item.doc.exists()) {
            const currentLosses = item.doc.data().losses || 0;
            transaction.update(item.ref, { losses: Math.max(0, currentLosses - 1) });
          }
        }
      });
      setSelectedWinner(null);
      setIsSevenZero(false);
      await showAlert('Partida reaberta com sucesso!', 'Sucesso', 'success');
    } catch (error) {
      console.error('Error reopening match:', error);
      await showAlert(error instanceof Error ? error.message : 'Erro ao reabrir partida.', 'Erro', 'danger');
    } finally {
      setFinishing(false);
    }
  };

  const winnerStatus = checkWinner();

  return (
    <div className="max-w-6xl mx-auto flex flex-col min-h-[80vh] px-4 py-6">
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-semibold text-sm">Voltar</span>
        </button>
      </div>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            Placar ao Vivo {match.matchNumber && <span className="text-blue-600 font-extrabold text-2xl">#{match.matchNumber}</span>}
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            {match.status === 'scheduled' ? 'Aguardando Início' : 
             match.status === 'in_progress' ? 'Em Andamento' : 'Partida Encerrada'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && match.status === 'completed' && (
            <button
              onClick={reopenMatch}
              disabled={finishing}
              className="px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-blue-200"
            >
              <RefreshCw className="h-5 w-5" />
              {finishing ? 'Reabrindo...' : 'Reabrir Partida'}
            </button>
          )}
        </div>
      </div>

      {/* PAINEL DO ADMINISTRADOR PARA PARTIDAS NÃO FINALIZADAS */}
      {isAdmin && match.status !== 'completed' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-800 mb-8">
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Painel do Administrador
          </h3>
          
          {match.status === 'scheduled' ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4 font-semibold">
                Esta partida está agendada e ainda não começou.
              </p>
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'matches', match.id), { status: 'in_progress' });
                    await showAlert('Partida iniciada com sucesso!', 'Sucesso', 'success');
                  } catch (err) {
                    console.error(err);
                    await showAlert('Erro ao iniciar a partida.', 'Erro', 'danger');
                  }
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                Iniciar Partida
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <span className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  1. Selecione o Time Vencedor:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedWinner('blue')}
                    className={`p-4 rounded-xl font-bold border-2 transition-all flex flex-col items-center gap-2 ${
                      selectedWinner === 'blue'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
                      {selectedWinner === 'blue' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
                    </div>
                    <span className="text-sm">Time Azul</span>
                  </button>
                  <button
                    onClick={() => setSelectedWinner('yellow')}
                    className={`p-4 rounded-xl font-bold border-2 transition-all flex flex-col items-center gap-2 ${
                      selectedWinner === 'yellow'
                        ? 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                        : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-yellow-500 flex items-center justify-center">
                      {selectedWinner === 'yellow' && <div className="w-3 h-3 rounded-full bg-yellow-500" />}
                    </div>
                    <span className="text-sm">Time Amarelo</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  2. A vitória foi por 7 a 0 (Chocolate 🍫)?
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsSevenZero(true)}
                    className={`p-3 rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                      isSevenZero
                        ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    Sim, foi de 7 a 0!
                  </button>
                  <button
                    onClick={() => setIsSevenZero(false)}
                    className={`p-3 rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                      !isSevenZero
                        ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                        : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    Não, placar normal (10 a 9)
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <button
                  onClick={finishMatchDirect}
                  disabled={finishing || !selectedWinner}
                  className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
                    selectedWinner
                      ? 'bg-green-600 hover:bg-green-700 active:scale-95 cursor-pointer'
                      : 'bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-600 cursor-not-allowed shadow-none'
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {finishing ? 'Encerrando...' : 'Finalizar e Gravar Partida'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TIME AND SCORE DISPLAY */}
      {(() => {
        const isCompleted = match.status === 'completed';
        const winner = isCompleted ? (winnerStatus.winner || (match.blueScore > match.yellowScore ? 'blue' : 'yellow')) : null;
        
        return (
          <div className="flex-1 flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 items-stretch justify-center">
            {/* Time Azul */}
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl md:rounded-3xl shadow-xl overflow-hidden border-2 md:border-4 border-blue-500 flex flex-col">
              <div className="bg-blue-600 text-white text-center py-2 md:py-4">
                <h2 className="text-sm sm:text-lg md:text-2xl font-black tracking-wider md:tracking-widest uppercase">Time Azul</h2>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-blue-50/50 dark:bg-blue-950/5">
                {isCompleted ? (
                  <div className={`text-6xl sm:text-8xl md:text-[8rem] font-black leading-none tabular-nums tracking-tighter ${
                    winner === 'blue' ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-500'
                  }`}>
                    {match.blueScore}
                  </div>
                ) : (
                  <div className="text-blue-600 dark:text-blue-400 animate-pulse text-center flex flex-col items-center py-8">
                    {match.status === 'scheduled' ? (
                      <>
                        <span className="text-sm font-bold tracking-widest uppercase mb-2">Aguardando</span>
                        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-black tracking-widest uppercase mb-2">Em Quadra</span>
                        <div className="w-16 h-1.5 bg-blue-500 rounded-full" />
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-900 p-4 md:p-6 border-t border-blue-100 dark:border-blue-950/20">
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 text-center">Atletas</h3>
                <div className="flex justify-center gap-4 sm:gap-6 md:gap-8 flex-wrap">
                  {match.blueTeam.map(id => {
                    const isWinner = isCompleted && winner === 'blue';
                    return (
                      <div key={id} className={`flex flex-col items-center text-center max-w-[100px] md:max-w-[140px] p-2 rounded-xl transition-all ${
                        isWinner ? 'bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 shadow-sm scale-105' : ''
                      }`}>
                        {athletes[id]?.photoUrl ? (
                          <img src={athletes[id].photoUrl} className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full object-cover mb-2 md:mb-3 shadow-sm ${
                            isWinner ? 'border-2 border-green-500' : 'border border-blue-200 dark:border-blue-800'
                          }`} alt="" />
                        ) : (
                          <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-sm md:text-xl font-bold mb-2 md:mb-3 shadow-sm shrink-0 ${
                            isWinner 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-2 border-green-500' 
                              : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          }`}>
                            {athletes[id]?.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <span className={`truncate w-full flex items-center justify-center gap-1 ${
                          isWinner 
                            ? 'font-black text-green-800 dark:text-green-400 text-sm sm:text-base underline decoration-green-500 decoration-2 underline-offset-4' 
                            : 'font-semibold text-gray-800 dark:text-gray-200 text-xs sm:text-sm'
                        }`}>
                          {athletes[id]?.name || '...'}
                          {isWinner && <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400 shrink-0" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* VS Separator */}
            <div className="flex items-center justify-center px-2 py-4 md:py-0 shrink-0">
              <span className="text-3xl md:text-5xl font-black text-gray-300 dark:text-gray-700 font-sans">VS</span>
            </div>

            {/* Time Amarelo */}
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl md:rounded-3xl shadow-xl overflow-hidden border-2 md:border-4 border-yellow-400 flex flex-col">
              <div className="bg-yellow-400 text-yellow-900 text-center py-2 md:py-4">
                <h2 className="text-sm sm:text-lg md:text-2xl font-black tracking-wider md:tracking-widest uppercase">Time Amarelo</h2>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-yellow-50/50 dark:bg-yellow-950/5">
                {isCompleted ? (
                  <div className={`text-6xl sm:text-8xl md:text-[8rem] font-black leading-none tabular-nums tracking-tighter ${
                    winner === 'yellow' ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-500'
                  }`}>
                    {match.yellowScore}
                  </div>
                ) : (
                  <div className="text-yellow-600 dark:text-yellow-400 animate-pulse text-center flex flex-col items-center py-8">
                    {match.status === 'scheduled' ? (
                      <>
                        <span className="text-sm font-bold tracking-widest uppercase mb-2">Aguardando</span>
                        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-black tracking-widest uppercase mb-2">Em Quadra</span>
                        <div className="w-16 h-1.5 bg-yellow-500 rounded-full" />
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-900 p-4 md:p-6 border-t border-yellow-100 dark:border-yellow-950/20">
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 text-center">Atletas</h3>
                <div className="flex justify-center gap-4 sm:gap-6 md:gap-8 flex-wrap">
                  {match.yellowTeam.map(id => {
                    const isWinner = isCompleted && winner === 'yellow';
                    return (
                      <div key={id} className={`flex flex-col items-center text-center max-w-[100px] md:max-w-[140px] p-2 rounded-xl transition-all ${
                        isWinner ? 'bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 shadow-sm scale-105' : ''
                      }`}>
                        {athletes[id]?.photoUrl ? (
                          <img src={athletes[id].photoUrl} className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full object-cover mb-2 md:mb-3 shadow-sm ${
                            isWinner ? 'border-2 border-green-500' : 'border border-yellow-200 dark:border-yellow-800'
                          }`} alt="" />
                        ) : (
                          <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-sm md:text-xl font-bold mb-2 md:mb-3 shadow-sm shrink-0 ${
                            isWinner 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-2 border-green-500' 
                              : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                          }`}>
                            {athletes[id]?.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <span className={`truncate w-full flex items-center justify-center gap-1 ${
                          isWinner 
                            ? 'font-black text-green-800 dark:text-green-400 text-sm sm:text-base underline decoration-green-500 decoration-2 underline-offset-4' 
                            : 'font-semibold text-gray-800 dark:text-gray-200 text-xs sm:text-sm'
                        }`}>
                          {athletes[id]?.name || '...'}
                          {isWinner && <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400 shrink-0" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
