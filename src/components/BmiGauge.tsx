// HealthVault — BMI semicircle gauge component
// Renders a speedometer-style SVG with colored zones and a needle.

interface BmiGaugeProps {
  value: number; // BMI value
  size?: number; // width in px (default 140)
}

// BMI ranges mapped to gauge zones
const BMI_MIN = 10;
const BMI_MAX = 40;

const ZONES = [
  { from: BMI_MIN, to: 18.5, color: '#60a5fa' }, // blue — underweight
  { from: 18.5, to: 25, color: '#34d399' }, // green — normal
  { from: 25, to: 30, color: '#fbbf24' }, // yellow — overweight
  { from: 30, to: BMI_MAX, color: '#f87171' }, // red — obese
];

function bmiToAngle(bmi: number): number {
  const clamped = Math.max(BMI_MIN, Math.min(BMI_MAX, bmi));
  return ((clamped - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 180;
}

/** Convert angle (0°=left, 180°=right) to SVG coords for an upward semicircle */
function toXY(cx: number, cy: number, r: number, angleDeg: number) {
  // 0° = left end, 180° = right end. Arc opens upward.
  const rad = (Math.PI * (180 - angleDeg)) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcD(
  cx: number,
  cy: number,
  r: number,
  a1: number,
  a2: number,
): string {
  const p1 = toXY(cx, cy, r, a1);
  const p2 = toXY(cx, cy, r, a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  // sweep=1 because we go from left to right (clockwise in screen coords)
  return `M${p1.x},${p1.y} A${r},${r} 0 ${large} 1 ${p2.x},${p2.y}`;
}

export default function BmiGauge({ value, size = 140 }: BmiGaugeProps) {
  const cx = size / 2;
  const cy = size / 2; // center at vertical midpoint
  const r = size / 2 - 14; // radius with padding for stroke
  const sw = 10; // stroke width

  const needleAngle = bmiToAngle(value);
  const tip = toXY(cx, cy, r - 8, needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + 24}
        viewBox={`0 0 ${size} ${size / 2 + 24}`}
      >
        {/* Background track */}
        <path
          d={arcD(cx, cy, r, 0, 180)}
          fill="none"
          stroke="currentColor"
          className="text-surface-700"
          strokeWidth={sw}
          strokeLinecap="round"
        />

        {/* Colored zone arcs */}
        {ZONES.map((zone, i) => (
          <path
            key={i}
            d={arcD(cx, cy, r, bmiToAngle(zone.from), bmiToAngle(zone.to))}
            fill="none"
            stroke={zone.color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        ))}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={tip.x}
          y2={tip.y}
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={4} className="fill-surface-100" />
        <circle cx={cx} cy={cy} r={2} className="fill-surface-800" />
      </svg>

      {/* Value */}
      <p className="text-sm font-medium text-surface-300 -mt-3">
        BMI: <span className="text-lg font-bold text-surface-100">{value}</span>
      </p>
    </div>
  );
}
