import type { ButtonEntry, LayerName, MacroSummary } from "../../acl/transport";
import { Stack, TileButton } from "../../design-system/primitives";
import { BUTTON_LABELS, formatHumanAction, type Locale, type Vocab } from "../../i18n/vocab";

export type BlueprintView = "side" | "top";

// True physical left-side Razer Naga V2 HyperSpeed 12-button grid (nose left, rear right):
// Top row: 3, 6, 9, 12 | Middle row: 2, 5, 8, 11 | Bottom row: 1, 4, 7, 10
const NAGA_KEYPAD_ORDER: readonly number[] = [3, 6, 9, 12, 2, 5, 8, 11, 1, 4, 7, 10];
const NAGA_MOBILE_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COLUMN_ARCH_Y: readonly number[] = [6, 0, -2, 4];

// Exact EloShapes (119.5 x 75.5 x 43.5 mm) orthographic top contour inside 320x360 viewBox (188x296 body, 0.635 ratio)
const NAGA_TOP_CONTOUR =
  "M83 47 C94 37, 110 32, 120 32 C131 32, 134 36, 139 36 L158 36 C164 36, 169 33, 182 36 C198 39, 210 43, 214 48 C221 56, 224 72, 228 86 C235 97, 248 112, 252 126 C255 142, 254 166, 248 200 C244 226, 238 244, 230 268 C222 290, 214 303, 198 313 C182 323, 164 328, 150 328 C134 328, 114 320, 101 312 C88 302, 79 282, 73 254 C67 224, 64 192, 64 165 C64 136, 67 104, 72 78 C75 61, 77 52, 83 47 Z";

// Exact EloShapes (119.5 x 43.5 mm, 2.75:1 ratio) orthographic side contour inside 640x256 viewBox (512x186 body)
const NAGA_SIDE_CONTOUR =
  "M64 166 C64 157, 74 150, 92 142 C114 132, 136 122, 164 110 C194 96, 230 78, 272 64 C308 52, 336 48, 356 48 C388 48, 424 54, 464 70 C504 86, 540 112, 566 138 C574 146, 576 154, 576 164 C576 184, 562 212, 540 226 C524 234, 504 234, 476 234 L132 234 C112 234, 98 228, 86 212 C74 196, 64 178, 64 166 Z";

function actionFor(entry: ButtonEntry | undefined, layer: LayerName): string {
  if (!entry) return "disabled";
  return layer === "normal" ? entry.normal : (entry.hypershift ?? entry.normal);
}

function isModified(entry: ButtonEntry | undefined, layer: LayerName): boolean {
  if (!entry) return false;
  return layer === "normal" ? entry.remappedNormal : entry.remappedHypershift;
}

interface TopAnchorSpec {
  ax: number;
  ay: number;
  kind: "elbow" | "spine";
  elbowX: number;
  dropX?: number;
  dropY?: number;
}

const TOP_ANCHORS: Record<string, TopAnchorSpec> = {
  wheel: { ax: 145, ay: 72, kind: "elbow", elbowX: 112 },
  "dpi-up": { ax: 79, ay: 64, kind: "elbow", elbowX: 44 },
  dpi: { ax: 79, ay: 74, kind: "elbow", elbowX: 44 },
  "dpi-down": { ax: 78, ay: 98, kind: "elbow", elbowX: 44 },
  "dpi-2": { ax: 78, ay: 102, kind: "elbow", elbowX: 44 },
  left: { ax: 110, ay: 132, kind: "elbow", elbowX: 54 },
  "tilt-left": { ax: 132, ay: 84, kind: "spine", dropX: 132, dropY: 294, elbowX: 80 },
  "scroll-up": { ax: 149, ay: 47, kind: "elbow", elbowX: 192 },
  "tilt-right": { ax: 166, ay: 84, kind: "elbow", elbowX: 226 },
  right: { ax: 188, ay: 128, kind: "elbow", elbowX: 244 },
  "scroll-down": { ax: 149, ay: 120, kind: "spine", dropX: 161, dropY: 290, elbowX: 234 },
};

function rowCenterY(index: number, count: number, padTop: number, padBottom: number): number {
  const tileH = 56;
  const start = padTop + tileH / 2;
  const end = 360 - padBottom - tileH / 2;
  if (count <= 1) return 180;
  return start + (index * (end - start)) / (count - 1);
}

function leaderPolyline(id: string, edgeX: number, targetY: number): { points: string; ax: number; ay: number } | null {
  const spec = TOP_ANCHORS[id];
  if (!spec) return null;
  if (spec.kind === "spine" && spec.dropY !== undefined) {
    const dx = spec.dropX ?? spec.ax;
    const pts =
      dx !== spec.ax
        ? `${spec.ax},${spec.ay} ${dx},${spec.ay + 12} ${dx},${spec.dropY} ${spec.elbowX},${targetY} ${edgeX},${targetY}`
        : `${spec.ax},${spec.ay} ${spec.ax},${spec.dropY} ${spec.elbowX},${targetY} ${edgeX},${targetY}`;
    return { ax: spec.ax, ay: spec.ay, points: pts };
  }
  return {
    ax: spec.ax,
    ay: spec.ay,
    points: `${spec.ax},${spec.ay} ${spec.elbowX},${targetY} ${edgeX},${targetY}`,
  };
}

function CalloutTile({
  id,
  entry,
  layer,
  selected,
  align,
  locale,
  macros,
  fixedHeight = false,
  compactTitle,
  onSelect,
}: {
  id: string;
  entry: ButtonEntry | undefined;
  layer: LayerName;
  selected: boolean;
  align: "start" | "end";
  locale: Locale;
  macros: readonly MacroSummary[];
  fixedHeight?: boolean;
  compactTitle?: string;
  onSelect: (id: string) => void;
}) {
  const fullTitle = BUTTON_LABELS[locale][id] ?? id;
  const title = compactTitle ?? fullTitle;
  const raw = actionFor(entry, layer);
  const actionLabel = formatHumanAction(raw, locale, macros, true);
  const modified = isModified(entry, layer);

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className={fixedHeight ? "h-[56px] w-full flex items-stretch" : "w-full"}>
      <TileButton
        active={selected}
        align={align}
        tone="hardware"
        fillCell={fixedHeight}
        onClick={() => onSelect(id)}
        ariaLabel={`${fullTitle}: ${actionLabel}`}
      >
        <span className="flex items-center gap-1.5 text-xs font-medium opacity-85 max-w-full whitespace-nowrap">
          {modified ? (
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${selected ? "bg-[var(--brand-fg)]" : "bg-[var(--brand)]"}`}
            />
          ) : null}
          <span className="truncate whitespace-nowrap">{title}</span>
        </span>
        <span className="text-xs font-bold truncate max-w-full whitespace-nowrap" dir="auto">
          {actionLabel}
        </span>
      </TileButton>
    </div>
  );
}

export function HardwareBlueprint({
  selectedButton,
  buttons,
  layer,
  view,
  hasSideGrid12,
  macros,
  locale,
  vocab,
  onSelectButton,
}: {
  selectedButton: string;
  buttons: readonly ButtonEntry[];
  layer: LayerName;
  view: BlueprintView;
  hasSideGrid12: boolean;
  macros: readonly MacroSummary[];
  locale: Locale;
  vocab: Vocab;
  onSelectButton: (buttonId: string) => void;
}) {
  const byId = new Map<string, ButtonEntry>();
  for (const b of buttons) byId.set(b.id, b);

  const fillFor = (id: string) => {
    if (selectedButton === id) return "var(--brand)";
    return isModified(byId.get(id), layer) ? "var(--hw-shell-alt)" : "var(--hw-shell)";
  };
  const strokeFor = (id: string) => {
    if (selectedButton === id) return "var(--brand)";
    return isModified(byId.get(id), layer) ? "var(--brand)" : "var(--hw-stroke)";
  };
  const labelFill = (id: string) => (selectedButton === id ? "var(--brand-fg)" : "var(--fg)");
  const lineStrokeFor = (id: string) => (selectedButton === id ? "var(--brand)" : "var(--hw-line)");

  const topLeftIds = ["wheel", "dpi-up", "dpi", "dpi-down", "dpi-2", "left", "tilt-left"].filter((id) =>
    byId.has(id),
  );
  const topRightIds = ["scroll-up", "tilt-right", "right", "scroll-down"].filter((id) => byId.has(id));
  const sideFallbackIds = buttons
    .map((b) => b.id)
    .filter((id) => ["side-forward", "side-back", "sniper", "side-extra"].includes(id));

  const dpiUpAction = formatHumanAction(actionFor(byId.get("dpi-up"), layer), locale, macros, true);
  const dpiDownAction = formatHumanAction(actionFor(byId.get("dpi-down"), layer), locale, macros, true);
  const wheelAction = formatHumanAction(actionFor(byId.get("wheel"), layer), locale, macros, true);

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--hw-canvas)] p-4 sm:p-5">
      {view === "side" ? (
        <Stack gap="4">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-semibold text-[var(--fg-muted)]">{vocab.sideBodyLabel}</span>
            {hasSideGrid12 ? (
              <span className="text-xs font-semibold text-[var(--fg-muted)] tabular-nums">
                {vocab.thumbKeypadCount}
              </span>
            ) : null}
          </div>

          {hasSideGrid12 ? (
            <Stack gap="4">
              {/* True-scale EloShapes 2.75:1 Naga V2 HyperSpeed Left Profile + Rotated Arched 12-Button Sculpt */}
              <div className="w-full max-w-[620px] mx-auto" dir="ltr">
                <svg viewBox="0 0 640 256" className="w-full h-auto select-none block">
                  {/* Low-friction front & rear PTFE skates on flat base */}
                  <line x1="126" y1="236" x2="212" y2="236" stroke="var(--hw-stroke)" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="418" y1="236" x2="504" y2="236" stroke="var(--hw-stroke)" strokeWidth="3.5" strokeLinecap="round" />

                  {/* True orthographic outer chassis silhouette */}
                  <path
                    d={NAGA_SIDE_CONTOUR}
                    fill="var(--hw-shell)"
                    stroke="var(--hw-stroke)"
                    strokeWidth="2.2"
                  />

                  {/* Diagonal front main-paddle undercut seam behind the nose lip */}
                  <path
                    d="M72 174 C112 162, 164 146, 232 126"
                    fill="none"
                    stroke="var(--hw-stroke)"
                    strokeWidth="1.4"
                    opacity="0.65"
                  />

                  {/* Scroll Wheel peaking behind DPI Down (exact TechPowerUp left profile position) */}
                  <g className="cursor-pointer grip-transition" onClick={() => onSelectButton("wheel")}>
                    <path
                      d="M188 104 C194 90, 212 85, 228 91 L222 103 Z"
                      fill={fillFor("wheel")}
                      stroke={strokeFor("wheel")}
                      strokeWidth="1.8"
                    />
                    <line x1="198" y1="92" x2="202" y2="101" stroke={labelFill("wheel")} strokeWidth="1.2" opacity="0.65" />
                    <line x1="208" y1="89" x2="210" y2="99" stroke={labelFill("wheel")} strokeWidth="1.2" opacity="0.65" />
                    <line x1="217" y1="89" x2="218" y2="99" stroke={labelFill("wheel")} strokeWidth="1.2" opacity="0.65" />
                    <g className="hidden sm:block pointer-events-none">
                      <polyline
                        points="210,88 210,22 232,22"
                        fill="none"
                        stroke={lineStrokeFor("wheel")}
                        strokeWidth={selectedButton === "wheel" ? "2" : "1.3"}
                      />
                      <circle cx="210" cy="88" r="2.8" fill={lineStrokeFor("wheel")} />
                      <text
                        x="240"
                        y="26"
                        textAnchor="start"
                        fontSize="13"
                        fontWeight="600"
                        fill={selectedButton === "wheel" ? "var(--brand-ink)" : "var(--fg)"}
                      >
                        {wheelAction}
                      </text>
                    </g>
                  </g>

                  {/* DPI Up at very nose tip sloping toward front lip */}
                  {byId.has("dpi-up") ? (
                    <g className="cursor-pointer grip-transition" onClick={() => onSelectButton("dpi-up")}>
                      <g className="hidden sm:block pointer-events-none">
                        <polyline
                          points="96,138 96,22 76,22"
                          fill="none"
                          stroke={lineStrokeFor("dpi-up")}
                          strokeWidth={selectedButton === "dpi-up" ? "2" : "1.3"}
                        />
                        <circle cx="96" cy="138" r="2.8" fill={lineStrokeFor("dpi-up")} />
                        <text
                          x="68"
                          y="26"
                          textAnchor="end"
                          fontSize="13"
                          fontWeight="600"
                          fill={selectedButton === "dpi-up" ? "var(--brand-ink)" : "var(--fg)"}
                        >
                          {dpiUpAction}
                        </text>
                      </g>
                      <g transform="rotate(-22 96 146)">
                        <rect
                          x="70"
                          y="138"
                          width="52"
                          height="15"
                          rx="4.5"
                          fill={fillFor("dpi-up")}
                          stroke={strokeFor("dpi-up")}
                          strokeWidth="1.7"
                        />
                      </g>
                    </g>
                  ) : null}

                  {/* DPI Down right behind DPI Up on front shoulder */}
                  {byId.has("dpi-down") ? (
                    <g className="cursor-pointer grip-transition" onClick={() => onSelectButton("dpi-down")}>
                      <g className="hidden sm:block pointer-events-none">
                        <polyline
                          points="154,116 154,52 134,52"
                          fill="none"
                          stroke={lineStrokeFor("dpi-down")}
                          strokeWidth={selectedButton === "dpi-down" ? "2" : "1.3"}
                        />
                        <circle cx="154" cy="116" r="2.8" fill={lineStrokeFor("dpi-down")} />
                        <text
                          x="126"
                          y="56"
                          textAnchor="end"
                          fontSize="13"
                          fontWeight="600"
                          fill={selectedButton === "dpi-down" ? "var(--brand-ink)" : "var(--fg)"}
                        >
                          {dpiDownAction}
                        </text>
                      </g>
                      <g transform="rotate(-20 154 123)">
                        <rect
                          x="128"
                          y="115"
                          width="52"
                          height="15"
                          rx="4.5"
                          fill={fillFor("dpi-down")}
                          stroke={strokeFor("dpi-down")}
                          strokeWidth="1.7"
                        />
                      </g>
                    </g>
                  ) : null}

                  {/* Tight -11° Counterclockwise Tilted Arched 12-Button Thumb Grid (3-6-9-12 / 2-5-8-11 / 1-4-7-10) */}
                  <g transform="translate(0, -7) rotate(-11 324 162)">
                    <rect
                      x="224"
                      y="102"
                      width="198"
                      height="118"
                      rx="14"
                      fill="var(--hw-shell-alt)"
                      stroke="var(--hw-stroke)"
                      strokeWidth="1.5"
                    />
                    {NAGA_KEYPAD_ORDER.map((num, idx) => {
                      const col = idx % 4;
                      const row = Math.floor(idx / 4);
                      const id = `grid-${num}`;
                      const archOffset = COLUMN_ARCH_Y[col] ?? 0;
                      const bx = 232 + col * 46;
                      const by = 110 + row * 34 + archOffset;
                      const modified = isModified(byId.get(id), layer);
                      const selected = selectedButton === id;
                      return (
                        <g key={id} className="cursor-pointer grip-transition" onClick={() => onSelectButton(id)}>
                          <rect
                            x={bx}
                            y={by}
                            width="41"
                            height="29"
                            rx="5.5"
                            fill={fillFor(id)}
                            stroke={strokeFor(id)}
                            strokeWidth={selected ? "2" : "1.5"}
                          />
                          {modified ? (
                            <circle
                              cx={bx + 34}
                              cy={by + 7}
                              r="2"
                              fill={selected ? "var(--brand-fg)" : "var(--brand)"}
                              className="pointer-events-none"
                            />
                          ) : null}
                          <text
                            x={bx + 20.5}
                            y={by + 19}
                            textAnchor="middle"
                            fontSize="13"
                            fontWeight="700"
                            fill={labelFill(id)}
                            className="pointer-events-none"
                          >
                            {num}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>

              {/* Synced Tactile Action Grid in Exact Physical Orientation (3-6-9-12 / 2-5-8-11 / 1-4-7-10) */}
              <div className="hidden sm:grid sm:grid-cols-4 gap-2 w-full" dir="ltr">
                {NAGA_KEYPAD_ORDER.map((num) => (
                  <CalloutTile
                    key={`grid-tile-${num}`}
                    id={`grid-${num}`}
                    entry={byId.get(`grid-${num}`)}
                    layer={layer}
                    selected={selectedButton === `grid-${num}`}
                    align="start"
                    compactTitle={locale === "ar" ? `زر ${num}` : `Key ${num}`}
                    locale={locale}
                    macros={macros}
                    onSelect={onSelectButton}
                  />
                ))}
              </div>

              {/* Mobile Sequential Touch-Friendly Grid (1..12, >= 44px touch targets, zero truncation) */}
              <div className="sm:hidden grid grid-cols-3 gap-1.5 w-full" dir="ltr">
                {NAGA_MOBILE_ORDER.map((num) => (
                  <CalloutTile
                    key={`grid-mob-${num}`}
                    id={`grid-${num}`}
                    entry={byId.get(`grid-${num}`)}
                    layer={layer}
                    selected={selectedButton === `grid-${num}`}
                    align="start"
                    compactTitle={String(num)}
                    locale={locale}
                    macros={macros}
                    onSelect={onSelectButton}
                  />
                ))}
              </div>
            </Stack>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sideFallbackIds.map((id) => (
                <CalloutTile
                  key={id}
                  id={id}
                  entry={byId.get(id)}
                  layer={layer}
                  selected={selectedButton === id}
                  align="start"
                  locale={locale}
                  macros={macros}
                  onSelect={onSelectButton}
                />
              ))}
            </div>
          )}
        </Stack>
      ) : (
        <Stack gap="4">
          <span className="text-xs font-semibold text-[var(--fg-muted)]">{vocab.topBodyLabel}</span>

          {/* Desktop Precision Vector Schematic: Flanking Callouts + Exact Orthographic Top Naga V2 Chassis */}
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)] items-stretch gap-0 w-full" dir="ltr">
            <div className="flex flex-col justify-between h-[360px] pt-1 pb-3 min-w-0">
              {topLeftIds.map((id) => (
                <CalloutTile
                  key={id}
                  id={id}
                  entry={byId.get(id)}
                  layer={layer}
                  selected={selectedButton === id}
                  align={locale === "ar" ? "start" : "end"}
                  fixedHeight={true}
                  locale={locale}
                  macros={macros}
                  onSelect={onSelectButton}
                />
              ))}
            </div>

            <svg viewBox="0 0 320 360" className="w-[320px] h-[360px] select-none block shrink-0">
              {/* Outer EloShapes Naga V2 HyperSpeed Top Chassis with Sweeping Right Ring-Finger Ledge */}
              <path
                d={NAGA_TOP_CONTOUR}
                fill="var(--hw-shell)"
                stroke="var(--hw-stroke)"
                strokeWidth="2.2"
              />

              {/* Subtle Top-Down Protrusion of Left 12-Button Side Thumb Strip (4 stepped bumps) */}
              {hasSideGrid12 ? (
                <g fill="var(--hw-shell-alt)" stroke="var(--hw-stroke)" strokeWidth="1.2">
                  <rect x="61" y="132" width="6" height="18" rx="2.5" />
                  <rect x="60" y="155" width="6" height="18" rx="2.5" />
                  <rect x="61" y="178" width="6" height="18" rx="2.5" />
                  <rect x="63" y="201" width="6" height="18" rx="2.5" />
                </g>
              ) : null}

              {/* Sweeping Sculptural Contour Separating Palm Dome from Wide Right Ring-Finger Rest */}
              <path
                d="M196 44 C205 92, 214 148, 218 206 C214 252, 200 284, 186 306"
                fill="none"
                stroke="var(--hw-stroke)"
                strokeWidth="1.4"
                opacity="0.7"
              />

              {/* Interactive Left & Right Primary Paddles (seamless open flow into one-piece palm shell) */}
              <path
                d="M92 50 C102 39, 114 35, 136 36 L136 160 C114 162, 92 154, 80 144 C82 126, 86 116, 90 112 L90 50 Z"
                fill={selectedButton === "left" || isModified(byId.get("left"), layer) ? fillFor("left") : "transparent"}
                stroke={selectedButton === "left" || isModified(byId.get("left"), layer) ? strokeFor("left") : "none"}
                strokeWidth="1.5"
                opacity="0.88"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("left")}
              />
              <path
                d="M162 36 C178 36, 190 40, 196 46 C204 88, 211 132, 214 172 C194 178, 174 176, 162 172 Z"
                fill={selectedButton === "right" || isModified(byId.get("right"), layer) ? fillFor("right") : "transparent"}
                stroke={selectedButton === "right" || isModified(byId.get("right"), layer) ? strokeFor("right") : "none"}
                strokeWidth="1.5"
                opacity="0.88"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("right")}
              />

              {/* Front-Left Outer-Edge Carved DPI Up & DPI Down Stepped Buttons */}
              <path
                d="M80 51 C85 49, 89 49, 89 51 L88 79 L72 79 C73 68, 76 56, 80 51 Z"
                fill={fillFor("dpi-up")}
                stroke={strokeFor("dpi-up")}
                strokeWidth="1.8"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("dpi-up")}
              />
              <path
                d="M72 83 L88 83 L87 112 L69 112 C70 100, 71 91, 72 83 Z"
                fill={fillFor("dpi-down")}
                stroke={strokeFor("dpi-down")}
                strokeWidth="1.8"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("dpi-down")}
              />

              {/* Continuous Glossy Central Channel: Scroll Assembly + Mode Toggle Button Behind */}
              <rect x="137" y="36" width="24" height="142" rx="7" fill="var(--hw-shell-alt)" stroke="var(--hw-stroke)" strokeWidth="1.4" />

              {/* Etched '<' and '>' Tilt Symbols Flanking Wheel on Shell */}
              <polyline
                points="133,79 128,84 133,89"
                fill="none"
                stroke={selectedButton === "tilt-left" ? "var(--brand)" : "var(--hw-stroke)"}
                strokeWidth={selectedButton === "tilt-left" ? "2" : "1.5"}
                strokeLinecap="round"
                className="cursor-pointer"
                onClick={() => onSelectButton("tilt-left")}
              />
              <polyline
                points="165,79 170,84 165,89"
                fill="none"
                stroke={selectedButton === "tilt-right" ? "var(--brand)" : "var(--hw-stroke)"}
                strokeWidth={selectedButton === "tilt-right" ? "2" : "1.5"}
                strokeLinecap="round"
                className="cursor-pointer"
                onClick={() => onSelectButton("tilt-right")}
              />

              {/* Top Scroll Up Trigger */}
              <path
                d="M141 40 L157 40 L157 54 L141 54 Z"
                fill={fillFor("scroll-up")}
                stroke={strokeFor("scroll-up")}
                strokeWidth="1.4"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("scroll-up")}
              />
              <polyline
                points="145,49 149,43 153,49"
                fill="none"
                stroke={labelFill("scroll-up")}
                strokeWidth="1.7"
                strokeLinecap="round"
                className="pointer-events-none"
              />

              {/* Scroll Wheel with Metallic Rim Accents & Tread Grooves */}
              <rect
                x="141"
                y="56"
                width="16"
                height="52"
                rx="4.5"
                fill={fillFor("wheel")}
                stroke={strokeFor("wheel")}
                strokeWidth="1.8"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("wheel")}
              />
              <line x1="143" y1="60" x2="143" y2="104" stroke={labelFill("wheel")} strokeWidth="1" opacity="0.45" className="pointer-events-none" />
              <line x1="155" y1="60" x2="155" y2="104" stroke={labelFill("wheel")} strokeWidth="1" opacity="0.45" className="pointer-events-none" />
              {[64, 72, 80, 88, 96].map((ty) => (
                <line key={ty} x1="144" y1={ty} x2="154" y2={ty} stroke={labelFill("wheel")} strokeWidth="1.1" opacity="0.55" className="pointer-events-none" />
              ))}

              {/* Tilt Left / Right Hit Flanks Inside Wheel Trim */}
              <rect
                x="134"
                y="64"
                width="6"
                height="38"
                rx="2.5"
                fill={fillFor("tilt-left")}
                stroke={strokeFor("tilt-left")}
                strokeWidth="1.2"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("tilt-left")}
              />
              <rect
                x="158"
                y="64"
                width="6"
                height="38"
                rx="2.5"
                fill={fillFor("tilt-right")}
                stroke={strokeFor("tilt-right")}
                strokeWidth="1.2"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("tilt-right")}
              />

              {/* Bottom Scroll Down Trigger */}
              <path
                d="M141 110 L157 110 L157 126 L141 126 Z"
                fill={fillFor("scroll-down")}
                stroke={strokeFor("scroll-down")}
                strokeWidth="1.4"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("scroll-down")}
              />
              <polyline
                points="145,115 149,121 153,115"
                fill="none"
                stroke={labelFill("scroll-down")}
                strokeWidth="1.7"
                strokeLinecap="round"
                className="pointer-events-none"
              />

              {/* Mechanical Scroll Mode Button (inside glossy recess behind wheel, per studio photo) */}
              <rect x="143" y="132" width="12" height="22" rx="3" fill="var(--hw-shell)" stroke="var(--hw-stroke)" strokeWidth="1.3" />
              <line x1="146" y1="162" x2="152" y2="162" stroke="var(--hw-stroke)" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="146" y1="166" x2="152" y2="166" stroke="var(--hw-stroke)" strokeWidth="1.2" strokeLinecap="round" />

              {/* Vector Pointer Leader Lines — Aligned Pixel-for-Pixel to Left Callout Centers */}
              {topLeftIds.map((id, idx) => {
                const targetY = rowCenterY(idx, topLeftIds.length, 4, 12);
                const poly = leaderPolyline(id, 2, targetY);
                if (!poly) return null;
                const active = selectedButton === id;
                return (
                  <g key={`ll-${id}`} className="pointer-events-none">
                    <polyline
                      points={poly.points}
                      fill="none"
                      stroke={lineStrokeFor(id)}
                      strokeWidth={active ? "2.2" : "1.3"}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx={poly.ax} cy={poly.ay} r={active ? "4" : "3"} fill={lineStrokeFor(id)} />
                    <circle cx="2" cy={targetY} r="2.5" fill={lineStrokeFor(id)} />
                  </g>
                );
              })}

              {/* Vector Pointer Leader Lines — Aligned Pixel-for-Pixel to Right Callout Centers */}
              {topRightIds.map((id, idx) => {
                const targetY = rowCenterY(idx, topRightIds.length, 16, 24);
                const poly = leaderPolyline(id, 318, targetY);
                if (!poly) return null;
                const active = selectedButton === id;
                return (
                  <g key={`lr-${id}`} className="pointer-events-none">
                    <polyline
                      points={poly.points}
                      fill="none"
                      stroke={lineStrokeFor(id)}
                      strokeWidth={active ? "2.2" : "1.3"}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx={poly.ax} cy={poly.ay} r={active ? "4" : "3"} fill={lineStrokeFor(id)} />
                    <circle cx="318" cy={targetY} r="2.5" fill={lineStrokeFor(id)} />
                  </g>
                );
              })}
            </svg>

            <div className="flex flex-col justify-between h-[360px] pt-4 pb-6 min-w-0">
              {topRightIds.map((id) => (
                <CalloutTile
                  key={id}
                  id={id}
                  entry={byId.get(id)}
                  layer={layer}
                  selected={selectedButton === id}
                  align={locale === "ar" ? "end" : "start"}
                  fixedHeight={true}
                  locale={locale}
                  macros={macros}
                  onSelect={onSelectButton}
                />
              ))}
            </div>
          </div>

          {/* Mobile True-Scale Top Silhouette + Clean 2-Column Callout Grid */}
          <div className="sm:hidden flex flex-col gap-3" dir="ltr">
            <svg viewBox="54 24 210 314" className="w-[152px] max-w-full h-auto mx-auto select-none block">
              <path d={NAGA_TOP_CONTOUR} fill="var(--hw-shell)" stroke="var(--hw-stroke)" strokeWidth="2.2" />
              {hasSideGrid12 ? (
                <g fill="var(--hw-shell-alt)" stroke="var(--hw-stroke)" strokeWidth="1.2">
                  <rect x="61" y="132" width="6" height="18" rx="2.5" />
                  <rect x="60" y="155" width="6" height="18" rx="2.5" />
                  <rect x="61" y="178" width="6" height="18" rx="2.5" />
                  <rect x="63" y="201" width="6" height="18" rx="2.5" />
                </g>
              ) : null}
              <path
                d="M196 44 C205 92, 214 148, 218 206 C214 252, 200 284, 186 306"
                fill="none"
                stroke="var(--hw-stroke)"
                strokeWidth="1.4"
                opacity="0.7"
              />
              <path
                d="M92 50 C102 39, 114 35, 136 36 L136 160 C114 162, 92 154, 80 144 C82 126, 86 116, 90 112 L90 50 Z"
                fill={selectedButton === "left" || isModified(byId.get("left"), layer) ? fillFor("left") : "transparent"}
                stroke={selectedButton === "left" || isModified(byId.get("left"), layer) ? strokeFor("left") : "none"}
                strokeWidth="1.5"
                onClick={() => onSelectButton("left")}
              />
              <path
                d="M162 36 C178 36, 190 40, 196 46 C204 88, 211 132, 214 172 C194 178, 174 176, 162 172 Z"
                fill={selectedButton === "right" || isModified(byId.get("right"), layer) ? fillFor("right") : "transparent"}
                stroke={selectedButton === "right" || isModified(byId.get("right"), layer) ? strokeFor("right") : "none"}
                strokeWidth="1.5"
                onClick={() => onSelectButton("right")}
              />
              <path d="M80 51 C85 49, 89 49, 89 51 L88 79 L72 79 Z" fill={fillFor("dpi-up")} stroke={strokeFor("dpi-up")} strokeWidth="1.6" onClick={() => onSelectButton("dpi-up")} />
              <path d="M72 83 L88 83 L87 112 L69 112 Z" fill={fillFor("dpi-down")} stroke={strokeFor("dpi-down")} strokeWidth="1.6" onClick={() => onSelectButton("dpi-down")} />
              <rect x="137" y="36" width="24" height="142" rx="7" fill="var(--hw-shell-alt)" stroke="var(--hw-stroke)" strokeWidth="1.4" />
              <rect x="141" y="56" width="16" height="52" rx="4.5" fill={fillFor("wheel")} stroke={strokeFor("wheel")} strokeWidth="1.7" onClick={() => onSelectButton("wheel")} />
              <rect x="143" y="132" width="12" height="22" rx="3" fill="var(--hw-shell)" stroke="var(--hw-stroke)" strokeWidth="1.3" />
            </svg>
            <div className="grid grid-cols-2 gap-1.5">
              {[...topLeftIds, ...topRightIds].map((id) => (
                <CalloutTile
                  key={id}
                  id={id}
                  entry={byId.get(id)}
                  layer={layer}
                  selected={selectedButton === id}
                  align="start"
                  locale={locale}
                  macros={macros}
                  onSelect={onSelectButton}
                />
              ))}
            </div>
          </div>
        </Stack>
      )}
    </div>
  );
}
