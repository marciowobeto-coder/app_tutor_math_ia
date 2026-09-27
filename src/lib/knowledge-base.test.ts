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
    expect(counts['8f-numeros']).toBeGreaterThan(100);
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
});
