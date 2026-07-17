import type { ButtonHTMLAttributes } from 'react';

export type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean;
  label: string;
  description?: string;
  onCheckedChange?: (checked: boolean) => void;
};

export function Toggle({
  checked,
  label,
  description,
  onCheckedChange,
  disabled,
  ...props
}: ToggleProps) {
  return (
    <button
      {...props}
      data-ff-toggle=""
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      style={{
        width: '100%',
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--ff-space-4)',
        padding: 0,
        border: 0,
        color: 'var(--ff-color-text)',
        background: 'transparent',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{ display: 'grid', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
        {description ? (
          <span style={{ color: 'var(--ff-color-text-muted)', fontSize: 12 }}>{description}</span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 42,
          height: 24,
          flex: '0 0 auto',
          padding: 3,
          display: 'flex',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          borderRadius: 'var(--ff-radius-full)',
          background: checked ? 'var(--ff-color-primary)' : 'var(--ff-color-border)',
          transition: 'all var(--ff-transition-fast)',
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: 'var(--ff-shadow-sm)',
          }}
        />
      </span>
    </button>
  );
}
