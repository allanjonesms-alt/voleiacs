import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DialogProvider } from './contexts/DialogContext';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';

import Home from './pages/Home';
import AllMatches from './pages/AllMatches';
import AdminDashboard from './pages/AdminDashboard';
import AdminMatches from './pages/AdminMatches';
import AdminAthletes from './pages/AdminAthletes';
import AdminAdmins from './pages/AdminAdmins';
import MatchScoreboard from './pages/MatchScoreboard';

import AthletesList from './pages/AthletesList';

export default function App() {
  return (
    <DialogProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="matches" element={<AllMatches />} />
              <Route path="match/:matchId" element={<MatchScoreboard />} />
              <Route path="athletes" element={<AthletesList />} />
              
              <Route path="admin" element={<AuthGuard />}>
                <Route index element={<AdminDashboard />} />
                <Route path="matches" element={<AdminMatches />} />
                <Route path="athletes" element={<AdminAthletes />} />
                <Route path="admins" element={<AdminAdmins />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </DialogProvider>
  );
}
