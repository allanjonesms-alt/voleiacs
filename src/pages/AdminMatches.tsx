import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Match, Athlete } from '../types';
import { Plus, Edit2, Trash2, X, PlayCircle, Search, Users, ArrowUp, ArrowDown, GripVertical, Check, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useDialog } from '../contexts/DialogContext';
import { getLocalDate } from '../lib/utils';

function AthleteAutocomplete({
  selectedId,
  onChange,
  athletes,
  dailyAthleteIds,
}: {
  selectedId: string;
  onChange: (id: string) => void;
  athletes: Athlete[];
  dailyAthleteIds: string[];
}) {
  const selectedAthlete = athletes.find(a => a.id === selectedId);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showSearchInput = !selectedAthlete || isEditing;
  const dailyAthletes = athletes.filter(a => dailyAthleteIds.includes(a.id));
  const filteredOptions = dailyAthletes.filter(a => {
    if (!search.trim()) return true;
    return a.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = (athleteId: string) => {
    onChange(athleteId);
    setSearch('');
    setIsOpen(false);
    setIsEditing(false);
  };

  const handleRemove = () => {
    onChange('');
    setSearch('');
    setIsEditing(false);
  };

  const handleReplaceClick = () => {
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setIsOpen(false);
    setSearch('');
  };

  if (showSearchInput) {
    return (
      <div ref={dropdownRef} className="relative w-full">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder={selectedAthlete ? `Substituir ${selectedAthlete.name}...` : "Buscar atleta..."}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full text-xs border border-gray-200 rounded-lg pl-8 pr-8 py-1.5 bg-gray-50 hover:bg-gray-100 font-medium transition-colors focus:ring-1 focus:ring-indigo-500 focus:bg-white outline-none"
          />
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-400" />
          {selectedAthlete && (
            <button
              type="button"
              onClick={handleCancelEditing}
              className="absolute right-2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
              title="Cancelar substituição"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-center text-xs text-gray-500 italic">
                Nenhum atleta presente encontrado
              </div>
            ) : (
              filteredOptions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelect(a.id)}
                  className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 transition-colors text-left"
                >
                  {a.photoUrl ? (
                    <img src={a.photoUrl} className="w-5 h-5 rounded-full object-cover border border-gray-100" alt="" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[9px] font-bold">
                      {a.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-gray-700 truncate">{a.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 border border-slate-100 p-1.5 rounded-xl transition-all">
      <div className="flex items-center gap-2 truncate">
        {selectedAthlete.photoUrl ? (
          <img src={selectedAthlete.photoUrl} className="w-7 h-7 rounded-full object-cover border border-gray-200 shadow-2xs" alt="" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-extrabold shadow-sm">
            {selectedAthlete.name.charAt(0)}
          </div>
        )}
        <div className="truncate">
          <p className="text-xs font-extrabold text-gray-800 truncate leading-snug">{selectedAthlete.name}</p>
          <p className="text-[9px] text-gray-400 font-bold leading-none">Atleta escalado</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <button
          type="button"
          onClick={handleReplaceClick}
          className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg transition-all flex items-center gap-0.5 shadow-3xs cursor-pointer"
          title="Substituir por outro atleta"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Substituir
        </button>
        <button
          type="button"
          onClick={handleRemove}
          className="p-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg transition-all cursor-pointer"
          title="Remover atleta"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default function AdminMatches() {
  const { showAlert, showConfirm } = useDialog();
  const [matches, setMatches] = useState<Match[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Autocomplete state
  const [blueSearch, setBlueSearch] = useState('');
  const [yellowSearch, setYellowSearch] = useState('');
  const [isBlueDropdownOpen, setIsBlueDropdownOpen] = useState(false);
  const [isYellowDropdownOpen, setIsYellowDropdownOpen] = useState(false);

  const blueDropdownRef = useRef<HTMLDivElement>(null);
  const yellowDropdownRef = useRef<HTMLDivElement>(null);

  // Atletas do Dia states
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [dailyAthleteIds, setDailyAthleteIds] = useState<string[]>([]);
  const [dailySearch, setDailySearch] = useState('');
  const [isDailyDropdownOpen, setIsDailyDropdownOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const dailyDropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [blueTeam, setBlueTeam] = useState<string[]>([]);
  const [yellowTeam, setYellowTeam] = useState<string[]>([]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (blueDropdownRef.current && !blueDropdownRef.current.contains(event.target as Node)) {
        setIsBlueDropdownOpen(false);
      }
      if (yellowDropdownRef.current && !yellowDropdownRef.current.contains(event.target as Node)) {
        setIsYellowDropdownOpen(false);
      }
      if (dailyDropdownRef.current && !dailyDropdownRef.current.contains(event.target as Node)) {
        setIsDailyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchAthletes = async () => {
      const q = query(collection(db, 'athletes'), orderBy('name'));
      const snapshot = await getDocs(q);
      const data: Athlete[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Athlete);
      });
      setAthletes(data);
    };
    fetchAthletes();

    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Match[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Match);
      });
      setMatches(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubDaily = onSnapshot(doc(db, 'config', 'present_athletes'), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const athleteIds = data.athleteIds || [];
        const updatedAt = data.updatedAt || 0;
        const now = Date.now();
        if (athleteIds.length > 0 && updatedAt && now - updatedAt > 24 * 60 * 60 * 1000) {
          try {
            await setDoc(doc(db, 'config', 'present_athletes'), {
              athleteIds: [],
              updatedAt: Date.now()
            });
          } catch (err) {
            console.error('Erro ao expirar lista de presença após 24h:', err);
          }
        } else {
          setDailyAthleteIds(athleteIds);
        }
      } else {
        setDailyAthleteIds([]);
      }
    });
    return () => unsubDaily();
  }, []);

  const [nextTeams, setNextTeams] = useState<string[][]>([['', '', ''], ['', '', ''], ['', '', '']]);

  useEffect(() => {
    const unsubNextTeams = onSnapshot(doc(db, 'config', 'next_teams'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data().teams || [];
        const padded = [...data];
        while (padded.length < 3) padded.push([]);
        setNextTeams(padded.slice(0, 3).map(team => {
          const t = [...team];
          while (t.length < 3) t.push('');
          return t;
        }));
      } else {
        setNextTeams([['', '', ''], ['', '', ''], ['', '', '']]);
      }
    });
    return () => unsubNextTeams();
  }, []);

  const saveDailyAthletes = async (newIds: string[]) => {
    try {
      await setDoc(doc(db, 'config', 'present_athletes'), {
        athleteIds: newIds,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('Erro ao salvar atletas do dia:', err);
    }
  };

  const resetForm = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setBlueTeam([]);
    setYellowTeam([]);
    setBlueSearch('');
    setYellowSearch('');
    setIsBlueDropdownOpen(false);
    setIsYellowDropdownOpen(false);
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleEdit = (match: Match) => {
    if (match.status === 'completed') {
      showAlert('Não é permitido editar uma partida concluída diretamente. Por favor, reabra a partida primeiro através da tela do Placar para que as estatísticas dos atletas sejam revertidas com segurança.', 'Atenção', 'warning');
      return;
    }
    setDate(format(getLocalDate(match.date), 'yyyy-MM-dd'));
    setBlueTeam(match.blueTeam);
    setYellowTeam(match.yellowTeam);
    setEditingId(match.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const match = matches.find(m => m.id === id);
    if (match && match.status === 'completed') {
      await showAlert('Não é permitido excluir uma partida concluída diretamente. Por favor, reabra a partida primeiro através da tela do Placar para que as estatísticas dos atletas sejam revertidas com segurança.', 'Atenção', 'warning');
      return;
    }
    const confirmed = await showConfirm('Tem certeza que deseja excluir esta partida?', 'Excluir Partida', 'danger');
    if (confirmed) {
      await deleteDoc(doc(db, 'matches', id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blueTeam.length !== 3 || yellowTeam.length !== 3) {
      await showAlert('Cada time deve ter exatamente 3 atletas.', 'Atenção', 'warning');
      return;
    }

    const data = {
      date: new Date(date).getTime(),
      blueTeam,
      yellowTeam,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'matches', editingId), data);
      } else {
        const nextMatchNumber = matches.reduce((max, m) => Math.max(max, m.matchNumber || 0), 0) + 1;
        await addDoc(collection(db, 'matches'), {
          ...data,
          blueScore: 0,
          yellowScore: 0,
          status: 'scheduled',
          createdAt: Date.now(),
          matchNumber: nextMatchNumber
        });

        // Rotate leaving athletes to the end of the presence list
        const completedMatchesOfToday = matches
          .filter(m => {
            const mDateStr = format(getLocalDate(m.date), 'yyyy-MM-dd');
            return mDateStr === date && m.status === 'completed';
          })
          .sort((a, b) => a.createdAt - b.createdAt);

        if (completedMatchesOfToday.length > 0) {
          const lastCompleted = completedMatchesOfToday[completedMatchesOfToday.length - 1];
          const prevAthletes = [...lastCompleted.blueTeam, ...lastCompleted.yellowTeam];
          const newAthletes = [...blueTeam, ...yellowTeam];
          const leftAthletes = prevAthletes.filter(id => !newAthletes.includes(id));
          if (leftAthletes.length > 0) {
            const filtered = dailyAthleteIds.filter(id => !leftAthletes.includes(id));
            const newDailyIds = [...filtered, ...leftAthletes];
            setDailyAthleteIds(newDailyIds);
            await saveDailyAthletes(newDailyIds);
          }
        }
      }
      resetForm();
    } catch (error) {
      console.error('Error saving match:', error);
      await showAlert('Erro ao salvar partida.', 'Erro', 'danger');
    }
  };

  const toggleAthlete = (athleteId: string, team: 'blue' | 'yellow') => {
    if (team === 'blue') {
      if (blueTeam.includes(athleteId)) {
        setBlueTeam(blueTeam.filter(id => id !== athleteId));
      } else if (blueTeam.length < 3) {
        setBlueTeam([...blueTeam, athleteId]);
      }
    } else {
      if (yellowTeam.includes(athleteId)) {
        setYellowTeam(yellowTeam.filter(id => id !== athleteId));
      } else if (yellowTeam.length < 3) {
        setYellowTeam([...yellowTeam, athleteId]);
      }
    }
  };

  const filteredBlueAthletes = athletes.filter(athlete => {
    const isSelected = blueTeam.includes(athlete.id) || yellowTeam.includes(athlete.id);
    if (isSelected) return false;
    if (!blueSearch.trim()) return true;
    return athlete.name.toLowerCase().includes(blueSearch.toLowerCase());
  });

  const filteredYellowAthletes = athletes.filter(athlete => {
    const isSelected = blueTeam.includes(athlete.id) || yellowTeam.includes(athlete.id);
    if (isSelected) return false;
    if (!yellowSearch.trim()) return true;
    return athlete.name.toLowerCase().includes(yellowSearch.toLowerCase());
  });

  const addDailyAthlete = async (athleteId: string) => {
    if (dailyAthleteIds.includes(athleteId)) return;
    const newIds = [...dailyAthleteIds, athleteId];
    setDailyAthleteIds(newIds);
    await saveDailyAthletes(newIds);
    setDailySearch('');
    setIsDailyDropdownOpen(false);
  };

  const removeDailyAthlete = async (athleteId: string) => {
    const newIds = dailyAthleteIds.filter(id => id !== athleteId);
    setDailyAthleteIds(newIds);
    await saveDailyAthletes(newIds);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newIds = [...dailyAthleteIds];
    const draggedId = newIds[draggedIndex];
    newIds.splice(draggedIndex, 1);
    newIds.splice(index, 0, draggedId);
    
    setDailyAthleteIds(newIds);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    await saveDailyAthletes(dailyAthleteIds);
  };

  const moveAthlete = async (index: number, direction: 'up' | 'down') => {
    const newIds = [...dailyAthleteIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    
    const temp = newIds[index];
    newIds[index] = newIds[targetIndex];
    newIds[targetIndex] = temp;
    
    setDailyAthleteIds(newIds);
    await saveDailyAthletes(newIds);
  };

  const rotateDailyQueue = async (count: number) => {
    if (dailyAthleteIds.length <= count) return;
    const toRotate = dailyAthleteIds.slice(0, count);
    const remaining = dailyAthleteIds.slice(count);
    const newIds = [...remaining, ...toRotate];
    
    setDailyAthleteIds(newIds);
    await saveDailyAthletes(newIds);
  };

  const scaleNextSix = async () => {
    if (dailyAthleteIds.length < 6) {
      await showAlert('É necessário ter pelo menos 6 atletas presentes para gerar uma partida.', 'Atenção', 'warning');
      return;
    }
    const blue = dailyAthleteIds.slice(0, 3);
    const yellow = dailyAthleteIds.slice(3, 6);
    
    resetForm();
    setBlueTeam(blue);
    setYellowTeam(yellow);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setIsDailyModalOpen(false);
    setIsModalOpen(true);
  };

  const updateNextTeamPlayer = async (teamIdx: number, playerIdx: number, athleteId: string) => {
    const updated = nextTeams.map((team, idx) => {
      if (idx !== teamIdx) return team;
      const t = [...team];
      while (t.length < 3) t.push('');
      t[playerIdx] = athleteId;
      return t;
    });
    setNextTeams(updated);
    try {
      await setDoc(doc(db, 'config', 'next_teams'), { teams: updated });
    } catch (err) {
      console.error('Erro ao atualizar próxima equipe:', err);
    }
  };

  const autoFillNextTeams = async () => {
    // Find athletes playing in active or scheduled matches
    const ongoingMatches = matches.filter(m => m.status === 'in_progress' || m.status === 'scheduled');
    const playingIds = new Set<string>();
    ongoingMatches.forEach(m => {
      m.blueTeam.forEach(id => playingIds.add(id));
      m.yellowTeam.forEach(id => playingIds.add(id));
    });

    // Players not currently playing on court
    const availablePlayers = dailyAthleteIds.filter(id => !playingIds.has(id));

    // Distribute them in order into the 3 next teams
    const updated: string[][] = [[], [], []];
    let currentIdx = 0;
    for (let t = 0; t < 3; t++) {
      const team: string[] = [];
      for (let p = 0; p < 3; p++) {
        if (currentIdx < availablePlayers.length) {
          team.push(availablePlayers[currentIdx]);
          currentIdx++;
        } else {
          team.push('');
        }
      }
      updated[t] = team;
    }

    setNextTeams(updated);
    try {
      await setDoc(doc(db, 'config', 'next_teams'), { teams: updated });
      await showAlert('As 3 próximas equipes foram preenchidas com os atletas disponíveis da fila de presença!', 'Fila Preenchida', 'success');
    } catch (err) {
      console.error('Erro ao preencher equipes desafiantes:', err);
    }
  };

  const clearNextTeams = async () => {
    const confirmed = await showConfirm('Tem certeza que deseja limpar as 3 próximas equipes?', 'Limpar Equipes', 'warning');
    if (confirmed) {
      const empty = [['', '', ''], ['', '', ''], ['', '', '']];
      setNextTeams(empty);
      try {
         await setDoc(doc(db, 'config', 'next_teams'), { teams: empty });
      } catch (err) {
         console.error('Erro ao limpar equipes desafiantes:', err);
      }
    }
  };

  const startNextMatchWithTeam = async (teamIdx: number) => {
    const team = nextTeams[teamIdx] || [];
    const validPlayers = team.filter(id => id);
    if (validPlayers.length !== 3) {
      await showAlert(`A Próxima Equipe #${teamIdx + 1} precisa ter exatamente 3 atletas escalados para iniciar a partida.`, 'Atenção', 'warning');
      return;
    }

    const selectedDateStr = format(new Date(), 'yyyy-MM-dd');

    // Find last completed match of today
    const completedMatchesOfToday = matches
      .filter(m => {
        const mDateStr = format(getLocalDate(m.date), 'yyyy-MM-dd');
        return mDateStr === selectedDateStr && m.status === 'completed';
      })
      .sort((a, b) => a.createdAt - b.createdAt);

    const isFirstMatch = completedMatchesOfToday.length === 0;

    let blueTeamSelected: string[] = [];
    let yellowTeamSelected: string[] = [];
    let isTwoTeamsConsumed = false;
    let otherTeamIdx = -1;

    if (isFirstMatch) {
      // First match of the day: Selected team plays against another team in nextTeams.
      // If teamIdx is 0, play against teamIdx 1. Otherwise play against teamIdx 0.
      otherTeamIdx = teamIdx === 0 ? 1 : 0;
      const otherTeam = nextTeams[otherTeamIdx] || [];
      const otherTeamValid = otherTeam.filter(id => id);
      if (otherTeamValid.length !== 3) {
        await showAlert(`Como esta é a primeira partida de hoje, as equipes #${teamIdx + 1} e #${otherTeamIdx + 1} se enfrentarão. A Próxima Equipe #${otherTeamIdx + 1} também precisa ter exatamente 3 atletas escalados.`, 'Atenção', 'info');
        return;
      }
      blueTeamSelected = validPlayers;
      yellowTeamSelected = otherTeamValid;
      isTwoTeamsConsumed = true;
    } else {
      const isSameTeam = (teamA: string[], teamB: string[]) => {
        return teamA.length === teamB.length && teamA.every(id => teamB.includes(id));
      };

      const getWinnerTeam = (m: Match) => {
        const bScore = m.blueScore || 0;
        const yScore = m.yellowScore || 0;
        const bTb = m.blueTiebreakScore || 0;
        const yTb = m.yellowTiebreakScore || 0;

        if ((bScore >= 7 && yScore === 0) || (yScore >= 7 && bScore === 0)) {
          return bScore > yScore ? m.blueTeam : m.yellowTeam;
        } else if (bScore === 9 && yScore === 9) {
          if (bTb >= 3 || yTb >= 3) {
            return bTb > yTb ? m.blueTeam : m.yellowTeam;
          } else if (bTb !== yTb) {
            return bTb > yTb ? m.blueTeam : m.yellowTeam;
          }
        } else if (bScore !== yScore) {
           return bScore > yScore ? m.blueTeam : m.yellowTeam;
        }
        return [];
      };

      const lastCompletedMatch = completedMatchesOfToday[completedMatchesOfToday.length - 1];
      const winningTeamOfLast = getWinnerTeam(lastCompletedMatch);
      const isBlueWinnerOfLast = isSameTeam(winningTeamOfLast, lastCompletedMatch.blueTeam);
      
      const currentWinner = isBlueWinnerOfLast ? lastCompletedMatch.blueTeam : lastCompletedMatch.yellowTeam;
      const currentLoser = isBlueWinnerOfLast ? lastCompletedMatch.yellowTeam : lastCompletedMatch.blueTeam;

      let consecutiveWins = 1;

      for (let i = completedMatchesOfToday.length - 2; i >= 0; i--) {
        const m = completedMatchesOfToday[i];
        const mWinner = getWinnerTeam(m);
        if (isSameTeam(currentWinner, mWinner)) {
          consecutiveWins++;
        } else {
          break;
        }
      }

      const limit = dailyAthleteIds.length > 18 ? 2 : 3;

      let remainingTeam: string[];
      let ruleTriggered = false;

      if (consecutiveWins >= limit) {
        remainingTeam = currentLoser;
        ruleTriggered = true;
      } else {
        remainingTeam = currentWinner;
      }

      blueTeamSelected = remainingTeam;
      yellowTeamSelected = validPlayers; // Selected team

      const winnerNames = remainingTeam.map(id => athletes.find(a => a.id === id)?.name || id).join(', ');
      const challengerNames = validPlayers.map(id => athletes.find(a => a.id === id)?.name || id).join(', ');

      if (ruleTriggered) {
        await showAlert(`Regra de vitórias consecutivas ATIVADA: O time vencedor venceu ${consecutiveWins} partidas consecutivas (limite: ${limit}). Portanto, o time DERROTADO permanece em quadra!\n\nTime que permanece: ${winnerNames}\n\nPróxima equipe desafiante (Equipe #${teamIdx + 1}): ${challengerNames}`, 'Partida Gerada!', 'info');
      } else {
        await showAlert(`O time vencedor permanece em quadra (vitórias seguidas: ${consecutiveWins}/${limit}).\n\nTime que permanece: ${winnerNames}\n\nPróxima equipe desafiante (Equipe #${teamIdx + 1}): ${challengerNames}`, 'Partida Gerada!', 'info');
      }
    }

    try {
      const nextMatchNumber = matches.reduce((max, m) => Math.max(max, m.matchNumber || 0), 0) + 1;
      await addDoc(collection(db, 'matches'), {
        date: Date.now(),
        blueTeam: blueTeamSelected,
        yellowTeam: yellowTeamSelected,
        blueScore: 0,
        yellowScore: 0,
        status: 'scheduled',
        createdAt: Date.now(),
        matchNumber: nextMatchNumber
      });

      // Shift nextTeams queue
      let updatedTeams: string[][] = [[], [], []];
      if (isTwoTeamsConsumed) {
        const remainingIndices = [0, 1, 2].filter(idx => idx !== teamIdx && idx !== otherTeamIdx);
        const remainingTeams = remainingIndices.map(idx => nextTeams[idx] || []);
        updatedTeams = [...remainingTeams, ['', '', ''], ['', '', '']].slice(0, 3);
      } else {
        const remainingIndices = [0, 1, 2].filter(idx => idx !== teamIdx);
        const remainingTeams = remainingIndices.map(idx => nextTeams[idx] || []);
        updatedTeams = [...remainingTeams, ['', '', '']].slice(0, 3);
      }

      // Automatically fill empty slot from remaining queue of today
      const playingOrScheduled = new Set<string>([...blueTeamSelected, ...yellowTeamSelected]);
      updatedTeams.forEach(team => {
        team.forEach(id => {
          if (id) playingOrScheduled.add(id);
        });
      });

      const availableQueue = dailyAthleteIds.filter(id => !playingOrScheduled.has(id));
      let queueIdx = 0;
      for (let t = 0; t < 3; t++) {
        const currentSize = updatedTeams[t].filter(id => id).length;
        if (currentSize === 0) {
          const newTeam: string[] = [];
          for (let p = 0; p < 3; p++) {
            if (queueIdx < availableQueue.length) {
              newTeam.push(availableQueue[queueIdx]);
              queueIdx++;
            } else {
              newTeam.push('');
            }
          }
          updatedTeams[t] = newTeam;
        }
      }

      await setDoc(doc(db, 'config', 'next_teams'), { teams: updatedTeams });

      // Rotate players that left the court
      if (completedMatchesOfToday.length > 0) {
         const lastCompleted = completedMatchesOfToday[completedMatchesOfToday.length - 1];
         const prevAthletes = [...lastCompleted.blueTeam, ...lastCompleted.yellowTeam];
         const newAthletes = [...blueTeamSelected, ...yellowTeamSelected];
         const leftAthletes = prevAthletes.filter(id => !newAthletes.includes(id));
         if (leftAthletes.length > 0) {
           const filtered = dailyAthleteIds.filter(id => !leftAthletes.includes(id));
           const newDailyIds = [...filtered, ...leftAthletes];
           setDailyAthleteIds(newDailyIds);
            await saveDailyAthletes(newDailyIds);
         }
      }
    } catch (err) {
      console.error('Erro ao iniciar partida:', err);
      await showAlert('Erro ao iniciar próxima partida.', 'Erro', 'danger');
    }
  };

  const filteredDailyAthletes = athletes.filter(athlete => {
    const isAlreadyPresent = dailyAthleteIds.includes(athlete.id);
    if (isAlreadyPresent) return false;
    
    if (!dailySearch.trim()) return true;
    return athlete.name.toLowerCase().includes(dailySearch.toLowerCase());
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partidas</h1>
          <p className="text-gray-500 text-sm">Gerencie as partidas e acesse os placares</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsDailyModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Users className="h-4.5 w-4.5" />
            Atletas do Dia
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Plus className="h-4.5 w-4.5" />
            Nova Partida
          </button>
        </div>
      </div>

      {/* Fila de Desafiantes (3 Próximas Equipes) */}
      <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-indigo-100/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm sm:text-base">Fila de Desafiantes (Próximas 3 Equipes)</h2>
              <p className="text-xs text-gray-500">Organize os trios que enfrentarão os vencedores</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={autoFillNextTeams}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all uppercase"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Preencher da Fila
            </button>
            <button
              type="button"
              onClick={clearNextTeams}
              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5 text-gray-400" />
              Limpar Fila
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((teamIdx) => {
            const team = nextTeams[teamIdx] || ['', '', ''];
            return (
              <div key={`next-team-card-${teamIdx}`} className="bg-white rounded-xl border border-gray-200/60 p-4 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-center border-b border-gray-50 pb-2 mb-3">
                    <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">
                      Equipe Desafiante #{teamIdx + 1}
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full">
                      Trio #{teamIdx + 1}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[0, 1, 2].map((playerIdx) => {
                      const selectedId = team[playerIdx] || '';
                      return (
                        <div key={`player-${teamIdx}-${playerIdx}`} className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase">
                            Atleta {playerIdx + 1}
                          </label>
                          <AthleteAutocomplete
                            selectedId={selectedId}
                            onChange={(id) => updateNextTeamPlayer(teamIdx, playerIdx, id)}
                            athletes={athletes}
                            dailyAthleteIds={dailyAthleteIds}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-50">
                  <button
                    type="button"
                    onClick={() => startNextMatchWithTeam(teamIdx)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2 px-3 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all text-xs uppercase tracking-wide cursor-pointer"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Iniciar Próxima Partida
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => startNextMatchWithTeam(0)}
            className="w-full max-w-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3 px-6 rounded-xl shadow-md shadow-emerald-200 flex items-center justify-center gap-2.5 transition-all text-sm uppercase tracking-wide cursor-pointer"
          >
            <PlayCircle className="h-5 w-5" />
            Iniciar Próxima Partida com Equipe #1
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : matches.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma partida registrada.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {matches.map(match => (
              <li key={match.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    {format(getLocalDate(match.date), "dd/MM/yyyy", { locale: ptBR })} - Status: <span className="font-bold">{
                      match.status === 'in_progress' ? 'Ao Vivo' : match.status === 'completed' ? 'Finalizada' : 'Agendada'
                    }</span>
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-blue-50 p-2 rounded border border-blue-100 flex justify-between items-center">
                      <div className="text-sm">
                        <span className="font-bold text-blue-700">Time Azul</span>
                      </div>
                      <span className="text-2xl font-black text-blue-600">{match.blueScore}</span>
                    </div>
                    <span className="text-gray-400 font-bold">X</span>
                    <div className="flex-1 bg-yellow-50 p-2 rounded border border-yellow-200 flex justify-between items-center">
                      <span className="text-2xl font-black text-yellow-600">{match.yellowScore}</span>
                      <div className="text-sm text-right">
                        <span className="font-bold text-yellow-700">Time Amarelo</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ml-6 flex items-center gap-2 flex-col sm:flex-row">
                  <Link 
                    to={`/match/${match.id}`}
                    className="p-2 text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors flex items-center gap-1"
                    title="Abrir Placar"
                  >
                    <PlayCircle className="h-5 w-5" />
                    <span className="text-sm font-medium hidden sm:inline">Placar</span>
                  </Link>
                  <div className="flex">
                    <button onClick={() => handleEdit(match)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleDelete(match.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden my-8">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Editar Partida' : 'Nova Partida'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-6">
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <div className="w-full sm:w-1/2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data da Partida</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full border border-gray-300 bg-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Time Azul */}
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 flex flex-col space-y-3">
                  <h3 className="font-bold text-blue-700 flex items-center justify-between">
                    Time Azul
                    <span className="text-sm bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">{blueTeam.length}/3</span>
                  </h3>
                  
                  {/* Autocomplete Input */}
                  <div className="relative" ref={blueDropdownRef}>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={blueTeam.length >= 3 ? "Time completo (3 atletas)" : "Buscar atleta..."}
                        disabled={blueTeam.length >= 3}
                        value={blueSearch}
                        onChange={(e) => {
                          setBlueSearch(e.target.value);
                          setIsBlueDropdownOpen(true);
                        }}
                        onFocus={() => setIsBlueDropdownOpen(true)}
                        className="w-full bg-white border border-blue-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-blue-100/50 disabled:text-gray-400 placeholder:text-gray-400 font-medium transition-all"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    </div>

                    {isBlueDropdownOpen && blueTeam.length < 3 && (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg divide-y divide-gray-100">
                        {filteredBlueAthletes.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 text-center">Nenhum atleta disponível encontrado</div>
                        ) : (
                          filteredBlueAthletes.map(athlete => (
                            <button
                              type="button"
                              key={`autocomplete-blue-${athlete.id}`}
                              onClick={() => {
                                toggleAthlete(athlete.id, 'blue');
                                setBlueSearch('');
                                setIsBlueDropdownOpen(false);
                              }}
                              className="w-full text-left p-2 hover:bg-blue-50 flex items-center gap-2.5 transition-colors"
                            >
                              {athlete.photoUrl ? (
                                <img src={athlete.photoUrl} className="w-7 h-7 rounded-full object-cover border border-gray-100" alt="" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                                  {athlete.name.charAt(0)}
                                </div>
                              )}
                              <span className="text-sm font-medium text-gray-800">{athlete.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {/* List of selected athletes */}
                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-semibold text-blue-600">Jogadores selecionados:</p>
                    {blueTeam.map((athleteId, idx) => {
                      const athlete = athletes.find(a => a.id === athleteId);
                      if (!athlete) return null;
                      return (
                        <div key={`selected-blue-${athleteId}`} className="p-2 bg-white rounded-lg border border-blue-100 flex items-center justify-between shadow-sm hover:border-blue-200 transition-colors gap-2">
                          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                            {athlete.photoUrl ? (
                              <img src={athlete.photoUrl} className="w-8 h-8 rounded-full object-cover border shrink-0" alt="" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                                {athlete.name.charAt(0)}
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800 truncate">{athlete.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {dailyAthleteIds.length > 0 && (
                              <select
                                value={athleteId}
                                onChange={(e) => {
                                  const newId = e.target.value;
                                  if (newId && newId !== athleteId) {
                                    const newBlue = [...blueTeam];
                                    newBlue[idx] = newId;
                                    setBlueTeam(newBlue);
                                  }
                                }}
                                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:ring-1 focus:ring-blue-500 max-w-[110px]"
                              >
                                <option value={athleteId}>Substituir...</option>
                                {dailyAthleteIds
                                  .filter(id => !blueTeam.includes(id) && !yellowTeam.includes(id))
                                  .map(id => {
                                    const auth = athletes.find(a => a.id === id);
                                    return auth ? (
                                      <option key={`sub-blue-${id}`} value={id}>
                                        {auth.name}
                                      </option>
                                    ) : null;
                                  })}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleAthlete(athleteId, 'blue')}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                              title="Remover"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {blueTeam.length === 0 && (
                      <div className="py-6 border-2 border-dashed border-blue-200 rounded-lg text-center text-xs text-blue-400">
                        Nenhum jogador escalado
                      </div>
                    )}
                  </div>
                </div>

                {/* Time Amarelo */}
                <div className="border border-yellow-200 rounded-xl p-4 bg-yellow-50 flex flex-col space-y-3">
                  <h3 className="font-bold text-yellow-700 flex items-center justify-between">
                    Time Amarelo
                    <span className="text-sm bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">{yellowTeam.length}/3</span>
                  </h3>
                  
                  {/* Autocomplete Input */}
                  <div className="relative" ref={yellowDropdownRef}>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={yellowTeam.length >= 3 ? "Time completo (3 atletas)" : "Buscar atleta..."}
                        disabled={yellowTeam.length >= 3}
                        value={yellowSearch}
                        onChange={(e) => {
                          setYellowSearch(e.target.value);
                          setIsYellowDropdownOpen(true);
                        }}
                        onFocus={() => setIsYellowDropdownOpen(true)}
                        className="w-full bg-white border border-yellow-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none disabled:bg-yellow-100/50 disabled:text-gray-400 placeholder:text-gray-400 font-medium transition-all"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    </div>

                    {isYellowDropdownOpen && yellowTeam.length < 3 && (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg divide-y divide-gray-100">
                        {filteredYellowAthletes.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 text-center">Nenhum atleta disponível encontrado</div>
                        ) : (
                          filteredYellowAthletes.map(athlete => (
                            <button
                              type="button"
                              key={`autocomplete-yellow-${athlete.id}`}
                              onClick={() => {
                                toggleAthlete(athlete.id, 'yellow');
                                setYellowSearch('');
                                setIsYellowDropdownOpen(false);
                              }}
                              className="w-full text-left p-2 hover:bg-yellow-50 flex items-center gap-2.5 transition-colors"
                            >
                              {athlete.photoUrl ? (
                                <img src={athlete.photoUrl} className="w-7 h-7 rounded-full object-cover border border-gray-100" alt="" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold">
                                  {athlete.name.charAt(0)}
                                </div>
                              )}
                              <span className="text-sm font-medium text-gray-800">{athlete.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* List of selected athletes */}
                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-semibold text-yellow-600">Jogadores selecionados:</p>
                    {yellowTeam.map((athleteId, idx) => {
                      const athlete = athletes.find(a => a.id === athleteId);
                      if (!athlete) return null;
                      return (
                        <div key={`selected-yellow-${athleteId}`} className="p-2 bg-white rounded-lg border border-yellow-100 flex items-center justify-between shadow-sm hover:border-yellow-200 transition-colors gap-2">
                          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                            {athlete.photoUrl ? (
                              <img src={athlete.photoUrl} className="w-8 h-8 rounded-full object-cover border shrink-0" alt="" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-sm font-bold shrink-0">
                                {athlete.name.charAt(0)}
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-800 truncate">{athlete.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {dailyAthleteIds.length > 0 && (
                              <select
                                value={athleteId}
                                onChange={(e) => {
                                  const newId = e.target.value;
                                  if (newId && newId !== athleteId) {
                                    const newYellow = [...yellowTeam];
                                    newYellow[idx] = newId;
                                    setYellowTeam(newYellow);
                                  }
                                }}
                                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:ring-1 focus:ring-yellow-500 max-w-[110px]"
                              >
                                <option value={athleteId}>Substituir...</option>
                                {dailyAthleteIds
                                  .filter(id => !blueTeam.includes(id) && !yellowTeam.includes(id))
                                  .map(id => {
                                    const auth = athletes.find(a => a.id === id);
                                    return auth ? (
                                      <option key={`sub-yellow-${id}`} value={id}>
                                        {auth.name}
                                      </option>
                                    ) : null;
                                  })}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleAthlete(athleteId, 'yellow')}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                              title="Remover"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {yellowTeam.length === 0 && (
                      <div className="py-6 border-2 border-dashed border-yellow-200 rounded-lg text-center text-xs text-yellow-400">
                        Nenhum jogador escalado
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={blueTeam.length !== 3 || yellowTeam.length !== 3}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Atletas do Dia */}
      {isDailyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/55 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Lista de Presença</h2>
                  <p className="text-xs text-gray-500">Selecione e organize a fila de presença para formar os trios de hoje</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDailyModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Container */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
              {/* Left column: Add/Search */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 block">Adicionar Atleta Presente</label>
                  <div className="relative" ref={dailyDropdownRef}>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar atleta pelo nome..."
                        value={dailySearch}
                        onChange={(e) => {
                          setDailySearch(e.target.value);
                          setIsDailyDropdownOpen(true);
                        }}
                        onFocus={() => setIsDailyDropdownOpen(true)}
                        className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-400 font-medium transition-all"
                      />
                      <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-gray-400" />
                    </div>

                    {isDailyDropdownOpen && (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl divide-y divide-gray-100">
                        {filteredDailyAthletes.length === 0 ? (
                          <div className="p-4 text-xs text-gray-500 text-center">Nenhum atleta disponível para adicionar</div>
                        ) : (
                          filteredDailyAthletes.map(athlete => (
                            <button
                              type="button"
                              key={`daily-search-${athlete.id}`}
                              onClick={() => addDailyAthlete(athlete.id)}
                              className="w-full text-left p-3 hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                            >
                              {athlete.photoUrl ? (
                                <img src={athlete.photoUrl} className="w-8 h-8 rounded-full object-cover border border-gray-100" alt="" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                                  {athlete.name.charAt(0)}
                                </div>
                              )}
                              <span className="text-sm font-semibold text-gray-800">{athlete.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info and quick actions */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Ações de Organização</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Você pode arrastar os atletas para mudar a ordem ou usar os botões de subir/descer. Os primeiros 6 formam as equipes.
                  </p>
                  
                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={scaleNextSix}
                      disabled={dailyAthleteIds.length < 6}
                      className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-100"
                    >
                      <Check className="h-4 w-4" />
                      Escalar Próximos 6 na Partida
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => rotateDailyQueue(3)}
                        disabled={dailyAthleteIds.length <= 3}
                        className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 disabled:opacity-50 text-gray-700 rounded-xl text-[10px] font-bold transition-colors flex items-center justify-center gap-1"
                        title="Move os 3 primeiros para o final"
                      >
                        <RefreshCw className="h-3 w-3 text-gray-400 shrink-0" />
                        Rotacionar 3
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateDailyQueue(6)}
                        disabled={dailyAthleteIds.length <= 6}
                        className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 disabled:opacity-50 text-gray-700 rounded-xl text-[10px] font-bold transition-colors flex items-center justify-center gap-1"
                        title="Move os 6 primeiros para o final"
                      >
                        <RefreshCw className="h-3 w-3 text-gray-400 shrink-0" />
                        Rotacionar 6
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await showConfirm("Deseja mesmo limpar toda a lista de presença?", "Limpar Lista", "warning");
                        if (confirmed) {
                          setDailyAthleteIds([]);
                          await saveDailyAthletes([]);
                        }
                      }}
                      disabled={dailyAthleteIds.length === 0}
                      className="w-full mt-1 px-3 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      Limpar Lista de Presença
                    </button>
                  </div>
                </div>
              </div>

              {/* Right column: Presence List & Drag n Drop */}
              <div className="lg:col-span-7 flex flex-col min-h-[300px]">
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <span className="text-sm font-bold text-gray-700">Fila de Presença ({dailyAthleteIds.length} Atletas)</span>
                  <span className="text-[10px] text-gray-400 font-medium">Arraste para reordenar</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[450px]">
                  {dailyAthleteIds.map((athleteId, index) => {
                    const athlete = athletes.find(a => a.id === athleteId);
                    if (!athlete) return null;

                    // Group styling
                    let groupBadge = "";
                    let groupClass = "border-gray-200 bg-white";
                    
                    if (index < 3) {
                      groupBadge = "Time Azul";
                      groupClass = "border-blue-200 bg-blue-50/40";
                    } else if (index < 6) {
                      groupBadge = "Time Amarelo";
                      groupClass = "border-yellow-200 bg-yellow-50/40";
                    } else {
                      groupBadge = `Próximo (${index - 5})`;
                      groupClass = "border-gray-200 bg-gray-50/30";
                    }

                    const isDragged = draggedIndex === index;

                    return (
                      <div
                        key={`daily-list-${athleteId}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-3 border rounded-xl shadow-sm transition-all ${groupClass} ${
                          isDragged ? "opacity-30 border-dashed border-emerald-400 bg-emerald-50/10 cursor-grabbing" : "cursor-grab hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          {/* Drag Handle */}
                          <div className="text-gray-400 hover:text-gray-600 shrink-0 cursor-grabbing">
                            <GripVertical className="h-5 w-5" />
                          </div>

                          {/* Number and Avatar */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black text-gray-400 w-5 text-center">#{index + 1}</span>
                            {athlete.photoUrl ? (
                              <img src={athlete.photoUrl} className="w-8 h-8 rounded-full object-cover border" alt="" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold border">
                                {athlete.name.charAt(0)}
                              </div>
                            )}
                          </div>

                          {/* Name and badge */}
                          <div className="truncate flex flex-col">
                            <span className="text-sm font-semibold text-gray-800 truncate">{athlete.name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full w-fit mt-0.5 ${
                              index < 3 ? "bg-blue-100 text-blue-700" :
                              index < 6 ? "bg-yellow-100 text-yellow-800" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {groupBadge}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Move up */}
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveAthlete(index, 'up')}
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
                            title="Mover para cima"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          {/* Move down */}
                          <button
                            type="button"
                            disabled={index === dailyAthleteIds.length - 1}
                            onClick={() => moveAthlete(index, 'down')}
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
                            title="Mover para baixo"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => removeDailyAthlete(athleteId)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-1"
                            title="Remover presença"
                          >
                            <X className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {dailyAthleteIds.length === 0 && (
                    <div className="py-16 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                      <Users className="h-10 w-10 text-gray-300 mb-2" />
                      <p className="text-sm font-bold text-gray-500">Nenhum atleta presente</p>
                      <p className="text-xs text-gray-400 max-w-xs mt-1">Busque atletas na barra de pesquisa ao lado para adicioná-los à lista de presença de hoje.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsDailyModalOpen(false)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
