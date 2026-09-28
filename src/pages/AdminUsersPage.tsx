import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2, ShieldCheck, User, Pencil, Ban, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SchoolYear, SCHOOL_YEARS } from '@/types/math';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const ALL_YEAR_KEYS = Object.keys(SCHOOL_YEARS) as SchoolYear[];

interface AppUser {
  id: string;
  username: string;
  full_name: string | null;
  turma: string | null;
  role: string;
  allowed_school_years: string[];
  active: boolean;
  has_history: boolean;
  created_at: string;
}

class ApiError extends Error {
  code?: string;
}

const call = async (action: string, body?: unknown) => {
  const { data, error } = await supabase.functions.invoke(`admin-users?action=${action}`, {
    body: body ?? {},
  });
  if (error) {
    // Extract the real message returned by the edge function (non-2xx responses)
    let message = error.message;
    let code: string | undefined;
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      try {
        const payload = await res.clone().json();
        if (payload?.error) message = String(payload.error);
        if (payload?.code) code = String(payload.code);
      } catch {
        /* keep default message */
      }
    }
    const err = new ApiError(message);
    err.code = code;
    throw err;
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

/** "Todos os blocos" quando tem os 9, senão a lista de anos abreviados (ex.: "6º Ano, 7º Ano"). */
const describeYears = (years: string[]) => {
  if (years.length >= ALL_YEAR_KEYS.length) return 'Todos os blocos';
  if (years.length === 0) return 'Nenhum bloco liberado';
  return years
    .filter((y): y is SchoolYear => y in SCHOOL_YEARS)
    .map(y => SCHOOL_YEARS[y].shortLabel)
    .join(', ');
};

/** Checklist de blocos (séries), reutilizado no formulário de criação e no diálogo de edição. */
const YearsChecklist = ({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (year: SchoolYear) => void;
}) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {ALL_YEAR_KEYS.map(year => (
      <label
        key={year}
        className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <Checkbox
          checked={selected.includes(year)}
          onCheckedChange={() => onToggle(year)}
        />
        <span className="text-foreground">{SCHOOL_YEARS[year].shortLabel}</span>
      </label>
    ))}
  </div>
);

const AdminUsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turma, setTurma] = useState('');
  const [role, setRole] = useState<'aluno' | 'admin'>('aluno');
  const [fullName, setFullName] = useState('');
  const [newUserYears, setNewUserYears] = useState<string[]>([]);

  // Edição de um usuário já existente (todos os campos; senha em branco = mantém a atual).
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTurma, setEditTurma] = useState('');
  const [editRole, setEditRole] = useState<'aluno' | 'admin'>('aluno');
  const [editYears, setEditYears] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Provedor de IA usado pela função ai-tutor (dica, correção de passo, análise de foto/quadro).
  // Trocar aqui atualiza a tabela app_settings; a edge function lê o valor a cada chamada,
  // então o efeito é imediato pra todo mundo que estiver usando o app.
  const [aiProvider, setAiProvider] = useState<'anthropic' | 'groq'>('anthropic');
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [savingProvider, setSavingProvider] = useState(false);

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

  const loadProvider = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_provider')
        .maybeSingle();
      if (error) throw error;
      if (data?.value === 'groq' || data?.value === 'anthropic') {
        setAiProvider(data.value);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar provedor de IA');
    } finally {
      setLoadingProvider(false);
    }
  };

  useEffect(() => {
    load();
    loadProvider();
  }, []);

  const handleProviderChange = async (value: 'anthropic' | 'groq') => {
    const previous = aiProvider;
    setAiProvider(value);
    setSavingProvider(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value })
        .eq('key', 'ai_provider');
      if (error) throw error;
      toast.success(`Provedor de IA alterado para ${value === 'groq' ? 'Groq' : 'Anthropic'}.`);
    } catch (e) {
      setAiProvider(previous);
      toast.error(e instanceof Error ? e.message : 'Erro ao alterar provedor de IA');
    } finally {
      setSavingProvider(false);
    }
  };

  const toggleNewUserYear = (year: SchoolYear) => {
    setNewUserYears(prev => (prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 3) {
      toast.error('Informe o nome completo.');
      return;
    }
    if (username.trim().length < 3) {
      toast.error('Usuário deve ter ao menos 3 caracteres.');
      return;
    }
    if (password.length < 6) {
      toast.error('Senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (role === 'aluno' && newUserYears.length === 0) {
      toast.error('Selecione ao menos um bloco (série) para o aluno.');
      return;
    }
    setCreating(true);
    try {
      await call('create', {
        fullName,
        username,
        password,
        role,
        turma,
        allowedSchoolYears: role === 'aluno' ? newUserYears : ALL_YEAR_KEYS,
      });
      toast.success(`Usuário "${username}" criado.`);
      setFullName('');
      setUsername('');
      setPassword('');
      setTurma('');
      setRole('aluno');
      setNewUserYears([]);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const handleSetActive = async (u: AppUser, active: boolean) => {
    try {
      await call('set-active', { id: u.id, active });
      toast.success(active ? `Usuário "${u.username}" reativado.` : `Usuário "${u.username}" inativado.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar situação do usuário');
    }
  };

  const handleDelete = async (u: AppUser) => {
    // Quem já tem histórico não pode ser excluído (perderia os dados do relatório): oferece inativar.
    if (u.has_history) {
      if (u.active && confirm(`"${u.username}" já possui histórico e não pode ser excluído. Deseja inativá-lo?`)) {
        await handleSetActive(u, false);
      } else if (!u.active) {
        toast.info(`"${u.username}" possui histórico e já está inativo.`);
      }
      return;
    }
    if (!confirm(`Excluir o usuário "${u.username}"?`)) return;
    try {
      await call('delete', { id: u.id });
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast.success('Usuário excluído.');
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'has_history') {
        if (confirm(`${err.message}\n\nDeseja inativar "${u.username}"?`)) await handleSetActive(u, false);
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir usuário');
    }
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setEditFullName(u.full_name ?? '');
    setEditUsername(u.username);
    setEditPassword('');
    setEditTurma(u.turma ?? '');
    setEditRole(u.role === 'admin' ? 'admin' : 'aluno');
    setEditYears(u.allowed_school_years?.length ? u.allowed_school_years : ALL_YEAR_KEYS);
  };

  const toggleEditYear = (year: SchoolYear) => {
    setEditYears(prev => (prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]));
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (editUsername.trim().length < 3) {
      toast.error('Usuário deve ter ao menos 3 caracteres.');
      return;
    }
    if (editPassword && editPassword.length < 6) {
      toast.error('Senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (editRole === 'aluno' && editYears.length === 0) {
      toast.error('Selecione ao menos um bloco (série) para o aluno.');
      return;
    }
    setSavingEdit(true);
    try {
      await call('update', {
        id: editingUser.id,
        fullName: editFullName,
        username: editUsername,
        password: editPassword || undefined,
        turma: editTurma,
        role: editRole,
        allowedSchoolYears: editRole === 'aluno' ? editYears : ALL_YEAR_KEYS,
      });
      toast.success(`Usuário "${editUsername}" atualizado.`);
      setEditingUser(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar usuário');
    } finally {
      setSavingEdit(false);
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
            Crie, edite, inative e remova acessos à plataforma
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-4 pb-12 space-y-6">
        <section className="bg-card border border-border rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="font-semibold font-heading text-foreground">Provedor de IA</h2>
          <p className="text-sm text-muted-foreground">
            Usado pela dica, correção de passo e análise de foto/quadro branco. A troca vale
            imediatamente para todos que estiverem usando o app.
          </p>
          <select
            value={aiProvider}
            disabled={loadingProvider || savingProvider}
            onChange={(e) => handleProviderChange(e.target.value as 'anthropic' | 'groq')}
            className="rounded-xl border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="groq">Groq</option>
          </select>
        </section>

        <form
          onSubmit={handleCreate}
          className="bg-card border border-border rounded-2xl shadow-sm p-5 space-y-4"
        >
          <h2 className="font-semibold font-heading text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Novo usuário
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="nome completo"
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring sm:col-span-2 lg:col-span-4"
            />
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

          {role === 'aluno' && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Blocos (séries) que este aluno poderá acessar
              </p>
              <YearsChecklist selected={newUserYears} onToggle={toggleNewUserYear} />
            </div>
          )}

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
                <li
                  key={u.id}
                  className={`flex items-center justify-between py-3 gap-2 ${u.active === false ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {u.role === 'admin' ? (
                      <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-foreground font-medium flex items-center gap-2">
                        {u.full_name || u.username}
                        {u.active === false && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            Inativo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {u.full_name ? <span className="normal-case">{u.username} · </span> : null}
                        {u.role}{u.turma ? ` · Turma ${u.turma}` : ''}
                      </div>
                      {u.role === 'aluno' && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {describeYears(u.allowed_school_years ?? [])}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                      aria-label={`Editar ${u.username}`}
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSetActive(u, u.active === false)}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                      aria-label={u.active === false ? `Reativar ${u.username}` : `Inativar ${u.username}`}
                      title={u.active === false ? 'Reativar' : 'Inativar'}
                    >
                      {u.active === false ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label={`Excluir ${u.username}`}
                      title={u.has_history ? 'Possui histórico: só pode ser inativado' : 'Excluir'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar {editingUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="font-medium text-foreground">Nome completo</span>
              <input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium text-foreground">Usuário</span>
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium text-foreground">Nova senha</span>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="em branco = manter"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium text-foreground">Turma</span>
              <input
                value={editTurma}
                onChange={(e) => setEditTurma(e.target.value)}
                placeholder="ex.: 5º A"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium text-foreground">Perfil</span>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'aluno' | 'admin')}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="aluno">Aluno</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
          </div>
          {editRole === 'aluno' && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Blocos (séries)</p>
              <YearsChecklist selected={editYears} onToggle={toggleEditYear} />
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setEditingUser(null)}
              className="rounded-xl border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="rounded-xl bg-primary text-primary-foreground font-medium px-4 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
            >
              {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPage;
