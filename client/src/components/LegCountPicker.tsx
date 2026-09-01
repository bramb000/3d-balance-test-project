type Props = {
  legCount: number;
  onChange: (count: number) => void;
};

const PRESETS = [3, 4, 6];

export function LegCountPicker({ legCount, onChange }: Props) {
  return (
    <div className="leg-picker">
      <span className="leg-picker-label">Legs</span>
      <div className="leg-picker-buttons">
        {PRESETS.map((n) => (
          <button
            key={n}
            className={`leg-btn ${legCount === n ? "active" : ""}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
        <input
          type="number"
          min={2}
          max={12}
          value={legCount}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v >= 2 && v <= 12) onChange(v);
          }}
          className="leg-input"
        />
      </div>
    </div>
  );
}
