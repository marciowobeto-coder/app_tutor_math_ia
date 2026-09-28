import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, CalendarDays, Target, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ActivityRow {
  user_id: string;
  activity_date: string;
  logins: number;
  questions_done: number;
  questions_correct: number;
}

interface ProfileRow {
  id: string;
  username: string;
  turma: string | null;
}

const RANGES = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: 'Tudo', days: 0 },
];

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const AdminReportPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [turma, setTurma] = useState('todas');

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_daily_activity')
        .select('user_id, activity_date, logins, questions_done, questions_correct')
        .order('activity_date', { ascending: false });

      if (days > 0) {
        const from = new Date();
        from.setDate(from.getDate() - (days - 1));
        query = query.gte('activity_date', from.toISOString().slice(0, 10));
      }

      const [{ data: activity, error: actError }, { data: profileData, error: profError }] = await Promise.all([
        query,
        supabase.from('profiles').select('id, username, turma'),
      ]);

      if (actError) throw actError;
      if (profError) throw profError;

      setRows((activity ?? []) as ActivityRow[]);
      setProfiles(
        Object.fromEntries(((profileData ?? []) as ProfileRow[]).map(p => [p.id, p]))
      );
    } catch (e) {
      toast.error('Erro ao carregar relatório', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const turmas = useMemo(() => {
    const set = new Set<string>();
    Object.values(profiles).forEach(p => p.turma && set.add(p.turma));
    return Array.from(set).sort();
  }, [profiles]);

  const filtered = useMemo(
    () => rows.filter(r => turma === 'todas' || profiles[r.user_id]?.turma === turma),
    [rows, turma, profiles]
  );

  const totals = useMemo(() => {
    const done = filtered.reduce((a, r) => a + r.questions_done, 0);
    const correct = filtered.reduce((a, r) => a + r.questions_correct, 0);
    const logins = filtered.reduce((a, r) => a + r.logins, 0);
    return {
      done,
      correct,
      logins,
      accuracy: done > 0 ? Math.round((correct / done) * 100) : 0,
      students: new Set(filtered.map(r => r.user_id)).size,
    };
  }, [filtered]);

  const byUser = useMemo(() => {
    const map = new Map<string, { done: number; correct: number; logins: number; days: number }>();
    filtered.forEach(r => {
      const cur = map.get(r.user_id) ?? { done: 0, correct: 0, logins: 0, days: 0 };
      cur.done += r.questions_done;
      cur.correct += r.questions_correct;
      cur.logins += r.logins;
      cur.days += 1;
      map.set(r.user_id, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].done - a[1].done);
  }, [filtered]);

  const exportCsv = () => {
    const header = 'usuario,turma,data,logins,questoes_feitas,questoes_corretas\n';
    const body = filtered
      .map(r => {
        const p = profiles[r.user_id];
        return [p?.username ?? r.user_id, p?.turma ?? '', r.activity_date, r.logins, r.questions_done, r.questions_correct].join(',');
      })
      .join('\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-atividade-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero p-6 pb-8 rounded-b-3xl">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Voltar</span>
          </button>
          <h1 className="text-2xl font-bold text-primary-foreground font-heading flex items-center gap-2">
            <BarChart3 className="w-6 h-6" /> Relatório de Atividade
          </h1>
          <p className="text-primary-foreground/80 text-sm mt-1">Logins e desempenho diário dos alunos</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 -mt-4 space-y-6">
        <div className="glass-card p-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  days === r.days ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <select
            value={turma}
            onChange={e => setTurma(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
          >
            <option value="todas">Todas as turmas</option>
            {turmas.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="ml-auto flex gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/70 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card p-4 text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-foreground">{totals.students}</div>
            <div className="text-xs text-muted-foreground">Alunos ativos</div>
          </div>
          <div className="glass-card p-4 text-center">
            <CalendarDays className="w-6 h-6 text-accent mx-auto mb-2" />
            <div className="text-2xl font-bold text-foreground">{totals.logins}</div>
            <div className="text-xs text-muted-foreground">Logins</div>
          </div>
          <div className="glass-card p-4 text-center">
            <Target className="w-6 h-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-foreground">{totals.done}</div>
            <div className="text-xs text-muted-foreground">Questões feitas</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-2xl font-bold text-foreground">{totals.accuracy}%</div>
            <div className="text-xs text-muted-foreground">{totals.correct} acertos</div>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-semibold font-heading text-foreground mb-3">Por aluno</h2>
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border">
                  <th className="text-left p-3">Aluno</th>
                  <th className="text-left p-3">Turma</th>
                  <th className="text-right p-3">Dias ativos</th>
                  <th className="text-right p-3">Logins</th>
                  <th className="text-right p-3">Feitas</th>
                  <th className="text-right p-3">Acertos</th>
                  <th className="text-right p-3">Precisão</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map(([userId, v], i) => (
                  <motion.tr
                    key={userId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.02 * i }}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="p-3 font-medium text-foreground">{profiles[userId]?.username ?? '—'}</td>
                    <td className="p-3 text-muted-foreground">{profiles[userId]?.turma ?? '—'}</td>
                    <td className="p-3 text-right text-muted-foreground">{v.days}</td>
                    <td className="p-3 text-right text-muted-foreground">{v.logins}</td>
                    <td className="p-3 text-right text-foreground">{v.done}</td>
                    <td className="p-3 text-right text-foreground">{v.correct}</td>
                    <td className="p-3 text-right font-semibold text-foreground">
                      {v.done > 0 ? Math.round((v.correct / v.done) * 100) : 0}%
                    </td>
                  </motion.tr>
                ))}
                {byUser.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      {loading ? 'Carregando...' : 'Nenhuma atividade no período.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pb-8">
          <h2 className="text-lg font-semibold font-heading text-foreground mb-3">Detalhe por dia</h2>
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border">
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Aluno</th>
                  <th className="text-left p-3">Turma</th>
                  <th className="text-right p-3">Logins</th>
                  <th className="text-right p-3">Feitas</th>
                  <th className="text-right p-3">Acertos</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={`${r.user_id}-${r.activity_date}`} className="border-b border-border/50 last:border-0">
                    <td className="p-3 text-muted-foreground">{formatDate(r.activity_date)}</td>
                    <td className="p-3 font-medium text-foreground">{profiles[r.user_id]?.username ?? '—'}</td>
                    <td className="p-3 text-muted-foreground">{profiles[r.user_id]?.turma ?? '—'}</td>
                    <td className="p-3 text-right text-muted-foreground">{r.logins}</td>
                    <td className="p-3 text-right text-foreground">{r.questions_done}</td>
                    <td className="p-3 text-right text-foreground">{r.questions_correct}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      {loading ? 'Carregando...' : 'Sem registros.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminReportPage;
