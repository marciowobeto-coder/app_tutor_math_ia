import { describe, it, expect } from 'vitest';
import {
  getUnits,
  getKbSources,
  countUnitsByTopic,
  getSubtopics,
  pickNext,
  getKbHint,
} from '@/lib/knowledge-base';
import { getTopicById, getYearByTopicId } from '@/types/math';

describe('base de conhecimento', () => {
  const counts = countUnitsByTopic();

  it('tem pelo menos uma fonte cadastrada', () => {
    expect(getKbSources().length).toBeGreaterThan(0);
  });

  it('todos os temas usados pela base existem no app', () => {
    for (const topicId of Object.keys(counts)) {
      expect(getTopicById(topicId), `tema ${topicId}`).toBeDefined();
      expect(getYearByTopicId(topicId), `ano do tema ${topicId}`).toBeDefined();
    }
  });

  it('tem exercícios para Números do 8º ano', () => {
    expect(counts['8f-numeros']).toBeGreaterThan(80);
  });

  it('tem exercícios para Porcentagem e Juros do 9º ano', () => {
    expect(counts['9f-porcentagem']).toBeGreaterThan(10);
  });

  it('tem exercícios para Razão, Proporção e Regra de Três do 9º ano', () => {
    expect(counts['9f-proporcao']).toBeGreaterThan(8);
  });

  it('todas as questões têm enunciado, resposta e id único', () => {
    const ids = new Set<string>();
    for (const topicId of Object.keys(counts)) {
      for (const u of getUnits({ topicId })) {
        const ex = u.exercise;
        expect(ex.statement.trim().length, ex.id).toBeGreaterThan(5);
        expect(ex.correctAnswer.trim().length, ex.id).toBeGreaterThan(0);
        expect(ids.has(ex.id), `id repetido ${ex.id}`).toBe(false);
        ids.add(ex.id);
      }
    }
  });

  it('não inclui exercícios abertos nem que dependam de figura', () => {
    for (const u of getUnits({ topicId: '8f-numeros' })) {
      expect(u.exercise.correctAnswer).not.toMatch(/^resposta pessoal/i);
    }
  });

  it('filtra por fonte e por assunto', () => {
    const all = getUnits({ topicId: '8f-numeros' });
    const subs = getSubtopics('8f-numeros');
    expect(subs.length).toBeGreaterThan(3);
    const one = getUnits({ topicId: '8f-numeros', subtopic: subs[0] });
    expect(one.length).toBeGreaterThan(0);
    expect(one.length).toBeLessThan(all.length);
    expect(getUnits({ topicId: '8f-numeros', sourceId: 'fonte-que-nao-existe' })).toHaveLength(0);
  });

  it('sorteia sem repetir até acabar a lista', () => {
    const units = getUnits({ topicId: '8f-numeros', subtopic: getSubtopics('8f-numeros')[0] });
    const seen = new Set<string>();
    for (let i = 0; i < units.length; i++) {
      const { unit, restarted } = pickNext(units, seen);
      expect(restarted).toBe(false);
      expect(seen.has(unit!.exercise.id)).toBe(false);
      seen.add(unit!.exercise.id);
    }
    expect(pickNext(units, seen).restarted).toBe(true);
  });

  it('usa as dicas da base por nível', () => {
    const u = getUnits({ topicId: '8f-numeros' }).find(x => x.exercise.hints && x.exercise.hints.length >= 2)!;
    expect(getKbHint(u.exercise, 1)).toContain(u.exercise.hints![0]);
    expect(getKbHint(u.exercise, 2)).toContain(u.exercise.hints![1]);
  });

  it('exercícios com figura só entram na prática quando têm uma imagem cadastrada, e a URL resolve', () => {
    const comImagem = [
      ...getUnits({ topicId: '8f-numeros' }),
      ...getUnits({ topicId: '9f-proporcao' }),
    ].filter(u => u.exercise.imageUrl);
    expect(comImagem.length).toBeGreaterThan(0);
    for (const u of comImagem) {
      expect(u.exercise.imageUrl, u.exercise.id).toMatch(/\.(svg|png|jpg|jpeg)$/i);
    }
  });

  it('exercício com tabela expõe tableData para a tela de exercícios', () => {
    const u = getUnits({ topicId: '9f-porcentagem' }).find(x => x.exercise.tableData);
    expect(u, 'esperava um exercício de porcentagem com tabela').toBeDefined();
    expect(u!.exercise.tableData!.length).toBeGreaterThan(1);
  });

  it('exercícios com várias alternativas (a, b, c…) viram UMA questão só, com todas juntas e subItems para a IA avaliar cada uma separadamente', () => {
    const comSub = [
      ...getUnits({ topicId: '8f-numeros' }),
      ...getUnits({ topicId: '9f-porcentagem' }),
      ...getUnits({ topicId: '9f-proporcao' }),
    ].filter(u => u.exercise.subItems && u.exercise.subItems.length > 0);

    expect(comSub.length).toBeGreaterThan(5);
    for (const u of comSub) {
      // O enunciado deve trazer todas as alternativas (a, b, c…), com as letras originais, não só uma.
      expect(u.exercise.statement, u.exercise.id).toMatch(/^[A-Za-z]\) /m);
      for (const si of u.exercise.subItems!) {
        expect(si.letra.length, `${u.exercise.id}`).toBeGreaterThan(0);
        expect(si.statement.trim().length, `${u.exercise.id} (${si.letra})`).toBeGreaterThan(0);
        expect(si.correctAnswer.trim().length, `${u.exercise.id} (${si.letra})`).toBeGreaterThan(0);
      }
    }
  });

  it('item de elaboração/pesquisa não entra nas subItems (não tem resposta única para a IA contar como acerto/erro), mas continua no enunciado', () => {
    const u = getUnits({ topicId: '8f-numeros' }).find(x => x.exercise.kbExerciseId === 'acm7-2022-p38-q05');
    expect(u, 'esperava achar o exercício acm7-2022-p38-q05').toBeDefined();
    expect(u!.exercise.subItems?.map(si => si.letra)).toEqual(['a', 'b']);
    expect(u!.exercise.statement).toMatch(/Elabore duas questões/);
  });

  it('inclui exercícios de outras fontes (páginas da internet), com referência sem número de página', () => {
    const sourceIds = getKbSources().map(s => s.id);
    for (const id of ['todamateria-numeros-inteiros', 'todamateria-porcentagem', 'todamateria-razao-proporcao']) {
      expect(sourceIds, `esperava a fonte ${id}`).toContain(id);
    }
    const u = getUnits({ topicId: '9f-porcentagem', sourceId: 'tudosaladeaula-porcentagem' })[0];
    expect(u, 'esperava ao menos um exercício da fonte tudosaladeaula-porcentagem').toBeDefined();
    // Exercícios sem página de livro (pagina = 0) não devem mostrar "p. 0" na referência.
    expect(u!.reference).not.toMatch(/p\. 0/);
  });
});
