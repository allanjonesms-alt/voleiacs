import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match, Athlete } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Minus, CheckCircle2, AlertCircle, RefreshCw, Trophy, X, ArrowLeft } from 'lucide-react';
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
  const [showTiebreak, setShowTiebreak] = useState(false);

  useEffect(() => {
    if (match && (match.blueScore !== 9 || match.yellowScore !== 9)) {
      setShowTiebreak(false);
    }
  }, [match?.blueScore, match?.yellowScore]);

  useEffect(() => {
    if (!matchId) return;

    // Fetch athletes for display
    const fetchAthletes = async () => {
      // In a real app we might only fetch the 6 needed, but for simplicity we fetch all
      // or we can just fetch them dynamically. Let's do a quick get all.
      const snapshot = await getDoc(doc(db, 'athletes', 'dummy')).catch(() => null); // Just to check connection
      // Better to fetch all athletes once
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
        setMatch({ id: docSnap.id, ...docSnap.data() } as Match);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [matchId]);

  if (loading) return <div className="text-center py-12">Carregando Placar...</div>;
  if (!match) return <div className="text-center py-12">Partida não encontrada.</div>;

  const updateScore = async (team: 'blue' | 'yellow', delta: number) => {
    if (!isAdmin || match.status === 'completed') return;

    // Verificar se o placar atual já possui um vencedor decidido (antes do novo delta)
    // Se o placar já possui vencedor e o delta for de acréscimo, nós bloqueamos a alteração (trava o placar)
    const currentStatus = checkWinner(match.blueScore, match.yellowScore, match.blueTiebreakScore || 0, match.yellowTiebreakScore || 0);
    if (currentStatus.hasWinner && delta > 0) {
      await showAlert('Placar travado! A partida já possui um vencedor definido de acordo com as regras de vitória. Clique em "Finalizar Partida" ou reduza os pontos para ajustar.', 'Atenção', 'warning');
      return;
    }
    
    let newBlue = match.blueScore;
    let newYellow = match.yellowScore;
    let newBlueTb = match.blueTiebreakScore || 0;
    let newYellowTb = match.yellowTiebreakScore || 0;

    const isCurrentlyTiebreak = match.blueScore === 9 && match.yellowScore === 9;

    if (isCurrentlyTiebreak) {
      if (delta === 1) {
        await showAlert('O placar está empatado em 9 a 9! Não é permitido adicionar mais pontos no placar principal. Use o placar do Tie-break para decidir o vencedor, ou reduza os pontos para ajustar.', 'Tie-break Ativo', 'info');
        return;
      } else if (delta === -1) {
        if (team === 'blue') {
          newBlue = 8;
        } else {
          newYellow = 8;
        }
        newBlueTb = 0;
        newYellowTb = 0;
      }
    } else {
      // Placar normal
      newBlue = team === 'blue' ? Math.max(0, match.blueScore + delta) : match.blueScore;
      newYellow = team === 'yellow' ? Math.max(0, match.yellowScore + delta) : match.yellowScore;

      // Se atingir 9 a 9, inicializa placar secundário
      if (newBlue === 9 && newYellow === 9) {
        newBlueTb = 0;
        newYellowTb = 0;
      }
    }

    // Auto start match if it was scheduled
    const newStatus = match.status === 'scheduled' && (newBlue > 0 || newYellow > 0) ? 'in_progress' : match.status;

    await updateDoc(doc(db, 'matches', match.id), {
      blueScore: newBlue,
      yellowScore: newYellow,
      blueTiebreakScore: newBlueTb,
      yellowTiebreakScore: newYellowTb,
      status: newStatus
    });
  };

  const updateTiebreakScore = async (team: 'blue' | 'yellow', delta: number) => {
    if (!isAdmin || match.status === 'completed') return;

    const currentStatus = checkWinner(match.blueScore, match.yellowScore, match.blueTiebreakScore || 0, match.yellowTiebreakScore || 0);
    if (currentStatus.hasWinner && delta > 0) {
      await showAlert('Placar travado! A partida já possui um vencedor definido de acordo com as regras de vitória. Clique em "Finalizar Partida" ou reduza os pontos para ajustar.', 'Atenção', 'warning');
      return;
    }

    let newBlueTb = match.blueTiebreakScore || 0;
    let newYellowTb = match.yellowTiebreakScore || 0;

    if (team === 'blue') {
      newBlueTb = Math.max(0, Math.min(3, newBlueTb + delta));
    } else {
      newYellowTb = Math.max(0, Math.min(3, newYellowTb + delta));
    }

    await updateDoc(doc(db, 'matches', match.id), {
      blueTiebreakScore: newBlueTb,
      yellowTiebreakScore: newYellowTb
    });
  };

  const checkWinner = (
    bScore = match.blueScore, 
    yScore = match.yellowScore,
    bTb = match.blueTiebreakScore || 0,
    yTb = match.yellowTiebreakScore || 0
  ) => {
    // Regra do 7 a 0
    if ((bScore >= 7 && yScore === 0) || (yScore >= 7 && bScore === 0)) {
      return { hasWinner: true, isSevenZero: true, winner: bScore > yScore ? 'blue' : 'yellow', isTiebreak: false };
    }

    // Regra do Placar Secundário (9 a 9)
    if (bScore === 9 && yScore === 9) {
      if (bTb >= 3) {
        return { hasWinner: true, isSevenZero: false, winner: 'blue', isTiebreak: true };
      }
      if (yTb >= 3) {
        return { hasWinner: true, isSevenZero: false, winner: 'yellow', isTiebreak: true };
      }
      return { hasWinner: false, isSevenZero: false, winner: null, isTiebreak: true };
    }

    // Regra normal (10 pontos direto, sem necessidade de diferença de 2 pontos!)
    if (bScore >= 10 || yScore >= 10) {
      return { hasWinner: true, isSevenZero: false, winner: bScore > yScore ? 'blue' : 'yellow', isTiebreak: false };
    }
    
    return { hasWinner: false, isSevenZero: false, winner: null, isTiebreak: false };
  };

  const finishMatch = async () => {
    if (!isAdmin || match.status === 'completed') return;
    const { hasWinner, winner } = checkWinner();
    
    if (!hasWinner) {
      await showAlert('A partida não pode ser encerrada sem cumprir as condições de vitória: deve ser 7 a 0, ter chegado no mínimo em 10 pontos ou ter vencido o Tie-break.', 'Atenção', 'warning');
      return;
    }

    setFinishing(true);
    try {
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

        if (winner) {
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
            loserDocs.push({ ref: athleteRef, doc: athleteDoc });
          }
        }

        // Perform all writes after reads
        transaction.update(matchRef, { status: 'completed' });

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
    const confirmed = await showConfirm('Tem certeza que deseja reabrir esta partida? O status voltará para "Em Andamento" e as estatísticas dos atletas serão ajustadas.', 'Reabrir Partida', 'warning');
    if (!confirmed) {
      return;
    }

    setFinishing(true);
    try {
      const { hasWinner, winner } = checkWinner(match.blueScore, match.yellowScore, match.blueTiebreakScore || 0, match.yellowTiebreakScore || 0);

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
            loserDocs.push({ ref: athleteRef, doc: athleteDoc });
          }
        }

        // Perform all writes after reads
        transaction.update(matchRef, { status: 'in_progress' });

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
      await showAlert('Partida reaberta com sucesso!', 'Sucesso', 'success');
    } catch (error) {
      console.error('Error reopening match:', error);
      await showAlert(error instanceof Error ? error.message : 'Erro ao reabrir partida.', 'Erro', 'danger');
    } finally {
      setFinishing(false);
    }
  };

  const winnerStatus = checkWinner();
  const isTiebreakActive = match.blueScore === 9 && match.yellowScore === 9;

  return (
    <div className="max-w-6xl mx-auto flex flex-col min-h-[80vh]">
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
          <h1 className="text-3xl font-black text-gray-900">Placar ao Vivo</h1>
          <p className="text-gray-500 font-medium mt-1">
            {match.status === 'scheduled' ? 'Aguardando Início' : 
             match.status === 'in_progress' ? 'Em Andamento' : 'Partida Encerrada'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isTiebreakActive && match.status !== 'completed' && (
            <button
              onClick={() => setShowTiebreak(!showTiebreak)}
              className={`px-5 py-3 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all active:scale-95 border ${
                showTiebreak
                  ? 'bg-amber-600 border-amber-700 text-white shadow-amber-200'
                  : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Trophy className="h-4 w-4" />
              {showTiebreak ? 'Fechar Tie-Break' : 'Tie-Break'}
            </button>
          )}
          {isAdmin && match.status !== 'completed' && (
            <button
              onClick={finishMatch}
              disabled={finishing || !winnerStatus.hasWinner}
              className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
                winnerStatus.hasWinner 
                  ? 'bg-green-500 hover:bg-green-600 animate-pulse active:scale-95 cursor-pointer' 
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed shadow-none'
              }`}
              title={winnerStatus.hasWinner ? 'Clique para encerrar a partida e contabilizar as vitórias/derrotas' : 'A partida só pode ser encerrada quando as condições de vitória forem atingidas'}
            >
              <CheckCircle2 className="h-5 w-5" />
              {finishing ? 'Encerrando...' : 'Finalizar Partida'}
            </button>
          )}
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

      {winnerStatus.isSevenZero && match.status !== 'completed' && (
        <div className="bg-red-100 text-red-800 p-4 rounded-xl mb-8 flex items-center gap-3 font-bold justify-center border border-red-200">
          <AlertCircle className="h-6 w-6" />
          Placar de 7 a 0 alcançado! A partida pode ser encerrada.
        </div>
      )}

      {isTiebreakActive && match.status !== 'completed' && (
        <div className="bg-amber-100 text-amber-950 p-4 rounded-xl mb-8 flex flex-col items-center gap-1 font-bold justify-center border border-amber-300 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-600 animate-pulse" />
            <span>Placar Secundário de Desempate Ativado (9 a 9)!</span>
          </div>
          <span className="text-xs font-normal text-amber-800">O primeiro time a atingir 3 pontos diretos vence a partida.</span>
        </div>
      )}

      <div className="flex-1 flex flex-row gap-2 sm:gap-4 md:gap-8 items-stretch justify-center">
        {/* Time Azul */}
        <div className="flex-1 bg-white rounded-2xl md:rounded-3xl shadow-xl overflow-hidden border-2 md:border-4 border-blue-500 flex flex-col">
          <div className="bg-blue-600 text-white text-center py-2 md:py-4">
            <h2 className="text-sm sm:text-lg md:text-2xl font-black tracking-wider md:tracking-widest uppercase">Time Azul</h2>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-blue-50">
            <div className="text-5xl sm:text-8xl md:text-[12rem] font-black text-blue-600 leading-none tabular-nums tracking-tighter">
              {match.blueScore}
            </div>

            {isTiebreakActive && (
              <div className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow-inner flex flex-col items-center min-w-[110px] sm:min-w-[140px] border border-blue-400">
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-90 text-blue-200">Pontos Diretos</span>
                <span className="text-xl sm:text-3xl font-black tabular-nums">{match.blueTiebreakScore || 0} <span className="text-xs font-normal text-blue-300">/ 3</span></span>
              </div>
            )}
            
            {isAdmin && match.status !== 'completed' && (
              <div className="flex gap-2 md:gap-4 mt-4 md:mt-8">
                <button onClick={() => updateScore('blue', -1)} className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-white text-blue-600 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors shadow-sm shrink-0">
                  <Minus className="h-5 w-5 md:h-8 md:w-8" />
                </button>
                <button onClick={() => updateScore('blue', 1)} className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-md shrink-0">
                  <Plus className="h-5 w-5 md:h-8 md:w-8" />
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-3 md:p-6 border-t border-blue-100">
            <h3 className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 md:mb-4 text-center">Atletas</h3>
            <div className="flex justify-center gap-2 sm:gap-4 md:gap-6 flex-wrap">
              {match.blueTeam.map(id => (
                <div key={id} className="flex flex-col items-center text-center max-w-[70px] md:max-w-[100px]">
                  {athletes[id]?.photoUrl ? (
                    <img src={athletes[id].photoUrl} className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full object-cover border border-blue-200 mb-1 md:mb-2 shadow-sm" alt="" />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center text-sm md:text-xl font-bold mb-1 md:mb-2 shadow-sm shrink-0">
                      {athletes[id]?.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <span className="font-bold text-gray-800 text-[10px] sm:text-xs md:text-sm truncate w-full">{athletes[id]?.name || '...'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="flex items-center justify-center px-1 sm:px-2 md:px-4">
          <span className="text-xl sm:text-4xl md:text-6xl font-black text-gray-300">X</span>
        </div>

        {/* Time Amarelo */}
        <div className="flex-1 bg-white rounded-2xl md:rounded-3xl shadow-xl overflow-hidden border-2 md:border-4 border-yellow-400 flex flex-col">
          <div className="bg-yellow-400 text-yellow-900 text-center py-2 md:py-4">
            <h2 className="text-sm sm:text-lg md:text-2xl font-black tracking-wider md:tracking-widest uppercase">Time Amarelo</h2>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-yellow-50">
            <div className="text-5xl sm:text-8xl md:text-[12rem] font-black text-yellow-500 leading-none tabular-nums tracking-tighter">
              {match.yellowScore}
            </div>

            {isTiebreakActive && (
              <div className="mt-2 px-4 py-2 bg-yellow-500 text-yellow-950 rounded-xl shadow-inner flex flex-col items-center min-w-[110px] sm:min-w-[140px] border border-yellow-400">
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-90 text-yellow-900/80">Pontos Diretos</span>
                <span className="text-xl sm:text-3xl font-black tabular-nums">{match.yellowTiebreakScore || 0} <span className="text-xs font-normal text-yellow-800">/ 3</span></span>
              </div>
            )}
            
            {isAdmin && match.status !== 'completed' && (
              <div className="flex gap-2 md:gap-4 mt-4 md:mt-8">
                <button onClick={() => updateScore('yellow', -1)} className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-white text-yellow-600 border border-yellow-200 flex items-center justify-center hover:bg-yellow-100 transition-colors shadow-sm shrink-0">
                  <Minus className="h-5 w-5 md:h-8 md:w-8" />
                </button>
                <button onClick={() => updateScore('yellow', 1)} className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-yellow-500 text-white flex items-center justify-center hover:bg-yellow-600 transition-colors shadow-md shrink-0">
                  <Plus className="h-5 w-5 md:h-8 md:w-8" />
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-3 md:p-6 border-t border-yellow-100">
            <h3 className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 md:mb-4 text-center">Atletas</h3>
            <div className="flex justify-center gap-2 sm:gap-4 md:gap-6 flex-wrap">
              {match.yellowTeam.map(id => (
                <div key={id} className="flex flex-col items-center text-center max-w-[70px] md:max-w-[100px]">
                  {athletes[id]?.photoUrl ? (
                    <img src={athletes[id].photoUrl} className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full object-cover border border-yellow-200 mb-1 md:mb-2 shadow-sm" alt="" />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-yellow-100 text-yellow-600 border border-yellow-200 flex items-center justify-center text-sm md:text-xl font-bold mb-1 md:mb-2 shadow-sm shrink-0">
                      {athletes[id]?.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <span className="font-bold text-gray-800 text-[10px] sm:text-xs md:text-sm truncate w-full">{athletes[id]?.name || '...'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showTiebreak && isTiebreakActive && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-amber-200 dark:border-amber-900/50 transform transition-all scale-100">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white p-6 relative">
              <button 
                type="button"
                onClick={() => setShowTiebreak(false)}
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-5 w-5 text-yellow-100 animate-bounce" />
                <span className="text-xs font-black uppercase tracking-widest text-amber-100">Placar Secundário</span>
              </div>
              <h3 className="text-xl font-black">Tie-Break Desempate</h3>
              <p className="text-xs text-amber-50/90 font-medium mt-1">O primeiro time a marcar 3 pontos diretos vence a partida.</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                {/* Time Azul Tiebreak */}
                <div className="flex-1 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex flex-col items-center">
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1">Time Azul</span>
                  <span className="text-4xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                    {match.blueTiebreakScore || 0}
                  </span>
                  
                  {isAdmin && match.status !== 'completed' && (
                    <div className="flex gap-2 mt-3">
                      <button 
                        type="button"
                        onClick={() => updateTiebreakScore('blue', -1)} 
                        className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 text-blue-600 border border-blue-200 dark:border-blue-800 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-sm active:scale-95"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateTiebreakScore('blue', 1)} 
                        className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-md active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-gray-300 font-bold text-lg shrink-0">VS</div>

                {/* Time Amarelo Tiebreak */}
                <div className="flex-1 bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-900/50 flex flex-col items-center">
                  <span className="text-sm font-bold text-yellow-700 dark:text-yellow-500 mb-1">Time Amarelo</span>
                  <span className="text-4xl font-black text-yellow-500 dark:text-yellow-400 tabular-nums">
                    {match.yellowTiebreakScore || 0}
                  </span>
                  
                  {isAdmin && match.status !== 'completed' && (
                    <div className="flex gap-2 mt-3">
                      <button 
                        type="button"
                        onClick={() => updateTiebreakScore('yellow', -1)} 
                        className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 text-yellow-600 border border-yellow-200 dark:border-yellow-800 flex items-center justify-center hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors shadow-sm active:scale-95"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateTiebreakScore('yellow', 1)} 
                        className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center hover:bg-yellow-600 transition-colors shadow-md active:scale-95"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {winnerStatus.hasWinner && winnerStatus.isTiebreak && (
                <div className="bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 p-3 rounded-xl text-center font-bold text-sm border border-green-100 dark:border-green-900/50 animate-bounce">
                  Vitória do Time {winnerStatus.winner === 'blue' ? 'Azul' : 'Amarelo'}! Você pode finalizar a partida agora.
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowTiebreak(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm transition-colors"
              >
                Confirmar e Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
