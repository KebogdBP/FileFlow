import type { CSSProperties, HTMLAttributes } from 'react';

export type BadgeVariant =
  'local' | 'private' | 'cloud' | 'success' | 'warning' | 'danger' | 'neutral';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, CSSProperties> = {
  local: {
    color: 'var(--ff-color-success)',
    background: 'var(--ff-color-success-soft)',
  },
  private: {
    color: 'var(--ff-color-primary)',
    background: 'var(--ff-color-primary-soft)',
  },
  cloud: {
    color: 'var(--ff-color-purple)',
    background: '#eeeaff',
  },
  success: {
    color: 'var(--ff-color-success)',
    background: 'var(--ff-color-success-soft)',
  },
  warning: {
    color: 'var(--ff-color-warning)',
    background: 'var(--ff-color-warning-soft)',
  },
  danger: {
    color: 'var(--ff-color-danger)',
    background: 'var(--ff-color-danger-soft)',
  },
  neutral: {
    color: 'var(--ff-color-text-muted)',
    background: 'var(--ff-color-surface-raised)',
  },
};

export function Badge({ variant = 'neutral', style, children, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 26,
        padding: '0 10px',
        borderRadius: 'var(--ff-radius-full)',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.03em',
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
