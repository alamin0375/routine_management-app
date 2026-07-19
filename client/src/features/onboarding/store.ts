import { create } from 'zustand';

// Single source of truth for onboarding answers. Living in a store (rather
// than router state) means Back/forward navigation never loses data; only the
// explicit "Start over" action clears it. Persistence to the backend arrives
// with accounts.

export const TIME_KEYS = [
  'wakeTime',
  'sleepTime',
  'breakfastTime',
  'lunchTime',
  'dinnerTime',
] as const;
export type TimeKey = (typeof TIME_KEYS)[number];
export type ScheduleTimes = Record<TimeKey, string>;

const EMPTY_TIMES: ScheduleTimes = {
  wakeTime: '',
  sleepTime: '',
  breakfastTime: '',
  lunchTime: '',
  dinnerTime: '',
};

interface OnboardingState {
  goal: string | null;
  times: ScheduleTimes;
  focusHours: string | null;
  intensity: string | null;
  style: string | null;
  focusAreas: string[];
  setGoal: (goal: string) => void;
  setTime: (key: TimeKey, value: string) => void;
  setFocusHours: (value: string) => void;
  setIntensity: (value: string) => void;
  setStyle: (value: string) => void;
  toggleFocusArea: (value: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  goal: null,
  times: EMPTY_TIMES,
  focusHours: null,
  intensity: null,
  style: null,
  focusAreas: [],
  setGoal: (goal) => set({ goal }),
  setTime: (key, value) => set((s) => ({ times: { ...s.times, [key]: value } })),
  setFocusHours: (focusHours) => set({ focusHours }),
  setIntensity: (intensity) => set({ intensity }),
  setStyle: (style) => set({ style }),
  toggleFocusArea: (value) =>
    set((s) => ({
      focusAreas: s.focusAreas.includes(value)
        ? s.focusAreas.filter((v) => v !== value)
        : [...s.focusAreas, value],
    })),
  reset: () =>
    set({
      goal: null,
      times: EMPTY_TIMES,
      focusHours: null,
      intensity: null,
      style: null,
      focusAreas: [],
    }),
}));

// Step guards — each step requires the previous steps' answers.
export const isScheduleComplete = (times: ScheduleTimes, focusHours: string | null) =>
  TIME_KEYS.every((key) => times[key] !== '') && focusHours !== null;

export const arePreferencesComplete = (s: {
  intensity: string | null;
  style: string | null;
  focusAreas: string[];
}) => s.intensity !== null && s.style !== null && s.focusAreas.length > 0;
