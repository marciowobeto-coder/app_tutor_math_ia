import { User, Medal, TopicProgress, Resolution, SchoolYear } from '@/types/math';

export interface GameState {
  user: User;
  progress: TopicProgress[];
  resolutions: Resolution[];
  currentStreak: number;
}

const DEFAULT_MEDALS: Medal[] = [
  { id: 'm1', name: 'Primeiro Passo', icon: '🌟', description: 'Complete seu primeiro exercício' },
  { id: 'm2', name: 'Sequência de 3', icon: '🔥', description: 'Acerte 3 exercícios seguidos' },
  { id: 'm3', name: 'Sequência de 5', icon: '💎', description: 'Acerte 5 exercícios seguidos' },
  { id: 'm4', name: 'Explorador', icon: '🗺️', description: 'Tente 3 temas diferentes' },
  { id: 'm5', name: 'Mestre Iniciante', icon: '🏅', description: 'Complete 10 exercícios' },
  { id: 'm6', name: 'Sem Dicas', icon: '🧠', description: 'Complete um exercício sem dicas' },
  { id: 'm7', name: 'Velocista', icon: '⚡', description: 'Complete um exercício em menos de 1 minuto' },
  { id: 'm8', name: 'Perfeccionista', icon: '💯', description: 'Complete um exercício sem erros' },
];

export function createInitialState(): GameState {
  return {
    user: {
      id: '1',
      name: 'Aluno',
      email: '',
      schoolYear: '6fund',
      createdAt: new Date(),
      points: 0,
      streak: 0,
      medals: DEFAULT_MEDALS,
    },
    progress: [],
    resolutions: [],
    currentStreak: 0,
  };
}

export function calculatePoints(basePoints: number, hintsUsed: number, errors: number): number {
  let points = basePoints;
  points -= hintsUsed * 2;
  points -= errors * 1;
  return Math.max(points, 1);
}

export function checkMedals(state: GameState): Medal[] {
  const newlyUnlocked: Medal[] = [];
  const totalCompleted = state.resolutions.filter(r => r.completed).length;
  const topicsAttempted = new Set(state.resolutions.map(r => r.exerciseId)).size;

  const checks: Record<string, boolean> = {
    m1: totalCompleted >= 1,
    m2: state.currentStreak >= 3,
    m3: state.currentStreak >= 5,
    m4: topicsAttempted >= 3,
    m5: totalCompleted >= 10,
    m6: state.resolutions.some(r => r.completed && r.hintsUsed === 0),
    m7: state.resolutions.some(r => {
      if (!r.completed || !r.completedAt) return false;
      const duration = r.completedAt.getTime() - r.startedAt.getTime();
      return duration < 60000;
    }),
    m8: state.resolutions.some(r => r.completed && r.steps.every(s => s.status === 'correto')),
  };

  state.user.medals.forEach(medal => {
    if (!medal.unlockedAt && checks[medal.id]) {
      medal.unlockedAt = new Date();
      newlyUnlocked.push(medal);
    }
  });

  return newlyUnlocked;
}
