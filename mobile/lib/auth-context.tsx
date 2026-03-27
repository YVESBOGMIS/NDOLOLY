import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { clearToken, getToken, setToken } from './auth';
import { setAuthFailureHandler } from './api';

type AuthContextValue = {
  token: string | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const load = async () => {
      const stored = await getToken();
      setTokenState(stored);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    setAuthFailureHandler(async () => {
      setTokenState(null);
    });
    return () => {
      setAuthFailureHandler(null);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) {
      router.replace('/login');
    }
    if (token && inAuth) {
      router.replace('/(tabs)/encounters');
    }
  }, [token, loading, segments, router]);

  const value = useMemo(
    () => ({
      token,
      loading,
      signIn: async (newToken: string) => {
        await setToken(newToken);
        setTokenState(newToken);
      },
      signOut: async () => {
        await clearToken();
        setTokenState(null);
      },
    }),
    [token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
