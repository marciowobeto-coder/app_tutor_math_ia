import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SchoolYear, SCHOOL_YEARS } from '@/types/math';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Flame, Star, TrendingUp, GraduationCap, Users, LogOut, BarChart3 } from 'lucide-react';

const HomePage = () => {
  const navigate = useNavigate();
  const { state } = useGame();
  const { username: authUsername, isAdmin, signOut } = useAuth();

  const years = Object.entries(SCHOOL_YEARS) as [SchoolYear, typeof SCHOOL_YEARS[SchoolYear]][];

  const totalExercises = state.resolutions.filter(r => r.completed).length;
  const unlockedMedals = state.user.medals.filter(m => m.unlockedAt).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero p-6 pb-10 rounded-b-3xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground font-heading">
                TutorMath AI
              </h1>
              <p className="text-primary-foreground/80 text-sm">Olá, {authUsername ?? state.user.name}! 👋</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/progress')}
                className="flex items-center gap-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-primary-foreground text-sm font-medium hover:bg-primary-foreground/30 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Progresso
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate('/admin/users')}
                    className="flex items-center gap-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-primary-foreground text-sm font-medium hover:bg-primary-foreground/30 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Usuários
                  </button>
                  <button
                    onClick={() => navigate('/admin/report')}
                    className="flex items-center gap-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-primary-foreground text-sm font-medium hover:bg-primary-foreground/30 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Relatório
                  </button>
                </>
              )}

              <button
                onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}
                aria-label="Sair"
                className="flex items-center justify-center bg-primary-foreground/20 backdrop-blur-sm rounded-full p-2 text-primary-foreground hover:bg-primary-foreground/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>



          <div className="grid grid-cols-3 gap-3">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-3 text-center">
              <Star className="w-5 h-5 text-accent mx-auto mb-1" />
              <div className="text-xl font-bold text-primary-foreground">{state.user.points}</div>
              <div className="text-xs text-primary-foreground/70">Pontos</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-3 text-center">
              <Flame className="w-5 h-5 text-accent mx-auto mb-1" />
              <div className="text-xl font-bold text-primary-foreground">{state.currentStreak}</div>
              <div className="text-xs text-primary-foreground/70">Sequência</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-3 text-center">
              <Trophy className="w-5 h-5 text-accent mx-auto mb-1" />
              <div className="text-xl font-bold text-primary-foreground">{unlockedMedals}/{state.user.medals.length}</div>
              <div className="text-xs text-primary-foreground/70">Medalhas</div>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 -mt-4">
        <div className="flex items-center gap-2 mb-4 mt-2">
          <GraduationCap className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold font-heading text-foreground">Escolha seu ano escolar</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-8">
          {years.map(([key, info], i) => {
            const yearProgress = state.progress.filter(p => p.topicId.startsWith(key.replace('fund', 'f-')));
            const totalDone = yearProgress.reduce((acc, p) => acc + p.exercisesDone, 0);

            return (
              <motion.button
                key={key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/year/${key}`)}
                className="glass-card p-4 text-left group hover:border-primary/30 transition-all"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform`}>
                  {info.icon}
                </div>
                <h3 className="font-semibold text-foreground font-heading text-sm">{info.shortLabel}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{info.topics.length} temas</p>
                {totalDone > 0 && (
                  <p className="text-xs text-primary mt-1 font-medium">{totalDone} exercícios feitos</p>
                )}
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
