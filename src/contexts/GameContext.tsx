import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { GameState, ExerciseAttempt, createInitialState, applyAttempt, checkMedals } from '@/lib/game-state';
import { SchoolYear, ErrorType } from '@/types/math';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GameContextType {
  state: GameState;
  /** true enquanto o histórico do aluno ainda está sendo carregado do banco. */
  loading: boolean;
  /** Registra um exercício resolvido: atualiza o progresso na tela e grava no banco. */
  recordExercise: (attempt: Omit<ExerciseAttempt, 'createdAt'>) => void;
  setSchoolYear: (year: SchoolYear) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<GameState>(createInitialState);
  const [loading, setLoading] = useState(false);

  // Reconstrói o progresso a partir do histórico gravado sempre que o usuário logado muda.
  useEffect(() => {
    setState(createInitialState());
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    supabase
      .from('exercise_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          console.error('Erro ao carregar o progresso:', error);
          toast.error('Não foi possível carregar seu progresso.', { description: error.message });
          return;
        }
        let next = createInitialState();
        next = { ...next, user: { ...next.user, id: userId } };
        for (const row of data ?? []) {
          next = applyAttempt(next, {
            topicId: row.topic_id,
            exerciseId: row.exercise_id,
            completed: row.completed,
            correct: row.correct,
            stepsCorrect: row.steps_correct,
            stepsTotal: row.steps_total,
            errors: row.errors,
            hintsUsed: row.hints_used,
            durationSeconds: Number(row.duration_seconds),
            points: row.points,
            errorTypes: row.error_types as ErrorType[],
            createdAt: new Date(row.created_at),
          });
          checkMedals(next);
        }
        setState(next);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const recordExercise = useCallback((attempt: Omit<ExerciseAttempt, 'createdAt'>) => {
    setState(prev => {
      const newState = applyAttempt(prev, { ...attempt, createdAt: new Date() });
      const newMedals = checkMedals(newState);
      if (newMedals.length > 0) {
        newMedals.forEach(m => {
          toast.success(`🏆 Medalha desbloqueada: ${m.name}!`, { description: m.description });
        });
      }
      return newState;
    });

    void supabase
      .rpc('record_exercise', {
        _topic_id: attempt.topicId,
        _exercise_id: attempt.exerciseId,
        _completed: attempt.completed,
        _correct: attempt.correct,
        _steps_correct: attempt.stepsCorrect,
        _steps_total: attempt.stepsTotal,
        _errors: attempt.errors,
        _hints_used: attempt.hintsUsed,
        _duration_seconds: attempt.durationSeconds,
        _points: attempt.points,
        _error_types: attempt.errorTypes,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Erro ao salvar o exercício:', error);
          toast.error('Não foi possível salvar este exercício no seu progresso.', { description: error.message });
        }
      });
  }, []);

  const setSchoolYear = useCallback((year: SchoolYear) => {
    setState(prev => ({ ...prev, user: { ...prev.user, schoolYear: year } }));
  }, []);

  return (
    <GameContext.Provider value={{ state, loading, recordExercise, setSchoolYear }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
