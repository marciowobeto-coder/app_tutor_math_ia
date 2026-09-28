/**
 * Base de conhecimento de exercícios.
 *
 * Os exercícios NÃO são mais criados pela IA: vêm de arquivos JSON em
 * `src/data/knowledge-base/sources/`. Cada arquivo é uma FONTE (ex.: um livro).
 * Para adicionar outra fonte, basta colocar outro .json nessa pasta (veja o README de lá).
 *
 * Este módulo transforma os exercícios da base em "questões de prática" (PracticeUnit),
 * que é o formato que a tela de exercícios já sabe resolver e corrigir.
 */
import type { Exercise, ExerciseSubItem, ExpectedStep, SchoolYear } from '@/types/math';

/* ------------------------------------------------------------------ */
/* Tipos do arquivo JSON da base                                        */
/* ------------------------------------------------------------------ */

export interface KbSourceMeta {
  id: string;
  tipo: string;
  referencia_abnt: string | null;
  titulo?: string;
  autor?: string;
  ano_escolar?: string;
  editora?: string;
  ano?: number;
  descricao?: string;
}

export interface KbItem {
  letra: string;
  enunciado: string;
  resposta?: string;
  resolucao?: string[];
  /** Nome do arquivo de imagem (em `src/data/knowledge-base/images/<fonte_id>/`), se esse item específico tiver figura própria. */
  imagem?: string;
}

export interface KbExercise {
  id: string;
  fonte_id: string;
  ano_id?: string;
  tema_id?: string;
  pagina: number;
  topico: string;
  subtopico?: string;
  numero: number;
  tipo: 'calculo' | 'problema' | 'compreensao' | 'multipla_escolha' | 'figura' | 'elaboracao' | 'desafio' | string;
  enunciado: string;
  alternativas?: Record<string, string>;
  itens?: KbItem[];
  gabarito?: string;
  resposta?: string;
  resolucao?: string[];
  dicas: string[];
  conceitos: string[];
  depende_de_figura: boolean;
  descricao_da_figura?: string;
  observacoes?: string;
  confianca_da_leitura: 'alta' | 'media' | 'baixa' | string;
  revisar?: string;
  /**
   * Nome do arquivo de imagem/diagrama do exercício (em
   * `src/data/knowledge-base/images/<fonte_id>/<imagem>`). Quando presente, o exercício
   * é mostrado com essa figura no app — mesmo que `depende_de_figura` seja true, ele
   * deixa de ser excluído da prática (ver `shouldInclude`).
   */
  imagem?: string;
  /** Tabela para exibir junto do enunciado (primeira linha = cabeçalho). */
  tabela?: string[][];
}

export interface KbFile {
  metadados: { fontes: KbSourceMeta[] };
  exercicios: KbExercise[];
}

/** Questão pronta para praticar: um exercício do app + dados extras da base. */
export interface PracticeUnit {
  exercise: Exercise;
  sourceId: string;
  subtopic: string;
  /** Ex.: "GIOVANNI JÚNIOR — p. 71, ex. 4 (a)" */
  reference: string;
}

/* ------------------------------------------------------------------ */
/* Regras de quais exercícios entram na prática                          */
/* ------------------------------------------------------------------ */

export const KB_RULES = {
  /** Exercícios que dependem de uma figura/quadro que o app ainda não mostra. */
  includeFigureExercises: false,
  /** Exercícios abertos (criar um exercício, pesquisa etc.) não têm resposta única. */
  includeOpenEnded: false,
  /** Exercícios cuja leitura da foto ficou duvidosa (ver campo `revisar`). */
  includeLowConfidence: false,
} as const;

/* ------------------------------------------------------------------ */
/* Carregamento dos arquivos                                             */
/* ------------------------------------------------------------------ */

const rawFiles = import.meta.glob('../data/knowledge-base/sources/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, KbFile>;

const files: KbFile[] = Object.values(rawFiles);

/**
 * Imagens/diagramas dos exercícios, em `src/data/knowledge-base/images/<fonte_id>/<arquivo>`.
 * Cada fonte tem sua própria subpasta. `?url` faz o Vite devolver a URL final do arquivo
 * (funciona tanto para .svg quanto para .png/.jpg).
 */
const rawImages = import.meta.glob('../data/knowledge-base/images/*/*.{svg,png,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function resolveImage(fonteId: string, filename?: string): string | undefined {
  if (!filename) return undefined;
  const suffix = `/images/${fonteId}/${filename}`;
  const key = Object.keys(rawImages).find(k => k.endsWith(suffix));
  return key ? rawImages[key] : undefined;
}

export function getKbSources(): KbSourceMeta[] {
  const map = new Map<string, KbSourceMeta>();
  for (const f of files) for (const s of f.metadados?.fontes ?? []) map.set(s.id, s);
  return [...map.values()];
}

function sourceShortName(src?: KbSourceMeta): string {
  if (!src) return 'Base de conhecimento';
  const author = src.autor ? src.autor.split(' ').slice(-2).join(' ').toUpperCase() : '';
  return src.titulo ? `${src.titulo}${author ? ` (${author})` : ''}` : src.id;
}

/* ------------------------------------------------------------------ */
/* Conversão exercício da base -> questão de prática                     */
/* ------------------------------------------------------------------ */

const BASE_POINTS: Record<string, number> = {
  calculo: 10,
  compreensao: 10,
  multipla_escolha: 10,
  problema: 15,
  figura: 15,
  desafio: 25,
};

function isOpenAnswer(answer?: string): boolean {
  return !answer || /^resposta (pessoal|de pesquisa)/i.test(answer.trim());
}

/**
 * "Descrição do passo: expressão" -> { description, expression }.
 * Corta no ÚLTIMO ": " que vem colado numa palavra (o ' : ' de divisão, com espaço antes, não conta).
 */
function toExpectedSteps(lines: string[] | undefined): ExpectedStep[] {
  return (lines ?? []).map((line, i) => {
    let cut = -1;
    for (const m of line.matchAll(/(?<=\S): /g)) cut = m.index ?? -1;
    return cut > 0 && cut < line.length - 2
      ? { order: i + 1, description: line.slice(0, cut), expression: line.slice(cut + 2) }
      : { order: i + 1, description: line, expression: line };
  });
}

/** Letras "normais" (a, b, c...) viram "a) ..."; ids longos (seg, ter...) já vêm com rótulo no texto. */
function itemLine(it: KbItem): string {
  return it.letra.length <= 1 ? `${it.letra}) ${it.enunciado}` : it.enunciado;
}

/** Quando o exercício tem `itens`, todos aparecem juntos, numa única questão, com as letras originais. */
function buildStatement(ex: KbExercise): string {
  const parts = [ex.enunciado.trim()];
  if (ex.alternativas) {
    parts.push(
      Object.entries(ex.alternativas)
        .map(([k, v]) => `${k}) ${v}`)
        .join('\n')
    );
  }
  if (ex.itens) parts.push(ex.itens.map(it => itemLine(it)).join('\n'));
  return parts.join('\n\n');
}

/** true se o exercício (ou algum de seus itens) já tem uma imagem própria cadastrada. */
function hasOwnImage(ex: KbExercise): boolean {
  return Boolean(ex.imagem) || Boolean(ex.itens?.some(it => it.imagem));
}

function shouldInclude(ex: KbExercise): boolean {
  if (!ex.ano_id || !ex.tema_id) return false;
  if (!KB_RULES.includeOpenEnded && ex.tipo === 'elaboracao') return false;
  // Exercício com figura só entra se já tivermos uma imagem para mostrar (foto ou diagrama).
  if (ex.depende_de_figura && !KB_RULES.includeFigureExercises && !hasOwnImage(ex)) return false;
  if (!KB_RULES.includeLowConfidence && ex.confianca_da_leitura === 'baixa') return false;
  return true;
}

function makeUnit(ex: KbExercise, src: KbSourceMeta | undefined): PracticeUnit | null {
  const hasItems = Boolean(ex.itens?.length);
  // Itens de elaboração/pesquisa (sem resposta única) ficam de fora da correção — mas continuam
  // aparecendo no enunciado, porque fazem parte do exercício do livro.
  const gradableItems = hasItems ? (ex.itens ?? []).filter(it => !isOpenAnswer(it.resposta)) : undefined;

  const answer = hasItems
    ? (gradableItems ?? []).map(it => (it.letra.length <= 1 ? `${it.letra}) ` : '') + (it.resposta ?? '')).join('; ')
    : ex.resposta;
  if (!KB_RULES.includeOpenEnded && isOpenAnswer(answer)) return null;

  const steps = toExpectedSteps(
    hasItems ? (gradableItems ?? []).flatMap(it => it.resolucao ?? []) : ex.resolucao
  );

  // Uma alternativa por item gradável, para a IA avaliar cada uma separadamente e contar
  // quantas ficaram certas e quantas erradas (em vez de dar um veredito único para tudo).
  const subItems: ExerciseSubItem[] | undefined =
    hasItems && gradableItems && gradableItems.length > 0
      ? gradableItems.map(it => ({
          letra: it.letra,
          statement: itemLine(it),
          correctAnswer: it.resposta ?? '',
          expectedSteps: toExpectedSteps(it.resolucao),
        }))
      : undefined;

  const reference = ex.pagina > 0
    ? `${sourceShortName(src)} — p. ${ex.pagina}, ex. ${ex.numero}`
    : `${sourceShortName(src)} — ex. ${ex.numero}`;
  const imageUrl = resolveImage(ex.fonte_id, ex.imagem);
  // Exercícios com várias alternativas valem um pouco mais (o aluno resolve todas de uma vez).
  const subItemBonus = subItems ? Math.max(0, subItems.length - 1) * 3 : 0;

  const exercise: Exercise = {
    id: ex.id,
    statement: buildStatement(ex),
    topicId: ex.tema_id!,
    schoolYear: ex.ano_id as SchoolYear,
    correctAnswer: answer ?? '',
    expectedSteps: steps,
    points: (BASE_POINTS[ex.tipo] ?? 10) + (steps.length >= 4 ? 5 : 0) + subItemBonus,
    imageUrl,
    tableData: ex.tabela,
    subItems,
    hints: ex.dicas,
    sourceId: ex.fonte_id,
    reference,
    kbExerciseId: ex.id,
  };

  return { exercise, sourceId: ex.fonte_id, subtopic: ex.topico, reference };
}

function buildAllUnits(): PracticeUnit[] {
  const out: PracticeUnit[] = [];
  const sources = new Map(getKbSources().map(s => [s.id, s]));
  for (const f of files) {
    for (const ex of f.exercicios ?? []) {
      if (!shouldInclude(ex)) continue;
      const src = sources.get(ex.fonte_id);
      const u = makeUnit(ex, src);
      if (u) out.push(u);
    }
  }
  return out;
}

const ALL_UNITS: PracticeUnit[] = buildAllUnits();

/* ------------------------------------------------------------------ */
/* Consultas                                                            */
/* ------------------------------------------------------------------ */

export interface UnitFilter {
  topicId: string;
  sourceId?: string; // undefined/'all' = todas as fontes
  subtopic?: string; // undefined/'all' = todos os tópicos do livro
}

export function getUnits({ topicId, sourceId, subtopic }: UnitFilter): PracticeUnit[] {
  return ALL_UNITS.filter(
    u =>
      u.exercise.topicId === topicId &&
      (!sourceId || sourceId === 'all' || u.sourceId === sourceId) &&
      (!subtopic || subtopic === 'all' || u.subtopic === subtopic)
  );
}

/** Quantas questões existem por tema (usado na tela de temas). */
export function countUnitsByTopic(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const u of ALL_UNITS) counts[u.exercise.topicId] = (counts[u.exercise.topicId] ?? 0) + 1;
  return counts;
}

export function getSourcesForTopic(topicId: string): KbSourceMeta[] {
  const ids = new Set(getUnits({ topicId }).map(u => u.sourceId));
  return getKbSources().filter(s => ids.has(s.id));
}

export function getSubtopics(topicId: string, sourceId?: string): string[] {
  const seen: string[] = [];
  for (const u of getUnits({ topicId, sourceId })) if (!seen.includes(u.subtopic)) seen.push(u.subtopic);
  return seen;
}

export function sourceLabel(id: string): string {
  const s = getKbSources().find(x => x.id === id);
  return s ? sourceShortName(s) : id;
}

/* ------------------------------------------------------------------ */
/* Sorteio de questões (evita repetir até acabar a lista)                */
/* ------------------------------------------------------------------ */

const seenKey = (userKey: string, topicId: string) => `kb-seen:${userKey}:${topicId}`;

export function loadSeen(userKey: string, topicId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(userKey, topicId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveSeen(userKey: string, topicId: string, seen: Set<string>): void {
  try {
    localStorage.setItem(seenKey(userKey, topicId), JSON.stringify([...seen]));
  } catch {
    /* localStorage indisponível: apenas não lembra */
  }
}

export interface PickResult {
  unit: PracticeUnit | null;
  /** true quando todas já tinham sido vistas e a lista recomeçou */
  restarted: boolean;
  remaining: number;
}

export function pickNext(units: PracticeUnit[], seen: Set<string>, currentId?: string): PickResult {
  if (units.length === 0) return { unit: null, restarted: false, remaining: 0 };
  let pool = units.filter(u => !seen.has(u.exercise.id) && u.exercise.id !== currentId);
  let restarted = false;
  if (pool.length === 0) {
    restarted = true;
    pool = units.filter(u => u.exercise.id !== currentId);
    if (pool.length === 0) pool = units;
  }
  const unit = pool[Math.floor(Math.random() * pool.length)];
  const remaining = units.filter(u => !seen.has(u.exercise.id) && u.exercise.id !== unit.exercise.id).length;
  return { unit, restarted, remaining: restarted ? units.length - 1 : remaining };
}

/* ------------------------------------------------------------------ */
/* Dicas da base                                                        */
/* ------------------------------------------------------------------ */

/** Dica do nível 1..3 vinda da base, ou null se a base não tiver dica para esse nível. */
export function getKbHint(exercise: Exercise, level: number): string | null {
  const hint = exercise.hints?.[level - 1];
  return hint ? `💡 ${hint}` : null;
}
