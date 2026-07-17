import type { CSSProperties, HTMLAttributes } from 'react';

export type CardVariant = 'surface' | 'interactive' | 'selected' | 'glass';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

export function Card({
  variant = 'surface',
  style,
  children,
  tabIndex,
  role,
  ...props
}: CardProps) {
  const selected = variant === 'selected';
  const glass = variant === 'glass';

  const variantStyle: CSSProperties = {
    borderColor: selected ? 'var(--ff-color-primary)' : 'var(--ff-color-border)',
    background: glass
      ? 'color-mix(in srgb, var(--ff-color-surface) 84%, transparent)'
      : 'var(--ff-color-surface)',
    boxShadow: selected ? 'var(--ff-shadow-focus)' : 'var(--ff-shadow-sm)',
    backdropFilter: glass ? 'blur(18px)' : undefined,
  };

  return (
    <div
      {...props}
      data-ff-card={variant}
      tabIndex={variant === 'interactive' ? (tabIndex ?? 0) : tabIndex}
      role={variant === 'interactive' ? (role ?? 'button') : role}
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 'var(--ff-radius-xl)',
        padding: 'var(--ff-space-6)',
        transition: 'all var(--ff-transition-fast)',
        ...variantStyle,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
