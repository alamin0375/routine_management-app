import { Container } from '../../components/Container';
import { Logo } from '../../components/Logo';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <Logo size="sm" />
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} RoutineApp. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
