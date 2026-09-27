import { motion } from 'framer-motion';
import { Trophy, RotateCcw, Sparkles } from 'lucide-react';
import { UserStep } from '@/types/math';

interface ExerciseCompletionProps {
  steps: UserStep[];
  hintsUsed: number;
  onReset: () => void;
  onNext: () => void;
}

const ExerciseCompletion = ({ steps, hintsUsed, onReset, onNext }: ExerciseCompletionProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-6 glass-card p-6 text-center"
    >
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 0.5 }}
      >
        <Trophy className="w-16 h-16 text-accent mx-auto mb-3" />
      </motion.div>
      <h2 className="text-xl font-bold font-heading text-foreground">Exercício Concluído!</h2>
      <p className="text-muted-foreground mt-1">
        {steps.filter(s => s.status === 'correto').length}/{steps.length} passos corretos
        {hintsUsed > 0 && ` • ${hintsUsed} dicas usadas`}
      </p>
      <div className="flex gap-3 mt-4 justify-center">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Refazer
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-4 py-2 gradient-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          Próximo
        </button>
      </div>
    </motion.div>
  );
};

export default ExerciseCompletion;
