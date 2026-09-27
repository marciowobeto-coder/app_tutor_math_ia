import { supabase } from '@/integrations/supabase/client';
import { Exercise, UserStep, SchoolYear } from '@/types/math';

export interface AIHintResult {
  content: string;
}

export interface AICorrectionResult {
  feedback: string;
  errorType: string;
  isCorrect: boolean;
  isPartial: boolean;
}

export interface AIWhiteboardResult {
  steps: string[];
  feedback: string;
  suggestions: string[];
  isCorrect?: boolean;
  errorLocation?: string | null;
}

/** Dados do exercício enviados à IA (a resposta e a resolução vêm da base de conhecimento). */
function exercisePayload(exercise: Exercise) {
  return {
    statement: exercise.statement,
    correctAnswer: exercise.correctAnswer,
    expectedSteps: exercise.expectedSteps,
    referenceSolution: exercise.expectedSteps.map(s => (s.description === s.expression ? s.expression : `${s.description}: ${s.expression}`)),
    reference: exercise.reference,
  };
}

async function callAI(body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke('ai-tutor', { body });

  if (error) {
    console.error('AI function error:', error);
    throw new Error(error.message || 'Erro ao comunicar com a IA');
  }

  return data;
}

export async function getAIHint(
  exercise: Exercise,
  steps: UserStep[],
  stepIndex: number,
  schoolYear: SchoolYear
): Promise<string> {
  const result = await callAI({
    action: 'generate_hint',
    exercise: exercisePayload(exercise),
    steps: steps.map(s => ({ expression: s.expression, status: s.status })),
    stepIndex,
    schoolYear,
  });

  return result.content || 'Tente revisar os passos anteriores.';
}

export async function getAICorrection(
  exercise: Exercise,
  steps: UserStep[],
  stepIndex: number
): Promise<AICorrectionResult> {
  const result = await callAI({
    action: 'correct_step',
    exercise: exercisePayload(exercise),
    steps: steps.map(s => ({ expression: s.expression, status: s.status })),
    stepIndex,
  });

  if (result.parsed) {
    return result.parsed;
  }

  return {
    feedback: result.content || 'Não foi possível analisar.',
    errorType: 'calculo',
    isCorrect: false,
    isPartial: false,
  };
}

export async function analyzeWhiteboard(
  imageData: string,
  exercise?: Exercise
): Promise<AIWhiteboardResult> {
  const result = await callAI({
    action: 'analyze_whiteboard',
    imageData,
    exercise: exercise ? exercisePayload(exercise) : undefined,
  });

  if (result.parsed) {
    const parsed = result.parsed;
    return {
      steps: parsed.steps || (parsed.recognized ? [parsed.recognized] : []),
      feedback: parsed.feedback || '',
      suggestions: parsed.suggestions || [],
      isCorrect: parsed.isCorrect ?? undefined,
      errorLocation: parsed.errorLocation ?? null,
    };
  }

  return {
    steps: [],
    feedback: result.content || 'Não foi possível analisar a imagem.',
    suggestions: [],
  };
}
