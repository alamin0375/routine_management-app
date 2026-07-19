import type { ElementType, ReactNode } from 'react';

// Constrains content width and applies consistent horizontal padding.
interface ContainerProps {
  as?: ElementType;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Container({ as: Tag = 'div', id, className = '', children }: ContainerProps) {
  return (
    <Tag id={id} className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </Tag>
  );
}
