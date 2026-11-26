import type { ButtonEntry, DeviceCapabilities, LayerName, MacroSummary } from "../../acl/transport";
import { TileButton } from "../../design-system/primitives";
import { BUTTON_LABELS, formatHumanAction, type Locale, type Vocab } from "../../i18n/vocab";
import { resolveBlueprint, type TopAnchorSpec } from "./blueprints";

export type BlueprintView = "side" | "top";

function actionFor(entry: ButtonEntry | undefined, layer: LayerName): string {
  if (!entry) return "disabled";
  return layer === "normal" ? entry.normal : (entry.hypershift ?? entry.normal);
}

function isModified(entry: ButtonEntry | undefined, layer: LayerName): boolean {
  if (!entry) return false;
  return layer === "normal" ? entry.remappedNormal : entry.remappedHypershift;
}

function normalizeLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^ال|\s+ال/g, " ")
    .replace(/لل/g, "ل")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveDisplayAction(
  fullTitle: string,
  shortTitle: string,
  actionLabel: string,
  modified: boolean,
  defaultLabel: string,
): string {
  if (modified) return actionLabel;
  const a = normalizeLabel(fullTitle);
  const s = normalizeLabel(shortTitle);
  const b = normalizeLabel(actionLabel);
  if ((a && a === b) || (s && s === b)) return defaultLabel;
  const tailNum = fullTitle.trim().match(/(?:^|\s)(\d+)$/)?.[1];
  if (tailNum && actionLabel.trim() === tailNum) return defaultLabel;
  return actionLabel;
}

function rowCenterY(index: number, count: number, padTop: number, padBottom: number): number {
  const tileH = 56;
  const start = padTop + tileH / 2;
  const end = 360 - padBottom - tileH / 2;
  if (count <= 1) return 180;
  return start + (index * (end - start)) / (count - 1);
}

function leaderPolyline(
  anchors: Record<string, TopAnchorSpec>,
  id: string,
  edgeX: number,
  targetY: number,
): { points: string; ax: number; ay: number } | null {
  const spec = anchors[id];
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
  vocab,
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
  vocab: Vocab;
  macros: readonly MacroSummary[];
  fixedHeight?: boolean;
  compactTitle?: string;
  onSelect: (id: string) => void;
}) {
  const fullTitle = BUTTON_LABELS[locale][id] ?? id;
  const title = compactTitle ?? fullTitle;
  const raw = actionFor(entry, layer);
  const rawHuman = formatHumanAction(raw, locale, macros, true);
  const modified = isModified(entry, layer);
  const displayAction = resolveDisplayAction(fullTitle, title, rawHuman, modified, vocab.defaultActionLabel);

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className={fixedHeight ? "h-[56px] w-full flex items-stretch" : "w-full"}>
      <TileButton
        active={selected}
        align={align}
        tone="hardware"
        fillCell={fixedHeight}
        onClick={() => onSelect(id)}
        ariaLabel={`${fullTitle}: ${rawHuman}`}
      >
        <span className="flex items-center gap-1.5 text-xs font-medium opacity-85 max-w-full whitespace-nowrap">
          {modified ? (
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${selected ? "bg-[var(--brand-fg)]" : "bg-[var(--brand)]"}`}
            />
          ) : null}
          <span className="truncate whitespace-nowrap">{title}</span>
        </span>
        <span
          className={`text-xs truncate max-w-full whitespace-nowrap ${
            !modified && displayAction === vocab.defaultActionLabel ? "font-medium opacity-70" : "font-bold"
          }`}
          dir="auto"
        >
          {displayAction}
        </span>
      </TileButton>
    </div>
  );
}

export function HardwareBlueprint({
  selectedButton,
  kind,
  capabilities,
  buttons,
  layer,
  view,
  macros,
  locale,
  vocab,
  onSelectButton,
}: {
  selectedButton: string;
  kind: string;
  capabilities: DeviceCapabilities;
  buttons: readonly ButtonEntry[];
  layer: LayerName;
  view: BlueprintView;
  macros: readonly MacroSummary[];
  locale: Locale;
  vocab: Vocab;
  onSelectButton: (buttonId: string) => void;
}) {
  const byId = new Map<string, ButtonEntry>();
  for (const b of buttons) byId.set(b.id, b);

  const bp = resolveBlueprint(kind, capabilities);

  // Generic dynamic fallback for any device without a dedicated CAD outline yet
  if (!bp) {
    return (
      <div className="rounded-[var(--radius-md)] bg-[var(--hw-canvas)] p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {buttons.map((b) => (
            <CalloutTile
              key={b.id}
              id={b.id}
              entry={b}
              layer={layer}
              selected={selectedButton === b.id}
              align="start"
              locale={locale}
              vocab={vocab}
              macros={macros}
              onSelect={onSelectButton}
            />
          ))}
        </div>
      </div>
    );
  }

  const fillFor = (id: string, quiet = false) => {
    if (selectedButton === id) return "var(--brand)";
    if (quiet) return "var(--hw-shell)";
    return isModified(byId.get(id), layer) ? "var(--hw-shell-alt)" : "var(--hw-shell)";
  };
  const strokeFor = (id: string, quiet = false) => {
    if (selectedButton === id) return "var(--brand)";
    if (quiet) return "var(--hw-stroke)";
    return isModified(byId.get(id), layer) ? "var(--brand)" : "var(--hw-stroke)";
  };
  const labelFill = (id: string) => (selectedButton === id ? "var(--brand-fg)" : "var(--fg)");
  const lineStrokeFor = (id: string) => (selectedButton === id ? "var(--brand)" : "var(--hw-line)");

  const topLeftIds = bp.top.leftButtons.filter((id) => byId.has(id));
  const topRightIds = bp.top.rightButtons.filter((id) => byId.has(id));
  const { side, top } = bp;
  const sg = side.sideGrid;

  const sideCalloutText = (id: string) =>
    isModified(byId.get(id), layer)
      ? formatHumanAction(actionFor(byId.get(id), layer), locale, macros, true)
      : (BUTTON_LABELS[locale][id] ?? id);

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--hw-canvas)] p-4 sm:p-5 flex-1 min-h-[320px] sm:min-h-[clamp(440px,calc(100vh-250px),680px)] flex flex-col justify-between">
      {view === "side" ? (
        <div className="flex-1 flex flex-col justify-between gap-4 min-h-0">
          {/* Orthographic Left Side Locator SVG (fluidly fills available canvas height) */}
          <div className="w-full max-w-[clamp(520px,54vw,760px)] self-center flex-1 flex items-center justify-center" dir="ltr">
            <svg viewBox={side.viewBox} className="w-full h-auto select-none block">
              {side.skates.map(([x1, y1, x2, y2], idx) => (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--hw-stroke)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              ))}

              <path d={side.contour} fill="var(--hw-shell)" stroke="var(--hw-stroke)" strokeWidth="2.2" />
              <path d={side.undercutSeam} fill="none" stroke="var(--hw-stroke)" strokeWidth="1.4" opacity="0.65" />

              {/* Scroll Wheel peaking behind DPI rockers */}
              <g className="cursor-pointer grip-transition" onClick={() => onSelectButton("wheel")}>
                <path
                  d={side.wheelPath}
                  fill={fillFor("wheel")}
                  stroke={strokeFor("wheel")}
                  strokeWidth="1.8"
                />
                {side.wheelRibs.map(([x1, y1, x2, y2], idx) => (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={labelFill("wheel")}
                    strokeWidth="1.2"
                    opacity="0.65"
                  />
                ))}
                {side.sideCallouts.wheel ? (
                  <g className="hidden sm:block pointer-events-none">
                    <polyline
                      points={side.sideCallouts.wheel.points}
                      fill="none"
                      stroke={lineStrokeFor("wheel")}
                      strokeWidth={selectedButton === "wheel" ? "2" : "1.3"}
                    />
                    <circle cx={side.sideCallouts.wheel.ax} cy={side.sideCallouts.wheel.ay} r="2.8" fill={lineStrokeFor("wheel")} />
                    <text
                      x={side.sideCallouts.wheel.tx}
                      y={side.sideCallouts.wheel.ty}
                      textAnchor={side.sideCallouts.wheel.anchor}
                      fontSize="13"
                      fontWeight="600"
                      fill={selectedButton === "wheel" ? "var(--brand-ink)" : "var(--fg)"}
                    >
                      {sideCalloutText("wheel")}
                    </text>
                  </g>
                ) : null}
              </g>

              {/* DPI Up & Down Shoulder Rockers */}
              {byId.has("dpi-up") && side.sideCallouts["dpi-up"] ? (
                <g className="cursor-pointer grip-transition" onClick={() => onSelectButton("dpi-up")}>
                  <g className="hidden sm:block pointer-events-none">
                    <polyline
                      points={side.sideCallouts["dpi-up"].points}
                      fill="none"
                      stroke={lineStrokeFor("dpi-up")}
                      strokeWidth={selectedButton === "dpi-up" ? "2" : "1.3"}
                    />
                    <circle
                      cx={side.sideCallouts["dpi-up"].ax}
                      cy={side.sideCallouts["dpi-up"].ay}
                      r="2.8"
                      fill={lineStrokeFor("dpi-up")}
                    />
                    <text
                      x={side.sideCallouts["dpi-up"].tx}
                      y={side.sideCallouts["dpi-up"].ty}
                      textAnchor={side.sideCallouts["dpi-up"].anchor}
                      fontSize="13"
                      fontWeight="600"
                      fill={selectedButton === "dpi-up" ? "var(--brand-ink)" : "var(--fg)"}
                    >
                      {sideCalloutText("dpi-up")}
                    </text>
                  </g>
                  <g transform={`rotate(${side.dpiUpRect.angle} ${side.dpiUpRect.cx} ${side.dpiUpRect.cy})`}>
                    <rect
                      x={side.dpiUpRect.x}
                      y={side.dpiUpRect.y}
                      width={side.dpiUpRect.w}
                      height={side.dpiUpRect.h}
                      rx="4.5"
                      fill={fillFor("dpi-up")}
                      stroke={strokeFor("dpi-up")}
                      strokeWidth="1.7"
                    />
                  </g>
                </g>
              ) : null}

              {byId.has("dpi-down") && side.sideCallouts["dpi-down"] ? (
                <g className="cursor-pointer grip-transition" onClick={() => onSelectButton("dpi-down")}>
                  <g className="hidden sm:block pointer-events-none">
                    <polyline
                      points={side.sideCallouts["dpi-down"].points}
                      fill="none"
                      stroke={lineStrokeFor("dpi-down")}
                      strokeWidth={selectedButton === "dpi-down" ? "2" : "1.3"}
                    />
                    <circle
                      cx={side.sideCallouts["dpi-down"].ax}
                      cy={side.sideCallouts["dpi-down"].ay}
                      r="2.8"
                      fill={lineStrokeFor("dpi-down")}
                    />
                    <text
                      x={side.sideCallouts["dpi-down"].tx}
                      y={side.sideCallouts["dpi-down"].ty}
                      textAnchor={side.sideCallouts["dpi-down"].anchor}
                      fontSize="13"
                      fontWeight="600"
                      fill={selectedButton === "dpi-down" ? "var(--brand-ink)" : "var(--fg)"}
                    >
                      {sideCalloutText("dpi-down")}
                    </text>
                  </g>
                  <g transform={`rotate(${side.dpiDownRect.angle} ${side.dpiDownRect.cx} ${side.dpiDownRect.cy})`}>
                    <rect
                      x={side.dpiDownRect.x}
                      y={side.dpiDownRect.y}
                      width={side.dpiDownRect.w}
                      height={side.dpiDownRect.h}
                      rx="4.5"
                      fill={fillFor("dpi-down")}
                      stroke={strokeFor("dpi-down")}
                      strokeWidth="1.7"
                    />
                  </g>
                </g>
              ) : null}

              {/* Quiet Hardware Sculpted Side Keypad (no redundant yellow dots; highlights ONLY active locator key) */}
              <g transform={`translate(0, ${sg.translateY}) rotate(${sg.tiltDeg} ${sg.pivotX} ${sg.pivotY})`}>
                <rect
                  x={sg.bezel.x}
                  y={sg.bezel.y}
                  width={sg.bezel.w}
                  height={sg.bezel.h}
                  rx="14"
                  fill="var(--hw-shell-alt)"
                  stroke="var(--hw-stroke)"
                  strokeWidth="1.5"
                />
                {sg.order.map((num, idx) => {
                  const col = idx % sg.cols;
                  const row = Math.floor(idx / sg.cols);
                  const id = `grid-${num}`;
                  const archOffset = sg.colArchY[col] ?? 0;
                  const bx = sg.cellOriginX + col * sg.cellStepX;
                  const by = sg.cellOriginY + row * sg.cellStepY + archOffset;
                  const selected = selectedButton === id;
                  return (
                    <g key={id} className="cursor-pointer grip-transition" onClick={() => onSelectButton(id)}>
                      <rect
                        x={bx}
                        y={by}
                        width={sg.cellW}
                        height={sg.cellH}
                        rx="5.5"
                        fill={fillFor(id, true)}
                        stroke={strokeFor(id, true)}
                        strokeWidth={selected ? "2" : "1.4"}
                      />
                      <text
                        x={bx + sg.cellW / 2}
                        y={by + sg.cellH / 2 + 4.5}
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

          {/* Unified Interactive Action Grid (single source of modified dots & human action names) */}
          <div className="hidden sm:grid sm:grid-cols-4 gap-2 w-full" dir="ltr">
            {sg.order.map((num) => (
              <CalloutTile
                key={`grid-tile-${num}`}
                id={`grid-${num}`}
                entry={byId.get(`grid-${num}`)}
                layer={layer}
                selected={selectedButton === `grid-${num}`}
                align="start"
                compactTitle={locale === "ar" ? `زر ${num}` : `Key ${num}`}
                locale={locale}
                vocab={vocab}
                macros={macros}
                onSelect={onSelectButton}
              />
            ))}
          </div>

          <div className="sm:hidden grid grid-cols-3 gap-1.5 w-full" dir="ltr">
            {sg.mobileOrder.map((num) => (
              <CalloutTile
                key={`grid-mob-${num}`}
                id={`grid-${num}`}
                entry={byId.get(`grid-${num}`)}
                layer={layer}
                selected={selectedButton === `grid-${num}`}
                align="start"
                compactTitle={String(num)}
                locale={locale}
                vocab={vocab}
                macros={macros}
                onSelect={onSelectButton}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center min-h-0">
          {/* Desktop Orthographic Top Schematic With Pixel-Exact Vector Pointer Leader Lines */}
          <div
            className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)] items-stretch gap-0 w-full max-w-[760px] self-center"
            dir="ltr"
          >
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
                  vocab={vocab}
                  macros={macros}
                  onSelect={onSelectButton}
                />
              ))}
            </div>

            <svg viewBox="0 0 320 360" className="w-[320px] h-[360px] select-none block shrink-0">
              <path d={top.contour} fill="var(--hw-shell)" stroke="var(--hw-stroke)" strokeWidth="2.2" />

              {top.sideBumps.length > 0 ? (
                <g fill="var(--hw-shell-alt)" stroke="var(--hw-stroke)" strokeWidth="1.2">
                  {top.sideBumps.map((b, i) => (
                    <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2.5" />
                  ))}
                </g>
              ) : null}

              <path d={top.wingCrease} fill="none" stroke="var(--hw-stroke)" strokeWidth="1.4" opacity="0.7" />

              {/* Seamless Left & Right Paddles */}
              <path
                d={top.leftPaddlePath}
                fill={selectedButton === "left" || isModified(byId.get("left"), layer) ? fillFor("left") : "transparent"}
                stroke={selectedButton === "left" || isModified(byId.get("left"), layer) ? strokeFor("left") : "none"}
                strokeWidth="1.5"
                opacity="0.88"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("left")}
              />
              <path
                d={top.rightPaddlePath}
                fill={selectedButton === "right" || isModified(byId.get("right"), layer) ? fillFor("right") : "transparent"}
                stroke={selectedButton === "right" || isModified(byId.get("right"), layer) ? strokeFor("right") : "none"}
                strokeWidth="1.5"
                opacity="0.88"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("right")}
              />

              {/* Outer-Edge Carved DPI Rockers */}
              <path
                d={top.dpiUpPath}
                fill={fillFor("dpi-up")}
                stroke={strokeFor("dpi-up")}
                strokeWidth="1.8"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("dpi-up")}
              />
              <path
                d={top.dpiDownPath}
                fill={fillFor("dpi-down")}
                stroke={strokeFor("dpi-down")}
                strokeWidth="1.8"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("dpi-down")}
              />

              {/* Central Glossy Channel + 5-Way Wheel + Scroll Mode Button */}
              <rect
                x={top.channelBezel.x}
                y={top.channelBezel.y}
                width={top.channelBezel.w}
                height={top.channelBezel.h}
                rx="7"
                fill="var(--hw-shell-alt)"
                stroke="var(--hw-stroke)"
                strokeWidth="1.4"
              />
              <polyline
                points={top.tiltLeftHit.glyph}
                fill="none"
                stroke={selectedButton === "tilt-left" ? "var(--brand)" : "var(--hw-stroke)"}
                strokeWidth={selectedButton === "tilt-left" ? "2" : "1.5"}
                strokeLinecap="round"
                className="cursor-pointer"
                onClick={() => onSelectButton("tilt-left")}
              />
              <polyline
                points={top.tiltRightHit.glyph}
                fill="none"
                stroke={selectedButton === "tilt-right" ? "var(--brand)" : "var(--hw-stroke)"}
                strokeWidth={selectedButton === "tilt-right" ? "2" : "1.5"}
                strokeLinecap="round"
                className="cursor-pointer"
                onClick={() => onSelectButton("tilt-right")}
              />

              <path
                d={top.scrollUpPath}
                fill={fillFor("scroll-up")}
                stroke={strokeFor("scroll-up")}
                strokeWidth="1.4"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("scroll-up")}
              />
              <polyline
                points={top.scrollUpArrow}
                fill="none"
                stroke={labelFill("scroll-up")}
                strokeWidth="1.7"
                strokeLinecap="round"
                className="pointer-events-none"
              />

              <rect
                x={top.wheelRect.x}
                y={top.wheelRect.y}
                width={top.wheelRect.w}
                height={top.wheelRect.h}
                rx="4.5"
                fill={fillFor("wheel")}
                stroke={strokeFor("wheel")}
                strokeWidth="1.8"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("wheel")}
              />
              <line x1={top.wheelRect.x + 2} y1="60" x2={top.wheelRect.x + 2} y2="104" stroke={labelFill("wheel")} strokeWidth="1" opacity="0.45" className="pointer-events-none" />
              <line x1={top.wheelRect.x + top.wheelRect.w - 2} y1="60" x2={top.wheelRect.x + top.wheelRect.w - 2} y2="104" stroke={labelFill("wheel")} strokeWidth="1" opacity="0.45" className="pointer-events-none" />
              {[64, 72, 80, 88, 96].map((ty) => (
                <line key={ty} x1="144" y1={ty} x2="154" y2={ty} stroke={labelFill("wheel")} strokeWidth="1.1" opacity="0.55" className="pointer-events-none" />
              ))}

              <rect
                x={top.tiltLeftHit.x}
                y={top.tiltLeftHit.y}
                width={top.tiltLeftHit.w}
                height={top.tiltLeftHit.h}
                rx="2.5"
                fill={fillFor("tilt-left")}
                stroke={strokeFor("tilt-left")}
                strokeWidth="1.2"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("tilt-left")}
              />
              <rect
                x={top.tiltRightHit.x}
                y={top.tiltRightHit.y}
                width={top.tiltRightHit.w}
                height={top.tiltRightHit.h}
                rx="2.5"
                fill={fillFor("tilt-right")}
                stroke={strokeFor("tilt-right")}
                strokeWidth="1.2"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("tilt-right")}
              />

              <path
                d={top.scrollDownPath}
                fill={fillFor("scroll-down")}
                stroke={strokeFor("scroll-down")}
                strokeWidth="1.4"
                className="cursor-pointer grip-transition"
                onClick={() => onSelectButton("scroll-down")}
              />
              <polyline
                points={top.scrollDownArrow}
                fill="none"
                stroke={labelFill("scroll-down")}
                strokeWidth="1.7"
                strokeLinecap="round"
                className="pointer-events-none"
              />

              <rect
                x={top.scrollModeToggle.x}
                y={top.scrollModeToggle.y}
                width={top.scrollModeToggle.w}
                height={top.scrollModeToggle.h}
                rx="3"
                fill="var(--hw-shell)"
                stroke="var(--hw-stroke)"
                strokeWidth="1.3"
              />
              <line x1="146" y1="162" x2="152" y2="162" stroke="var(--hw-stroke)" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="146" y1="166" x2="152" y2="166" stroke="var(--hw-stroke)" strokeWidth="1.2" strokeLinecap="round" />

              {topLeftIds.map((id, idx) => {
                const targetY = rowCenterY(idx, topLeftIds.length, 4, 12);
                const poly = leaderPolyline(top.anchors, id, 2, targetY);
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

              {topRightIds.map((id, idx) => {
                const targetY = rowCenterY(idx, topRightIds.length, 16, 24);
                const poly = leaderPolyline(top.anchors, id, 318, targetY);
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
                  vocab={vocab}
                  macros={macros}
                  onSelect={onSelectButton}
                />
              ))}
            </div>
          </div>

          <div className="sm:hidden flex flex-col gap-3" dir="ltr">
            <svg viewBox="54 24 210 314" className="w-[152px] max-w-full h-auto mx-auto select-none block">
              <path d={top.contour} fill="var(--hw-shell)" stroke="var(--hw-stroke)" strokeWidth="2.2" />
              {top.sideBumps.length > 0 ? (
                <g fill="var(--hw-shell-alt)" stroke="var(--hw-stroke)" strokeWidth="1.2">
                  {top.sideBumps.map((b, i) => (
                    <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2.5" />
                  ))}
                </g>
              ) : null}
              <path d={top.wingCrease} fill="none" stroke="var(--hw-stroke)" strokeWidth="1.4" opacity="0.7" />
              <path
                d={top.dpiUpPath}
                fill={fillFor("dpi-up")}
                stroke={strokeFor("dpi-up")}
                strokeWidth="1.6"
                onClick={() => onSelectButton("dpi-up")}
              />
              <path
                d={top.dpiDownPath}
                fill={fillFor("dpi-down")}
                stroke={strokeFor("dpi-down")}
                strokeWidth="1.6"
                onClick={() => onSelectButton("dpi-down")}
              />
              <rect
                x={top.channelBezel.x}
                y={top.channelBezel.y}
                width={top.channelBezel.w}
                height={top.channelBezel.h}
                rx="7"
                fill="var(--hw-shell-alt)"
                stroke="var(--hw-stroke)"
                strokeWidth="1.4"
              />
              <rect
                x={top.wheelRect.x}
                y={top.wheelRect.y}
                width={top.wheelRect.w}
                height={top.wheelRect.h}
                rx="4.5"
                fill={fillFor("wheel")}
                stroke={strokeFor("wheel")}
                strokeWidth="1.7"
                onClick={() => onSelectButton("wheel")}
              />
              <rect
                x={top.scrollModeToggle.x}
                y={top.scrollModeToggle.y}
                width={top.scrollModeToggle.w}
                height={top.scrollModeToggle.h}
                rx="3"
                fill="var(--hw-shell)"
                stroke="var(--hw-stroke)"
                strokeWidth="1.3"
              />
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
                  vocab={vocab}
                  macros={macros}
                  onSelect={onSelectButton}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
