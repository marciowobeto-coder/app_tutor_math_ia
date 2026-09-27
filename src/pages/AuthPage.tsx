import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Loader2, Lock, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const AuthPage = () => {
  const navigate = useNavigate();
  const { signIn, user, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Informe usuário e senha.');
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(username, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Bem-vindo de volta!');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="gradient-hero px-6 pt-16 pb-24 rounded-b-3xl text-center">
        <GraduationCap className="w-12 h-12 text-primary-foreground mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-primary-foreground font-heading">TutorMath AI</h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          Entre para continuar seus estudos
        </p>
      </div>

      <main className="max-w-md w-full mx-auto px-4 -mt-16">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-2xl shadow-lg p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold font-heading text-foreground">Acessar conta</h2>

          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Usuário
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu.usuario"
                className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Não tem conta? Peça a um administrador para criar seu acesso.
          </p>
        </motion.form>
      </main>
    </div>
  );
};

export default AuthPage;
