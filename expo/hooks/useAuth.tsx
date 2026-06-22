import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: UserRole;
  avatar: string | null;
}

interface SignUpParams {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role, avatar')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to load profile:', error.message);
      return null;
    }
    const p = (data as Profile | null) ?? null;
    setProfile(p);
    return p;
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (params: SignUpParams): Promise<{ needsConfirmation: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: { data: { name: params.name.trim(), phone: params.phone.trim() } },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const reloadProfile = useCallback(async (): Promise<Profile | null> => {
    if (session?.user) return loadProfile(session.user.id);
    return null;
  }, [session, loadProfile]);

  return useMemo(
    () => ({
      session,
      profile,
      loading,
      isAuthenticated: !!session,
      role: profile?.role ?? null,
      signIn,
      signUp,
      signOut,
      reloadProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, reloadProfile],
  );
});
