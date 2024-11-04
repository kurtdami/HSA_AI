'use client'
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth as firebaseAuth } from './firebase';
import { useRouter } from 'next/navigation';

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  error: null,
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (!firebaseAuth) {
          setError('Firebase Auth is not initialized');
          setLoading(false);
          return;
        }

        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          setUser(user);
          setLoading(false);
          
          // Handle navigation based on auth state
          if (!user && window.location.pathname !== '/') {
            router.push('/');
          } else if (user && window.location.pathname === '/') {
            router.push('/expenses');
          }
        }, (error) => {
          console.error('Auth state change error:', error);
          setError(error.message);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Auth initialization error:', error);
        setError(error instanceof Error ? error.message : 'Authentication error');
        setLoading(false);
      }
    }
  }, [router]);

  const logout = async () => {
    if (!firebaseAuth) {
      setError('Firebase Auth is not initialized');
      return;
    }
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      console.error('Logout error:', error);
      setError(error instanceof Error ? error.message : 'Logout error');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
