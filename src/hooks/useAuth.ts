import { useState, useEffect, createContext, useContext } from 'react';
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

  const checkBanStatus = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('is_banned')
      .eq('id', userId)
      .single();
    return data?.is_banned === true;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const banned = await checkBanStatus(session.user.id);
        if (banned) {
          await supabase.auth.signOut();
          setIsBanned(true);
          setSession(null);
        } else {
          setIsBanned(false);
          setSession(session);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const banned = await checkBanStatus(session.user.id);
        if (banned) {
          await supabase.auth.signOut();
          setIsBanned(true);
          setSession(null);
        } else {
          setIsBanned(false);
          setSession(session);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime ban detection — kicks user out the moment admin bans them
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
          // Admin unbanned them — clear banned state
          setIsBanned(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsBanned(false);
  };

  return { session, user: session?.user ?? null, loading, isBanned, signOut };
}

export { AuthContext };