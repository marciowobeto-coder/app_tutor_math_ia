import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { SCHOOL_YEARS, getTopicById } from '@/types/math';
import { ArrowLeft, Trophy, Target, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { shouldAdjustDifficulty } from '@/lib/tutor-engine';

const ProgressPage = () => {
  const navigate = useNavigate();
  const { state } = useGame();

  const totalCompleted = state.resolutions.filter(r => r.completed).length;
  const totalDone = state.progress.reduce((acc, p) => acc + p.exercisesDone, 0);
  const overallAccuracy = totalDone > 0
    ? state.progress.reduce((acc, p) => acc + p.accuracy * p.exercisesDone, 0) / totalDone
    : 0;
  const adjustment = shouldAdjustDifficulty(overallAccuracy);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero p-6 pb-8 rounded-b-3xl">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Voltar</span>
          </button>
          <h1 className="text-2xl font-bold text-primary-foreground font-heading">Seu Progresso</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">Acompanhe sua evolução</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 -mt-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 text-center">
            <Target className="w-6 h-6 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-foreground">{Math.round(overallAccuracy)}%</div>
            <div className="text-xs text-muted-foreground">Precisão</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4 text-center">
            <Trophy className="w-6 h-6 text-accent mx-auto mb-2" />
            <div className="text-2xl font-bold text-foreground">{totalCompleted}</div>
            <div className="text-xs text-muted-foreground">Concluídos</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 text-center">
            <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center">
              {adjustment === 'increase' ? <TrendingUp className="w-6 h-6 text-success" /> :
               adjustment === 'decrease' ? <TrendingDown className="w-6 h-6 text-destructive" /> :
               <Minus className="w-6 h-6 text-muted-foreground" />}
            </div>
            <div className="text-sm font-bold text-foreground capitalize">
              {adjustment === 'increase' ? 'Subindo' : adjustment === 'decrease' ? 'Reforço' : 'Estável'}
            </div>
            <div className="text-xs text-muted-foreground">Nível</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-4 text-center">
            <div className="text-2xl mb-1">🔥</div>
            <div className="text-2xl font-bold text-foreground">{state.user.streak}</div>
            <div className="text-xs text-muted-foreground">Melhor seq.</div>
          </motion.div>
        </div>

        {/* Topic progress */}
        {state.progress.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold font-heading text-foreground mb-3">Por Tema</h2>
            <div className="space-y-3">
              {state.progress.map((p, i) => {
                const topic = getTopicById(p.topicId);
                if (!topic) return null;
                return (
                  <motion.div
                    key={p.topicId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="glass-card p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{topic.icon}</span>
                        <div>
                          <h3 className="font-medium text-foreground">{topic.label}</h3>
                          <p className="text-xs text-muted-foreground">{p.exercisesDone} exercícios feitos</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-foreground">{Math.round(p.accuracy)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(p.accuracy, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.1 * i }}
                        className={`h-full rounded-full bg-gradient-to-r ${topic.color}`}
                      />
                    </div>
                    {p.commonErrors.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <AlertTriangle className="w-3 h-3 text-warning" />
                        <p className="text-xs text-muted-foreground">
                          Erros comuns: {p.commonErrors.map(e =>
                            e === 'sinal' ? 'Sinais' : e === 'distributiva' ? 'Distributiva' : e === 'calculo' ? 'Cálculo' : String(e)
                          ).join(', ')}
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {state.progress.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum exercício feito ainda. Comece a praticar!</p>
          </div>
        )}

        {/* Medals */}
        <div className="pb-8">
          <h2 className="text-lg font-semibold font-heading text-foreground mb-3">Conquistas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {state.user.medals.map((medal, i) => (
              <motion.div
                key={medal.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i }}
                className={`glass-card p-4 text-center ${medal.unlockedAt ? 'border-accent/30' : 'opacity-50 grayscale'}`}
              >
                <div className="text-3xl mb-2">{medal.icon}</div>
                <h3 className="text-sm font-medium text-foreground">{medal.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{medal.description}</p>
                {medal.unlockedAt && <div className="mt-2 text-xs text-success font-medium">✅ Desbloqueada</div>}
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProgressPage;
