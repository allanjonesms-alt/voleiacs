import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, isAdmin: false, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser?.email) {
        const lowerEmail = currentUser.email.toLowerCase();
        let isUserAdmin = false;
        let adminData: any = null;

        if (lowerEmail === 'allanjonesms@gmail.com') {
          isUserAdmin = true;
          adminData = {
            name: currentUser.displayName || 'Allan Jones',
            email: lowerEmail,
            createdAt: Date.now()
          };
        } else {
          const adminDoc = await getDoc(doc(db, 'admins', lowerEmail));
          if (adminDoc.exists()) {
            isUserAdmin = true;
            adminData = adminDoc.data();
          }
        }

        if (isUserAdmin) {
          setIsAdmin(true);
          try {
            // Sync UID to make sure security rules authorize the admin seamlessly
            await setDoc(doc(db, 'admins', currentUser.uid), {
              name: adminData?.name || currentUser.displayName || 'Administrador',
              email: lowerEmail,
              uid: currentUser.uid,
              createdAt: adminData?.createdAt || Date.now()
            });
          } catch (err) {
            console.error('Error syncing admin UID document:', err);
          }
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
