import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: {
    color: '#fff',
    background: 'var(--ff-color-primary)',
    borderColor: 'transparent',
  },
  secondary: {
    color: 'var(--ff-color-text)',
    background: 'var(--ff-color-surface)',
    borderColor: 'var(--ff-color-border)',
  },
  ghost: {
    color: 'var(--ff-color-text)',
    background: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    color: '#fff',
    background: 'var(--ff-color-danger)',
    borderColor: 'transparent',
  },
};

const sizes: Record<ButtonSize, CSSProperties> = {
  sm: { minHeight: 36, padding: '0 12px', fontSize: 13 },
  md: { minHeight: 44, padding: '0 18px', fontSize: 14 },
  lg: { minHeight: 52, padding: '0 22px', fontSize: 16 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 'var(--ff-radius-sm)',
        fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all var(--ff-transition-fast)',
        ...variants[variant],
        ...sizes[size],
        ...style,
      }}
    >
      {loading ? 'Processing…' : children}
    </button>
  );
}
