import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { GameState, createInitialState, calculatePoints, checkMedals } from '@/lib/game-state';
import { Resolution, TopicProgress, SchoolYear } from '@/types/math';
import { toast } from 'sonner';

interface GameContextType {
  state: GameState;
  addPoints: (points: number) => void;
  addResolution: (resolution: Resolution) => void;
  updateProgress: (topicId: string, accuracy: number, time: number, errors: string[]) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  setSchoolYear: (year: SchoolYear) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(createInitialState);

  const addPoints = useCallback((points: number) => {
    setState(prev => ({
      ...prev,
      user: { ...prev.user, points: prev.user.points + points },
    }));
  }, []);

  const addResolution = useCallback((resolution: Resolution) => {
    setState(prev => {
      const newState = {
        ...prev,
        resolutions: [...prev.resolutions, resolution],
      };
      const newMedals = checkMedals(newState);
      if (newMedals.length > 0) {
        newMedals.forEach(m => {
          toast.success(`🏆 Medalha desbloqueada: ${m.name}!`, { description: m.description });
        });
      }
      return newState;
    });
  }, []);

  const updateProgress = useCallback((topicId: string, accuracy: number, time: number, errors: string[]) => {
    setState(prev => {
      const existing = prev.progress.find(p => p.topicId === topicId);
      if (existing) {
        return {
          ...prev,
          progress: prev.progress.map(p =>
            p.topicId === topicId
              ? {
                  ...p,
                  accuracy: p.exercisesDone === 0 ? accuracy : (p.accuracy * p.exercisesDone + accuracy) / (p.exercisesDone + 1),
                  averageTime: p.exercisesDone === 0 ? time : (p.averageTime * p.exercisesDone + time) / (p.exercisesDone + 1),
                  exercisesDone: p.exercisesDone + 1,
                  commonErrors: [...new Set([...p.commonErrors, ...errors])] as any,
                }
              : p
          ),
        };
      }
      return {
        ...prev,
        progress: [...prev.progress, {
          topicId,
          accuracy,
          averageTime: time,
          exercisesDone: 1,
          commonErrors: errors as any,
        }],
      };
    });
  }, []);

  const incrementStreak = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStreak: prev.currentStreak + 1,
      user: { ...prev.user, streak: Math.max(prev.user.streak, prev.currentStreak + 1) },
    }));
  }, []);

  const resetStreak = useCallback(() => {
    setState(prev => ({ ...prev, currentStreak: 0 }));
  }, []);

  const setSchoolYear = useCallback((year: SchoolYear) => {
    setState(prev => ({ ...prev, user: { ...prev.user, schoolYear: year } }));
  }, []);

  return (
    <GameContext.Provider value={{ state, addPoints, addResolution, updateProgress, incrementStreak, resetStreak, setSchoolYear }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
