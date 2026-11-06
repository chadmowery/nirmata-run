const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// ============================================================================
// COLOR PALETTES & DRAWING UTILITIES
// ============================================================================

// Base Dungeon Wall Palette (matching wall.png)
const WALL_C = {
  VOID: '#050816',           // Shadow / void boundary
  SEAM: '#0c1538',           // Structural panel seam
  FOUNDATION: '#0d163b',     // Foundation bottom skirt
  EDGE_SHADOW: '#101b47',    // Right/bottom shadow bevel
  SKIRT_FACE: '#132054',     // Front vertical skirt face
  BULKHEAD: '#16255e',       // Main bulkhead roof panel
  PANEL_SHADE: '#1b2d70',    // Recessed panel shading
  SKIRT_RIB: '#233a8f',      // Skirt vertical rib detail
  HIGHLIGHT: '#3556cc',      // Top/left specular highlight ridge
  FRONT_LIP: '#4268eb',      // Bright elevated front lip
  CYAN_LED: '#00e5ff',       // Status LED / tech diode
  WHITE_SPEC: '#ffffff',     // Specular glint
};

// Drawing Helpers
function setPixel(ctx, x, y, color) {
  if (x < 0 || x >= 32 || y < 0 || y >= 32) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawRect(ctx, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawDropShadow(ctx, cx, cy, rx, ry, alpha = 0.65) {
  ctx.fillStyle = `rgba(2, 6, 18, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// A. WALL AUTOTILE FRAMES (16 CARDINAL + 4 INNER CORNERS)
// ============================================================================

// Helper: render front skirt on bottom (y=22..31) for South-exposed faces
function drawFrontSkirt(ctx, xStart = 0, xEnd = 31) {
  const w = xEnd - xStart + 1;
  // Front Lip (Row 22)
  drawRect(ctx, xStart, 22, w, 1, WALL_C.FRONT_LIP);
  for (let x = xStart + 7; x <= xEnd - 7; x += 16) {
    setPixel(ctx, x, 22, WALL_C.CYAN_LED);
    setPixel(ctx, x + 1, 22, WALL_C.CYAN_LED);
  }

  // Skirt Face (Rows 23..25)
  for (let y = 23; y <= 25; y++) {
    drawRect(ctx, xStart, y, w, 1, WALL_C.SKIRT_FACE);
    for (let rx = xStart + 4; rx <= xEnd; rx += 7) {
      setPixel(ctx, rx, y, WALL_C.SKIRT_RIB);
      setPixel(ctx, rx + 1, y, WALL_C.SEAM);
    }
  }

  // Skirt Groove (Row 26)
  drawRect(ctx, xStart, 26, w, 1, WALL_C.VOID);

  // Foundation Base (Rows 27..30)
  for (let y = 27; y <= 30; y++) {
    drawRect(ctx, xStart, y, w, 1, WALL_C.FOUNDATION);
    for (let rx = xStart + 4; rx <= xEnd; rx += 7) {
      if (y < 30) {
        setPixel(ctx, rx, y, WALL_C.SKIRT_RIB);
        setPixel(ctx, rx + 1, y, WALL_C.SEAM);
      }
    }
  }

  // Floor Shadow Grounding (Row 31)
  drawRect(ctx, xStart, 31, w, 1, WALL_C.VOID);
}

// Helper: render vertical side drops (West or East)
function drawSideBevelWest(ctx, yStart = 0, yEnd = 31) {
  for (let y = yStart; y <= yEnd; y++) {
    setPixel(ctx, 0, y, WALL_C.VOID);
    setPixel(ctx, 1, y, WALL_C.HIGHLIGHT);
    setPixel(ctx, 2, y, WALL_C.PANEL_SHADE);
  }
}

function drawSideBevelEast(ctx, yStart = 0, yEnd = 31) {
  for (let y = yStart; y <= yEnd; y++) {
    setPixel(ctx, 29, y, WALL_C.PANEL_SHADE);
    setPixel(ctx, 30, y, WALL_C.EDGE_SHADOW);
    setPixel(ctx, 31, y, WALL_C.VOID);
  }
}

// 1. wall_single (Bitmask 0 - isolated 1x1 pillar)
function renderWallSingle(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Outside open floor shadow
  drawRect(ctx, 0, 0, 32, 32, WALL_C.VOID);

  // Pillar Column (x: 4..27, y: 3..31)
  drawRect(ctx, 4, 3, 24, 19, WALL_C.BULKHEAD);

  // Top roof cap bevels (y: 3..5)
  drawRect(ctx, 6, 3, 20, 1, WALL_C.HIGHLIGHT);
  drawRect(ctx, 5, 4, 22, 1, WALL_C.PANEL_SHADE);
  drawRect(ctx, 6, 5, 20, 1, WALL_C.BULKHEAD);

  // West/East side bevels
  drawSideBevelWest(ctx, 4, 22);
  drawSideBevelEast(ctx, 4, 22);

  // Pillar center tech plate with glowing cyan diode
  drawRect(ctx, 12, 10, 8, 8, WALL_C.PANEL_SHADE);
  drawRect(ctx, 13, 11, 6, 6, WALL_C.SEAM);
  drawRect(ctx, 14, 12, 4, 4, WALL_C.HIGHLIGHT);
  drawRect(ctx, 15, 13, 2, 2, WALL_C.CYAN_LED);
  setPixel(ctx, 15, 13, WALL_C.WHITE_SPEC);

  // Front skirt (x: 4..27, y: 22..31)
  drawFrontSkirt(ctx, 4, 27);
}

// 2. wall_cap_n (Bitmask 4 - dead end pointing North)
function renderWallCapN(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Background void
  drawRect(ctx, 0, 0, 32, 32, WALL_C.VOID);

  // Vertical Wall Column continuing South (x: 4..27, y: 4..31)
  drawRect(ctx, 4, 4, 24, 28, WALL_C.BULKHEAD);

  // North terminating end cap (y: 2..5)
  drawRect(ctx, 7, 2, 18, 1, WALL_C.HIGHLIGHT);
  drawRect(ctx, 5, 3, 22, 1, WALL_C.HIGHLIGHT);
  drawRect(ctx, 4, 4, 24, 1, WALL_C.PANEL_SHADE);
  drawRect(ctx, 4, 5, 24, 1, WALL_C.PANEL_SHADE);

  // Center vertical panel seam
  for (let y = 6; y <= 31; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }

  // Cyan status diode on end cap
  setPixel(ctx, 15, 4, WALL_C.CYAN_LED);
  setPixel(ctx, 16, 4, WALL_C.CYAN_LED);
  setPixel(ctx, 15, 3, WALL_C.WHITE_SPEC);

  // West & East edge bevels dropping into floor
  drawSideBevelWest(ctx, 3, 31);
  drawSideBevelEast(ctx, 3, 31);
}

// 3. wall_cap_s (Bitmask 1 - dead end pointing South)
function renderWallCapS(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Background void
  drawRect(ctx, 0, 0, 32, 32, WALL_C.VOID);

  // Vertical column connecting from North (x: 4..27, y: 0..21)
  drawRect(ctx, 4, 0, 24, 22, WALL_C.BULKHEAD);

  // West & East edge bevels
  drawSideBevelWest(ctx, 0, 22);
  drawSideBevelEast(ctx, 0, 22);

  // Center vertical seam
  for (let y = 0; y <= 21; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }

  // South front skirt
  drawFrontSkirt(ctx, 4, 27);
}

// 4. wall_cap_e (Bitmask 8 - dead end pointing East)
function renderWallCapE(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Connects from West (x=0..25) and terminates on East (x=26..31)
  // Top void row
  drawRect(ctx, 0, 0, 32, 1, WALL_C.VOID);

  // Bulkhead roof cap (x: 0..26, y: 1..21)
  drawRect(ctx, 0, 1, 26, 21, WALL_C.BULKHEAD);

  // Top highlight
  drawRect(ctx, 0, 1, 25, 1, WALL_C.HIGHLIGHT);

  // East end cap rounded bevel
  drawRect(ctx, 25, 2, 2, 19, WALL_C.PANEL_SHADE);
  drawRect(ctx, 27, 3, 2, 18, WALL_C.EDGE_SHADOW);
  drawRect(ctx, 29, 0, 3, 32, WALL_C.VOID);

  // Horizontal seams
  drawRect(ctx, 0, 11, 26, 1, WALL_C.SEAM);
  drawRect(ctx, 0, 12, 26, 1, WALL_C.PANEL_SHADE);

  // Front skirt (x: 0..26)
  drawFrontSkirt(ctx, 0, 26);
}

// 5. wall_cap_w (Bitmask 2 - dead end pointing West)
function renderWallCapW(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Connects to East (x=6..31) and terminates on West (x=0..5)
  // Top void row
  drawRect(ctx, 0, 0, 32, 1, WALL_C.VOID);

  // West side void
  drawRect(ctx, 0, 0, 3, 32, WALL_C.VOID);

  // West end cap rounded bevel
  drawRect(ctx, 3, 3, 2, 18, WALL_C.HIGHLIGHT);
  drawRect(ctx, 5, 2, 2, 19, WALL_C.PANEL_SHADE);

  // Bulkhead roof cap (x: 6..31, y: 1..21)
  drawRect(ctx, 6, 1, 26, 21, WALL_C.BULKHEAD);
  drawRect(ctx, 6, 1, 26, 1, WALL_C.HIGHLIGHT);

  // East edge connects seamlessly
  setPixel(ctx, 31, 1, WALL_C.EDGE_SHADOW);

  // Horizontal seams
  drawRect(ctx, 6, 11, 26, 1, WALL_C.SEAM);
  drawRect(ctx, 6, 12, 26, 1, WALL_C.PANEL_SHADE);

  // Front skirt (x: 6..31)
  drawFrontSkirt(ctx, 6, 31);
}

// 6. wall_straight_h (Bitmask 10 - horizontal wall run, identical to wall.png)
function renderWallStraightH(ctx) {
  // Read exact reference pixels
  const wallHexes = JSON.parse(fs.readFileSync(path.join(__dirname, 'wall_hexes.json'), 'utf-8'));
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      setPixel(ctx, x, y, wallHexes[y][x]);
    }
  }
}

// 7. wall_straight_v (Bitmask 5 - vertical wall run connecting North and South)
function renderWallStraightV(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Void background on flanks (x: 0..3 and 28..31)
  drawRect(ctx, 0, 0, 4, 32, WALL_C.VOID);
  drawRect(ctx, 28, 0, 4, 32, WALL_C.VOID);

  // Continuous bulkhead from y=0 to y=31 (x: 4..27)
  drawRect(ctx, 4, 0, 24, 32, WALL_C.BULKHEAD);

  // West side bevel
  drawSideBevelWest(ctx, 0, 31);
  // East side bevel
  drawSideBevelEast(ctx, 0, 31);

  // Center vertical seam & conduit channel
  for (let y = 0; y < 32; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }

  // Cross horizontal reinforcement plates at y=8, 16, 24
  for (const ry of [7, 15, 23]) {
    drawRect(ctx, 4, ry, 24, 2, WALL_C.PANEL_SHADE);
    drawRect(ctx, 6, ry, 20, 1, WALL_C.HIGHLIGHT);
    setPixel(ctx, 15, ry, WALL_C.CYAN_LED);
    setPixel(ctx, 16, ry, WALL_C.CYAN_LED);
    setPixel(ctx, 15, ry + 1, WALL_C.WHITE_SPEC);
  }
}

// 8. wall_corner_ne (Bitmask 3 / corner North to East; South and West are floor)
// Aliases: wall_corner_outer_sw
function renderWallCornerNE(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Background void
  drawRect(ctx, 0, 0, 32, 32, WALL_C.VOID);

  // Bulkhead L-turn connecting North (x: 4..31, y: 0) to East (x: 31, y: 0..21)
  drawRect(ctx, 4, 0, 28, 22, WALL_C.BULKHEAD);

  // West side bevel dropping into floor
  drawSideBevelWest(ctx, 0, 22);

  // Center seam running North-to-East
  for (let y = 0; y <= 15; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }
  for (let x = 16; x <= 31; x++) {
    setPixel(ctx, x, 11, WALL_C.SEAM);
    setPixel(ctx, x, 12, WALL_C.PANEL_SHADE);
  }

  // Diagonal corner brace rivet
  setPixel(ctx, 12, 12, WALL_C.CYAN_LED);
  setPixel(ctx, 11, 11, WALL_C.HIGHLIGHT);

  // Front skirt on South face (x: 4..31)
  drawFrontSkirt(ctx, 4, 31);
}

// 9. wall_corner_se (Bitmask 6 / corner South to East; North and West are floor)
// Aliases: wall_corner_outer_nw
function renderWallCornerSE(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Background void
  drawRect(ctx, 0, 0, 32, 32, WALL_C.VOID);

  // Bulkhead connecting South (y: 4..31, x: 4..27) and East (x: 4..31, y: 4..21)
  drawRect(ctx, 4, 4, 28, 28, WALL_C.BULKHEAD);

  // Top North bevel terminating against floor
  drawRect(ctx, 5, 2, 26, 1, WALL_C.HIGHLIGHT);
  drawRect(ctx, 4, 3, 27, 1, WALL_C.PANEL_SHADE);

  // West side bevel dropping into floor
  drawSideBevelWest(ctx, 3, 31);

  // East continues seamlessly
  for (let x = 15; x <= 31; x++) {
    setPixel(ctx, x, 11, WALL_C.SEAM);
    setPixel(ctx, x, 12, WALL_C.PANEL_SHADE);
  }
  for (let y = 12; y <= 31; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }

  // Corner status LED
  setPixel(ctx, 15, 7, WALL_C.CYAN_LED);
  setPixel(ctx, 16, 7, WALL_C.WHITE_SPEC);
}

// 10. wall_corner_sw (Bitmask 12 / corner South to West; North and East are floor)
// Aliases: wall_corner_outer_ne
function renderWallCornerSW(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Background void
  drawRect(ctx, 0, 0, 32, 32, WALL_C.VOID);

  // Bulkhead connecting South (y: 4..31, x: 4..27) and West (x: 0..27, y: 4..21)
  drawRect(ctx, 0, 4, 28, 28, WALL_C.BULKHEAD);

  // Top North bevel terminating against floor
  drawRect(ctx, 0, 2, 27, 1, WALL_C.HIGHLIGHT);
  drawRect(ctx, 0, 3, 27, 1, WALL_C.PANEL_SHADE);

  // East side bevel dropping into floor
  drawSideBevelEast(ctx, 3, 31);

  // West continues seamlessly
  for (let x = 0; x <= 15; x++) {
    setPixel(ctx, x, 11, WALL_C.SEAM);
    setPixel(ctx, x, 12, WALL_C.PANEL_SHADE);
  }
  for (let y = 12; y <= 31; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }

  // Corner status LED
  setPixel(ctx, 15, 7, WALL_C.CYAN_LED);
  setPixel(ctx, 16, 7, WALL_C.WHITE_SPEC);
}

// 11. wall_corner_nw (Bitmask 9 / corner North to West; South and East are floor)
// Aliases: wall_corner_outer_se
function renderWallCornerNW(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Background void
  drawRect(ctx, 0, 0, 32, 32, WALL_C.VOID);

  // Bulkhead connecting North (x: 0..27, y: 0) to West (x: 0..27, y: 0..21)
  drawRect(ctx, 0, 0, 28, 22, WALL_C.BULKHEAD);

  // East side bevel dropping into floor
  drawSideBevelEast(ctx, 0, 22);

  // Seams
  for (let y = 0; y <= 15; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }
  for (let x = 0; x <= 15; x++) {
    setPixel(ctx, x, 11, WALL_C.SEAM);
    setPixel(ctx, x, 12, WALL_C.PANEL_SHADE);
  }

  // Corner LED
  setPixel(ctx, 19, 12, WALL_C.CYAN_LED);
  setPixel(ctx, 20, 11, WALL_C.HIGHLIGHT);

  // Front skirt on South face (x: 0..27)
  drawFrontSkirt(ctx, 0, 27);
}

// 12. wall_t_n (Bitmask 14 - T-junction branching South, through East-West; North is floor)
// Aliases: wall_tjunction_n
function renderWallTN(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Top North bevel across full width
  drawRect(ctx, 0, 0, 32, 1, WALL_C.VOID);
  drawRect(ctx, 0, 1, 32, 1, WALL_C.HIGHLIGHT);
  drawRect(ctx, 0, 2, 32, 1, WALL_C.PANEL_SHADE);

  // Bulkhead full cross body (x: 0..31, y: 3..21) and vertical stem to South (x: 4..27, y: 22..31)
  drawRect(ctx, 0, 3, 32, 19, WALL_C.BULKHEAD);
  drawRect(ctx, 4, 22, 24, 10, WALL_C.BULKHEAD);

  // West & East drop off below y=22
  drawSideBevelWest(ctx, 22, 31);
  drawSideBevelEast(ctx, 22, 31);

  // Central T junction seams
  drawRect(ctx, 0, 11, 32, 1, WALL_C.SEAM);
  drawRect(ctx, 0, 12, 32, 1, WALL_C.PANEL_SHADE);
  for (let y = 13; y <= 31; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }

  // Central T-junction status diode
  setPixel(ctx, 15, 11, WALL_C.CYAN_LED);
  setPixel(ctx, 16, 11, WALL_C.CYAN_LED);
  setPixel(ctx, 15, 10, WALL_C.WHITE_SPEC);
}

// 13. wall_t_s (Bitmask 11 - T-junction branching North, through East-West; South is floor)
// Aliases: wall_tjunction_s
function renderWallTS(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Bulkhead body across full width and northern branch (y: 0..21)
  drawRect(ctx, 0, 0, 32, 22, WALL_C.BULKHEAD);

  // North branch connects from North (x: 4..27, y: 0)
  // East & West connect horizontally
  drawRect(ctx, 0, 11, 32, 1, WALL_C.SEAM);
  drawRect(ctx, 0, 12, 32, 1, WALL_C.PANEL_SHADE);
  for (let y = 0; y <= 10; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }

  // Status diode
  setPixel(ctx, 15, 11, WALL_C.CYAN_LED);
  setPixel(ctx, 16, 11, WALL_C.CYAN_LED);
  setPixel(ctx, 15, 12, WALL_C.WHITE_SPEC);

  // South front skirt across full width
  drawFrontSkirt(ctx, 0, 31);
}

// 14. wall_t_w (Bitmask 7 - T-junction branching East, through North-South; West is floor)
// Aliases: wall_tjunction_w
function renderWallTW(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Void background on West flank (x: 0..3)
  drawRect(ctx, 0, 0, 4, 32, WALL_C.VOID);

  // North-South vertical through-body (x: 4..27, y: 0..31)
  drawRect(ctx, 4, 0, 24, 32, WALL_C.BULKHEAD);

  // East branch (x: 28..31, y: 0..21)
  drawRect(ctx, 28, 0, 4, 22, WALL_C.BULKHEAD);

  // West side bevel dropping into floor
  drawSideBevelWest(ctx, 0, 31);

  // East drop below y=22
  drawSideBevelEast(ctx, 22, 31);

  // Seams
  for (let y = 0; y <= 31; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }
  for (let x = 16; x <= 31; x++) {
    setPixel(ctx, x, 11, WALL_C.SEAM);
    setPixel(ctx, x, 12, WALL_C.PANEL_SHADE);
  }

  // Status diode
  setPixel(ctx, 15, 11, WALL_C.CYAN_LED);
  setPixel(ctx, 16, 11, WALL_C.CYAN_LED);
}

// 15. wall_t_e (Bitmask 13 - T-junction branching West, through North-South; East is floor)
// Aliases: wall_tjunction_e
function renderWallTE(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Void background on East flank (x: 28..31)
  drawRect(ctx, 28, 0, 4, 32, WALL_C.VOID);

  // North-South vertical through-body (x: 4..27, y: 0..31)
  drawRect(ctx, 4, 0, 24, 32, WALL_C.BULKHEAD);

  // West branch (x: 0..3, y: 0..21)
  drawRect(ctx, 0, 0, 4, 22, WALL_C.BULKHEAD);

  // East side bevel dropping into floor
  drawSideBevelEast(ctx, 0, 31);

  // West drop below y=22
  drawSideBevelWest(ctx, 22, 31);

  // Seams
  for (let y = 0; y <= 31; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }
  for (let x = 0; x <= 15; x++) {
    setPixel(ctx, x, 11, WALL_C.SEAM);
    setPixel(ctx, x, 12, WALL_C.PANEL_SHADE);
  }

  // Status diode
  setPixel(ctx, 15, 11, WALL_C.CYAN_LED);
  setPixel(ctx, 16, 11, WALL_C.CYAN_LED);
}

// 16. wall_cross (Bitmask 15 - 4-way cross junction N, E, S, W)
function renderWallCross(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Full solid bulkhead cross filling the tile
  drawRect(ctx, 0, 0, 32, 32, WALL_C.BULKHEAD);

  // Cross seams
  drawRect(ctx, 0, 11, 32, 1, WALL_C.SEAM);
  drawRect(ctx, 0, 12, 32, 1, WALL_C.PANEL_SHADE);
  for (let y = 0; y <= 31; y++) {
    setPixel(ctx, 15, y, WALL_C.SEAM);
    setPixel(ctx, 16, y, WALL_C.PANEL_SHADE);
  }

  // Center intersection hub
  drawRect(ctx, 13, 9, 6, 6, WALL_C.PANEL_SHADE);
  drawRect(ctx, 14, 10, 4, 4, WALL_C.HIGHLIGHT);
  drawRect(ctx, 15, 11, 2, 2, WALL_C.CYAN_LED);
  setPixel(ctx, 15, 11, WALL_C.WHITE_SPEC);
}

// 17-20. Inner Corner tiles (wall_corner_inner_nw, wall_corner_inner_ne, wall_corner_inner_se, wall_corner_inner_sw)
function renderWallCornerInnerNW(ctx) {
  // Base cross
  renderWallCross(ctx);
  // Cut NW corner (x: 0..4, y: 0..4) with bevel and floor shadow
  drawRect(ctx, 0, 0, 4, 4, WALL_C.VOID);
  drawRect(ctx, 4, 0, 1, 4, WALL_C.HIGHLIGHT);
  drawRect(ctx, 0, 4, 4, 1, WALL_C.HIGHLIGHT);
}

function renderWallCornerInnerNE(ctx) {
  renderWallCross(ctx);
  // Cut NE corner (x: 27..31, y: 0..4)
  drawRect(ctx, 27, 0, 5, 4, WALL_C.VOID);
  drawRect(ctx, 26, 0, 1, 4, WALL_C.HIGHLIGHT);
  drawRect(ctx, 27, 4, 5, 1, WALL_C.HIGHLIGHT);
}

function renderWallCornerInnerSE(ctx) {
  renderWallCross(ctx);
  // Cut SE corner (x: 27..31, y: 27..31)
  drawRect(ctx, 27, 27, 5, 5, WALL_C.VOID);
  drawRect(ctx, 26, 27, 1, 5, WALL_C.EDGE_SHADOW);
  drawRect(ctx, 27, 26, 5, 1, WALL_C.EDGE_SHADOW);
}

function renderWallCornerInnerSW(ctx) {
  renderWallCross(ctx);
  // Cut SW corner (x: 0..4, y: 27..31)
  drawRect(ctx, 0, 27, 5, 5, WALL_C.VOID);
  drawRect(ctx, 4, 27, 1, 5, WALL_C.EDGE_SHADOW);
  drawRect(ctx, 0, 26, 5, 1, WALL_C.EDGE_SHADOW);
}

// ============================================================================
// B. DIRECTIONAL DOOR FRAMES (4 TILES)
// ============================================================================

// 21. door_h_closed (Horizontal closed blast door - matches door.png)
function renderDoorHClosed(ctx) {
  // Floor background
  drawRect(ctx, 0, 0, 32, 32, '#0b1128');

  // Left & Right Jambs
  for (let y = 4; y <= 27; y++) {
    drawRect(ctx, 0, y, 5, 1, '#1b2d70');
    setPixel(ctx, 0, y, '#3556cc');
    setPixel(ctx, 4, y, '#4268eb');
    drawRect(ctx, 27, y, 5, 1, '#1b2d70');
    setPixel(ctx, 27, y, '#4268eb');
    setPixel(ctx, 31, y, '#3556cc');
  }
  // Jamb caps
  drawRect(ctx, 0, 4, 5, 1, '#3556cc');
  drawRect(ctx, 27, 4, 5, 1, '#3556cc');
  drawRect(ctx, 0, 27, 5, 1, '#3556cc');
  drawRect(ctx, 27, 27, 5, 1, '#3556cc');

  // Horizontal Blast Door Hatch in center (x: 5..26, y: 8..24)
  drawRect(ctx, 5, 9, 22, 15, '#0e1840');
  drawRect(ctx, 5, 8, 22, 1, '#070b1a');
  drawRect(ctx, 5, 9, 22, 1, '#3556cc');
  drawRect(ctx, 5, 23, 22, 1, '#3556cc');
  drawRect(ctx, 5, 24, 22, 1, '#070b1a');

  // Center laser lock seam (Row 16)
  drawRect(ctx, 5, 16, 22, 1, '#00e5ff');
  setPixel(ctx, 2, 16, '#25ff88'); // Green status diode on left jamb
  setPixel(ctx, 29, 16, '#25ff88'); // Green status diode on right jamb
}

// 22. door_v_closed (Vertical closed blast door - corridor runs E-W, door runs N-S)
function renderDoorVClosed(ctx) {
  // Floor background
  drawRect(ctx, 0, 0, 32, 32, '#0b1128');

  // Top & Bottom Jambs
  for (let x = 4; x <= 27; x++) {
    drawRect(ctx, x, 0, 1, 5, '#1b2d70');
    setPixel(ctx, x, 0, '#3556cc');
    setPixel(ctx, x, 4, '#4268eb');
    drawRect(ctx, x, 27, 1, 5, '#1b2d70');
    setPixel(ctx, x, 27, '#4268eb');
    setPixel(ctx, x, 31, '#3556cc');
  }

  // Vertical Blast Door Hatch in center (x: 8..24, y: 5..26)
  drawRect(ctx, 9, 5, 15, 22, '#0e1840');
  drawRect(ctx, 8, 5, 1, 22, '#070b1a');
  drawRect(ctx, 9, 5, 1, 22, '#3556cc');
  drawRect(ctx, 23, 5, 1, 22, '#3556cc');
  drawRect(ctx, 24, 5, 1, 22, '#070b1a');

  // Center vertical laser lock seam (Col 16)
  for (let y = 5; y <= 26; y++) {
    setPixel(ctx, 16, y, '#00e5ff');
  }
  setPixel(ctx, 16, 2, '#25ff88'); // Status diode on top jamb
  setPixel(ctx, 16, 29, '#25ff88'); // Status diode on bottom jamb
}

// 23. door_h_open (Horizontal open blast door - door retracted into jambs, threshold open)
function renderDoorHOpen(ctx) {
  // Clear floor threshold
  drawRect(ctx, 0, 0, 32, 32, '#0b1128');

  // Recessed threshold tread lines
  drawRect(ctx, 5, 10, 22, 1, '#111a3d');
  drawRect(ctx, 5, 16, 22, 1, '#14204b');
  drawRect(ctx, 5, 22, 22, 1, '#111a3d');

  // Left & Right Jambs with retracted door panels
  for (let y = 4; y <= 27; y++) {
    drawRect(ctx, 0, y, 6, 1, '#1b2d70');
    setPixel(ctx, 0, y, '#3556cc');
    setPixel(ctx, 5, y, '#4268eb');
    drawRect(ctx, 26, y, 6, 1, '#1b2d70');
    setPixel(ctx, 26, y, '#4268eb');
    setPixel(ctx, 31, y, '#3556cc');
  }
  // Open green diodes
  setPixel(ctx, 2, 8, '#25ff88');
  setPixel(ctx, 2, 23, '#25ff88');
  setPixel(ctx, 29, 8, '#25ff88');
  setPixel(ctx, 29, 23, '#25ff88');
}

// 24. door_v_open (Vertical open blast door - corridor runs E-W)
function renderDoorVOpen(ctx) {
  drawRect(ctx, 0, 0, 32, 32, '#0b1128');

  // Recessed threshold tread lines
  drawRect(ctx, 10, 5, 1, 22, '#111a3d');
  drawRect(ctx, 16, 5, 1, 22, '#14204b');
  drawRect(ctx, 22, 5, 1, 22, '#111a3d');

  // Top & Bottom Jambs with retracted panels
  for (let x = 4; x <= 27; x++) {
    drawRect(ctx, x, 0, 1, 6, '#1b2d70');
    setPixel(ctx, x, 0, '#3556cc');
    setPixel(ctx, x, 5, '#4268eb');
    drawRect(ctx, x, 26, 1, 6, '#1b2d70');
    setPixel(ctx, x, 26, '#4268eb');
    setPixel(ctx, x, 31, '#3556cc');
  }
  // Open green diodes
  setPixel(ctx, 8, 2, '#25ff88');
  setPixel(ctx, 23, 2, '#25ff88');
  setPixel(ctx, 8, 29, '#25ff88');
  setPixel(ctx, 23, 29, '#25ff88');
}

// ============================================================================
// C. DIRECTIONAL ENVIRONMENTAL PROPS (18 TILES)
// ============================================================================

// 1. WORKSTATIONS (CRT Terminal & Desk)
// 25. prop_workstation_s (Facing South - front monitors facing South)
function renderWorkstationS(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.65);

  // Terminal Desk Structure
  drawRect(ctx, 4, 18, 24, 10, '#0f172a');
  drawRect(ctx, 5, 19, 22, 3, '#1e293b');
  drawRect(ctx, 3, 17, 26, 2, '#475569');
  drawRect(ctx, 3, 17, 26, 1, '#94a3b8');

  // Pedestal legs
  drawRect(ctx, 5, 22, 4, 7, '#0f172a');
  drawRect(ctx, 23, 22, 4, 7, '#0f172a');
  drawRect(ctx, 6, 23, 2, 6, '#1e293b');
  drawRect(ctx, 24, 23, 2, 6, '#1e293b');

  // Glowing conduit
  drawRect(ctx, 15, 20, 2, 9, '#0284c7');
  setPixel(ctx, 15, 23, '#00f0ff');
  setPixel(ctx, 16, 26, '#00f0ff');

  // Keyboard deck
  drawRect(ctx, 9, 16, 14, 2, '#1e293b');
  for (let kx = 10; kx <= 21; kx += 2) setPixel(ctx, kx, 16, '#94a3b8');

  // Left Monitor (Cobalt)
  drawRect(ctx, 4, 8, 8, 8, '#0f172a');
  drawRect(ctx, 5, 9, 6, 6, '#0284c7');
  setPixel(ctx, 6, 10, '#38bdf8');
  setPixel(ctx, 7, 10, '#38bdf8');

  // Main Monitor (Cyan)
  drawRect(ctx, 13, 4, 14, 12, '#0f172a');
  drawRect(ctx, 14, 3, 12, 1, '#cbd5e1');
  drawRect(ctx, 14, 5, 12, 10, '#042f2e');
  drawRect(ctx, 15, 6, 10, 1, '#00f0ff');
  setPixel(ctx, 16, 8, '#00f0ff');
  setPixel(ctx, 17, 9, '#5eead4');
  setPixel(ctx, 18, 8, '#00f0ff');
  setPixel(ctx, 19, 7, '#ffffff');
  setPixel(ctx, 20, 8, '#00f0ff');
}

// 26. prop_workstation_n (Facing North - back of desk and monitors facing South)
function renderWorkstationN(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.65);

  // Rear Desk Chassis (heavy graphite & heatsinks)
  drawRect(ctx, 3, 16, 26, 12, '#0f172a');
  drawRect(ctx, 4, 17, 24, 10, '#1e293b');
  drawRect(ctx, 5, 16, 22, 1, '#475569');

  // Heatsink ventilation louvers on back of desk
  for (let y = 19; y <= 25; y += 2) {
    drawRect(ctx, 7, y, 18, 1, '#0f172a');
  }

  // Back of CRT Monitors facing camera (curved heavy plastic casing & fan grilles)
  drawRect(ctx, 4, 6, 9, 10, '#1e293b');
  drawRect(ctx, 5, 5, 7, 1, '#334155');
  drawRect(ctx, 6, 8, 5, 5, '#0f172a'); // Fan vent

  drawRect(ctx, 14, 3, 14, 13, '#1e293b');
  drawRect(ctx, 15, 2, 12, 1, '#334155');
  drawRect(ctx, 17, 5, 8, 7, '#0f172a'); // Main fan exhaust

  // Heavy Power & Fiber-Optic Cables spilling from rear onto floor
  drawRect(ctx, 10, 24, 2, 6, '#ea580c'); // Orange high-voltage line
  drawRect(ctx, 20, 23, 2, 7, '#0284c7'); // Blue fiber line
  setPixel(ctx, 21, 27, '#00f0ff');
}

// 27. prop_workstation_e (Facing East - profile view facing East)
function renderWorkstationE(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.65);

  // Desk profile (x: 6..24, y: 16..28)
  drawRect(ctx, 6, 16, 18, 12, '#0f172a');
  drawRect(ctx, 7, 17, 16, 10, '#1e293b');
  drawRect(ctx, 6, 16, 18, 1, '#94a3b8');

  // Monitor angled to East (x: 8..18, y: 5..16)
  drawRect(ctx, 8, 6, 10, 10, '#0f172a');
  drawRect(ctx, 9, 5, 8, 1, '#cbd5e1');
  drawRect(ctx, 16, 6, 2, 10, '#00f0ff'); // Screen face glow pointing East
  setPixel(ctx, 16, 8, '#ffffff');

  // Keyboard deck extending to East
  drawRect(ctx, 18, 16, 5, 2, '#334155');
  setPixel(ctx, 20, 16, '#94a3b8');
}

// 28. prop_workstation_w (Facing West - profile view facing West)
function renderWorkstationW(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.65);

  // Desk profile
  drawRect(ctx, 8, 16, 18, 12, '#0f172a');
  drawRect(ctx, 9, 17, 16, 10, '#1e293b');
  drawRect(ctx, 8, 16, 18, 1, '#94a3b8');

  // Monitor angled to West (x: 14..24, y: 5..16)
  drawRect(ctx, 14, 6, 10, 10, '#0f172a');
  drawRect(ctx, 15, 5, 8, 1, '#cbd5e1');
  drawRect(ctx, 14, 6, 2, 10, '#00f0ff'); // Screen face glow pointing West
  setPixel(ctx, 15, 8, '#ffffff');

  // Keyboard deck extending to West
  drawRect(ctx, 9, 16, 5, 2, '#334155');
  setPixel(ctx, 11, 16, '#94a3b8');
}

// 2. LOCKERS (Security Locker)
// 29. prop_locker_s (Facing South - front door & latch facing South)
function renderLockerS(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.7);

  // Heavy steel casing
  drawRect(ctx, 6, 4, 20, 25, '#0f172a');
  drawRect(ctx, 7, 3, 18, 25, '#1e293b');
  drawRect(ctx, 8, 4, 16, 23, '#334155');
  drawRect(ctx, 7, 3, 18, 1, '#64748b');

  // Yellow hazard band
  drawRect(ctx, 8, 5, 16, 3, '#0f172a');
  for (let hx = 8; hx <= 22; hx += 4) drawRect(ctx, hx, 5, 2, 3, '#eab308');

  // Door division
  drawRect(ctx, 15, 8, 2, 19, '#1e293b');

  // Safety orange lock
  drawRect(ctx, 13, 13, 6, 6, '#7c2d12');
  drawRect(ctx, 14, 13, 4, 5, '#ff9500');
  setPixel(ctx, 15, 15, '#ffffff');
}

// 30. prop_locker_n (Facing North - rear backplate facing South)
function renderLockerN(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.7);

  // Rear backplate of locker
  drawRect(ctx, 6, 4, 20, 25, '#0f172a');
  drawRect(ctx, 7, 3, 18, 25, '#1e293b');
  drawRect(ctx, 7, 3, 18, 1, '#64748b');

  // Heavy X-cross stamped reinforcement ribs on rear panel
  drawRect(ctx, 9, 6, 14, 19, '#0f172a');
  drawRect(ctx, 10, 7, 12, 17, '#1e293b');
  // Stamped diagonal braces
  for (let d = 0; d < 12; d++) {
    setPixel(ctx, 10 + d, 8 + Math.floor(d * 1.3), '#334155');
    setPixel(ctx, 21 - d, 8 + Math.floor(d * 1.3), '#334155');
  }
  // Stenciled barcode / serial tag
  drawRect(ctx, 12, 21, 8, 2, '#94a3b8');
  setPixel(ctx, 13, 21, '#0f172a');
  setPixel(ctx, 15, 21, '#0f172a');
  setPixel(ctx, 18, 21, '#0f172a');
}

// 31. prop_locker_e (Facing East - side profile facing East)
function renderLockerE(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 8, 2.5, 0.7);

  // Side casing profile (x: 8..23, y: 3..28)
  drawRect(ctx, 8, 4, 16, 25, '#0f172a');
  drawRect(ctx, 9, 3, 14, 25, '#1e293b');
  drawRect(ctx, 9, 3, 14, 1, '#64748b');

  // Front face rim pointing East (x: 21..23)
  drawRect(ctx, 21, 4, 2, 23, '#334155');
  drawRect(ctx, 21, 5, 2, 3, '#eab308'); // Hazard band
  drawRect(ctx, 21, 13, 2, 5, '#ff9500'); // Lock latch side view
  setPixel(ctx, 22, 15, '#ffffff');
}

// 32. prop_locker_w (Facing West - side profile facing West)
function renderLockerW(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 8, 2.5, 0.7);

  // Side casing profile (x: 8..23, y: 3..28)
  drawRect(ctx, 8, 4, 16, 25, '#0f172a');
  drawRect(ctx, 9, 3, 14, 25, '#1e293b');
  drawRect(ctx, 9, 3, 14, 1, '#64748b');

  // Front face rim pointing West (x: 9..11)
  drawRect(ctx, 9, 4, 2, 23, '#334155');
  drawRect(ctx, 9, 5, 2, 3, '#eab308'); // Hazard band
  drawRect(ctx, 9, 13, 2, 5, '#ff9500'); // Lock latch side view
  setPixel(ctx, 9, 15, '#ffffff');
}

// 3. BIOCABINETS (Sekiguchi Bio-Dispenser)
// 33. prop_biocabinet_s (Facing South - front glass and cross facing South)
function renderBiocabinetS(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.65);

  // Sterile Titanium frame
  drawRect(ctx, 6, 4, 20, 25, '#0f172a');
  drawRect(ctx, 7, 3, 18, 25, '#cbd5e1');
  drawRect(ctx, 8, 4, 16, 24, '#f8fafc');
  drawRect(ctx, 7, 3, 18, 1, '#ffffff');

  // Red Cross
  drawRect(ctx, 14, 5, 4, 4, '#ef4444');
  drawRect(ctx, 15, 4, 2, 6, '#ffffff');
  drawRect(ctx, 13, 6, 6, 2, '#ffffff');
  drawRect(ctx, 15, 6, 2, 2, '#ef4444');

  // Glass chamber
  drawRect(ctx, 8, 10, 16, 13, '#064e3b');
  drawRect(ctx, 9, 11, 14, 11, '#042f2e');

  // Glowing Mint Canisters
  drawRect(ctx, 11, 13, 2, 7, '#10b981');
  drawRect(ctx, 15, 12, 2, 8, '#10b981');
  drawRect(ctx, 16, 13, 1, 6, '#5eead4');
  setPixel(ctx, 16, 14, '#ffffff');
  drawRect(ctx, 20, 14, 2, 6, '#10b981');
}

// 34. prop_biocabinet_n (Facing North - rear compressor facing South)
function renderBiocabinetN(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.65);

  // Rear sterile shell
  drawRect(ctx, 6, 4, 20, 25, '#0f172a');
  drawRect(ctx, 7, 3, 18, 25, '#cbd5e1');
  drawRect(ctx, 7, 3, 18, 1, '#ffffff');

  // Cryogenic Compressor & Heat Dissipation Radiator
  drawRect(ctx, 9, 6, 14, 14, '#0f172a');
  for (let y = 7; y <= 18; y += 2) {
    drawRect(ctx, 10, y, 12, 1, '#475569');
  }

  // Cryo-coolant supply pipes
  drawRect(ctx, 10, 20, 3, 8, '#065f46');
  drawRect(ctx, 11, 20, 1, 8, '#10b981');
  drawRect(ctx, 19, 20, 3, 8, '#065f46');
  drawRect(ctx, 20, 20, 1, 8, '#10b981');
}

// 35. prop_biocabinet_e (Facing East - side view facing East)
function renderBiocabinetE(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 8, 2.5, 0.65);

  // Side casing
  drawRect(ctx, 8, 4, 16, 25, '#0f172a');
  drawRect(ctx, 9, 3, 14, 25, '#cbd5e1');
  drawRect(ctx, 9, 3, 14, 1, '#ffffff');

  // Glass chamber visible on East front (x: 18..22, y: 10..22)
  drawRect(ctx, 18, 10, 4, 13, '#064e3b');
  drawRect(ctx, 19, 11, 2, 11, '#10b981');
  setPixel(ctx, 20, 14, '#5eead4');
}

// 36. prop_biocabinet_w (Facing West - side view facing West)
function renderBiocabinetW(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 8, 2.5, 0.65);

  // Side casing
  drawRect(ctx, 8, 4, 16, 25, '#0f172a');
  drawRect(ctx, 9, 3, 14, 25, '#cbd5e1');
  drawRect(ctx, 9, 3, 14, 1, '#ffffff');

  // Glass chamber visible on West front (x: 10..14, y: 10..22)
  drawRect(ctx, 10, 10, 4, 13, '#064e3b');
  drawRect(ctx, 11, 11, 2, 11, '#10b981');
  setPixel(ctx, 11, 14, '#5eead4');
}

// 4. ENCRYPTED VAULT DOORS
// 37. prop_vault_door_s (Facing South - front blast hatch facing South)
function renderVaultDoorS(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 13, 2.5, 0.7);

  // Outer Bulkhead Archway
  drawRect(ctx, 2, 3, 28, 26, '#0f172a');
  drawRect(ctx, 3, 2, 26, 26, '#1e293b');
  drawRect(ctx, 3, 2, 26, 2, '#64748b');
  drawRect(ctx, 4, 2, 24, 1, '#cbd5e1');

  // Jambs & Sliding Panels
  drawRect(ctx, 6, 4, 20, 24, '#0f172a');
  drawRect(ctx, 7, 5, 18, 22, '#1e293b');

  // Plasma laser core
  drawRect(ctx, 5, 15, 22, 3, '#ea580c');
  drawRect(ctx, 5, 16, 22, 1, '#ff9500');
  drawRect(ctx, 9, 16, 14, 1, '#ffffff');

  // Beacon
  drawRect(ctx, 14, 1, 4, 2, '#7c2d12');
  drawRect(ctx, 15, 1, 2, 2, '#ff9500');
  setPixel(ctx, 15, 1, '#ffffff');
}

// 38. prop_vault_door_n (Facing North - rear armored bulkhead facing South)
function renderVaultDoorN(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 13, 2.5, 0.7);

  // Outer Bulkhead Archway
  drawRect(ctx, 2, 3, 28, 26, '#0f172a');
  drawRect(ctx, 3, 2, 26, 26, '#1e293b');
  drawRect(ctx, 4, 2, 24, 1, '#cbd5e1');

  // Heavy Rear Hydraulic Locking Rams (Left & Right)
  drawRect(ctx, 6, 7, 5, 16, '#0f172a');
  drawRect(ctx, 7, 8, 3, 14, '#475569');
  drawRect(ctx, 21, 7, 5, 16, '#0f172a');
  drawRect(ctx, 22, 8, 3, 14, '#475569');

  // Central Gear Locking Wheel on Rear Hatch
  drawRect(ctx, 12, 10, 8, 8, '#0f172a');
  drawRect(ctx, 13, 11, 6, 6, '#334155');
  drawRect(ctx, 14, 12, 4, 4, '#ff9500'); // Central amber hub
  setPixel(ctx, 15, 13, '#ffffff');
}

// 39. prop_vault_door_e (Facing East - side profile facing East)
function renderVaultDoorE(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 9, 2.5, 0.7);

  // Side archway profile
  drawRect(ctx, 7, 3, 18, 26, '#0f172a');
  drawRect(ctx, 8, 2, 16, 26, '#1e293b');
  drawRect(ctx, 9, 2, 14, 1, '#cbd5e1');

  // Front face pointing East (x: 21..24)
  drawRect(ctx, 22, 5, 2, 22, '#ea580c');
  drawRect(ctx, 23, 12, 1, 8, '#ff9500');
  setPixel(ctx, 23, 16, '#ffffff');
}

// 40. prop_vault_door_w (Facing West - side profile facing West)
function renderVaultDoorW(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 9, 2.5, 0.7);

  // Side archway profile
  drawRect(ctx, 7, 3, 18, 26, '#0f172a');
  drawRect(ctx, 8, 2, 16, 26, '#1e293b');
  drawRect(ctx, 9, 2, 14, 1, '#cbd5e1');

  // Front face pointing West (x: 8..11)
  drawRect(ctx, 8, 5, 2, 22, '#ea580c');
  drawRect(ctx, 8, 12, 1, 8, '#ff9500');
  setPixel(ctx, 8, 16, '#ffffff');
}

// 5. REINFORCED CRATE COVER
// 41. prop_crate_cover_h (Horizontal barricade - matches prop_crate_cover.png)
function renderCrateCoverH(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.7);

  drawRect(ctx, 4, 12, 24, 16, '#0f172a');
  drawRect(ctx, 5, 11, 22, 16, '#1e293b');
  drawRect(ctx, 6, 12, 20, 14, '#334155');
  drawRect(ctx, 5, 11, 22, 1, '#64748b');
  drawRect(ctx, 6, 11, 20, 1, '#cbd5e1');

  // Hazard stripe
  drawRect(ctx, 6, 16, 20, 4, '#0f172a');
  for (let cx = 6; cx <= 24; cx += 4) drawRect(ctx, cx, 16, 2, 4, '#facc15');

  // Bolts
  for (const [cx, cy] of [[6, 13], [24, 13], [6, 23], [24, 23]]) {
    drawRect(ctx, cx - 1, cy - 1, 3, 3, '#0f172a');
    setPixel(ctx, cx, cy, '#94a3b8');
  }
}

// 42. prop_crate_cover_v (Vertical barricade providing East/West cover)
function renderCrateCoverV(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 7, 2.5, 0.7);

  // Vertical steel crate pallet (x: 10..21, y: 4..28)
  drawRect(ctx, 10, 5, 12, 24, '#0f172a');
  drawRect(ctx, 11, 4, 10, 24, '#1e293b');
  drawRect(ctx, 12, 5, 8, 22, '#334155');
  drawRect(ctx, 11, 4, 10, 1, '#cbd5e1');

  // Vertical hazard stripes along center (x: 14..17, y: 6..24)
  drawRect(ctx, 14, 6, 4, 19, '#0f172a');
  for (let cy = 6; cy <= 23; cy += 4) {
    drawRect(ctx, 14, cy, 4, 2, '#facc15');
  }

  // Corner bolts
  for (const [cx, cy] of [[12, 6], [19, 6], [12, 24], [19, 24]]) {
    setPixel(ctx, cx, cy, '#94a3b8');
  }
}

// ============================================================================
// INSPECTION PREVIEW SHEET (600x300)
// ============================================================================
async function generateInspectionSheet(tileCanvas, tileKey, floorImg, wallImg, isWall = false, isDoor = false) {
  const sheet = createCanvas(600, 300);
  const sCtx = sheet.getContext('2d');
  sCtx.imageSmoothingEnabled = false;

  // Background
  sCtx.fillStyle = '#04060e';
  sCtx.fillRect(0, 0, 600, 300);

  // Grid lines
  sCtx.strokeStyle = 'rgba(16, 26, 50, 0.4)';
  sCtx.lineWidth = 1;
  for (let x = 0; x < 600; x += 16) {
    sCtx.beginPath(); sCtx.moveTo(x, 0); sCtx.lineTo(x, 300); sCtx.stroke();
  }
  for (let y = 0; y < 300; y += 16) {
    sCtx.beginPath(); sCtx.moveTo(0, y); sCtx.lineTo(600, y); sCtx.stroke();
  }

  // --- PANEL 1: LEFT 8X ZOOM (256x256 at x:20, y:22) ---
  const p1X = 20, p1Y = 22, p1W = 256, p1H = 256;
  const checkSize = 16;
  for (let cy = 0; cy < p1H; cy += checkSize) {
    for (let cx = 0; cx < p1W; cx += checkSize) {
      const isAlt = ((cx / checkSize) + (cy / checkSize)) % 2 === 0;
      sCtx.fillStyle = isAlt ? '#080c1e' : '#0c122b';
      sCtx.fillRect(p1X + cx, p1Y + cy, checkSize, checkSize);
    }
  }
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p1X, p1Y, p1W, p1H);
  sCtx.strokeStyle = '#00f0ff';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p1X - 0.5, p1Y - 0.5, p1W + 1, p1H + 1);

  // --- PANEL 2: TOP CENTER 3x3 CONTEXT GRID (192x192 at x:300, y:22) ---
  const p2X = 300, p2Y = 22, p2W = 192, p2H = 192;
  // Draw 3x3 floor grid
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      sCtx.drawImage(floorImg, 0, 0, 32, 32, p2X + gx * 64, p2Y + gy * 64, 64, 64);
    }
  }

  if (isWall) {
    // Context wall room: top row walls, center tile has this wall tile
    sCtx.drawImage(wallImg, 0, 0, 32, 32, p2X + 0, p2Y + 0, 64, 64);
    sCtx.drawImage(wallImg, 0, 0, 32, 32, p2X + 128, p2Y + 0, 64, 64);
    sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p2X + 64, p2Y + 64, 64, 64);
  } else if (isDoor) {
    // Door between two walls
    sCtx.drawImage(wallImg, 0, 0, 32, 32, p2X + 0, p2Y + 64, 64, 64);
    sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p2X + 64, p2Y + 64, 64, 64);
    sCtx.drawImage(wallImg, 0, 0, 32, 32, p2X + 128, p2Y + 64, 64, 64);
  } else {
    // Prop on floor
    sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p2X + 64, p2Y + 64, 64, 64);
  }

  sCtx.strokeStyle = '#2563eb';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p2X - 0.5, p2Y - 0.5, p2W + 1, p2H + 1);

  // --- PANEL 3: BOTTOM CENTER 1x3 FOV ALPHA CHECK (192x64 at x:300, y:224) ---
  const p3X = 300, p3Y = 224;
  for (let gx = 0; gx < 3; gx++) {
    sCtx.drawImage(floorImg, 0, 0, 32, 32, p3X + gx * 64, p3Y, 64, 64);
  }
  // 100% alpha
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p3X + 8, p3Y, 64, 64);
  // 30% alpha Fog of War
  sCtx.save();
  sCtx.globalAlpha = 0.3;
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p3X + 120, p3Y, 64, 64);
  sCtx.restore();

  sCtx.strokeStyle = '#00f0ff';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p3X - 0.5, p3Y - 0.5, 192 + 1, 64 + 1);

  // --- PANEL 4: TOP RIGHT 1:1 TRUE SIZE (32x32 at x:530, y:22) ---
  const p4X = 530, p4Y = 22;
  sCtx.drawImage(floorImg, 0, 0, 32, 32, p4X, p4Y, 32, 32);
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p4X, p4Y, 32, 32);
  sCtx.strokeStyle = '#38bdf8';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p4X - 0.5, p4Y - 0.5, 32 + 1, 32 + 1);

  return sheet;
}

// ============================================================================
// MASTER WALL AUTOTILES PREVIEW SHEET (780x420)
// ============================================================================
async function generateMasterWallSheet(tileCanvases, floorImg) {
  const sheet = createCanvas(780, 420);
  const sCtx = sheet.getContext('2d');
  sCtx.imageSmoothingEnabled = false;

  sCtx.fillStyle = '#04060e';
  sCtx.fillRect(0, 0, 780, 420);

  // Title
  sCtx.fillStyle = '#00f0ff';
  sCtx.font = 'bold 13px monospace';
  sCtx.fillText('[NIRMATA RUN] BESPOKE WALL AUTOTILES // FULL BITMASK SET (16+4 TILES)', 24, 25);

  sCtx.fillStyle = '#94a3b8';
  sCtx.font = '10px monospace';
  sCtx.fillText('INDIVIDUAL 32x32 AUTOTILE PALETTE (2x ZOOM)', 24, 46);
  sCtx.fillText('AUTOTILED DUNGEON SECTOR WITH WALL CAPS & CORNERS (10x10)', 380, 46);

  // Left side: 4x5 grid of wall tiles at 2x scale (64x64 each)
  const leftX = 24, leftY = 56;
  const wallOrder = [
    'wall_single', 'wall_cap_n', 'wall_cap_s', 'wall_cap_w',
    'wall_cap_e', 'wall_straight_h', 'wall_straight_v', 'wall_corner_ne',
    'wall_corner_se', 'wall_corner_sw', 'wall_corner_nw', 'wall_t_n',
    'wall_t_s', 'wall_t_w', 'wall_t_e', 'wall_cross',
    'wall_corner_inner_nw', 'wall_corner_inner_ne', 'wall_corner_inner_se', 'wall_corner_inner_sw'
  ];

  for (let i = 0; i < wallOrder.length; i++) {
    const key = wallOrder[i];
    const can = tileCanvases.get(key);
    if (!can) continue;
    const col = i % 4;
    const row = Math.floor(i / 4);
    const tx = leftX + col * 80;
    const ty = leftY + row * 70;

    // Floor backing
    sCtx.drawImage(floorImg, 0, 0, 32, 32, tx, ty, 64, 64);
    // Tile at 2x
    sCtx.drawImage(can, 0, 0, 32, 32, tx, ty, 64, 64);
    sCtx.strokeStyle = '#2563eb';
    sCtx.lineWidth = 1;
    sCtx.strokeRect(tx - 0.5, ty - 0.5, 64 + 1, 64 + 1);

    // Label
    sCtx.fillStyle = '#64748b';
    sCtx.font = '8px monospace';
    sCtx.fillText(key.replace('wall_', ''), tx, ty + 68);
  }

  // Right side: Mock Autotiled Dungeon Room (10x10 tiles = 320x320 px at x: 420, y: 56)
  const mapX = 420, mapY = 56;

  // 1. Draw floor everywhere
  for (let gy = 0; gy < 10; gy++) {
    for (let gx = 0; gx < 10; gx++) {
      sCtx.drawImage(floorImg, 0, 0, 32, 32, mapX + gx * 32, mapY + gy * 32, 32, 32);
    }
  }

  // 2. Stamp autotiled walls in realistic room with corridors, pillar, and endcaps
  const stamp = (k, gx, gy) => {
    const c = tileCanvases.get(k);
    if (c) sCtx.drawImage(c, 0, 0, 32, 32, mapX + gx * 32, mapY + gy * 32, 32, 32);
  };

  // Top perimeter wall (horizontal run with corners)
  stamp('wall_corner_se', 0, 0);
  for (let gx = 1; gx <= 8; gx++) stamp('wall_straight_h', gx, 0);
  stamp('wall_corner_sw', 9, 0);

  // Left & Right perimeter walls
  stamp('wall_straight_v', 0, 1);
  stamp('wall_straight_v', 9, 1);
  stamp('wall_straight_v', 0, 2);
  stamp('wall_straight_v', 9, 2);

  // T-junction branching into an interior divider
  stamp('wall_t_w', 0, 3);
  stamp('wall_straight_h', 1, 3);
  stamp('wall_straight_h', 2, 3);
  stamp('wall_cap_e', 3, 3); // Terminal endcap facing East!

  stamp('wall_straight_v', 9, 3);

  // Freestanding pillar in room center
  stamp('wall_single', 6, 2);

  // Vertical spine wall with North and South caps
  stamp('wall_cap_n', 6, 5); // Terminal endcap facing North!
  stamp('wall_straight_v', 6, 6);
  stamp('wall_t_n', 6, 7); // T-junction branching South and East
  stamp('wall_straight_h', 7, 7);
  stamp('wall_straight_h', 8, 7);
  stamp('wall_t_e', 9, 7);
  stamp('wall_cap_s', 6, 8); // Terminal endcap facing South!

  // Bottom perimeter wall
  stamp('wall_corner_ne', 0, 9);
  for (let gx = 1; gx <= 8; gx++) stamp('wall_straight_h', gx, 9);
  stamp('wall_corner_nw', 9, 9);

  stamp('wall_straight_v', 0, 4);
  stamp('wall_straight_v', 0, 5);
  stamp('wall_straight_v', 0, 6);
  stamp('wall_straight_v', 0, 7);
  stamp('wall_straight_v', 0, 8);
  stamp('wall_straight_v', 9, 4);
  stamp('wall_straight_v', 9, 5);
  stamp('wall_straight_v', 9, 6);
  stamp('wall_straight_v', 9, 8);

  // Border around mock map
  sCtx.strokeStyle = '#00f0ff';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(mapX - 0.5, mapY - 0.5, 320 + 1, 320 + 1);

  sCtx.fillStyle = '#64748b';
  sCtx.font = '9px monospace';
  sCtx.fillText('Seamless 3/4 Elevated Geometry with Dead-End Caps & Orthogonal Runs', mapX, 396);

  return sheet;
}

// ============================================================================
// MAIN GENERATOR EXECUTION
// ============================================================================
async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const floorPath = path.join(rootDir, 'public/assets/tiles/floor.png');
  const wallPath = path.join(rootDir, 'public/assets/tiles/wall.png');

  const floorImg = await loadImage(floorPath);
  const wallImg = await loadImage(wallPath);

  const tiles = [
    // --- A. WALL AUTOTILE FRAMES ---
    { key: 'wall_single', aliases: ['wall_pillar'], render: renderWallSingle, isWall: true },
    { key: 'wall_cap_n', aliases: [], render: renderWallCapN, isWall: true },
    { key: 'wall_cap_s', aliases: [], render: renderWallCapS, isWall: true },
    { key: 'wall_cap_e', aliases: [], render: renderWallCapE, isWall: true },
    { key: 'wall_cap_w', aliases: [], render: renderWallCapW, isWall: true },
    { key: 'wall_straight_h', aliases: [], render: renderWallStraightH, isWall: true },
    { key: 'wall_straight_v', aliases: [], render: renderWallStraightV, isWall: true },
    { key: 'wall_corner_ne', aliases: ['wall_corner_outer_sw'], render: renderWallCornerNE, isWall: true },
    { key: 'wall_corner_se', aliases: ['wall_corner_outer_nw'], render: renderWallCornerSE, isWall: true },
    { key: 'wall_corner_sw', aliases: ['wall_corner_outer_ne'], render: renderWallCornerSW, isWall: true },
    { key: 'wall_corner_nw', aliases: ['wall_corner_outer_se'], render: renderWallCornerNW, isWall: true },
    { key: 'wall_t_n', aliases: ['wall_tjunction_n'], render: renderWallTN, isWall: true },
    { key: 'wall_t_s', aliases: ['wall_tjunction_s'], render: renderWallTS, isWall: true },
    { key: 'wall_t_w', aliases: ['wall_tjunction_w'], render: renderWallTW, isWall: true },
    { key: 'wall_t_e', aliases: ['wall_tjunction_e'], render: renderWallTE, isWall: true },
    { key: 'wall_cross', aliases: [], render: renderWallCross, isWall: true },
    { key: 'wall_corner_inner_nw', aliases: ['wall_corner_nw_inner'], render: renderWallCornerInnerNW, isWall: true },
    { key: 'wall_corner_inner_ne', aliases: ['wall_corner_ne_inner'], render: renderWallCornerInnerNE, isWall: true },
    { key: 'wall_corner_inner_se', aliases: ['wall_corner_se_inner'], render: renderWallCornerInnerSE, isWall: true },
    { key: 'wall_corner_inner_sw', aliases: ['wall_corner_sw_inner'], render: renderWallCornerInnerSW, isWall: true },

    // --- B. DIRECTIONAL DOOR FRAMES ---
    { key: 'door_h_closed', aliases: ['door_closed_horizontal'], render: renderDoorHClosed, isDoor: true },
    { key: 'door_v_closed', aliases: ['door_closed_vertical'], render: renderDoorVClosed, isDoor: true },
    { key: 'door_h_open', aliases: ['door_open_horizontal'], render: renderDoorHOpen, isDoor: true },
    { key: 'door_v_open', aliases: ['door_open_vertical'], render: renderDoorVOpen, isDoor: true },

    // --- C. DIRECTIONAL ENVIRONMENTAL PROPS ---
    { key: 'prop_workstation_s', aliases: [], render: renderWorkstationS },
    { key: 'prop_workstation_n', aliases: [], render: renderWorkstationN },
    { key: 'prop_workstation_e', aliases: [], render: renderWorkstationE },
    { key: 'prop_workstation_w', aliases: [], render: renderWorkstationW },

    { key: 'prop_locker_s', aliases: [], render: renderLockerS },
    { key: 'prop_locker_n', aliases: [], render: renderLockerN },
    { key: 'prop_locker_e', aliases: [], render: renderLockerE },
    { key: 'prop_locker_w', aliases: [], render: renderLockerW },

    { key: 'prop_biocabinet_s', aliases: [], render: renderBiocabinetS },
    { key: 'prop_biocabinet_n', aliases: [], render: renderBiocabinetN },
    { key: 'prop_biocabinet_e', aliases: [], render: renderBiocabinetE },
    { key: 'prop_biocabinet_w', aliases: [], render: renderBiocabinetW },

    { key: 'prop_vault_door_s', aliases: ['prop_vault_door_locked_s'], render: renderVaultDoorS },
    { key: 'prop_vault_door_n', aliases: ['prop_vault_door_locked_n'], render: renderVaultDoorN },
    { key: 'prop_vault_door_e', aliases: ['prop_vault_door_locked_e'], render: renderVaultDoorE },
    { key: 'prop_vault_door_w', aliases: ['prop_vault_door_locked_w'], render: renderVaultDoorW },

    { key: 'prop_crate_cover_h', aliases: [], render: renderCrateCoverH },
    { key: 'prop_crate_cover_v', aliases: [], render: renderCrateCoverV },
  ];

  console.log(`Starting generation for ${tiles.length} directional tiles...`);

  const previewDirs = [
    path.join(rootDir, 'docs/visual-design/previews'),
  ];
  for (const d of previewDirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  const generatedCanvases = new Map();

  for (const t of tiles) {
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    t.render(ctx);
    generatedCanvases.set(t.key, canvas);

    const buf = canvas.toBuffer('image/png');
    const outTilePath = path.join(rootDir, `public/assets/tiles/${t.key}.png`);
    fs.writeFileSync(outTilePath, buf);

    for (const alias of t.aliases) {
      const aliasPath = path.join(rootDir, `public/assets/tiles/${alias}.png`);
      fs.writeFileSync(aliasPath, buf);
      generatedCanvases.set(alias, canvas);
    }

    // Generate inspection sheet
    const sheetCanvas = await generateInspectionSheet(canvas, t.key, floorImg, wallImg, t.isWall, t.isDoor);
    const sheetBuf = sheetCanvas.toBuffer('image/png');

    for (const pd of previewDirs) {
      const previewFile = path.join(pd, `${t.key}_sheet.png`);
      fs.writeFileSync(previewFile, sheetBuf);
      for (const alias of t.aliases) {
        fs.writeFileSync(path.join(pd, `${alias}_sheet.png`), sheetBuf);
      }
    }
  }

  console.log('Generating Master Wall Autotiles Preview Sheet...');
  const masterWallSheet = await generateMasterWallSheet(generatedCanvases, floorImg);
  const masterBuf = masterWallSheet.toBuffer('image/png');
  for (const pd of previewDirs) {
    fs.writeFileSync(path.join(pd, 'wall_autotiles_master_sheet.png'), masterBuf);
  }
  console.log(`Saved master sheet to docs/visual-design/previews/wall_autotiles_master_sheet.png`);

  console.log(`Successfully built all ${tiles.length} tiles, aliases, and inspection sheets!`);
}

main().catch((err) => {
  console.error('Error generating directional tiles:', err);
  process.exit(1);
});
