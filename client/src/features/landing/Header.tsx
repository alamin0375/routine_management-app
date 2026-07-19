import { Container } from '../../components/Container';
import { Logo } from '../../components/Logo';
import { ButtonRouterLink } from '../../components/Button';

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#08080d]/70 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        <a href="#" aria-label="RoutineApp home">
          <Logo size="sm" />
        </a>
        <nav
          aria-label="Main"
          className="hidden items-center gap-7 text-sm font-medium text-slate-400 sm:flex"
        >
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-white">
            How it works
          </a>
        </nav>
        {/* Auth arrives in a later phase — onboarding is the entry point for now. */}
        <ButtonRouterLink to="/onboarding" size="md">
          Get started
        </ButtonRouterLink>
      </Container>
    </header>
  );
}
