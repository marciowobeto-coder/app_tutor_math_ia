import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SchoolYear, SCHOOL_YEARS } from '@/types/math';
import { ArrowLeft, Play, Clock } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { countUnitsByTopic } from '@/lib/knowledge-base';

const TopicPage = () => {
  const { yearId } = useParams<{ yearId: string }>();
  const navigate = useNavigate();
  const { state } = useGame();
  const { isAdmin, allowedSchoolYears } = useAuth();
  const year = yearId as SchoolYear;
  const info = SCHOOL_YEARS[year];
  // Quantos exercícios a base de conhecimento tem por tema
  const available = useMemo(() => countUnitsByTopic(), []);

  if (!info) {
    navigate('/');
    return null;
  }

  // Aluno não pode entrar num bloco que o administrador não liberou pra ele (admin vê tudo).
  if (!isAdmin && !allowedSchoolYears.includes(year)) {
    navigate('/');
    return null;
  }

  // Temas sem nenhum exercício na base ficam ocultos para aluno; admin continua vendo
  // todos (com o cartão "Em breve"), pra acompanhar o que falta cadastrar.
  const visibleTopics = isAdmin
    ? info.topics
    : info.topics.filter(topic => (available[topic.id] ?? 0) > 0);

  return (
    <div className="min-h-screen bg-background">
      <header className={`bg-gradient-to-br ${info.color} p-6 pb-8 rounded-b-3xl`}>
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Voltar</span>
          </button>
          <div className="flex items-center gap-4">
            <span className="text-4xl">{info.icon}</span>
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground font-heading">{info.label}</h1>
              <p className="text-primary-foreground/80 text-sm">{visibleTopics.length} temas • exercícios da base de conhecimento</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleTopics.map((topic, i) => {
            const progress = state.progress.find(p => p.topicId === topic.id);
            const done = progress?.exercisesDone || 0;
            const count = available[topic.id] ?? 0;
            const hasExercises = count > 0;

            return (
              <motion.button
                key={topic.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                whileHover={hasExercises ? { scale: 1.02 } : undefined}
                whileTap={hasExercises ? { scale: 0.98 } : undefined}
                disabled={!hasExercises}
                onClick={() => navigate(`/exercise/${year}/${topic.id}`)}
                className={`glass-card p-4 flex items-start gap-4 text-left transition-all ${
                  hasExercises ? 'hover:border-primary/30' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${topic.color} flex items-center justify-center text-2xl shrink-0`}>
                  {topic.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{topic.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>
                  {hasExercises ? (
                    <p className="text-xs text-muted-foreground mt-1">{count} exercícios na base</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Em breve
                    </p>
                  )}
                  {done > 0 && (
                    <p className="text-xs text-primary mt-1 font-medium">{done} exercícios feitos • {Math.round(progress!.accuracy)}% precisão</p>
                  )}
                </div>
                {hasExercises && <Play className="w-5 h-5 text-primary shrink-0 mt-1" />}
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default TopicPage;
