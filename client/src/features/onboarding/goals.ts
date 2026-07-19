import { Briefcase, Dumbbell, GraduationCap, Sprout, type LucideIcon } from 'lucide-react';

// Goal options shared across onboarding steps. The chosen value travels
// through router state until a backend exists to persist it.
export interface GoalOption {
  value: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

export const GOALS: readonly GoalOption[] = [
  {
    value: 'study',
    icon: GraduationCap,
    label: 'Study',
    description: 'Exam prep, coursework, and consistent study blocks.',
  },
  {
    value: 'work',
    icon: Briefcase,
    label: 'Work',
    description: 'Deep work, focus time, and a sustainable workday.',
  },
  {
    value: 'fitness',
    icon: Dumbbell,
    label: 'Fitness',
    description: 'Workouts, movement, and healthy daily habits.',
  },
  {
    value: 'personal-growth',
    icon: Sprout,
    label: 'Personal growth',
    description: 'Reading, side projects, mindfulness, new skills.',
  },
] as const;

export function findGoal(value: string | undefined): GoalOption | undefined {
  return GOALS.find((g) => g.value === value);
}
