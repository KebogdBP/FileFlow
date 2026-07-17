export type ProgressVariant = 'linear' | 'circular';

export type ProgressProps = {
  value?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  indeterminate?: boolean;
  variant?: ProgressVariant;
  size?: number;
};

export function Progress({
  value = 0,
  max = 100,
  label,
  showValue = true,
  indeterminate = false,
  variant = 'linear',
  size = 72,
}: ProgressProps) {
  const safeMax = Math.max(max, 0);
  const safeValue = Math.min(Math.max(value, 0), safeMax);
  const percent = safeMax > 0 ? Math.round((safeValue / safeMax) * 100) : 0;
  const ariaProps = {
    role: 'progressbar',
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': safeMax,
    'aria-valuenow': indeterminate ? undefined : safeValue,
    'aria-valuetext': indeterminate ? 'Working' : `${percent}%`,
  } as const;

  if (variant === 'circular') {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - percent / 100);

    return (
      <div
        {...ariaProps}
        style={{
          width: size,
          display: 'grid',
          gap: 'var(--ff-space-2)',
          justifyItems: 'center',
          color: 'var(--ff-color-text)',
        }}
      >
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            data-ff-progress-circle-indeterminate={indeterminate ? '' : undefined}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--ff-color-primary-soft)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--ff-color-primary)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={indeterminate ? circumference * 0.72 : dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dashoffset var(--ff-transition-base)' }}
            />
          </svg>
          {showValue ? (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                fontSize: 'var(--ff-font-caption-size)',
                fontWeight: 700,
              }}
            >
              {indeterminate ? '…' : `${percent}%`}
            </span>
          ) : null}
        </div>
        {label ? <span style={{ fontSize: 'var(--ff-font-caption-size)' }}>{label}</span> : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--ff-space-2)', color: 'var(--ff-color-text)' }}>
      {label || showValue ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--ff-space-3)',
            fontSize: 'var(--ff-font-caption-size)',
            fontWeight: 700,
          }}
        >
          <span>{label}</span>
          {showValue ? <span>{indeterminate ? 'Working…' : `${percent}%`}</span> : null}
        </div>
      ) : null}
      <div
        {...ariaProps}
        style={{
          height: 10,
          overflow: 'hidden',
          borderRadius: 'var(--ff-radius-full)',
          background: 'var(--ff-color-primary-soft)',
        }}
      >
        <div
          data-ff-progress-indeterminate={indeterminate ? '' : undefined}
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
