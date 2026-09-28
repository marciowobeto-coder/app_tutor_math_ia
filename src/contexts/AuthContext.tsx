import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@app.local`;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  username: string | null;
  isAdmin: boolean;
  /** Blocos (séries) que este usuário pode acessar. Só é relevante para aluno — admin sempre
   * tem acesso a tudo, independentemente do que estiver aqui (ver checagens de `isAdmin`). */
  allowedSchoolYears: string[];
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedSchoolYears, setAllowedSchoolYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(false);

  useEffect(() => {
    const loadMeta = async (uid: string) => {
      setMetaLoading(true);
      const [{ data: profile }, { data: role }] = await Promise.all([
        supabase.from('profiles').select('username, allowed_school_years, active').eq('id', uid).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', uid).eq('role', 'admin').maybeSingle(),
      ]);
      // Usuário inativado pelo admin: encerra a sessão que ainda estiver aberta.
      if (profile?.active === false) {
        await supabase.auth.signOut();
        setMetaLoading(false);
        return;
      }
      setUsername(profile?.username ?? null);
      setAllowedSchoolYears(profile?.allowed_school_years ?? []);
      setIsAdmin(!!role);
      setMetaLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setMetaLoading(true);
        setTimeout(() => loadMeta(newSession.user.id), 0);
      } else {
        setUsername(null);
        setIsAdmin(false);
        setAllowedSchoolYears([]);
        setMetaLoading(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        setMetaLoading(true);
        loadMeta(data.session.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);


  const signIn = async (usernameInput: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(usernameInput),
      password,
    });
    if (error) {
      return {
        error: error.message.toLowerCase().includes('banned')
          ? 'Usuário inativo. Procure o administrador.'
          : error.message.toLowerCase().includes('invalid')
            ? 'Usuário ou senha incorretos.'
            : error.message,
      };
    }
    // Registra o login do dia (não bloqueia o fluxo em caso de falha)
    await supabase.rpc('record_login');

    return { error: null };
  };


  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, username, isAdmin, allowedSchoolYears, loading: loading || metaLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
