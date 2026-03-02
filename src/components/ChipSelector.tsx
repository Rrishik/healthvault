// HealthVault — Chip selector (toggle-able pill buttons)

interface ChipSelectorProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Show a loading shimmer overlay */
  loading?: boolean;
}

export default function ChipSelector({
  options,
  selected,
  onChange,
  loading,
}: ChipSelectorProps) {
  const toggle = (item: string) => {
    onChange(
      selected.includes(item)
        ? selected.filter((i) => i !== item)
        : [...selected, item],
    );
  };

  return (
    <div className="space-y-2">
      {loading && options.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {[...Array(6)].map((_, i) => (
            <span
              key={i}
              className="inline-block h-8 rounded-full bg-surface-800 animate-pulse"
              style={{ width: `${60 + ((i * 17) % 40)}px` }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                selected.includes(opt)
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {loading && options.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-surface-500">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
          Personalizing suggestions…
        </div>
      )}
    </div>
  );
}
