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

/** Resultado da IA para UMA alternativa (a, b, c…) de um exercício com várias partes. */
export interface AIItemResult {
  letra: string;
  /** A IA encontrou essa alternativa resolvida na imagem? */
  attempted: boolean;
  isCorrect: boolean;
  feedback: string;
}

export interface AIWhiteboardResult {
  steps: string[];
  feedback: string;
  suggestions: string[];
  isCorrect?: boolean;
  errorLocation?: string | null;
  /** Presente quando o exercício tem `subItems`: o resultado de cada alternativa, separadamente. */
  itemResults?: AIItemResult[];
}

function stepsToReferenceSolution(steps: Exercise['expectedSteps']) {
  return steps.map(s => (s.description === s.expression ? s.expression : `${s.description}: ${s.expression}`));
}

/** Dados do exercício enviados à IA (a resposta e a resolução vêm da base de conhecimento). */
function exercisePayload(exercise: Exercise) {
  return {
    statement: exercise.statement,
    correctAnswer: exercise.correctAnswer,
    expectedSteps: exercise.expectedSteps,
    referenceSolution: stepsToReferenceSolution(exercise.expectedSteps),
    reference: exercise.reference,
    // Quando o exercício tem várias alternativas (a, b, c…), a IA recebe cada uma separadamente
    // para poder avaliar e identificar quais o aluno resolveu.
    subItems: exercise.subItems?.map(si => ({
      letra: si.letra,
      statement: si.statement,
      correctAnswer: si.correctAnswer,
      referenceSolution: stepsToReferenceSolution(si.expectedSteps),
    })),
  };
}

async function callAI(body: Record<string, unknown>) {
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
      itemResults: Array.isArray(parsed.itemResults)
        ? parsed.itemResults.map((r: { letra?: unknown; attempted?: unknown; isCorrect?: unknown; feedback?: string }) => ({
            letra: String(r.letra ?? ''),
            attempted: Boolean(r.attempted),
            isCorrect: Boolean(r.attempted) && Boolean(r.isCorrect),
            feedback: r.feedback || '',
          }))
        : undefined,
    };
  }

  return {
    steps: [],
    feedback: result.content || 'Não foi possível analisar a imagem.',
    suggestions: [],
  };
}
