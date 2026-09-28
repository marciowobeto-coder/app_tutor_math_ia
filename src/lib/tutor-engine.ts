import { Exercise, UserStep, StepStatus, ErrorType, HintLevel } from '@/types/math';

function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
}

export function validateStep(
  userInput: string,
  exercise: Exercise,
  stepIndex: number
): { status: StepStatus; errorType: ErrorType; feedback: string } {
  const norm = normalize(userInput);
  const expected = exercise.expectedSteps[stepIndex];

  if (!expected) {
    if (normalize(exercise.correctAnswer).includes(norm) || norm.includes(normalize(exercise.correctAnswer))) {
      return { status: 'correto', errorType: 'nenhum', feedback: '🎉 Resposta correta!' };
    }
    return { status: 'incorreto', errorType: 'calculo', feedback: 'Este passo não era esperado. Revise seu raciocínio.' };
  }

  const expectedNorm = normalize(expected.expression);

  if (norm === expectedNorm || norm.includes(expectedNorm) || expectedNorm.includes(norm)) {
    return { status: 'correto', errorType: 'nenhum', feedback: `✅ Correto! ${expected.description}` };
  }

  const errorType = detectErrorType(userInput, expected.expression, exercise);
  const feedback = getErrorFeedback(errorType);

  const hasRightStructure = norm.includes('x') === expectedNorm.includes('x');
  if (hasRightStructure && Math.abs(norm.length - expectedNorm.length) <= 3) {
    return { status: 'parcial', errorType, feedback: `⚠️ Quase lá! ${feedback}` };
  }

  return { status: 'incorreto', errorType, feedback: `❌ ${feedback}` };
}

function detectErrorType(userInput: string, expected: string, exercise: Exercise): ErrorType {
  const norm = normalize(userInput);
  const expNorm = normalize(expected);

  const userDigits = norm.replace(/[^0-9]/g, '');
  const expDigits = expNorm.replace(/[^0-9]/g, '');
  if (userDigits === expDigits && norm !== expNorm) return 'sinal';

  if (exercise.statement.includes('(') && !norm.includes('(') && norm !== expNorm) {
    const terms = norm.split(/[+-]/).length;
    const expTerms = expNorm.split(/[+-]/).length;
    if (terms !== expTerms) return 'distributiva';
  }

  if (Math.abs(norm.length - expNorm.length) > 10) return 'salto_logico';

  return 'calculo';
}

function getErrorFeedback(errorType: ErrorType): string {
  switch (errorType) {
    case 'sinal':
      return 'Verifique os sinais!';
    case 'distributiva':
      return 'Revise a propriedade distributiva: a(b + c) = ab + ac.';
    case 'salto_logico':
      return 'Você pulou etapas! Detalhe mais o raciocínio.';
    case 'calculo':
      return 'Erro de cálculo. Revise a operação.';
    case 'conceitual':
      return 'Revise o conceito utilizado.';
    default:
      return 'Revise este passo.';
  }
}

export function getHint(exercise: Exercise, stepIndex: number, level: HintLevel): string {
  const step = exercise.expectedSteps[stepIndex];
  if (!step) return 'Você já completou todos os passos!';

  switch (level) {
    case 1:
      return `🤔 Pense: ${step.description}. O que você precisa fazer?`;
    case 2:
      return `📖 Conceito: ${step.description}. Aplique ao problema.`;
    case 3: {
      const expr = step.expression;
      const masked = expr.substring(0, Math.ceil(expr.length * 0.6)) + ' ...';
      return `📝 Exemplo parcial: ${masked}\n(Complete o restante!)`;
    }
  }
}

export function shouldAdjustDifficulty(accuracy: number): 'increase' | 'decrease' | 'maintain' {
  if (accuracy > 80) return 'increase';
  if (accuracy < 50) return 'decrease';
  return 'maintain';
}
