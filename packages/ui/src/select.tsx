import type { SelectHTMLAttributes } from 'react';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  description?: string;
  error?: string;
};

export function Select({
  id,
  label,
  description,
  error,
  children,
  disabled,
  ...props
}: SelectProps) {
  const descriptionId = description && id ? `${id}-description` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <label
      htmlFor={id}
      style={{ display: 'grid', gap: 'var(--ff-space-2)', color: 'var(--ff-color-text)' }}
    >
      {label ? <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span> : null}
      <select
        {...props}
        data-ff-select=""
        id={id}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? descriptionId}
        style={{
          minHeight: 44,
          width: '100%',
          padding: '0 var(--ff-space-3)',
          border: `1px solid ${error ? 'var(--ff-color-danger)' : 'var(--ff-color-border)'}`,
          borderRadius: 'var(--ff-radius-sm)',
          color: 'var(--ff-color-text)',
          background: disabled ? 'var(--ff-color-surface-raised)' : 'var(--ff-color-surface)',
          font: 'inherit',
        }}
      >
        {children}
      </select>
      {description ? (
        <span id={descriptionId} style={{ color: 'var(--ff-color-text-muted)', fontSize: 12 }}>
          {description}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" style={{ color: 'var(--ff-color-danger)', fontSize: 12 }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
