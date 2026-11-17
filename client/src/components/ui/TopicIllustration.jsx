const palettes = {
  fungsi: ['#6875ef', '#c5ccff', '#e9edff', '#3c49b0'],
  geometri: ['#31b99d', '#9be8ce', '#e4f8f0', '#18856f'],
  statistik: ['#f2ac49', '#ffe09a', '#fff3d6', '#be7b27'],
  peluang: ['#a07aea', '#d9c5ff', '#f0e7ff', '#7350b7'],
  aljabar: ['#e88bab', '#ffc7d8', '#fff0f4', '#b55b81'],
  transformasi: ['#91bb4c', '#d8ed9e', '#f1f8db', '#668d31'],
};

/** Small, hand-drawn vector illustrations stay sharp at every UI size. */
export default function TopicIllustration({ id = 'fungsi' }) {
  const [main, light, pale, dark] = palettes[id] ?? palettes.fungsi;
  const stroke = { stroke: dark, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="0 0 100 100" fill="none" className="topic-illustration" aria-hidden="true">
      <ellipse cx="50" cy="85" rx="31" ry="5" fill={dark} opacity=".09" />
      {id === 'fungsi' && (
        <>
          <path
            d="M19 19h57a7 7 0 0 1 7 7v46a7 7 0 0 1-7 7H19a7 7 0 0 1-7-7V26a7 7 0 0 1 7-7Z"
            fill={light}
            {...stroke}
          />
          <rect x="17" y="14" width="68" height="60" rx="8" fill="white" {...stroke} />
          <path d="M31 28v33h40" stroke={light} strokeWidth="3" strokeLinecap="round" />
          <path
            d="M34 53c7 0 10-18 18-18s10 19 20 7"
            stroke={main}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="35" cy="53" r="5" fill={main} stroke="white" strokeWidth="2" />
          <circle cx="53" cy="36" r="5" fill={main} stroke="white" strokeWidth="2" />
          <circle cx="72" cy="42" r="5" fill={main} stroke="white" strokeWidth="2" />
          <path d="m78 9 2-5m9 11 5-1" stroke={light} strokeWidth="3" strokeLinecap="round" />
          <path d="M46 75v8m-10 1h24" {...stroke} />
        </>
      )}
      {id === 'geometri' && (
        <>
          <circle cx="43" cy="49" r="29" fill={pale} stroke={light} strokeWidth="3" />
          <path d="M43 49 67 31M43 49l17 24" stroke={main} strokeWidth="3" strokeLinecap="round" />
          <path d="M55 41a15 15 0 0 1-3 20" stroke={main} strokeWidth="3" strokeLinecap="round" />
          <path d="m57 26-12 48-5 8 1-10 10-49m6 3 22 47 1 10-7-7-22-50" fill={light} {...stroke} />
          <circle cx="54" cy="23" r="7" fill="white" {...stroke} />
          <circle cx="43" cy="49" r="3" fill={dark} />
          <path d="m15 19 2-5m-5 2 5 2" stroke={light} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {id === 'statistik' && (
        <>
          <path d="M17 76h66" {...stroke} />
          <rect x="22" y="48" width="14" height="27" rx="4" fill={light} {...stroke} />
          <rect x="43" y="34" width="14" height="41" rx="4" fill={main} {...stroke} />
          <rect x="64" y="19" width="14" height="56" rx="4" fill={light} {...stroke} />
          <path
            d="m22 35 21-15 16 4 17-14"
            stroke={dark}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M67 10h9v9" {...stroke} />
          <path d="M26 54h6m15-14h6m15-15h6" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {id === 'peluang' && (
        <>
          <g transform="rotate(-12 35 57)">
            <rect x="12" y="32" width="45" height="45" rx="10" fill={light} {...stroke} />
            <circle cx="25" cy="45" r="3.4" fill={dark} />
            <circle cx="44" cy="45" r="3.4" fill={dark} />
            <circle cx="34.5" cy="54.5" r="3.4" fill={dark} />
            <circle cx="25" cy="64" r="3.4" fill={dark} />
            <circle cx="44" cy="64" r="3.4" fill={dark} />
          </g>
          <g transform="rotate(13 66 39)">
            <rect x="43" y="15" width="44" height="44" rx="10" fill="white" {...stroke} />
            <circle cx="55" cy="27" r="3.5" fill={main} />
            <circle cx="75" cy="27" r="3.5" fill={main} />
            <circle cx="55" cy="47" r="3.5" fill={main} />
            <circle cx="75" cy="47" r="3.5" fill={main} />
          </g>
          <path d="m82 73 3-4m1 8 5 1" stroke={light} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {id === 'aljabar' && (
        <>
          <path
            d="M24 24h-9v54h9m52-54h9v54h-9"
            stroke={light}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M23 19H13v54h10m54-54h10v54H77" {...stroke} />
          {[0, 1, 2].map((row) =>
            [0, 1].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={28 + col * 26}
                y={22 + row * 18}
                width="17"
                height="12"
                rx="4"
                fill={(row + col) % 2 ? light : main}
              />
            )),
          )}
          <path d="m66 9 1-4m6 8 4-2" stroke={light} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {id === 'transformasi' && (
        <>
          <path d="M19 74V21m-6 53h70" stroke={light} strokeWidth="3" strokeLinecap="round" />
          <path d="m25 65 12-29 16 29H25Z" fill={light} {...stroke} />
          <path d="m48 48 13-30 18 30H48Z" fill={main} {...stroke} />
          <path d="M32 21C37 8 53 5 65 10" {...stroke} />
          <path d="m57 5 9 5-6 8" {...stroke} />
          <path d="m42 59 15-17" stroke={dark} strokeWidth="2" strokeDasharray="3 4" />
          <circle cx="21" cy="74" r="3" fill={dark} />
        </>
      )}
    </svg>
  );
}
