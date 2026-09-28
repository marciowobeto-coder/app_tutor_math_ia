import { motion } from 'framer-motion';
import { UserStep, StepStatus } from '@/types/math';

interface ExerciseStepsProps {
  steps: UserStep[];
}

const getStepBorderClass = (status: StepStatus) => {
  switch (status) {
    case 'correto': return 'step-correct';
    case 'parcial': return 'step-partial';
    case 'incorreto': return 'step-incorrect';
    case 'pendente': return 'border border-dashed border-muted-foreground/40';
    default: return 'border border-border';
  }
};

const ExerciseSteps = ({ steps }: ExerciseStepsProps) => {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={`rounded-xl p-4 ${getStepBorderClass(step.status)} ${
            step.status === 'incorreto' ? 'animate-shake' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step.status === 'correto' ? 'bg-success text-success-foreground' :
              step.status === 'parcial' ? 'bg-warning text-warning-foreground' :
              step.status === 'pendente' ? 'bg-muted text-muted-foreground' :
              'bg-destructive text-destructive-foreground'
            }`}>
              {step.status === 'pendente' ? '–' : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-foreground font-medium">{step.expression}</p>
              <p className="text-sm text-muted-foreground mt-1">{step.feedback}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default ExerciseSteps;
