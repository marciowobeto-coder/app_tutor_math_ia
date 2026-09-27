import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AppUser {
  id: string;
  username: string;
  turma: string | null;
  role: string;
  created_at: string;
}

const call = async (action: string, body?: unknown) => {
  const { data, error } = await supabase.functions.invoke(`admin-users?action=${action}`, {
    body: body ?? {},
  });
  if (error) {
    // Extract the real message returned by the edge function (non-2xx responses)
    let message = error.message;
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      try {
        const payload = await res.clone().json();
        if (payload?.error) message = String(payload.error);
      } catch {
        /* keep default message */
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

const AdminUsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turma, setTurma] = useState('');
  const [role, setRole] = useState<'aluno' | 'admin'>('aluno');

  const load = async () => {
    try {
      const data = await call('list');
      setUsers(data.users ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) {
      toast.error('Usuário deve ter ao menos 3 caracteres.');
      return;
    }
    if (password.length < 6) {
      toast.error('Senha deve ter ao menos 6 caracteres.');
      return;
    }
    setCreating(true);
    try {
      await call('create', { username, password, role, turma });
      toast.success(`Usuário "${username}" criado.`);
      setUsername('');
      setPassword('');
      setTurma('');
      setRole('aluno');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`Excluir o usuário "${u.username}"?`)) return;
    try {
      await call('delete', { id: u.id });
      toast.success('Usuário excluído.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir usuário');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero p-6 pb-10 rounded-b-3xl">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-primary-foreground/90 text-sm mb-4 hover:text-primary-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-2xl font-bold text-primary-foreground font-heading">
            Gerenciar usuários
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            Crie e remova acessos à plataforma
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-4 pb-12 space-y-6">
        <form
          onSubmit={handleCreate}
          className="bg-card border border-border rounded-2xl shadow-sm p-5 space-y-4"
        >
          <h2 className="font-semibold font-heading text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Novo usuário
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuário"
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="senha (mín. 6)"
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
              placeholder="turma (ex.: 5º A)"
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'aluno' | 'admin')}
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="aluno">Aluno</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-primary text-primary-foreground font-medium px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar usuário
          </button>
        </form>

        <section className="bg-card border border-border rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold font-heading text-foreground mb-3">Usuários</h2>
          {loading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {u.role === 'admin' ? (
                      <ShieldCheck className="w-4 h-4 text-primary" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="text-foreground font-medium">{u.username}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {u.role}{u.turma ? ` · Turma ${u.turma}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(u)}
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Excluir ${u.username}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminUsersPage;
