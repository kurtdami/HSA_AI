'use client'
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth as firebaseAuth, app } from './firebase';

interface AuthContextProps {
  user: User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps>({ user: null, logout: () => {} });

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!app || !firebaseAuth) {
          console.error("Firebase app or auth is not initialized");
          setLoading(false);
          return;
        }

        console.log("Initializing auth listener");
        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          console.log("Auth state changed", user);
          setUser(user);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error in AuthProvider useEffect:", error);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const logout = async () => {
    try {
      if (!app) {
        console.error("Firebase app is not initialized");
        return;
      }

      await signOut(firebaseAuth);
      console.log("User signed out");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
