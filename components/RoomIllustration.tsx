/**
 * Схематичные иллюстрации для блока «Как снять фото».
 * good — горизонтально, вечер, гирлянда, ёлка целиком, место на полу.
 * bad — темно, ёлка обрезана, в кадре человек.
 * Позже можно заменить настоящими фотографиями.
 */
export function RoomIllustration({ variant }: { variant: "good" | "bad" }) {
  const good = variant === "good";
  return (
    <svg viewBox="0 0 320 180" className="h-full w-full" role="img" aria-label={good ? "Пример хорошего фото комнаты" : "Пример неподходящего фото комнаты"}>
      <defs>
        <radialGradient id={`glow-${variant}`} cx="70%" cy="55%" r="45%">
          <stop offset="0%" stopColor="#f2c46d" stopOpacity={good ? 0.35 : 0.06} />
          <stop offset="100%" stopColor="#f2c46d" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* стены и пол */}
      <rect width="320" height="180" fill={good ? "#27304a" : "#0c0f18"} />
      <rect y="122" width="320" height="58" fill={good ? "#323c58" : "#10141e"} />
      <rect width="320" height="180" fill={`url(#glow-${variant})`} />
      {/* окно и диван */}
      <rect x="28" y="30" width="62" height="70" rx="2" fill={good ? "#151b2b" : "#07090f"} stroke={good ? "#46557a" : "#1a2030"} strokeWidth="3" />
      <rect x="104" y="96" width="78" height="34" rx="6" fill={good ? "#5a4638" : "#1a1612"} />
      {/* ёлка: в плохом варианте — обрезана правым краем */}
      <g transform={good ? "translate(0 0)" : "translate(78 -18) scale(1.25)"}>
        <polygon points="232,34 268,128 196,128" fill={good ? "#2d6a45" : "#14301f"} />
        <rect x="226" y="128" width="12" height="12" fill={good ? "#5a3b25" : "#23170e"} />
        {[
          [222, 80],
          [244, 92],
          [212, 112],
          [252, 116],
          [232, 62],
          [230, 104],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={good ? 2.6 : 1.6} fill="#f2c46d" opacity={good ? 1 : 0.4} />
        ))}
      </g>
      {/* человек в кадре */}
      {!good && (
        <g fill="#1d2433">
          <circle cx="150" cy="70" r="13" />
          <rect x="134" y="84" width="32" height="56" rx="12" />
        </g>
      )}
      {/* свободное место на полу */}
      {good && (
        <rect x="190" y="140" width="96" height="26" rx="4" fill="none" stroke="#f2c46d" strokeDasharray="4 4" strokeOpacity="0.7" />
      )}
    </svg>
  );
}
