export type SchoolYear = '1fund' | '2fund' | '3fund' | '4fund' | '5fund' | '6fund' | '7fund' | '8fund' | '9fund';
export type StepStatus = 'correto' | 'parcial' | 'incorreto' | 'pendente';
export type ErrorType = 'sinal' | 'distributiva' | 'salto_logico' | 'calculo' | 'conceitual' | 'nenhum';
export type HintLevel = 1 | 2 | 3;

export interface BNCCTopic {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export interface SchoolYearInfo {
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  topics: BNCCTopic[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  schoolYear: SchoolYear;
  createdAt: Date;
  points: number;
  streak: number;
  medals: Medal[];
}

export interface Medal {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt?: Date;
}

export interface ExpectedStep {
  order: number;
  expression: string;
  description: string;
}

export interface Exercise {
  id: string;
  statement: string;
  topicId: string;
  schoolYear: SchoolYear;
  correctAnswer: string;
  expectedSteps: ExpectedStep[];
  points: number;
  imageUrl?: string;
  tableData?: string[][];
}

export interface UserStep {
  id: string;
  expression: string;
  status: StepStatus;
  errorType: ErrorType;
  feedback: string;
  timestamp: Date;
}

export interface Resolution {
  id: string;
  userId: string;
  exerciseId: string;
  steps: UserStep[];
  hintsUsed: number;
  completed: boolean;
  startedAt: Date;
  completedAt?: Date;
}

export interface TopicProgress {
  topicId: string;
  accuracy: number;
  averageTime: number;
  exercisesDone: number;
  commonErrors: ErrorType[];
}

// BNCC-aligned topics per school year
export const SCHOOL_YEARS: Record<SchoolYear, SchoolYearInfo> = {
  '1fund': {
    label: '1º Ano - Fundamental',
    shortLabel: '1º Ano',
    icon: '🌱',
    color: 'from-green-400 to-emerald-500',
    topics: [
      { id: '1f-numeros', label: 'Números até 100', icon: '🔢', color: 'from-blue-400 to-blue-600', description: 'Contagem, leitura e escrita de números' },
      { id: '1f-adicao', label: 'Adição', icon: '➕', color: 'from-green-400 to-green-600', description: 'Somas simples com números até 20' },
      { id: '1f-subtracao', label: 'Subtração', icon: '➖', color: 'from-orange-400 to-orange-600', description: 'Subtrações simples com números até 20' },
      { id: '1f-geometria', label: 'Formas Geométricas', icon: '🔷', color: 'from-purple-400 to-purple-600', description: 'Reconhecimento de formas planas e sólidos' },
      { id: '1f-medidas', label: 'Medidas e Comparações', icon: '📏', color: 'from-pink-400 to-pink-600', description: 'Comparar comprimentos, massas e capacidades' },
    ],
  },
  '2fund': {
    label: '2º Ano - Fundamental',
    shortLabel: '2º Ano',
    icon: '🌿',
    color: 'from-green-500 to-teal-500',
    topics: [
      { id: '2f-numeros', label: 'Números até 1000', icon: '🔢', color: 'from-blue-400 to-blue-600', description: 'Leitura, escrita e ordenação' },
      { id: '2f-adicao-sub', label: 'Adição e Subtração', icon: '🧮', color: 'from-green-400 to-green-600', description: 'Operações com reagrupamento' },
      { id: '2f-multiplicacao', label: 'Introdução à Multiplicação', icon: '✖️', color: 'from-orange-400 to-orange-600', description: 'Ideia de multiplicação e tabuadas do 2 e 3' },
      { id: '2f-geometria', label: 'Geometria', icon: '📐', color: 'from-purple-400 to-purple-600', description: 'Figuras planas e simetria' },
      { id: '2f-medidas', label: 'Medidas de Tempo', icon: '⏰', color: 'from-pink-400 to-pink-600', description: 'Horas, dias da semana e meses' },
    ],
  },
  '3fund': {
    label: '3º Ano - Fundamental',
    shortLabel: '3º Ano',
    icon: '🌳',
    color: 'from-teal-500 to-cyan-500',
    topics: [
      { id: '3f-numeros', label: 'Números até 10.000', icon: '🔢', color: 'from-blue-400 to-blue-600', description: 'Sistema de numeração decimal' },
      { id: '3f-operacoes', label: 'Quatro Operações', icon: '🧮', color: 'from-green-400 to-green-600', description: 'Adição, subtração, multiplicação e divisão' },
      { id: '3f-fracoes', label: 'Introdução às Frações', icon: '🍕', color: 'from-orange-400 to-orange-600', description: 'Frações como parte de um todo' },
      { id: '3f-geometria', label: 'Geometria', icon: '📐', color: 'from-purple-400 to-purple-600', description: 'Perímetro e ângulos' },
      { id: '3f-medidas', label: 'Medidas', icon: '📏', color: 'from-pink-400 to-pink-600', description: 'Comprimento, massa e capacidade' },
    ],
  },
  '4fund': {
    label: '4º Ano - Fundamental',
    shortLabel: '4º Ano',
    icon: '🌴',
    color: 'from-cyan-500 to-blue-500',
    topics: [
      { id: '4f-numeros', label: 'Números Naturais', icon: '🔢', color: 'from-blue-400 to-blue-600', description: 'Operações e propriedades' },
      { id: '4f-fracoes', label: 'Frações e Decimais', icon: '🍕', color: 'from-orange-400 to-orange-600', description: 'Frações equivalentes e decimais' },
      { id: '4f-multiplicacao', label: 'Multiplicação e Divisão', icon: '✖️', color: 'from-green-400 to-green-600', description: 'Algoritmos e problemas' },
      { id: '4f-geometria', label: 'Geometria', icon: '📐', color: 'from-purple-400 to-purple-600', description: 'Área, perímetro e simetria' },
      { id: '4f-estatistica', label: 'Probabilidade e Estatística', icon: '📊', color: 'from-pink-400 to-pink-600', description: 'Tabelas e gráficos simples' },
    ],
  },
  '5fund': {
    label: '5º Ano - Fundamental',
    shortLabel: '5º Ano',
    icon: '🌻',
    color: 'from-blue-500 to-indigo-500',
    topics: [
      { id: '5f-numeros', label: 'Números e Operações', icon: '🔢', color: 'from-blue-400 to-blue-600', description: 'Números naturais e decimais' },
      { id: '5f-fracoes', label: 'Frações', icon: '🍕', color: 'from-orange-400 to-orange-600', description: 'Operações com frações' },
      { id: '5f-porcentagem', label: 'Porcentagem', icon: '💯', color: 'from-green-400 to-green-600', description: 'Porcentagem e proporção' },
      { id: '5f-geometria', label: 'Geometria', icon: '📐', color: 'from-purple-400 to-purple-600', description: 'Volume e figuras espaciais' },
      { id: '5f-estatistica', label: 'Estatística', icon: '📊', color: 'from-pink-400 to-pink-600', description: 'Média, moda e mediana' },
    ],
  },
  '6fund': {
    label: '6º Ano - Fundamental',
    shortLabel: '6º Ano',
    icon: '🚀',
    color: 'from-indigo-500 to-violet-500',
    topics: [
      { id: '6f-numeros', label: 'Números Naturais e Inteiros', icon: '🔢', color: 'from-blue-400 to-blue-600', description: 'Números inteiros e operações' },
      { id: '6f-fracoes', label: 'Frações e Decimais', icon: '🍕', color: 'from-orange-400 to-orange-600', description: 'MMC, MDC e operações' },
      { id: '6f-algebra', label: 'Introdução à Álgebra', icon: '🔤', color: 'from-green-400 to-green-600', description: 'Expressões algébricas simples' },
      { id: '6f-geometria', label: 'Geometria', icon: '📐', color: 'from-purple-400 to-purple-600', description: 'Ângulos e polígonos' },
      { id: '6f-estatistica', label: 'Estatística', icon: '📊', color: 'from-pink-400 to-pink-600', description: 'Gráficos e tabelas' },
    ],
  },
  '7fund': {
    label: '7º Ano - Fundamental',
    shortLabel: '7º Ano',
    icon: '⭐',
    color: 'from-violet-500 to-purple-500',
    topics: [
      { id: '7f-inteiros', label: 'Números Inteiros e Racionais', icon: '🔢', color: 'from-blue-400 to-blue-600', description: 'Operações com negativos e racionais' },
      { id: '7f-algebra', label: 'Álgebra', icon: '🔤', color: 'from-green-400 to-green-600', description: 'Equações do 1º grau' },
      { id: '7f-proporcao', label: 'Razão e Proporção', icon: '⚖️', color: 'from-orange-400 to-orange-600', description: 'Regra de três e proporções' },
      { id: '7f-geometria', label: 'Geometria', icon: '📐', color: 'from-purple-400 to-purple-600', description: 'Triângulos e transformações' },
      { id: '7f-estatistica', label: 'Probabilidade', icon: '🎲', color: 'from-pink-400 to-pink-600', description: 'Probabilidade e amostragem' },
    ],
  },
  '8fund': {
    label: '8º Ano - Fundamental',
    shortLabel: '8º Ano',
    icon: '💫',
    color: 'from-purple-500 to-fuchsia-500',
    topics: [
      { id: '8f-numeros', label: 'Números Reais', icon: '🔢', color: 'from-blue-400 to-blue-600', description: 'Números irracionais e reais' },
      { id: '8f-algebra', label: 'Álgebra', icon: '🔤', color: 'from-green-400 to-green-600', description: 'Fatoração e produtos notáveis' },
      { id: '8f-equacoes', label: 'Equações e Sistemas', icon: '⚖️', color: 'from-orange-400 to-orange-600', description: 'Sistemas de equações' },
      { id: '8f-geometria', label: 'Geometria', icon: '📐', color: 'from-purple-400 to-purple-600', description: 'Teorema de Pitágoras e congruência' },
      { id: '8f-estatistica', label: 'Estatística', icon: '📊', color: 'from-pink-400 to-pink-600', description: 'Pesquisa e análise de dados' },
    ],
  },
  '9fund': {
    label: '9º Ano - Fundamental',
    shortLabel: '9º Ano',
    icon: '🎓',
    color: 'from-fuchsia-500 to-rose-500',
    topics: [
      { id: '9f-numeros', label: 'Potências e Raízes', icon: '⚡', color: 'from-blue-400 to-blue-600', description: 'Potenciação, radiciação e notação científica' },
      { id: '9f-algebra', label: 'Álgebra', icon: '🔤', color: 'from-green-400 to-green-600', description: 'Equações do 2º grau' },
      { id: '9f-funcoes', label: 'Funções', icon: '📈', color: 'from-orange-400 to-orange-600', description: 'Funções afim e quadrática' },
      { id: '9f-geometria', label: 'Geometria', icon: '📐', color: 'from-purple-400 to-purple-600', description: 'Semelhança, trigonometria e geometria analítica' },
      { id: '9f-estatistica', label: 'Probabilidade e Estatística', icon: '📊', color: 'from-pink-400 to-pink-600', description: 'Contagem, probabilidade e análise' },
    ],
  },
};

export function getTopicById(topicId: string): BNCCTopic | undefined {
  for (const year of Object.values(SCHOOL_YEARS)) {
    const topic = year.topics.find(t => t.id === topicId);
    if (topic) return topic;
  }
  return undefined;
}

export function getYearByTopicId(topicId: string): SchoolYear | undefined {
  for (const [year, info] of Object.entries(SCHOOL_YEARS)) {
    if (info.topics.some(t => t.id === topicId)) return year as SchoolYear;
  }
  return undefined;
}
