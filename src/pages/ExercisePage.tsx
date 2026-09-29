import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getHint } from '@/lib/tutor-engine';
import { calculatePoints } from '@/lib/game-state';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Exercise, UserStep, HintLevel, SchoolYear, SCHOOL_YEARS, getTopicById } from '@/types/math';
import { ArrowLeft, Lightbulb, BookOpen, Play, ChevronUp, ChevronDown, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import Whiteboard from '@/components/Whiteboard';
import { getAIHint, analyzeWhiteboard } from '@/lib/ai-service';
import ExerciseSteps from '@/components/ExerciseSteps';
import ExerciseCompletion from '@/components/ExerciseCompletion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  getUnits,
  getSourcesForTopic,
  getSubtopics,
  loadSeen,
  saveSeen,
  pickNext,
  getKbHint,
  sourceLabel,
} from '@/lib/knowledge-base';

const selectClass =
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

/** Resumo "X acertos, Y erros" (e pendentes, se houver) para exercícios com várias alternativas. */
function describeSubItemsResult(steps: UserStep[]): string {
  const acertos = steps.filter(s => s.status === 'correto').length;
  const erros = steps.filter(s => s.status === 'incorreto').length;
  const pendentes = steps.filter(s => s.status === 'pendente').length;
  const parts = [
    `${acertos} ${acertos === 1 ? 'acerto' : 'acertos'}`,
    `${erros} ${erros === 1 ? 'erro' : 'erros'}`,
  ];
  if (pendentes > 0) parts.push(`${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`);
  return `Alternativas: ${parts.join(', ')} (de ${steps.length})`;
}

const ExercisePage = () => {
  const { yearId, topicId } = useParams<{ yearId: string; topicId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, allowedSchoolYears } = useAuth();
  const { state, addPoints, addResolution, updateProgress, incrementStreak, resetStreak } = useGame();

  const year = yearId as SchoolYear;
  const yearInfo = SCHOOL_YEARS[year];
  const topicInfo = getTopicById(topicId || '');
  const userKey = user?.id ?? 'anon';

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [reference, setReference] = useState<string>('');
  const [steps, setSteps] = useState<UserStep[]>([]);
  const [hintLevel, setHintLevel] = useState<HintLevel | 0>(0);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [whiteboardClearTrigger, setWhiteboardClearTrigger] = useState(0);
  const [questionCollapsed, setQuestionCollapsed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Filtros da base de conhecimento
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [subtopicFilter, setSubtopicFilter] = useState<string>('all');

  const sources = useMemo(() => getSourcesForTopic(topicId || ''), [topicId]);
  const subtopics = useMemo(
    () => getSubtopics(topicId || '', sourceFilter === 'all' ? undefined : sourceFilter),
    [topicId, sourceFilter]
  );
  const pool = useMemo(
    () => getUnits({ topicId: topicId || '', sourceId: sourceFilter, subtopic: subtopicFilter }),
    [topicId, sourceFilter, subtopicFilter]
  );

  if (!yearInfo || !topicInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Tema não encontrado</p>
      </div>
    );
  }

  // Mesma checagem de acesso da TopicPage, aqui como segunda camada (acesso direto pela URL).
  if (!isAdmin && !allowedSchoolYears.includes(year)) {
    navigate('/');
    return null;
  }

  /** Sorteia a próxima questão da base (não repete até acabar a lista). */
  const handleNextExercise = () => {
    if (!topicId) return;
    const seen = loadSeen(userKey, topicId);
    const { unit, restarted, remaining: left } = pickNext(pool, seen, exercise?.id);

    if (!unit) {
      toast.error('Não há exercícios na base para esse filtro.');
      return;
    }

    seen.add(unit.exercise.id);
    saveSeen(userKey, topicId, restarted ? new Set([unit.exercise.id]) : seen);
    if (restarted) toast.info('Você já viu todos os exercícios deste filtro. Vamos recomeçar a lista!');

    setExercise(unit.exercise);
    setReference(unit.reference);
    setRemaining(left);
    setSteps([]);
    setCompleted(false);
    setHintLevel(0);
    setCurrentHint(null);
    setHintsUsed(0);
    setAiAnalysis(null);
    setWhiteboardClearTrigger(prev => prev + 1);
    setStartTime(Date.now());
    setQuestionCollapsed(false);
  };

  const completeExercise = (allSteps: UserStep[]) => {
    if (!exercise) return;
    setCompleted(true);
    setFeedbackOpen(true);
    const errors = allSteps.filter(s => s.status === 'incorreto').length;
    const earnedPoints = calculatePoints(exercise.points, hintsUsed, errors);
    addPoints(earnedPoints);

    const duration = (Date.now() - startTime) / 1000;
    const accuracy = (allSteps.filter(s => s.status === 'correto').length / allSteps.length) * 100;

    addResolution({
      id: `res-${Date.now()}`,
      userId: state.user.id,
      exerciseId: exercise.id,
      steps: allSteps,
      hintsUsed,
      completed: true,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    });

    updateProgress(
      topicId!,
      accuracy,
      duration,
      allSteps.filter(s => s.errorType !== 'nenhum').map(s => s.errorType)
    );

    if (errors === 0) incrementStreak();
    else resetStreak();

    // Registra a questão do dia (feita e se acertou)
    void supabase.rpc('record_question', { _correct: errors === 0 });

    toast.success(`+${earnedPoints} pontos!`, { description: 'Exercício concluído!' });
  };

  const handleHint = async () => {
    if (!exercise) return;
    const nextLevel = Math.min((hintLevel || 0) + 1, 3) as HintLevel;
    setHintLevel(nextLevel);
    setHintsUsed(prev => prev + 1);

    // 1) Dica curada da base de conhecimento (sem gastar IA)
    const kbHint = getKbHint(exercise, nextLevel);
    if (kbHint) {
      setCurrentHint(kbHint);
      return;
    }

    // 2) Sem dica na base para esse nível: pede à IA (e, se falhar, usa a dica local)
    setIsLoadingHint(true);
    try {
      const aiHint = await getAIHint(exercise, steps, steps.length, year);
      setCurrentHint(aiHint);
    } catch {
      setCurrentHint(getHint(exercise, steps.length, nextLevel));
    } finally {
      setIsLoadingHint(false);
    }
  };

  const handleWhiteboardCapture = async (imageData: string) => {
    if (!exercise) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      const result = await analyzeWhiteboard(imageData, exercise);
      setAiAnalysis(result.feedback);
      setFeedbackOpen(true);

      const subItems = exercise.subItems;
      if (subItems && subItems.length > 0 && result.itemResults && result.itemResults.length > 0) {
        // Exercício com várias alternativas: um "passo" por alternativa, para o aluno ver
        // exatamente quais foram identificadas, quais estão certas e quais ainda faltam.
        const itemSteps: UserStep[] = subItems.map((si, idx) => {
          const found = result.itemResults!.find(r => r.letra === si.letra);
          const attempted = found?.attempted ?? false;
          const isCorrect = attempted && Boolean(found?.isCorrect);
          return {
            id: `step-${Date.now()}-${idx}`,
            expression: si.statement,
            status: !attempted ? 'pendente' : isCorrect ? 'correto' : 'incorreto',
            errorType: attempted && !isCorrect ? 'calculo' : 'nenhum',
            feedback:
              found?.feedback || (attempted ? '' : 'Não encontrei essa alternativa no quadro/foto ainda.'),
            timestamp: new Date(),
          };
        });

        setSteps(itemSteps);

        // Só falta terminar quando alguma alternativa ainda não foi encontrada no quadro/foto
        // ("pendente"). Uma vez que todas foram avaliadas, o exercício se conclui com o placar
        // final de acertos e erros — não é preciso acertar tudo para fechar a questão.
        const allAttempted = itemSteps.every(s => s.status !== 'pendente');
        if (allAttempted) {
          completeExercise(itemSteps);
        }
      } else {
        // Exercício de alternativa única (comportamento anterior: um parecer geral).
        const overallStep: UserStep = {
          id: `step-${Date.now()}`,
          expression: result.steps?.join(' → ') || 'Desenvolvimento completo',
          status: result.isCorrect ? 'correto' : 'incorreto',
          errorType: result.errorLocation ? 'calculo' : 'nenhum',
          feedback: result.feedback,
          timestamp: new Date(),
        };

        setSteps([overallStep]);

        if (result.isCorrect) {
          completeExercise([overallStep]);
        }
      }

      if (result.suggestions?.length > 0) {
        toast.info('💡 Sugestão da IA', { description: result.suggestions[0] });
      }
    } catch (err) {
      console.error('Erro ao analisar o quadro branco:', err);
      toast.error('Não foi possível analisar o quadro branco.', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSteps([]);
    setHintLevel(0);
    setCurrentHint(null);
    setHintsUsed(0);
    setCompleted(false);
    setAiAnalysis(null);
  };

  // Sem exercício ainda: tela de escolha (fonte / tópico do livro)
  if (!exercise) {
    const empty = pool.length === 0;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className={`bg-gradient-to-br ${topicInfo.color} p-6 pb-8 rounded-b-3xl`}>
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => navigate(`/year/${year}`)}
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Voltar</span>
            </button>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{topicInfo.icon}</span>
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground font-heading">{topicInfo.label}</h1>
                <p className="text-primary-foreground/80 text-sm">{yearInfo.shortLabel} • {topicInfo.description}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center w-full max-w-sm"
          >
            {empty && sources.length === 0 ? (
              <>
                <div className="text-6xl mb-4">🚧</div>
                <h2 className="text-xl font-bold text-foreground font-heading mb-2">Em breve</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Ainda não há exercícios da base de conhecimento para <strong>{topicInfo.label}</strong> no{' '}
                  <strong>{yearInfo.shortLabel}</strong>.
                </p>
                <button
                  onClick={() => navigate(`/year/${year}`)}
                  className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
                >
                  Escolher outro tema
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📚</div>
                <h2 className="text-xl font-bold text-foreground font-heading mb-2">Pronto para praticar?</h2>
                <p className="text-muted-foreground text-sm mb-5">
                  Os exercícios vêm da base de conhecimento de <strong>{topicInfo.label}</strong>.
                </p>

                <div className="space-y-3 text-left mb-5">
                  {sources.length > 1 && (
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fonte</span>
                      <select
                        className={selectClass}
                        value={sourceFilter}
                        onChange={e => {
                          setSourceFilter(e.target.value);
                          setSubtopicFilter('all');
                        }}
                      >
                        <option value="all">Todas as fontes</option>
                        {sources.map(s => (
                          <option key={s.id} value={s.id}>{sourceLabel(s.id)}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {subtopics.length > 1 && (
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assunto</span>
                      <select className={selectClass} value={subtopicFilter} onChange={e => setSubtopicFilter(e.target.value)}>
                        <option value="all">Todos os assuntos</option>
                        {subtopics.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  {pool.length} {pool.length === 1 ? 'exercício disponível' : 'exercícios disponíveis'}
                </p>
                <button
                  onClick={handleNextExercise}
                  disabled={empty}
                  className="flex items-center gap-2 mx-auto px-6 py-3 gradient-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Play className="w-5 h-5" />
                  Começar
                </button>
              </>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="gradient-hero p-3 rounded-b-2xl shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate(`/year/${year}`)}
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Voltar</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleHint}
                disabled={hintLevel >= 3 || isLoadingHint || completed}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full text-primary-foreground text-xs font-medium hover:bg-primary-foreground/30 transition-colors disabled:opacity-40"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Dica {hintLevel > 0 ? `(${3 - hintLevel})` : ''}
              </button>
              <button
                onClick={handleNextExercise}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full text-primary-foreground text-xs font-medium hover:bg-primary-foreground/30 transition-colors disabled:opacity-40"
                title="Próximo exercício da base"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Próximo
              </button>
            </div>
          </div>

          {/* Collapsible question area */}
          <div className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl overflow-hidden">
            <button
              onClick={() => setQuestionCollapsed(!questionCollapsed)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <span className="text-xs font-medium text-primary-foreground/70 uppercase tracking-wide">
                {questionCollapsed ? 'Ver enunciado' : 'Enunciado'}
              </span>
              {questionCollapsed ? (
                <ChevronDown className="w-4 h-4 text-primary-foreground/70" />
              ) : (
                <ChevronUp className="w-4 h-4 text-primary-foreground/70" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {!questionCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 max-h-[40vh] overflow-y-auto">
                    <p className="text-primary-foreground font-medium text-lg font-heading whitespace-pre-line">{exercise.statement}</p>
                    {/* Render images/tables if present in the exercise */}
                    {exercise.imageUrl && (
                      <div className="mt-3 rounded-lg overflow-hidden bg-white/10 p-2">
                        <img
                          src={exercise.imageUrl}
                          alt="Imagem do exercício"
                          className="max-w-full h-auto rounded-md mx-auto"
                          style={{ maxHeight: '300px' }}
                        />
                      </div>
                    )}
                    {exercise.tableData && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm text-primary-foreground border-collapse">
                          <tbody>
                            {exercise.tableData.map((row, i) => (
                              <tr key={i} className={i === 0 ? 'font-bold border-b border-primary-foreground/30' : ''}>
                                {row.map((cell, j) => (
                                  <td key={j} className="px-3 py-1.5 border border-primary-foreground/20 text-center">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs text-primary-foreground/70 bg-primary-foreground/10 px-2 py-0.5 rounded-full">
                        {yearInfo.shortLabel}
                      </span>
                      <span className="text-xs text-primary-foreground/70">🏆 {exercise.points} pts</span>
                      {reference && (
                        <span className="flex items-center gap-1 text-xs text-primary-foreground/70">
                          <BookOpen className="w-3 h-3" />
                          {reference}
                        </span>
                      )}
                      {remaining !== null && (
                        <span className="text-xs text-primary-foreground/70">• faltam {remaining} nesta lista</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main content - Whiteboard only */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {!completed ? (
          <div className="flex-1 flex flex-col min-h-0">
            <Whiteboard onCapture={handleWhiteboardCapture} isAnalyzing={isAnalyzing} clearTrigger={whiteboardClearTrigger} />

            {/* Hint popup */}
            <Dialog open={currentHint !== null || isLoadingHint} onOpenChange={(open) => { if (!open) setCurrentHint(null); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-accent" />
                    Dica (Nível {hintLevel})
                  </DialogTitle>
                </DialogHeader>
                <div className="py-2">
                  {isLoadingHint ? (
                    <div className="flex justify-center gap-1 py-4">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-line">{currentHint}</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <Whiteboard onCapture={handleWhiteboardCapture} isAnalyzing={isAnalyzing} clearTrigger={whiteboardClearTrigger} />
          </div>
        )}

        {/* Feedback Popup Dialog */}
        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-heading flex items-center gap-2">
                🤖 Resultado da Análise
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {aiAnalysis && (
                <div className="p-3 bg-accent/10 rounded-xl">
                  <p className="text-sm text-foreground whitespace-pre-line">
                    <span className="font-medium text-primary">IA: </span>{aiAnalysis}
                  </p>
                </div>
              )}
              {steps.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {exercise.subItems?.length ? describeSubItemsResult(steps) : 'Etapas reconhecidas'}
                  </p>
                  <ExerciseSteps steps={steps} />
                  {!completed && exercise.subItems?.length ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      Ainda falta encontrar alguma alternativa no quadro/foto. Continue e toque em capturar de novo quando terminar.
                    </p>
                  ) : null}
                </div>
              )}
              {completed && (
                <ExerciseCompletion
                  steps={steps}
                  hintsUsed={hintsUsed}
                  onReset={() => { handleReset(); setFeedbackOpen(false); }}
                  onNext={() => { handleNextExercise(); setFeedbackOpen(false); }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default ExercisePage;
