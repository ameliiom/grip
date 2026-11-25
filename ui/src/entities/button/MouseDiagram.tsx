import { Inline, Stack, SurfaceInset } from "../../design-system/primitives";
import type { Vocab } from "../../i18n/vocab";

const SIDE_COORDS: readonly { num: number; id: string; col: number; row: number }[] = [
  { num: 1, id: "grid-1", col: 0, row: 0 },
  { num: 2, id: "grid-2", col: 0, row: 1 },
  { num: 3, id: "grid-3", col: 0, row: 2 },
  { num: 4, id: "grid-4", col: 1, row: 0 },
  { num: 5, id: "grid-5", col: 1, row: 1 },
  { num: 6, id: "grid-6", col: 1, row: 2 },
  { num: 7, id: "grid-7", col: 2, row: 0 },
  { num: 8, id: "grid-8", col: 2, row: 1 },
  { num: 9, id: "grid-9", col: 2, row: 2 },
  { num: 10, id: "grid-10", col: 3, row: 0 },
  { num: 11, id: "grid-11", col: 3, row: 1 },
  { num: 12, id: "grid-12", col: 3, row: 2 },
];

export function MouseDiagram({
  selectedButton,
  bindings,
  hasSideGrid12,
  vocab,
  onSelectButton,
}: {
  selectedButton: string;
  bindings: Record<string, string>;
  hasSideGrid12: boolean;
  vocab: Vocab;
  onSelectButton: (buttonId: string) => void;
}) {
  const fillFor = (id: string, isDisabled = false) => {
    if (selectedButton === id) return "var(--brand)";
    return isDisabled ? "var(--surface-0)" : "var(--surface-2)";
  };
  const strokeFor = (id: string) => (selectedButton === id ? "var(--brand)" : "var(--border)");
  const textFor = (id: string, isDisabled = false) => {
    if (selectedButton === id) return "var(--brand-fg)";
    return isDisabled ? "var(--fg-muted)" : "var(--fg)";
  };

  return (
    <div className={`grid grid-cols-1 ${hasSideGrid12 ? "md:grid-cols-12" : ""} gap-4 items-stretch`}>
      {/* Top-down view */}
      <SurfaceInset className={hasSideGrid12 ? "md:col-span-5 min-w-0 flex flex-col justify-between" : "min-w-0 flex flex-col justify-between"}>
        <Stack gap="2" className="items-center w-full">
          <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.topViewTitle}</span>
          <svg viewBox="0 0 240 316" className="w-[175px] max-w-full select-none">
            <path
              d="M58 88 C52 38, 82 16, 120 16 C158 16, 188 38, 182 88 L188 206 C192 272, 165 304, 120 304 C75 304, 48 272, 52 206 C42 178, 42 128, 58 88 Z"
              fill="var(--surface-1)"
              stroke="var(--border)"
              strokeWidth="2"
            />
            <path
              d="M62 87 C58 44, 84 22, 117 22 L117 120 L60 120 Z"
              fill={fillFor("left")}
              stroke={strokeFor("left")}
              strokeWidth="1.5"
              className="cursor-pointer grip-transition"
              onClick={() => onSelectButton("left")}
            />
            <text
              x="88"
              y="74"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={textFor("left")}
              className="pointer-events-none"
            >
              L
            </text>

            <path
              d="M123 22 C156 22, 182 44, 178 87 L180 120 L123 120 Z"
              fill={fillFor("right")}
              stroke={strokeFor("right")}
              strokeWidth="1.5"
              className="cursor-pointer grip-transition"
              onClick={() => onSelectButton("right")}
            />
            <text
              x="152"
              y="74"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={textFor("right")}
              className="pointer-events-none"
            >
              R
            </text>

            <rect
              x="96"
              y="48"
              width="13"
              height="32"
              rx="4"
              fill={fillFor("tilt-left")}
              stroke={strokeFor("tilt-left")}
              strokeWidth="1.5"
              className="cursor-pointer grip-transition"
              onClick={() => onSelectButton("tilt-left")}
            />
            <polyline
              points="104,59 100,64 104,69"
              fill="none"
              stroke={textFor("tilt-left")}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
            <rect
              x="131"
              y="48"
              width="13"
              height="32"
              rx="4"
              fill={fillFor("tilt-right")}
              stroke={strokeFor("tilt-right")}
              strokeWidth="1.5"
              className="cursor-pointer grip-transition"
              onClick={() => onSelectButton("tilt-right")}
            />
            <polyline
              points="136,59 140,64 136,69"
              fill="none"
              stroke={textFor("tilt-right")}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
            <rect
              x="111"
              y="40"
              width="18"
              height="48"
              rx="7"
              fill={fillFor("wheel")}
              stroke={strokeFor("wheel")}
              strokeWidth="1.8"
              className="cursor-pointer grip-transition"
              onClick={() => onSelectButton("wheel")}
            />
            <rect
              x="111"
              y="96"
              width="18"
              height="16"
              rx="4"
              fill={fillFor("dpi-up")}
              stroke={strokeFor("dpi-up")}
              strokeWidth="1.5"
              className="cursor-pointer grip-transition"
              onClick={() => onSelectButton("dpi-up")}
            />
            <text
              x="120"
              y="108"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={textFor("dpi-up")}
              className="pointer-events-none"
            >
              +
            </text>
            <rect
              x="111"
              y="116"
              width="18"
              height="16"
              rx="4"
              fill={fillFor("dpi-down")}
              stroke={strokeFor("dpi-down")}
              strokeWidth="1.5"
              className="cursor-pointer grip-transition"
              onClick={() => onSelectButton("dpi-down")}
            />
            <text
              x="120"
              y="128"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={textFor("dpi-down")}
              className="pointer-events-none"
            >
              -
            </text>
            {hasSideGrid12 ? (
              <rect x="44" y="136" width="9" height="68" rx="4" fill="var(--brand)" opacity="0.8" />
            ) : null}
            <circle cx="120" cy="222" r="22" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="120" y="226" textAnchor="middle" fontSize="12" fill="var(--fg-muted)">
              Grip
            </text>
          </svg>
        </Stack>
      </SurfaceInset>

      {/* Side-profile 12-button grid view */}
      {hasSideGrid12 ? (
        <SurfaceInset className="md:col-span-7 min-w-0 flex flex-col justify-between">
          <Stack gap="2" className="items-center w-full">
            <Inline gap="2" justify="between" className="w-full">
              <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.sideViewTitle}</span>
              <span className="text-xs font-semibold tabular-nums text-[var(--brand-ink)]">12</span>
            </Inline>
            <svg viewBox="0 0 380 225" className="w-full max-w-[360px] select-none">
              <path
                d="M26 176 C24 126, 65 70, 145 46 C215 26, 285 43, 336 92 C358 113, 362 150, 344 174 C332 190, 290 196, 200 196 C100 196, 32 190, 26 176 Z"
                fill="var(--surface-1)"
                stroke="var(--border)"
                strokeWidth="2"
              />
              <path
                d="M74 76 C78 56, 102 46, 118 54 L112 70 Z"
                fill={fillFor("wheel")}
                stroke={strokeFor("wheel")}
                strokeWidth="1.5"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("wheel")}
              />
              <rect x="82" y="82" width="174" height="100" rx="12" fill="var(--surface-0)" opacity="0.6" />
              {SIDE_COORDS.map((c) => {
                const disabled = bindings[c.id] === "disabled";
                const x = 92 + c.col * 40;
                const y = 90 + c.row * 30;
                return (
                  <g
                    key={c.id}
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton(c.id)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width="34"
                      height="24"
                      rx="6"
                      fill={fillFor(c.id, disabled)}
                      stroke={strokeFor(c.id)}
                      strokeWidth="1.6"
                    />
                    <text
                      x={x + 17}
                      y={y + 16}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fill={textFor(c.id, disabled)}
                      className="pointer-events-none tabular-nums"
                    >
                      {c.num}
                    </text>
                  </g>
                );
              })}
              <line x1="50" y1="202" x2="110" y2="202" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
              <line x1="255" y1="202" x2="320" y2="202" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </Stack>
        </SurfaceInset>
      ) : null}
    </div>
  );
}
