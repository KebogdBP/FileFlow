export type ProgressProps = {
  value?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  indeterminate?: boolean;
};

export function Progress({
  value = 0,
  max = 100,
  label,
  showValue = true,
  indeterminate = false,
}: ProgressProps) {
  const safeValue = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? Math.round((safeValue / max) * 100) : 0;

  return (
    <div style={{ display: 'grid', gap: 'var(--ff-space-2)', color: 'var(--ff-color-text)' }}>
      {label || showValue ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--ff-space-3)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <span>{label}</span>
          {showValue ? <span>{indeterminate ? 'Working…' : `${percent}%`}</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : safeValue}
        style={{
          height: 10,
          overflow: 'hidden',
          borderRadius: 'var(--ff-radius-full)',
          background: 'var(--ff-color-primary-soft)',
        }}
      >
        <div
          style={{
            width: indeterminate ? '38%' : `${percent}%`,
            height: '100%',
            borderRadius: 'inherit',
            background: 'var(--ff-color-primary)',
            transition: 'width var(--ff-transition-base)',
          }}
        />
      </div>
    </div>
  );
}
