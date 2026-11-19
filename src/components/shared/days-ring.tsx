/**
 * A countdown ring (DESIGN.md, Other number pictures; board HVehicleForms): a circle filled for the
 * days left out of `ofDays`, coloured by how near it is (green over 30 days, amber inside 30, red
 * inside 7 or past), with the number of days in the middle.
 */
export function DaysRing({ days, ofDays = 365, size = 70, label }: { days: number; ofDays?: number; size?: number; label: string }) {
  const stroke = size >= 100 ? 8 : 6;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const share = days <= 0 ? 0 : Math.min(1, days / ofDays);
  const dash = Math.max(days > 0 ? 4 : 0, share * c);
  const tone = days < 0 || days <= 7 ? "var(--status-overdue)" : days <= 30 ? "var(--status-soon-mark)" : "var(--status-ok)";
  const shown = days < 0 ? -days : days;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--raised)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {days > 0 ? <circle cx={size / 2} cy={stroke / 2 + 2} r={stroke * 0.6} fill={tone} /> : null}
      <text x={size / 2} y={size / 2 + size * 0.07} textAnchor="middle" fontSize={size * 0.3} fontWeight={600} className="fill-foreground font-display">
        {shown}
      </text>
      <text x={size / 2} y={size / 2 + size * 0.27} textAnchor="middle" fontSize={Math.max(8, size * 0.12)} letterSpacing={1} className="fill-label font-mono">
        {days < 0 ? "LATE" : "DAYS"}
      </text>
    </svg>
  );
}
