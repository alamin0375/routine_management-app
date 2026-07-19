import { Header } from './Header';
import { Hero } from './Hero';
import { Features } from './Features';
import { HowItWorks } from './HowItWorks';
import { CallToAction } from './CallToAction';
import { Footer } from './Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08080d] text-slate-200 antialiased selection:bg-violet-500/30 selection:text-white">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
