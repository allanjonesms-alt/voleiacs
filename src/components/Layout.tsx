import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loginWithGoogle, logout } from '../lib/firebase';
import { useDialog } from '../contexts/DialogContext';
import { Volleyball, ShieldAlert, LogOut, LogIn, Users } from 'lucide-react';

export default function Layout() {
  const { user, isAdmin, loading } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error("Login component caught error:", error);
      const errorMessage = error?.message || String(error);
      const isUnauthorizedDomain = 
        errorMessage.includes("auth/unauthorized-domain") || 
        error?.code === "auth/unauthorized-domain";

      const isPopupError = 
        errorMessage.includes("auth/cancelled-popup-request") ||
        errorMessage.includes("auth/popup-blocked") ||
        error?.code === "auth/cancelled-popup-request" ||
        error?.code === "auth/popup-blocked";

      if (isUnauthorizedDomain) {
        const currentDomain = window.location.hostname;
        const currentOrigin = window.location.origin;
        await showAlert(
          `Erro de Domínio Não Autorizado (unauthorized-domain).\n\nPara habilitar o login de administradores, adicione este domínio como autorizado no Console do Firebase:\n\n1. Acesse o Console do Firebase (https://console.firebase.google.com)\n2. Vá no seu projeto ("gen-lang-client-0506636251")\n3. Acesse Authentication -> Configurações (Settings) -> Domínios Autorizados (Authorized Domains)\n4. Adicione os seguintes domínios:\n   👉 ${currentDomain}\n   👉 ais-dev-ws4socl3srqgpdrmfmpwes-45221046979.us-east1.run.app\n   👉 ais-pre-ws4socl3srqgpdrmfmpwes-45221046979.us-east1.run.app\n\nApós salvar no Firebase Console, recarregue esta página e tente entrar novamente.`,
          "Domínio Não Autorizado no Firebase",
          "warning"
        );
      } else if (isPopupError) {
        const confirmOpen = await showConfirm(
          `A janela de login do Google foi bloqueada ou cancelada pelo navegador.\n\nIsso ocorre frequentemente porque o aplicativo está sendo executado dentro de um painel (iframe) do AI Studio.\n\nDeseja abrir o aplicativo diretamente em uma nova aba para fazer o login de administrador com segurança?`,
          "Janela de Login Bloqueada",
          "warning"
        );
        if (confirmOpen) {
          window.open(window.location.href, "_blank");
        }
      } else {
        await showAlert(`Erro ao fazer login: ${errorMessage}`, "Erro de Autenticação", "danger");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <Volleyball className="h-8 w-8 text-yellow-300" />
            <span className="font-bold text-xl tracking-tight">VOLEI ACS</span>
          </Link>

          <nav className="flex items-center space-x-4">
            <Link to="/athletes" className="flex items-center space-x-1 hover:text-yellow-300 transition-colors">
              <Users className="h-5 w-5" />
              <span className="hidden sm:inline">Atletas</span>
            </Link>
            {!loading && (
              <>
                {isAdmin && (
                  <Link to="/admin" className="flex items-center space-x-1 hover:text-yellow-300 transition-colors">
                    <ShieldAlert className="h-5 w-5" />
                    <span className="hidden sm:inline">Painel Admin</span>
                  </Link>
                )}
                {user ? (
                  <button onClick={handleLogout} className="flex items-center space-x-1 hover:text-yellow-300 transition-colors cursor-pointer">
                    <LogOut className="h-5 w-5" />
                    <span className="hidden sm:inline">Sair</span>
                  </button>
                ) : (
                  <button onClick={handleLogin} className="flex items-center space-x-1 hover:text-yellow-300 transition-colors cursor-pointer">
                    <LogIn className="h-5 w-5" />
                    <span className="hidden sm:inline">Entrar Admin</span>
                  </button>
                )}
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} VOLEI ACS. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
