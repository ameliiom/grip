import type { ButtonEntry, LayerName, MacroSummary } from "../../acl/transport";
import { Stack, SurfaceInset, TileButton } from "../../design-system/primitives";
import { BUTTON_LABELS, formatHumanAction, type Locale, type Vocab } from "../../i18n/vocab";

export type BlueprintView = "side" | "top" | "both";

const NAGA_KEYPAD_ORDER: readonly number[] = [1, 4, 7, 10, 2, 5, 8, 11, 3, 6, 9, 12];
const NAGA_MOBILE_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function actionFor(entry: ButtonEntry | undefined, layer: LayerName): string {
  if (!entry) return "disabled";
  return layer === "normal" ? entry.normal : (entry.hypershift ?? entry.normal);
}

function isModified(entry: ButtonEntry | undefined, layer: LayerName): boolean {
  if (!entry) return false;
  return layer === "normal" ? entry.remappedNormal : entry.remappedHypershift;
}

function CalloutTile({
  id,
  entry,
  layer,
  selected,
  align,
  locale,
  macros,
  onSelect,
}: {
  id: string;
  entry: ButtonEntry | undefined;
  layer: LayerName;
  selected: boolean;
  align: "start" | "end";
  locale: Locale;
  macros: readonly MacroSummary[];
  onSelect: (id: string) => void;
}) {
  const title = BUTTON_LABELS[locale][id] ?? id;
  const raw = actionFor(entry, layer);
  const actionLabel = formatHumanAction(raw, locale, macros, true);
  const modified = isModified(entry, layer);

  return (
    <TileButton
      active={selected}
      align={align}
      onClick={() => onSelect(id)}
      ariaLabel={`${title}: ${actionLabel}`}
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
    return isModified(byId.get(id), layer) ? "var(--surface-2)" : "var(--surface-0)";
  };
  const strokeFor = (id: string) => {
    if (selectedButton === id) return "var(--brand)";
    return isModified(byId.get(id), layer) ? "var(--brand)" : "var(--border)";
  };
  const labelFill = (id: string) => (selectedButton === id ? "var(--brand-fg)" : "var(--fg)");

  const topLeftIds = ["dpi-up", "dpi-down", "dpi", "dpi-2", "left", "tilt-left", "scroll-down"].filter((id) => byId.has(id));
  const topRightIds = ["scroll-up", "wheel", "tilt-right", "right"].filter((id) => byId.has(id));
  const sideFallbackIds = buttons
    .map((b) => b.id)
    .filter((id) => ["side-forward", "side-back", "sniper", "side-extra"].includes(id));

  const showTop = view === "both" || view === "top";
  const showSide = view === "both" || view === "side";

  return (
    <Stack gap="4">
      {/* Side-profile 12-button tactile keypad embedded in the real contoured Naga V2 HyperSpeed profile */}
      {showSide ? (
        <SurfaceInset>
          <Stack gap="4">
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-semibold text-[var(--fg-muted)]">{vocab.sideBodyLabel}</span>
              {hasSideGrid12 ? (
                <span className="text-xs font-semibold text-[var(--brand-ink)] tabular-nums">
                  {vocab.thumbKeypadCount}
                </span>
              ) : null}
            </div>

            {hasSideGrid12 ? (
              <div className="relative w-full max-w-[600px] mx-auto flex flex-col gap-2" dir="ltr">
                <svg viewBox="0 0 600 264" className="w-full h-auto select-none block">
                  {/* Low-friction PTFE front and rear glide skates */}
                  <line x1="66" y1="250" x2="164" y2="250" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
                  <line x1="414" y1="250" x2="530" y2="250" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />

                  {/* Authentic sculpted Razer Naga V2 HyperSpeed left side body profile */}
                  <path
                    d="M42 204 C36 158, 62 96, 132 66 C204 34, 296 22, 378 38 C466 56, 532 104, 560 166 C572 195, 560 226, 534 236 C480 248, 384 252, 272 252 C148 252, 50 236, 42 204 Z"
                    fill="var(--surface-1)"
                    stroke="var(--border)"
                    strokeWidth="2.2"
                  />

                  {/* Split front left-click overhang shell contour */}
                  <path
                    d="M58 134 C90 98, 152 68, 250 52 C302 45, 362 48, 424 64"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="1.5"
                    opacity="0.7"
                  />

                  {/* Scroll wheel ridge protruding on nose slope */}
                  <path
                    d="M92 84 C102 56, 128 42, 152 54 L145 70 Z"
                    fill={fillFor("wheel")}
                    stroke={strokeFor("wheel")}
                    strokeWidth="1.8"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("wheel")}
                  />

                  {/* Authentic angled front-left shoulder DPI buttons visible from left side */}
                  <g
                    className="cursor-pointer grip-transition"
                    transform="rotate(-9 170 72)"
                    onClick={() => onSelectButton("dpi-up")}
                  >
                    <rect
                      x="148"
                      y="62"
                      width="44"
                      height="20"
                      rx="6"
                      fill={fillFor("dpi-up")}
                      stroke={strokeFor("dpi-up")}
                      strokeWidth="1.8"
                    />
                    <text
                      x="170"
                      y="76"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill={labelFill("dpi-up")}
                      className="pointer-events-none"
                    >
                      +
                    </text>
                  </g>
                  <g
                    className="cursor-pointer grip-transition"
                    transform="rotate(-6 220 65)"
                    onClick={() => onSelectButton("dpi-down")}
                  >
                    <rect
                      x="198"
                      y="55"
                      width="44"
                      height="20"
                      rx="6"
                      fill={fillFor("dpi-down")}
                      stroke={strokeFor("dpi-down")}
                      strokeWidth="1.8"
                    />
                    <text
                      x="220"
                      y="69"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill={labelFill("dpi-down")}
                      className="pointer-events-none"
                    >
                      -
                    </text>
                  </g>

                  {/* Recessed sculpted 12-button thumb plate */}
                  <rect
                    x="104"
                    y="96"
                    width="388"
                    height="142"
                    rx="20"
                    fill="var(--surface-0)"
                    stroke="var(--border)"
                    strokeWidth="1.5"
                  />
                </svg>

                {/* Desktop 4x3 keypad nestled inside the Naga side thumb bay */}
                <div
                  className="hidden sm:grid sm:grid-cols-4 gap-1 sm:absolute sm:inset-x-[18.5%] sm:top-[38.5%] sm:bottom-[11%]"
                  dir="ltr"
                >
                  {NAGA_KEYPAD_ORDER.map((num) => {
                    const id = `grid-${num}`;
                    const entry = byId.get(id);
                    const act = formatHumanAction(actionFor(entry, layer), locale, macros, true);
                    const active = selectedButton === id;
                    const modified = isModified(entry, layer);
                    return (
                      <TileButton
                        key={id}
                        compact={true}
                        fillCell={true}
                        active={active}
                        align="start"
                        onClick={() => onSelectButton(id)}
                        ariaLabel={`${BUTTON_LABELS[locale][id] ?? id}: ${act}`}
                      >
                        <span className="flex items-center justify-between gap-1 w-full whitespace-nowrap">
                          <span className="text-xs font-bold tabular-nums opacity-85 shrink-0 whitespace-nowrap">{num}</span>
                          {modified ? (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-[var(--brand-fg)]" : "bg-[var(--brand)]"}`}
                            />
                          ) : null}
                        </span>
                        <span className="text-xs font-medium truncate max-w-full whitespace-nowrap" dir="auto">
                          {act}
                        </span>
                      </TileButton>
                    );
                  })}
                </div>

                {/* Mobile 3x4 keypad below silhouette in logical sequential order (1..12) */}
                <div className="sm:hidden grid grid-cols-3 gap-1.5" dir="ltr">
                  {NAGA_MOBILE_ORDER.map((num) => {
                    const id = `grid-${num}`;
                    const entry = byId.get(id);
                    const act = formatHumanAction(actionFor(entry, layer), locale, macros, true);
                    const active = selectedButton === id;
                    const modified = isModified(entry, layer);
                    return (
                      <TileButton
                        key={id}
                        compact={true}
                        active={active}
                        align="start"
                        onClick={() => onSelectButton(id)}
                        ariaLabel={`${BUTTON_LABELS[locale][id] ?? id}: ${act}`}
                      >
                        <span className="flex items-center justify-between gap-1 w-full whitespace-nowrap">
                          <span className="text-xs font-bold tabular-nums opacity-85 shrink-0 whitespace-nowrap">{num}</span>
                          {modified ? (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-[var(--brand-fg)]" : "bg-[var(--brand)]"}`}
                            />
                          ) : null}
                        </span>
                        <span className="text-xs font-medium truncate max-w-full whitespace-nowrap" dir="auto">
                          {act}
                        </span>
                      </TileButton>
                    );
                  })}
                </div>
              </div>
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
        </SurfaceInset>
      ) : null}

      {/* Top View: authentic asymmetrical Naga V2 HyperSpeed + flanking Synapse callout pills */}
      {showTop ? (
        <SurfaceInset>
          <Stack gap="4">
            <span className="text-xs font-semibold text-[var(--fg-muted)]">{vocab.topBodyLabel}</span>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_188px_minmax(0,1fr)] gap-3 items-center w-full" dir="ltr">
              <div className="flex flex-col gap-2 min-w-0 order-2 sm:order-1">
                {topLeftIds.map((id) => (
                  <CalloutTile
                    key={id}
                    id={id}
                    entry={byId.get(id)}
                    layer={layer}
                    selected={selectedButton === id}
                    align="end"
                    locale={locale}
                    macros={macros}
                    onSelect={onSelectButton}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center order-1 sm:order-2">
                <svg viewBox="0 0 220 296" className="w-[176px] max-w-full h-auto select-none">
                  {/* Asymmetrical right-handed sculpted Naga V2 chassis with wide ring-finger ledge */}
                  <path
                    d="M52 88 C44 38, 74 16, 110 16 C148 16, 178 40, 174 90 C192 118, 198 164, 186 210 C176 262, 152 284, 110 284 C68 284, 46 260, 40 208 C34 176, 34 126, 52 88 Z"
                    fill="var(--surface-1)"
                    stroke="var(--border)"
                    strokeWidth="2.2"
                  />

                  {/* Flared ring-finger ergonomic rest contour */}
                  <path
                    d="M174 90 C188 120, 190 164, 178 206 C170 232, 162 250, 156 260"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="1.5"
                    opacity="0.7"
                  />

                  {/* Subtle thumb-pad edge marker on left */}
                  {hasSideGrid12 ? (
                    <rect x="34" y="124" width="8" height="68" rx="4" fill="var(--brand)" opacity="0.85" />
                  ) : null}

                  {/* Left Click Paddle */}
                  <path
                    d="M66 90 L66 118 L106 118 L106 23 C84 23, 68 33, 62 52 L66 52 Z"
                    fill={fillFor("left")}
                    stroke={strokeFor("left")}
                    strokeWidth="1.8"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("left")}
                  />

                  {/* Right Click Paddle */}
                  <path
                    d="M114 23 C146 23, 168 45, 166 90 L166 118 L114 118 Z"
                    fill={fillFor("right")}
                    stroke={strokeFor("right")}
                    strokeWidth="1.8"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("right")}
                  />

                  {/* Front-Left Shoulder DPI Up & DPI Down */}
                  <rect
                    x="47"
                    y="48"
                    width="15"
                    height="22"
                    rx="5"
                    fill={fillFor("dpi-up")}
                    stroke={strokeFor("dpi-up")}
                    strokeWidth="1.8"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("dpi-up")}
                  />
                  <rect
                    x="47"
                    y="74"
                    width="15"
                    height="22"
                    rx="5"
                    fill={fillFor("dpi-down")}
                    stroke={strokeFor("dpi-down")}
                    strokeWidth="1.8"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("dpi-down")}
                  />

                  {/* Central 5-Input Scroll Assembly */}
                  <rect x="94" y="38" width="32" height="68" rx="11" fill="var(--surface-0)" stroke="var(--border)" strokeWidth="1.4" />
                  <path
                    d="M102 41 L118 41 L118 53 L102 53 Z"
                    fill={fillFor("scroll-up")}
                    stroke={strokeFor("scroll-up")}
                    strokeWidth="1.5"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("scroll-up")}
                  />
                  <polyline
                    points="106,49 110,44 114,49"
                    fill="none"
                    stroke={labelFill("scroll-up")}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                  <rect
                    x="102"
                    y="55"
                    width="16"
                    height="32"
                    rx="4"
                    fill={fillFor("wheel")}
                    stroke={strokeFor("wheel")}
                    strokeWidth="1.8"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("wheel")}
                  />
                  <path
                    d="M102 89 L118 89 L118 103 L102 103 Z"
                    fill={fillFor("scroll-down")}
                    stroke={strokeFor("scroll-down")}
                    strokeWidth="1.5"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("scroll-down")}
                  />
                  <polyline
                    points="106,93 110,98 114,93"
                    fill="none"
                    stroke={labelFill("scroll-down")}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                  <rect
                    x="94"
                    y="58"
                    width="7"
                    height="26"
                    rx="3"
                    fill={fillFor("tilt-left")}
                    stroke={strokeFor("tilt-left")}
                    strokeWidth="1.5"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("tilt-left")}
                  />
                  <rect
                    x="119"
                    y="58"
                    width="7"
                    height="26"
                    rx="3"
                    fill={fillFor("tilt-right")}
                    stroke={strokeFor("tilt-right")}
                    strokeWidth="1.5"
                    className="cursor-pointer grip-transition"
                    onClick={() => onSelectButton("tilt-right")}
                  />

                  {/* Scroll Mode Switch Circle */}
                  <circle cx="110" cy="118" r="5" fill="var(--surface-0)" stroke="var(--border)" strokeWidth="1.5" />
                </svg>
              </div>

              <div className="flex flex-col gap-2 min-w-0 order-3">
                {topRightIds.map((id) => (
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
        </SurfaceInset>
      ) : null}
    </Stack>
  );
}
