import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { OptionCard } from './OptionCard';
import { OnboardingLayout } from './OnboardingLayout';
import { GOALS } from './goals';
import { useOnboardingStore } from './store';

// Step 1 of onboarding: pick a main goal. Answers live in the onboarding
// store so Back navigation never loses them; persistence arrives with the
// backend, and the collected answers feed the AI onboarding chat (Phase 4).
export function OnboardingPage() {
  const goal = useOnboardingStore((s) => s.goal);
  const setGoal = useOnboardingStore((s) => s.setGoal);
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
  });

  const handleContinue = () => {
    if (goal === null) return;
    navigate('/onboarding/details');
  };

  return (
    <OnboardingLayout step={1} backTo="/" backLabel="Back">
      <motion.h1
        {...rise(0)}
        className="text-balance bg-gradient-to-b from-white to-slate-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl"
      >
        Welcome! Let&apos;s build your routine.
      </motion.h1>
      <motion.p {...rise(0.08)} className="mt-3 text-lg leading-relaxed text-slate-400">
        First things first — what&apos;s your main goal right now? This helps us shape a routine
        around what matters to you.
      </motion.p>

      <motion.fieldset {...rise(0.16)} className="mt-9">
        <legend className="sr-only">Main goal</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {GOALS.map((option) => (
            <OptionCard
              key={option.value}
              {...option}
              name="main-goal"
              checked={goal === option.value}
              onSelect={setGoal}
            />
          ))}
        </div>
      </motion.fieldset>

      <motion.div {...rise(0.24)} className="mt-9 flex items-center justify-between">
        <p className="text-sm text-slate-500">You can add more goals later.</p>
        <Button size="lg" disabled={goal === null} onClick={handleContinue}>
          Continue <ArrowRight className="size-4" />
        </Button>
      </motion.div>
    </OnboardingLayout>
  );
}
