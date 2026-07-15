import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Admin } from '../types';
import { Plus, Edit2, Trash2, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';

export default function AdminAdmins() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'admins'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Admin[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Admin);
      });
      setAdmins(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleEdit = (admin: Admin) => {
    setName(admin.name);
    setEmail(admin.email);
    setPhone(admin.phone || '');
    setEditingId(admin.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (id === user?.email) {
      await showAlert('Você não pode se excluir.', 'Ação não permitida', 'danger');
      return;
    }
    const confirmed = await showConfirm('Tem certeza que deseja remover este administrador?', 'Remover Administrador', 'danger');
    if (confirmed) {
      await deleteDoc(doc(db, 'admins', id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    
    const adminEmail = email.trim().toLowerCase();
    const data = {
      name: name.trim(),
      email: adminEmail,
      phone: phone.trim(),
      createdAt: editingId ? admins.find(a => a.id === editingId)?.createdAt : Date.now()
    };

    try {
      // Use email as document ID
      await setDoc(doc(db, 'admins', adminEmail), data);
      
      // If editing and email changed, delete old document
      if (editingId && editingId !== adminEmail) {
        await deleteDoc(doc(db, 'admins', editingId));
      }
      resetForm();
    } catch (error) {
      console.error('Error saving admin:', error);
      await showAlert('Erro ao salvar admin.', 'Erro', 'danger');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administradores</h1>
          <p className="text-gray-500 text-sm">Gerencie quem tem acesso ao painel admin</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Admin
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum administrador cadastrado além do root.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {admins.map(admin => (
              <li key={admin.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{admin.name}</p>
                    <p className="text-sm text-gray-500">{admin.email} • {admin.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(admin)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {admin.id !== user?.email && (
                    <button onClick={() => handleDelete(admin.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
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
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Editar Admin' : 'Novo Admin'}</h2>
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
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Google)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="exemplo@gmail.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (opcional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="(00) 00000-0000"
                />
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
