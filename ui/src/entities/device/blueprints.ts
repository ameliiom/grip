import type { DeviceCapabilities } from "../../acl/transport";

export interface TopAnchorSpec {
  ax: number;
  ay: number;
  kind: "elbow" | "spine";
  elbowX: number;
  dropX?: number;
  dropY?: number;
}

export interface HardwareBlueprintSpec {
  id: string;
  side: {
    viewBox: string;
    contour: string;
    skates: readonly [number, number, number, number][];
    undercutSeam: string;
    wheelPath: string;
    wheelRibs: readonly [number, number, number, number][];
    dpiUpRect: { cx: number; cy: number; angle: number; x: number; y: number; w: number; h: number };
    dpiDownRect: { cx: number; cy: number; angle: number; x: number; y: number; w: number; h: number };
    sideCallouts: Record<string, { points: string; ax: number; ay: number; tx: number; ty: number; anchor: "start" | "end" }>;
    sideGrid: {
      cols: number;
      rows: number;
      order: readonly number[];
      mobileOrder: readonly number[];
      tiltDeg: number;
      pivotX: number;
      pivotY: number;
      translateY: number;
      bezel: { x: number; y: number; w: number; h: number };
      colArchY: readonly number[];
      cellOriginX: number;
      cellOriginY: number;
      cellStepX: number;
      cellStepY: number;
      cellW: number;
      cellH: number;
    };
  };
  top: {
    contour: string;
    wingCrease: string;
    sideBumps: readonly { x: number; y: number; w: number; h: number }[];
    leftPaddlePath: string;
    rightPaddlePath: string;
    dpiUpPath: string;
    dpiDownPath: string;
    channelBezel: { x: number; y: number; w: number; h: number };
    scrollUpPath: string;
    scrollUpArrow: string;
    wheelRect: { x: number; y: number; w: number; h: number };
    scrollDownPath: string;
    scrollDownArrow: string;
    tiltLeftHit: { x: number; y: number; w: number; h: number; glyph: string };
    tiltRightHit: { x: number; y: number; w: number; h: number; glyph: string };
    scrollModeToggle: { x: number; y: number; w: number; h: number };
    leftButtons: readonly string[];
    rightButtons: readonly string[];
    anchors: Record<string, TopAnchorSpec>;
  };
}

// Declarative CAD blueprint calibrated from measured 119.5 x 75.5 x 43.5 mm orthographic specs
const MM_GRID_NAGA_BLUEPRINT: HardwareBlueprintSpec = {
  id: "mmo-grid-mouse-v2",
  side: {
    viewBox: "0 0 640 256",
    contour:
      "M64 166 C64 157, 74 150, 92 142 C114 132, 136 122, 164 110 C194 96, 230 78, 272 64 C308 52, 336 48, 356 48 C388 48, 424 54, 464 70 C504 86, 540 112, 566 138 C574 146, 576 154, 576 164 C576 184, 562 212, 540 226 C524 234, 504 234, 476 234 L132 234 C112 234, 98 228, 86 212 C74 196, 64 178, 64 166 Z",
    skates: [
      [126, 236, 212, 236],
      [418, 236, 504, 236],
    ],
    undercutSeam: "M72 174 C112 162, 164 146, 232 126",
    wheelPath: "M188 104 C194 90, 212 85, 228 91 L222 103 Z",
    wheelRibs: [
      [198, 92, 202, 101],
      [208, 89, 210, 99],
      [217, 89, 218, 99],
    ],
    dpiUpRect: { cx: 96, cy: 146, angle: -22, x: 70, y: 138, w: 52, h: 15 },
    dpiDownRect: { cx: 154, cy: 123, angle: -20, x: 128, y: 115, w: 52, h: 15 },
    sideCallouts: {
      "dpi-up": { points: "96,138 96,22 76,22", ax: 96, ay: 138, tx: 68, ty: 26, anchor: "end" },
      "dpi-down": { points: "154,116 154,52 134,52", ax: 154, ay: 116, tx: 126, ty: 56, anchor: "end" },
      wheel: { points: "210,88 210,22 232,22", ax: 210, ay: 88, tx: 240, ty: 26, anchor: "start" },
    },
    sideGrid: {
      cols: 4,
      rows: 3,
      order: [3, 6, 9, 12, 2, 5, 8, 11, 1, 4, 7, 10],
      mobileOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      tiltDeg: -11,
      pivotX: 324,
      pivotY: 162,
      translateY: -7,
      bezel: { x: 224, y: 102, w: 198, h: 118 },
      colArchY: [6, 0, -2, 4],
      cellOriginX: 232,
      cellOriginY: 110,
      cellStepX: 46,
      cellStepY: 34,
      cellW: 41,
      cellH: 29,
    },
  },
  top: {
    contour:
      "M83 47 C94 37, 110 32, 120 32 C131 32, 134 36, 139 36 L158 36 C164 36, 169 33, 182 36 C198 39, 210 43, 214 48 C221 56, 224 72, 228 86 C235 97, 248 112, 252 126 C255 142, 254 166, 248 200 C244 226, 238 244, 230 268 C222 290, 214 303, 198 313 C182 323, 164 328, 150 328 C134 328, 114 320, 101 312 C88 302, 79 282, 73 254 C67 224, 64 192, 64 165 C64 136, 67 104, 72 78 C75 61, 77 52, 83 47 Z",
    wingCrease: "M196 44 C205 92, 214 148, 218 206 C214 252, 200 284, 186 306",
    sideBumps: [
      { x: 61, y: 132, w: 6, h: 18 },
      { x: 60, y: 155, w: 6, h: 18 },
      { x: 61, y: 178, w: 6, h: 18 },
      { x: 63, y: 201, w: 6, h: 18 },
    ],
    leftPaddlePath: "M92 50 C102 39, 114 35, 136 36 L136 160 C114 162, 92 154, 80 144 C82 126, 86 116, 90 112 L90 50 Z",
    rightPaddlePath: "M162 36 C178 36, 190 40, 196 46 C204 88, 211 132, 214 172 C194 178, 174 176, 162 172 Z",
    dpiUpPath: "M80 51 C85 49, 89 49, 89 51 L88 79 L72 79 C73 68, 76 56, 80 51 Z",
    dpiDownPath: "M72 83 L88 83 L87 112 L69 112 C70 100, 71 91, 72 83 Z",
    channelBezel: { x: 137, y: 36, w: 24, h: 142 },
    scrollUpPath: "M141 40 L157 40 L157 54 L141 54 Z",
    scrollUpArrow: "145,49 149,43 153,49",
    wheelRect: { x: 141, y: 56, w: 16, h: 52 },
    scrollDownPath: "M141 110 L157 110 L157 126 L141 126 Z",
    scrollDownArrow: "145,115 149,121 153,115",
    tiltLeftHit: { x: 134, y: 64, w: 6, h: 38, glyph: "133,79 128,84 133,89" },
    tiltRightHit: { x: 158, y: 64, w: 6, h: 38, glyph: "165,79 170,84 165,89" },
    scrollModeToggle: { x: 143, y: 132, w: 12, h: 22 },
    leftButtons: ["wheel", "dpi-up", "dpi", "dpi-down", "dpi-2", "left", "tilt-left"],
    rightButtons: ["scroll-up", "tilt-right", "right", "scroll-down"],
    anchors: {
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
    },
  },
};

export function resolveBlueprint(kind: string, capabilities: DeviceCapabilities): HardwareBlueprintSpec | null {
  if (kind === "mouse" && capabilities.hasSideGrid12) {
    return MM_GRID_NAGA_BLUEPRINT;
  }
  return null;
}
