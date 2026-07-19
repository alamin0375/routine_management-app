import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  // Gradient pill with a soft glow — the Linear/Raycast primary CTA look.
  primary:
    'bg-gradient-to-b from-violet-500 to-indigo-600 text-white shadow-[0_0_24px_-6px_rgba(124,92,255,0.8),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_32px_-4px_rgba(124,92,255,0.9),inset_0_1px_0_rgba(255,255,255,0.2)] hover:brightness-110 active:brightness-95',
  // Glass outline button.
  secondary:
    'border border-white/15 bg-white/5 text-white backdrop-blur hover:border-white/25 hover:bg-white/10',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-white',
};

const sizes: Record<Size, string> = {
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-[15px]',
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
}

function classes({ variant = 'primary', size = 'md' }: StyleProps, extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function Button({ variant, size, className = '', children, ...rest }: ButtonProps) {
  return (
    <button className={classes({ variant, size }, className)} {...rest}>
      {children}
    </button>
  );
}

// Anchor styled as a button — for in-page anchors and external links.
type ButtonLinkProps = StyleProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode };

export function ButtonLink({ variant, size, className = '', children, ...rest }: ButtonLinkProps) {
  return (
    <a className={classes({ variant, size }, className)} {...rest}>
      {children}
    </a>
  );
}

// React Router <Link> styled as a button — for client-side navigation.
type ButtonRouterLinkProps = StyleProps & LinkProps & { children: ReactNode };

export function ButtonRouterLink({
  variant,
  size,
  className = '',
  children,
  ...rest
}: ButtonRouterLinkProps) {
  return (
    <Link className={classes({ variant, size }, className)} {...rest}>
      {children}
    </Link>
  );
}
