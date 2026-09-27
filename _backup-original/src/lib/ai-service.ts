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

export interface AIExerciseResult {
  statement: string;
  correctAnswer: string;
  expectedSteps: { order: number; expression: string; description: string }[];
  points: number;
  tableData?: string[][];
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
    exercise: {
      statement: exercise.statement,
      correctAnswer: exercise.correctAnswer,
      expectedSteps: exercise.expectedSteps,
    },
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
    exercise: {
      statement: exercise.statement,
      correctAnswer: exercise.correctAnswer,
      expectedSteps: exercise.expectedSteps,
    },
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
    exercise: exercise
      ? {
          statement: exercise.statement,
          correctAnswer: exercise.correctAnswer,
          expectedSteps: exercise.expectedSteps,
        }
      : undefined,
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

export async function generateExercise(
  topicId: string,
  topicLabel: string,
  schoolYear: SchoolYear,
  schoolYearLabel: string,
  topicDescription: string,
  commonErrors?: string[]
): Promise<AIExerciseResult | null> {
  try {
    const result = await callAI({
      action: 'generate_exercise',
      topicId,
      topicLabel,
      schoolYear,
      schoolYearLabel,
      topicDescription,
      errorType: commonErrors?.join(', '),
    });

    if (result.parsed) {
      return result.parsed;
    }
    return null;
  } catch {
    return null;
  }
}
