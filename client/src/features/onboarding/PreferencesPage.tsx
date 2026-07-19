import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BedDouble,
  BookOpen,
  Briefcase,
  CalendarRange,
  Dumbbell,
  Feather,
  Flame,
  GraduationCap,
  Lightbulb,
  Scale,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { OnboardingLayout } from './OnboardingLayout';
import { OptionCard } from './OptionCard';
import { SelectChip } from './SelectChip';
import { findGoal } from './goals';
import { arePreferencesComplete, isScheduleComplete, useOnboardingStore } from './store';

// Step 3 of onboarding: routine preferences. Answers live in the onboarding
// store (Back never loses them); goal + schedule + preferences together feed
// the AI routine suggestion once Phase 4 connects the backend.

export const INTENSITIES = [
  {
    value: 'relaxed',
    icon: Feather,
    label: 'Relaxed',
    description: 'A gentle pace with plenty of breathing room.',
  },
  {
    value: 'balanced',
    icon: Scale,
    label: 'Balanced',
    description: 'Steady progress that still leaves space for life.',
  },
  {
    value: 'ambitious',
    icon: Flame,
    label: 'Ambitious',
    description: 'A packed schedule for maximum momentum.',
  },
] as const;

export const STYLES = [
  {
    value: 'fixed',
    icon: CalendarRange,
    label: 'Fixed schedule',
    description: 'Tasks at set times — same rhythm every day.',
  },
  {
    value: 'flexible',
    icon: Shuffle,
    label: 'Flexible blocks',
    description: 'Time blocks you slot in wherever the day allows.',
  },
] as const;

export const FOCUS_AREAS = [
  { value: 'study', icon: GraduationCap, label: 'Study' },
  { value: 'work', icon: Briefcase, label: 'Work' },
  { value: 'fitness', icon: Dumbbell, label: 'Fitness' },
  { value: 'reading', icon: BookOpen, label: 'Reading' },
  { value: 'skill-learning', icon: Lightbulb, label: 'Skill learning' },
  { value: 'better-sleep', icon: BedDouble, label: 'Better sleep' },
] as const;

export function PreferencesPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const goalValue = useOnboardingStore((s) => s.goal);
  const times = useOnboardingStore((s) => s.times);
  const focusHours = useOnboardingStore((s) => s.focusHours);
  const intensity = useOnboardingStore((s) => s.intensity);
  const style = useOnboardingStore((s) => s.style);
  const focusAreas = useOnboardingStore((s) => s.focusAreas);
  const setIntensity = useOnboardingStore((s) => s.setIntensity);
  const setStyle = useOnboardingStore((s) => s.setStyle);
  const toggleFocusArea = useOnboardingStore((s) => s.toggleFocusArea);
  const goal = findGoal(goalValue ?? undefined);

  const hasSchedule = isScheduleComplete(times, focusHours);

  // Errors render only after a submit attempt — no red text on first paint.
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!goal || !hasSchedule) navigate('/onboarding', { replace: true });
  }, [goal, hasSchedule, navigate]);

  if (!goal || !hasSchedule) return null;

  const intensityError = submitted && intensity === null ? 'Please choose an intensity.' : undefined;
  const styleError = submitted && style === null ? 'Please choose a style.' : undefined;
  const focusError =
    submitted && focusAreas.length === 0 ? 'Pick at least one focus area.' : undefined;
  const isComplete = arePreferencesComplete({ intensity, style, focusAreas });

  const handleGenerate = () => {
    setSubmitted(true);
    if (!isComplete) return;
    navigate('/onboarding/preview');
  };

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
  });

  const Icon = goal.icon;

  return (
    <OnboardingLayout
      step={3}
      backTo="/onboarding/details"
      backLabel="Back to schedule"
      showStartOver
    >
      <motion.span
        {...rise(0)}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-200"
      >
        <Icon className="size-4" strokeWidth={1.8} /> {goal.label}
      </motion.span>

      <motion.h1
        {...rise(0.08)}
        className="text-balance bg-gradient-to-b from-white to-slate-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl"
      >
        Almost there — your preferences
      </motion.h1>
      <motion.p {...rise(0.16)} className="mt-3 text-lg leading-relaxed text-slate-400">
        Last step: tell us how you like to work, and we&apos;ll shape the routine to match.
      </motion.p>

      <motion.form
        {...rise(0.24)}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleGenerate();
        }}
        className="mt-9 space-y-8"
      >
        {/* Intensity */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold uppercase tracking-widest text-violet-400">
            Routine intensity
          </legend>
          <p className="mb-4 text-sm text-slate-500">How much do you want to take on?</p>
          <div
            className="grid gap-3 sm:grid-cols-3"
            aria-invalid={intensityError ? true : undefined}
          >
            {INTENSITIES.map((option) => (
              <OptionCard
                key={option.value}
                {...option}
                name="intensity"
                checked={intensity === option.value}
                onSelect={setIntensity}
              />
            ))}
          </div>
          {intensityError && (
            <p className="mt-2 text-xs font-medium text-rose-400">{intensityError}</p>
          )}
        </fieldset>

        {/* Style */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold uppercase tracking-widest text-violet-400">
            Routine style
          </legend>
          <p className="mb-4 text-sm text-slate-500">How should your day be structured?</p>
          <div className="grid gap-3 sm:grid-cols-2" aria-invalid={styleError ? true : undefined}>
            {STYLES.map((option) => (
              <OptionCard
                key={option.value}
                {...option}
                name="style"
                checked={style === option.value}
                onSelect={setStyle}
              />
            ))}
          </div>
          {styleError && <p className="mt-2 text-xs font-medium text-rose-400">{styleError}</p>}
        </fieldset>

        {/* Focus areas */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold uppercase tracking-widest text-violet-400">
            Focus areas
          </legend>
          <p className="mb-4 text-sm text-slate-500">Pick everything you want time for.</p>
          <div className="flex flex-wrap gap-2" aria-invalid={focusError ? true : undefined}>
            {FOCUS_AREAS.map((area) => (
              <SelectChip
                key={area.value}
                {...area}
                checked={focusAreas.includes(area.value)}
                onToggle={toggleFocusArea}
              />
            ))}
          </div>
          {focusError && <p className="mt-2 text-xs font-medium text-rose-400">{focusError}</p>}
        </fieldset>

        <div className="flex items-center justify-between gap-4">
          <p
            className="text-sm text-slate-500"
            role={submitted && !isComplete ? 'alert' : undefined}
          >
            {submitted && !isComplete
              ? 'Please complete the highlighted sections.'
              : 'You can change all of this later.'}
          </p>
          <Button type="submit" size="lg">
            <Sparkles className="size-4" /> Generate my routine <ArrowRight className="size-4" />
          </Button>
        </div>
      </motion.form>
    </OnboardingLayout>
  );
}
