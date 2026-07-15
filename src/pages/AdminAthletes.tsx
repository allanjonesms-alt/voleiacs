import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Athlete } from '../types';
import { Plus, Edit2, Trash2, X, Upload, RefreshCw } from 'lucide-react';
import ImageCropper from '../components/ImageCropper';
import { useDialog } from '../contexts/DialogContext';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const getAge = (dateStr?: string) => {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return isNaN(age) ? null : age;
};

export default function AdminAthletes() {
  const { showAlert, showConfirm } = useDialog();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculateStats = async () => {
    const confirmed = await showConfirm('Deseja recalcular as estatísticas de todos os atletas a partir do histórico de todas as partidas finalizadas de hoje e anteriores? Isso corrigirá qualquer erro nos números de vitórias e derrotas.', 'Recalcular Estatísticas', 'warning');
    if (!confirmed) {
      return;
    }
    setIsRecalculating(true);
    try {
      // 1. Fetch all completed matches
      const matchesSnap = await getDocs(collection(db, 'matches'));
      const completedMatches: any[] = [];
      matchesSnap.forEach(docSnap => {
        const m = docSnap.data();
        if (m.status === 'completed') {
          completedMatches.push({ id: docSnap.id, ...m });
        }
      });

      // 2. Fetch all athletes
      const athletesSnap = await getDocs(collection(db, 'athletes'));
      const athletesList: any[] = [];
      athletesSnap.forEach(docSnap => {
        athletesList.push({ id: docSnap.id, ...docSnap.data() });
      });

      // 3. Initialize counts
      const statsMap: Record<string, { wins: number; losses: number }> = {};
      athletesList.forEach(ath => {
        statsMap[ath.id] = { wins: 0, losses: 0 };
      });

      // 4. Calculate stats from matches
      completedMatches.forEach(match => {
        const bScore = match.blueScore || 0;
        const yScore = match.yellowScore || 0;
        const bTb = match.blueTiebreakScore || 0;
        const yTb = match.yellowTiebreakScore || 0;

        let winner: 'blue' | 'yellow' | null = null;

        // Apply same rules as checkWinner
        if ((bScore >= 7 && yScore === 0) || (yScore >= 7 && bScore === 0)) {
          winner = bScore > yScore ? 'blue' : 'yellow';
        } else if (bScore === 9 && yScore === 9) {
          if (bTb >= 3 || yTb >= 3) {
            winner = bTb > yTb ? 'blue' : 'yellow';
          } else if (bTb !== yTb) {
            winner = bTb > yTb ? 'blue' : 'yellow';
          }
        } else if (bScore !== yScore) {
           winner = bScore > yScore ? 'blue' : 'yellow';
        } else {
           winner = null;
        }

        if (winner) {
          const winningTeam = winner === 'blue' ? (match.blueTeam || []) : (match.yellowTeam || []);
          const losingTeam = winner === 'blue' ? (match.yellowTeam || []) : (match.blueTeam || []);

          winningTeam.forEach((id: string) => {
            if (statsMap[id]) {
              statsMap[id].wins += 1;
            }
          });
          losingTeam.forEach((id: string) => {
            if (statsMap[id]) {
              statsMap[id].losses += 1;
            }
          });
        }
      });

      // 5. Update Firestore using batch
      const batch = writeBatch(db);
      let updatedCount = 0;

      for (const ath of athletesList) {
        const computed = statsMap[ath.id];
        const currentWins = ath.wins || 0;
        const currentLosses = ath.losses || 0;

        if (computed.wins !== currentWins || computed.losses !== currentLosses) {
          const athRef = doc(db, 'athletes', ath.id);
          batch.update(athRef, {
            wins: computed.wins,
            losses: computed.losses
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
      }

      await showAlert(`Estatísticas recalculadas com sucesso!\n\nPartidas finalizadas processadas: ${completedMatches.length}\nAtletas atualizados com correções: ${updatedCount}`, 'Sucesso', 'success');
    } catch (err) {
      console.error('Erro ao recalcular estatísticas:', err);
      await showAlert('Ocorreu um erro ao recalcular as estatísticas.', 'Erro', 'danger');
    } finally {
      setIsRecalculating(false);
    }
  };
  
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'MASCULINO' | 'FEMININO' | ''>('');
  const [rawImageSrc, setRawImageSrc] = useState('');
  const [isCropping, setIsCropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'athletes'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Athlete[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Athlete);
      });
      setAthletes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setName('');
    setPhotoUrl('');
    setBirthDate('');
    setGender('');
    setRawImageSrc('');
    setIsCropping(false);
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleEdit = (athlete: Athlete) => {
    setName(athlete.name);
    setPhotoUrl(athlete.photoUrl);
    setBirthDate(athlete.birthDate || '');
    setGender(athlete.gender || '');
    setEditingId(athlete.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm('Tem certeza que deseja excluir este atleta?', 'Excluir Atleta', 'danger');
    if (confirmed) {
      await deleteDoc(doc(db, 'athletes', id));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // generous 10MB limit for original raw image
        await showAlert('A imagem original deve ter menos de 10MB.', 'Arquivo muito grande', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawImageSrc(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      photoUrl,
      birthDate,
      gender: gender || null,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'athletes', editingId), data);
      } else {
        await addDoc(collection(db, 'athletes'), {
          ...data,
          wins: 0,
          losses: 0,
          createdAt: Date.now()
        });
      }
      resetForm();
    } catch (error) {
      console.error('Error saving athlete:', error);
      await showAlert('Erro ao salvar atleta.', 'Erro', 'danger');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atletas</h1>
          <p className="text-gray-500 text-sm">Gerencie os atletas do VOLEI ACS</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRecalculateStats}
            disabled={isRecalculating}
            className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-sm shrink-0 disabled:opacity-50"
            title="Corrige quaisquer inconsistências recalculando vitórias/derrotas do histórico completo de partidas concluídas"
          >
            <RefreshCw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Recalculando...' : 'Recalcular Estatísticas'}
          </button>
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-sm shrink-0 animate-fade-in"
          >
            <Plus className="h-4 w-4" />
            Novo Atleta
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : athletes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum atleta cadastrado.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {athletes.map(athlete => (
              <li key={athlete.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  {athlete.photoUrl ? (
                    <img src={athlete.photoUrl} alt={athlete.name} className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                      <span className="text-gray-400 font-bold text-lg">{athlete.name.charAt(0)}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-gray-900 flex items-center gap-2">
                      {athlete.name}
                      {athlete.gender && (
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          athlete.gender === 'MASCULINO' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                        }`}>
                          {athlete.gender}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                      <p>{athlete.wins} Vitórias | {athlete.losses} Derrotas</p>
                      {athlete.birthDate && (
                        <p>
                          Nascimento: {formatDate(athlete.birthDate)} {getAge(athlete.birthDate) !== null && `(${getAge(athlete.birthDate)} anos)`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(athlete)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(athlete.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Editar Atleta' : 'Novo Atleta'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Nome do atleta"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value as 'MASCULINO' | 'FEMININO' | '')}
                  className="w-full border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
                >
                  <option value="">Não informado</option>
                  <option value="MASCULINO">MASCULINO</option>
                  <option value="FEMININO">FEMININO</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
                {isCropping && rawImageSrc ? (
                  <div className="mt-2 bg-white p-2 rounded-xl border border-gray-100 shadow-inner">
                    <ImageCropper
                      imageSrc={rawImageSrc}
                      onCrop={(croppedBase64) => {
                        setPhotoUrl(croppedBase64);
                        setIsCropping(false);
                        setRawImageSrc('');
                      }}
                      onCancel={() => {
                        setIsCropping(false);
                        setRawImageSrc('');
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    {photoUrl ? (
                      <div className="relative">
                        <img src={photoUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow" />
                        <span className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shadow">OK</span>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border border-dashed border-gray-300">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1 shadow-sm transition-colors"
                        >
                          <Upload className="h-3 w-3" />
                          {photoUrl ? 'Alterar Foto' : 'Escolher Imagem'}
                        </button>
                        {photoUrl && (
                          <button 
                            type="button" 
                            onClick={() => setPhotoUrl('')} 
                            className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">Selecione uma foto do atleta para poder cortar, girar e dar zoom.</p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
