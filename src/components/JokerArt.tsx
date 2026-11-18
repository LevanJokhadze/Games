// Original jester artwork for the two jokers (drawn for this app).
// J1 is the red joker, J2 the black joker, as in a traditional deck.

export function JokerArt({ id, compact }: { id: string; compact?: boolean }) {
  const red = id === "J1";
  const main = red ? "#c8102e" : "#1d2430";
  const second = red ? "#1d2430" : "#c8102e";
  const gold = "#e0a800";
  const letters = ["J", "O", "K", "E", "R"];
  return (
    <svg className="joker-art" viewBox="0 0 100 145" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {!compact && (
        <>
          <g fill={main} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="10.5" textAnchor="middle">
            {letters.map((l, i) => (
              <text key={i} x="9" y={14 + i * 10}>{l}</text>
            ))}
          </g>
          <g transform="rotate(180 50 72.5)" fill={main} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="10.5" textAnchor="middle">
            {letters.map((l, i) => (
              <text key={i} x="9" y={14 + i * 10}>{l}</text>
            ))}
          </g>
        </>
      )}
      <g transform={compact ? "translate(-8 -14) scale(1.16)" : undefined} stroke="#1d2430" strokeWidth="1.1" strokeLinejoin="round">
        {/* cap: three points with bells */}
        <path d="M37 61 C27 55 19 45 15 31 C26 37 34 46 43 57 Z" fill={main} />
        <path d="M44 57 C43 44 46 32 50 19 C54 32 57 44 56 57 Z" fill={gold} />
        <path d="M63 61 C73 55 81 45 85 31 C74 37 66 46 57 57 Z" fill={second} />
        <circle cx="15" cy="30" r="3.4" fill={gold} />
        <circle cx="50" cy="18" r="3.4" fill={main} />
        <circle cx="85" cy="30" r="3.4" fill={gold} />
        <path d="M34 62 Q50 52 66 62 L66 67 Q50 58 34 67 Z" fill={gold} />
        {/* face */}
        <ellipse cx="50" cy="78" rx="13.5" ry="15" fill="#f7dcc0" />
        <path d="M42.5 72.5 Q45 70.5 47.5 72.5" fill="none" strokeWidth="1.3" />
        <path d="M52.5 72.5 Q55 70.5 57.5 72.5" fill="none" strokeWidth="1.3" />
        <circle cx="45" cy="75.5" r="1.4" fill="#1d2430" stroke="none" />
        <circle cx="55" cy="75.5" r="1.4" fill="#1d2430" stroke="none" />
        <circle cx="50" cy="80" r="2.2" fill={main} stroke="none" />
        <circle cx="42" cy="81.5" r="2.6" fill="#f29a9a" opacity="0.7" stroke="none" />
        <circle cx="58" cy="81.5" r="2.6" fill="#f29a9a" opacity="0.7" stroke="none" />
        <path d="M43.5 84.5 Q50 91 56.5 84.5" fill="none" strokeWidth="1.4" />
        {/* ruffled collar with bells */}
        <path d="M28 94 L35 106 L42 95 L50 108 L58 95 L65 106 L72 94 Q50 87 28 94 Z" fill={main} />
        <path d="M35 106 L42 95 L50 108 Z" fill={second} />
        <path d="M50 108 L58 95 L65 106 Z" fill={second} />
        <circle cx="35" cy="107.5" r="2.6" fill={gold} />
        <circle cx="50" cy="110" r="2.6" fill={gold} />
        <circle cx="65" cy="107.5" r="2.6" fill={gold} />
      </g>
      {!compact && (
        <text x="50" y="128" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="9" letterSpacing="2" fill={main}>
          JOKER
        </text>
      )}
    </svg>
  );
}
