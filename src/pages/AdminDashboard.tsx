import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Activity, Shield } from 'lucide-react';

export default function AdminDashboard() {
  const adminLinks = [
    {
      title: 'Gerenciar Partidas',
      description: 'Criar novas partidas, acessar placar e editar resultados.',
      icon: <Activity className="h-8 w-8 text-blue-600 mb-4" />,
      path: '/admin/matches',
      color: 'bg-blue-50 border-blue-100 hover:border-blue-300'
    },
    {
      title: 'Gerenciar Atletas',
      description: 'Cadastrar novos atletas, editar perfis e remover.',
      icon: <Users className="h-8 w-8 text-yellow-600 mb-4" />,
      path: '/admin/athletes',
      color: 'bg-yellow-50 border-yellow-100 hover:border-yellow-300'
    },
    {
      title: 'Gerenciar Administradores',
      description: 'Adicionar ou remover acesso administrativo.',
      icon: <Shield className="h-8 w-8 text-gray-600 mb-4" />,
      path: '/admin/admins',
      color: 'bg-gray-50 border-gray-200 hover:border-gray-400'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Painel de Administração</h1>
        <p className="text-gray-500">Selecione uma área abaixo para gerenciar o sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {adminLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`p-6 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md ${link.color}`}
          >
            {link.icon}
            <h2 className="text-xl font-bold text-gray-900 mb-2">{link.title}</h2>
            <p className="text-sm text-gray-600">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
