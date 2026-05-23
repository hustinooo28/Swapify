import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isBanned: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isBanned: false,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const banCheckInProgress = useRef(false);
  const initialCheckDone = useRef(false);

  const checkBanStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_banned')
        .eq('id', userId)
        .single();
      return data?.is_banned === true;
    } catch {
      return false;
    }
  };

  const handleSession = async (newSession: Session | null) => {
    // Prevent concurrent ban checks
    if (banCheckInProgress.current) return;

    if (!newSession?.user) {
      setSession(null);
      setLoading(false);
      return;
    }

    banCheckInProgress.current = true;
    try {
      const banned = await checkBanStatus(newSession.user.id);
      if (banned) {
        await supabase.auth.signOut();
        setIsBanned(true);
        setSession(null);
      } else {
        setIsBanned(false);
        setSession(newSession);
      }
    } catch {
      // On error, let them in — don't block on ban check failure
      setSession(newSession);
    } finally {
      banCheckInProgress.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get initial session with timeout
    const sessionTimeout = setTimeout(() => {
      if (!initialCheckDone.current) {
        initialCheckDone.current = true;
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      if (!initialCheckDone.current) {
        initialCheckDone.current = true;
        handleSession(session);
      }
    });

    // Listen to auth state changes — but skip INITIAL_SESSION
    // since we handle it above via getSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION — already handled by getSession()
        if (event === 'INITIAL_SESSION') return;
        await handleSession(session);
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(sessionTimeout);
    };
  }, []);

  // Realtime ban detection
  useEffect(() => {
    if (!session?.user) return;

    const channel = supabase
      .channel(`ban_watch_${session.user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${session.user.id}`,
      }, async (payload) => {
        if (payload.new.is_banned === true) {
          await supabase.auth.signOut();
          setIsBanned(true);
          setSession(null);
        } else if (payload.new.is_banned === false) {
          setIsBanned(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsBanned(false);
    setSession(null);
  };

  return { session, user: session?.user ?? null, loading, isBanned, signOut };
}

export { AuthContext };