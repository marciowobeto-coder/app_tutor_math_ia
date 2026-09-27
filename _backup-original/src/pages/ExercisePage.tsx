import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getHint } from '@/lib/tutor-engine';
import { calculatePoints } from '@/lib/game-state';
import { useGame } from '@/contexts/GameContext';
import { Exercise, UserStep, HintLevel, SchoolYear, SCHOOL_YEARS, getTopicById } from '@/types/math';
import { ArrowLeft, Lightbulb, RotateCcw, Sparkles, RefreshCw, ChevronUp, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import Whiteboard from '@/components/Whiteboard';
import { getAIHint, analyzeWhiteboard, generateExercise } from '@/lib/ai-service';
import ExerciseSteps from '@/components/ExerciseSteps';
import ExerciseCompletion from '@/components/ExerciseCompletion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';


const ExercisePage = () => {
  const { yearId, topicId } = useParams<{ yearId: string; topicId: string }>();
  const navigate = useNavigate();
  const { state, addPoints, addResolution, updateProgress, incrementStreak, resetStreak } = useGame();

  const year = yearId as SchoolYear;
  const yearInfo = SCHOOL_YEARS[year];
  const topicInfo = getTopicById(topicId || '');

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<UserStep[]>([]);
  const [hintLevel, setHintLevel] = useState<HintLevel>(0 as any);
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

  if (!yearInfo || !topicInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Tema não encontrado</p>
      </div>
    );
  }

  const handleGenerateExercise = async () => {
    setIsGenerating(true);
    try {
      const progress = state.progress.find(p => p.topicId === topicId);
      const result = await generateExercise(
        topicId!,
        topicInfo.label,
        year,
        yearInfo.label,
        topicInfo.description,
        progress?.commonErrors?.map(String)
      );

      if (result) {
        const newExercise: Exercise = {
          id: `ai-${Date.now()}`,
          statement: result.statement,
          topicId: topicId!,
          schoolYear: year,
          correctAnswer: result.correctAnswer,
          expectedSteps: result.expectedSteps,
          points: result.points || 10,
          tableData: result.tableData || undefined,
        };
        setExercise(newExercise);
        setSteps([]);
        setCompleted(false);
        setHintLevel(0 as any);
        setCurrentHint(null);
        setHintsUsed(0);
        setAiAnalysis(null);
        setWhiteboardClearTrigger(prev => prev + 1);
        setStartTime(Date.now());
        toast.success('Exercício gerado!');
      } else {
        toast.error('Não foi possível gerar o exercício. Tente novamente.');
      }
    } catch {
      toast.error('Erro ao gerar exercício.');
    } finally {
      setIsGenerating(false);
    }
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
    void (supabase as any).rpc('record_question', { _correct: errors === 0 });

    toast.success(`+${earnedPoints} pontos!`, { description: 'Exercício concluído!' });
  };


  const handleHint = async () => {
    if (!exercise) return;
    const nextLevel = Math.min((hintLevel || 0) + 1, 3) as HintLevel;
    setHintLevel(nextLevel);
    setHintsUsed(prev => prev + 1);
    setIsLoadingHint(true);

    try {
      const aiHint = await getAIHint(exercise, steps, steps.length, year);
      setCurrentHint(aiHint);
    } catch {
      const hint = getHint(exercise, steps.length, nextLevel);
      setCurrentHint(hint);
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

      // Create a single step representing the whole work
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

      if (result.suggestions?.length > 0) {
        toast.info('💡 Sugestão da IA', { description: result.suggestions[0] });
      }
    } catch {
      toast.error('Não foi possível analisar o quadro branco.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSteps([]);
    setHintLevel(0 as any);
    setCurrentHint(null);
    setHintsUsed(0);
    setCompleted(false);
    setAiAnalysis(null);
  };

  // No exercise yet - show generate screen
  if (!exercise) {
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

        <main className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-sm"
          >
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-xl font-bold text-foreground font-heading mb-2">Pronto para praticar?</h2>
            <p className="text-muted-foreground text-sm mb-6">
              A IA vai gerar um exercício aleatório de <strong>{topicInfo.label}</strong> para o nível do <strong>{yearInfo.shortLabel}</strong>.
            </p>
            <button
              onClick={handleGenerateExercise}
              disabled={isGenerating}
              className="flex items-center gap-2 mx-auto px-6 py-3 gradient-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Sparkles className="w-5 h-5" />
              {isGenerating ? 'Gerando exercício...' : 'Gerar Exercício'}
            </button>
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
                onClick={handleGenerateExercise}
                disabled={isGenerating}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full text-primary-foreground text-xs font-medium hover:bg-primary-foreground/30 transition-colors disabled:opacity-40"
                title="Novo exercício"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                Novo
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
                  <div className="px-3 pb-3">
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
                          {exercise.tableData.map((row, i) => (
                            <tr key={i} className={i === 0 ? 'font-bold border-b border-primary-foreground/30' : ''}>
                              {row.map((cell, j) => (
                                <td key={j} className="px-3 py-1.5 border border-primary-foreground/20 text-center">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </table>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-primary-foreground/70 bg-primary-foreground/10 px-2 py-0.5 rounded-full">
                        {yearInfo.shortLabel}
                      </span>
                      <span className="text-xs text-primary-foreground/70">🏆 {exercise.points} pts</span>
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
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Etapas reconhecidas</p>
                  <ExerciseSteps steps={steps} />
                </div>
              )}
              {completed && (
                <ExerciseCompletion
                  steps={steps}
                  hintsUsed={hintsUsed}
                  onReset={() => { handleReset(); setFeedbackOpen(false); }}
                  onNext={() => { handleGenerateExercise(); setFeedbackOpen(false); }}
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
