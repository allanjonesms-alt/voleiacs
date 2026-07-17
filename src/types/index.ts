export interface Athlete {
  id: string;
  name: string;
  photoUrl: string;
  wins: number;
  losses: number;
  createdAt: number;
  birthDate?: string; // Birth date formatted as YYYY-MM-DD
  gender?: 'MASCULINO' | 'FEMININO';
}

export interface Admin {
  id: string; // The email of the admin
  name: string;
  email: string;
  phone: string;
  createdAt: number;
}

export interface Match {
  id: string;
  date: number;
  blueTeam: string[]; // Athlete IDs
  yellowTeam: string[]; // Athlete IDs
  blueScore: number;
  yellowScore: number;
  blueTiebreakScore?: number;
  yellowTiebreakScore?: number;
  status: 'scheduled' | 'in_progress' | 'completed';
  createdAt: number;
  matchNumber?: number;
}
