import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LandingPage } from '../features/landing/LandingPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { DetailsPage } from '../features/onboarding/DetailsPage';
import { PreferencesPage } from '../features/onboarding/PreferencesPage';
import { RoutinePreviewPage } from '../features/onboarding/RoutinePreviewPage';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/onboarding/details" element={<DetailsPage />} />
          <Route path="/onboarding/preferences" element={<PreferencesPage />} />
          <Route path="/onboarding/preview" element={<RoutinePreviewPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
