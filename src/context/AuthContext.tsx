'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/types';
import { authService } from '@/lib/services/authService';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, password?: string) => Promise<User>;
  register: (email: string, password?: string, displayName?: string) => Promise<User>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  requireAuth: (returnTo?: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function initAuth() {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsGuest(false);
        } else {
          // If no stored user, default to guest mode so they can browse freely
          setIsGuest(true);
        }
      } catch (err) {
        console.error('Failed to init auth', err);
        setIsGuest(true);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email: string, password?: string): Promise<User> => {
    setIsLoading(true);
    try {
      const loggedUser = await authService.login(email, password);
      setUser(loggedUser);
      setIsGuest(false);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password?: string, displayName?: string): Promise<User> => {
    setIsLoading(true);
    try {
      const registeredUser = await authService.register(email, password, displayName);
      setUser(registeredUser);
      setIsGuest(false);
      return registeredUser;
    } finally {
      setIsLoading(false);
    }
  };

  const continueAsGuest = () => {
    setUser(null);
    setIsGuest(true);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setIsGuest(true);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const requireAuth = (returnTo = '/'): boolean => {
    if (user) return true;
    router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isGuest,
        login,
        register,
        continueAsGuest,
        logout,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
