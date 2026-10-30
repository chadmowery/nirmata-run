const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Color helpers
function hexToRgba(hex, alpha = 255) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [r, g, b, alpha];
}

function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// -------------------------------------------------------------
// 1. BASTION TILE (32x32)
// -------------------------------------------------------------
function renderBastion(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Soft grounding drop shadow (alpha ~170)
  ctx.fillStyle = 'rgba(2, 6, 18, 0.65)';
  ctx.beginPath();
  ctx.ellipse(16, 29, 10, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Heavy blast collar behind head (y: 3-7, x: 9-22)
  drawRect(ctx, 10, 4, 12, 4, '#1e293b'); // base collar
  drawRect(ctx, 9, 5, 14, 4, '#334155');
  drawRect(ctx, 10, 3, 12, 1, '#64748b'); // collar rim highlight
  drawRect(ctx, 11, 4, 10, 1, '#94a3b8');

  // Fortified Head & Helmet (x: 12-19, y: 5-11)
  drawRect(ctx, 12, 6, 8, 5, '#1e293b'); // base head
  drawRect(ctx, 13, 5, 6, 6, '#334155'); // helm shell
  drawRect(ctx, 14, 4, 4, 2, '#64748b'); // helm dome
  drawRect(ctx, 15, 4, 2, 1, '#cbd5e1'); // top specular highlight

  // Segmented armored faceplate / chin
  drawRect(ctx, 13, 9, 6, 2, '#1e293b');
  drawRect(ctx, 14, 9, 4, 2, '#334155');
  setPixel(ctx, 15, 10, '#0f172a');
  setPixel(ctx, 16, 10, '#0f172a');

  // Visor: Narrow glowing mint-cyan tactical optic slit (y: 8, x: 13-18)
  drawRect(ctx, 13, 8, 6, 1, '#0d9488');
  drawRect(ctx, 14, 8, 4, 1, '#5eead4');
  setPixel(ctx, 15, 8, '#ffffff');
  setPixel(ctx, 16, 8, '#ffffff');

  // Massive Pauldrons / Shoulder Armor (x: 4-9 & 22-27, y: 9-18)
  // Left shoulder
  drawRect(ctx, 5, 9, 6, 7, '#1e293b');
  drawRect(ctx, 4, 10, 6, 6, '#334155');
  drawRect(ctx, 5, 9, 5, 2, '#64748b');
  drawRect(ctx, 6, 9, 3, 1, '#cbd5e1'); // highlight
  drawRect(ctx, 4, 12, 1, 3, '#475569');
  setPixel(ctx, 6, 11, '#5eead4'); // status node
  // Right shoulder
  drawRect(ctx, 21, 9, 6, 7, '#1e293b');
  drawRect(ctx, 22, 10, 6, 6, '#334155');
  drawRect(ctx, 22, 9, 5, 2, '#64748b');
  drawRect(ctx, 23, 9, 3, 1, '#cbd5e1'); // highlight
  drawRect(ctx, 27, 12, 1, 3, '#475569');
  setPixel(ctx, 25, 11, '#5eead4'); // status node

  // Torso / Chest Chassis (x: 9-22, y: 11-20)
  drawRect(ctx, 9, 11, 14, 9, '#1e293b'); // torso back
  drawRect(ctx, 10, 11, 12, 8, '#334155'); // chest plate
  drawRect(ctx, 11, 12, 10, 6, '#475569');
  drawRect(ctx, 12, 11, 8, 1, '#64748b'); // collar bone plate
  drawRect(ctx, 13, 11, 6, 1, '#94a3b8');

  // Glowing Chevron Power Vents on Chest
  // Left angled vent
  setPixel(ctx, 12, 14, '#10b981');
  setPixel(ctx, 13, 14, '#5eead4');
  setPixel(ctx, 13, 15, '#5eead4');
  setPixel(ctx, 14, 15, '#f0fdf4');
  setPixel(ctx, 14, 16, '#5eead4');
  // Right angled vent
  setPixel(ctx, 19, 14, '#10b981');
  setPixel(ctx, 18, 14, '#5eead4');
  setPixel(ctx, 18, 15, '#5eead4');
  setPixel(ctx, 17, 15, '#f0fdf4');
  setPixel(ctx, 17, 16, '#5eead4');

  // Lower abdominal armor & ribs
  drawRect(ctx, 11, 17, 10, 3, '#1e293b');
  drawRect(ctx, 12, 17, 8, 2, '#334155');
  setPixel(ctx, 15, 17, '#f59e0b'); // amber core status diode
  setPixel(ctx, 16, 17, '#f59e0b');
  drawRect(ctx, 13, 18, 6, 1, '#475569');

  // Heavy Arms & Gauntlets (x: 4-8 & 23-27, y: 16-23)
  // Left arm
  drawRect(ctx, 4, 16, 5, 6, '#1e293b');
  drawRect(ctx, 4, 17, 4, 5, '#334155');
  drawRect(ctx, 5, 18, 2, 3, '#64748b');
  setPixel(ctx, 4, 21, '#1e293b'); // fist
  setPixel(ctx, 5, 21, '#334155');
  // Right arm
  drawRect(ctx, 23, 16, 5, 6, '#1e293b');
  drawRect(ctx, 24, 17, 4, 5, '#334155');
  drawRect(ctx, 25, 18, 2, 3, '#64748b');
  setPixel(ctx, 26, 21, '#334155');
  setPixel(ctx, 27, 21, '#1e293b');

  // Heavy Belt / Pelvis (x: 9-22, y: 20-22)
  drawRect(ctx, 10, 20, 12, 3, '#0f172a');
  drawRect(ctx, 11, 20, 10, 2, '#334155');
  drawRect(ctx, 14, 20, 4, 2, '#64748b'); // central groin plate / lock
  setPixel(ctx, 15, 21, '#94a3b8');
  setPixel(ctx, 16, 21, '#94a3b8');

  // Reinforced Armored Legs & Greaves (x: 8-13 & 18-23, y: 23-29)
  // Left leg
  drawRect(ctx, 8, 23, 6, 6, '#0f172a');
  drawRect(ctx, 9, 23, 4, 5, '#334155');
  drawRect(ctx, 9, 24, 3, 3, '#475569');
  drawRect(ctx, 9, 24, 1, 3, '#64748b'); // shin ridge highlight
  setPixel(ctx, 11, 27, '#5eead4'); // boot tread light
  drawRect(ctx, 8, 27, 6, 2, '#1e293b'); // heavy boot sole
  drawRect(ctx, 8, 28, 6, 1, '#0f172a');

  // Right leg
  drawRect(ctx, 18, 23, 6, 6, '#0f172a');
  drawRect(ctx, 19, 23, 4, 5, '#334155');
  drawRect(ctx, 20, 24, 3, 3, '#475569');
  drawRect(ctx, 22, 24, 1, 3, '#64748b'); // shin ridge highlight
  setPixel(ctx, 20, 27, '#5eead4'); // boot tread light
  drawRect(ctx, 18, 27, 6, 2, '#1e293b'); // heavy boot sole
  drawRect(ctx, 18, 28, 6, 1, '#0f172a');
}

// -------------------------------------------------------------
// 2. GHOST TILE (32x32)
// -------------------------------------------------------------
function renderGhost(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Soft delicate grounding drop shadow
  ctx.fillStyle = 'rgba(2, 6, 18, 0.55)';
  ctx.beginPath();
  ctx.ellipse(16, 29, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head & Neck (x: 12-19, y: 3-10)
  // Synthetic cranial dome
  drawRect(ctx, 13, 3, 6, 7, '#cbd5e1'); // outer skull
  drawRect(ctx, 14, 3, 4, 7, '#f8fafc'); // bone white shell
  drawRect(ctx, 14, 2, 4, 1, '#ffffff'); // cranial highlight
  drawRect(ctx, 12, 5, 8, 4, '#e2e8f0');

  // Slender cybernetic jawline / faceplate
  drawRect(ctx, 13, 8, 6, 2, '#94a3b8');
  drawRect(ctx, 14, 9, 4, 2, '#475569');
  setPixel(ctx, 15, 10, '#0f172a');
  setPixel(ctx, 16, 10, '#0f172a');

  // Piercing emerald glowing sensor optics (y: 6, x: 14 & 17)
  setPixel(ctx, 14, 6, '#22c55e');
  setPixel(ctx, 14, 7, '#86efac');
  setPixel(ctx, 17, 6, '#22c55e');
  setPixel(ctx, 17, 7, '#86efac');

  // Forehead cybernetic circuit trace
  setPixel(ctx, 15, 4, '#4ade80');
  setPixel(ctx, 16, 4, '#4ade80');

  // Slender neck with central glowing fiber conduit
  drawRect(ctx, 14, 10, 4, 2, '#0f172a');
  drawRect(ctx, 15, 10, 2, 2, '#4ade80'); // bright throat node
  setPixel(ctx, 15, 11, '#dcfce7');
  setPixel(ctx, 16, 11, '#dcfce7');

  // Shoulders & Slender Arms (x: 8-11 & 20-23, y: 12-23)
  // Left shoulder & arm
  drawRect(ctx, 9, 12, 4, 2, '#cbd5e1');
  drawRect(ctx, 8, 13, 4, 8, '#0f172a'); // carbon under-arm
  drawRect(ctx, 8, 14, 2, 7, '#f8fafc'); // white exterior casing
  drawRect(ctx, 10, 14, 1, 6, '#22c55e'); // glowing green neural fiber line
  setPixel(ctx, 10, 16, '#86efac');
  setPixel(ctx, 9, 21, '#94a3b8'); // hand
  setPixel(ctx, 8, 22, '#475569');

  // Right shoulder & arm
  drawRect(ctx, 19, 12, 4, 2, '#cbd5e1');
  drawRect(ctx, 20, 13, 4, 8, '#0f172a');
  drawRect(ctx, 22, 14, 2, 7, '#f8fafc');
  drawRect(ctx, 21, 14, 1, 6, '#22c55e');
  setPixel(ctx, 21, 16, '#86efac');
  setPixel(ctx, 22, 21, '#94a3b8'); // hand
  setPixel(ctx, 23, 22, '#475569');

  // Translucent Ceramic Torso & Neural Conduits (x: 11-20, y: 12-20)
  drawRect(ctx, 11, 12, 10, 8, '#0f172a'); // dark internal cavity
  // Ceramic side shells
  drawRect(ctx, 11, 12, 3, 7, '#e2e8f0');
  drawRect(ctx, 12, 13, 2, 5, '#ffffff');
  drawRect(ctx, 18, 12, 3, 7, '#e2e8f0');
  drawRect(ctx, 18, 13, 2, 5, '#ffffff');

  // Central branching neural bus (intense green luminescence)
  // Star/conduit node at throat
  setPixel(ctx, 14, 12, '#22c55e');
  setPixel(ctx, 15, 12, '#86efac');
  setPixel(ctx, 16, 12, '#86efac');
  setPixel(ctx, 17, 12, '#22c55e');
  // Branching fibers down sternum
  drawRect(ctx, 15, 13, 2, 6, '#4ade80');
  drawRect(ctx, 15, 14, 2, 3, '#dcfce7'); // bright central core
  // Diagonal neural rib traces
  setPixel(ctx, 14, 14, '#22c55e');
  setPixel(ctx, 13, 15, '#4ade80');
  setPixel(ctx, 17, 14, '#22c55e');
  setPixel(ctx, 18, 15, '#4ade80');
  setPixel(ctx, 14, 17, '#16a34a');
  setPixel(ctx, 17, 17, '#16a34a');

  // Slender Synthetic Waist (x: 13-18, y: 20-22)
  drawRect(ctx, 13, 20, 6, 2, '#0f172a');
  drawRect(ctx, 14, 20, 4, 2, '#334155');
  drawRect(ctx, 15, 20, 2, 2, '#4ade80'); // waist conduit link

  // Slender Aerodynamic Legs (x: 11-14 & 17-20, y: 22-29)
  // Left leg
  drawRect(ctx, 11, 22, 4, 7, '#0f172a');
  drawRect(ctx, 11, 22, 2, 5, '#e2e8f0');
  drawRect(ctx, 11, 23, 1, 4, '#ffffff'); // white shin plate
  drawRect(ctx, 13, 23, 1, 4, '#22c55e'); // green calf tracer
  setPixel(ctx, 13, 25, '#86efac');
  drawRect(ctx, 10, 27, 4, 2, '#334155'); // sleek foot
  drawRect(ctx, 10, 28, 4, 1, '#0f172a');

  // Right leg
  drawRect(ctx, 17, 22, 4, 7, '#0f172a');
  drawRect(ctx, 19, 22, 2, 5, '#e2e8f0');
  drawRect(ctx, 20, 23, 1, 4, '#ffffff'); // white shin plate
  drawRect(ctx, 18, 23, 1, 4, '#22c55e'); // green calf tracer
  setPixel(ctx, 18, 25, '#86efac');
  drawRect(ctx, 18, 27, 4, 2, '#334155'); // sleek foot
  drawRect(ctx, 18, 28, 4, 1, '#0f172a');
}

// -------------------------------------------------------------
// 3. VANGUARD TILE (32x32)
// -------------------------------------------------------------
function renderVanguard(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Grounding drop shadow
  ctx.fillStyle = 'rgba(2, 6, 18, 0.65)';
  ctx.beginPath();
  ctx.ellipse(16, 29, 9, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // High-Collar Armored Tactical Jacket (Collar wings rising at x: 7-10 & 21-24, y: 5-13)
  // Left collar wing (white outer, dark lining)
  drawRect(ctx, 8, 6, 4, 8, '#0f172a'); // collar shadow/inner
  drawRect(ctx, 7, 5, 4, 8, '#e2e8f0'); // collar plate
  drawRect(ctx, 7, 5, 3, 7, '#ffffff'); // white exterior
  drawRect(ctx, 7, 5, 1, 6, '#cbd5e1'); // edge bevel
  setPixel(ctx, 9, 8, '#ef4444'); // tactical crimson status diode on collar lapel
  setPixel(ctx, 9, 9, '#ef4444');

  // Right collar wing (white outer, dark lining)
  drawRect(ctx, 20, 6, 4, 8, '#0f172a');
  drawRect(ctx, 21, 5, 4, 8, '#e2e8f0');
  drawRect(ctx, 22, 5, 3, 7, '#ffffff');
  drawRect(ctx, 24, 5, 1, 6, '#cbd5e1');
  setPixel(ctx, 22, 8, '#38bdf8'); // cyan comms diode
  setPixel(ctx, 22, 9, '#0284c7');

  // Tactical Cybernetic Helm & Face (x: 12-19, y: 4-11)
  drawRect(ctx, 12, 5, 8, 6, '#0f172a'); // helm backing
  drawRect(ctx, 13, 4, 6, 6, '#334155'); // helm chassis
  drawRect(ctx, 14, 3, 4, 2, '#475569'); // helm crown
  drawRect(ctx, 14, 3, 4, 1, '#ffffff'); // white tactical crest ridge
  drawRect(ctx, 13, 6, 6, 4, '#94a3b8'); // cybernetic faceplate
  drawRect(ctx, 14, 7, 4, 3, '#cbd5e1');

  // Cheeks and chin seams
  setPixel(ctx, 13, 9, '#475569');
  setPixel(ctx, 18, 9, '#475569');
  drawRect(ctx, 14, 10, 4, 1, '#1e293b'); // chin guard

  // Piercing glowing bionic cyan eyes (y: 7, x: 14 & 17)
  setPixel(ctx, 14, 7, '#00f0ff');
  setPixel(ctx, 14, 8, '#ffffff');
  setPixel(ctx, 17, 7, '#00f0ff');
  setPixel(ctx, 17, 8, '#ffffff');

  // Armored Throat Cowl (y: 11-12, x: 14-17)
  drawRect(ctx, 14, 11, 4, 2, '#1e293b');
  drawRect(ctx, 15, 11, 2, 2, '#334155');

  // Tactical Armored Torso (x: 9-22, y: 12-19)
  drawRect(ctx, 10, 12, 12, 8, '#0f172a'); // base rig
  drawRect(ctx, 11, 13, 10, 6, '#1e293b');
  // White shoulder/chest harnesses
  drawRect(ctx, 10, 12, 3, 7, '#ffffff');
  drawRect(ctx, 10, 12, 3, 1, '#e2e8f0');
  drawRect(ctx, 19, 12, 3, 7, '#ffffff');
  drawRect(ctx, 19, 12, 3, 1, '#e2e8f0');
  // Center dark carbon breastplate
  drawRect(ctx, 13, 13, 6, 6, '#334155');
  drawRect(ctx, 14, 13, 4, 5, '#475569');

  // Tactical Glowing Cyan Reactor Core (centered at x: 15-16, y: 14-16)
  drawRect(ctx, 14, 14, 4, 3, '#0284c7');
  drawRect(ctx, 15, 14, 2, 3, '#38bdf8');
  setPixel(ctx, 15, 15, '#ffffff');
  setPixel(ctx, 16, 15, '#ffffff');
  setPixel(ctx, 14, 15, '#00f0ff');
  setPixel(ctx, 17, 15, '#00f0ff');

  // Arms & Gauntlets (x: 6-10 & 21-25, y: 12-21)
  // Left arm
  drawRect(ctx, 6, 12, 4, 8, '#0f172a');
  drawRect(ctx, 6, 13, 3, 4, '#ffffff'); // white shoulder pad
  drawRect(ctx, 6, 17, 3, 4, '#334155'); // gauntlet
  setPixel(ctx, 7, 19, '#00f0ff'); // wrist status diode
  setPixel(ctx, 6, 21, '#1e293b'); // clenched combat fist
  setPixel(ctx, 7, 21, '#475569');

  // Right arm
  drawRect(ctx, 22, 12, 4, 8, '#0f172a');
  drawRect(ctx, 23, 13, 3, 4, '#ffffff'); // white shoulder pad
  drawRect(ctx, 23, 17, 3, 4, '#334155'); // gauntlet
  setPixel(ctx, 24, 19, '#00f0ff'); // wrist status diode
  setPixel(ctx, 25, 21, '#1e293b');
  setPixel(ctx, 24, 21, '#475569');

  // Combat Utility Belt (x: 10-21, y: 19-21)
  drawRect(ctx, 11, 19, 10, 2, '#0f172a');
  drawRect(ctx, 12, 19, 8, 2, '#334155');
  drawRect(ctx, 15, 19, 2, 2, '#64748b'); // buckle
  setPixel(ctx, 12, 20, '#f97316'); // ammo/firmware pouch indicator

  // Angular Combat Legs & Greaves (x: 9-13 & 18-22, y: 21-29)
  // Left leg
  drawRect(ctx, 9, 21, 5, 8, '#0f172a');
  drawRect(ctx, 10, 21, 3, 5, '#1e293b'); // combat trousers
  drawRect(ctx, 10, 23, 3, 2, '#475569'); // knee plate
  drawRect(ctx, 9, 25, 4, 3, '#334155'); // greave
  drawRect(ctx, 9, 25, 1, 3, '#ffffff'); // outer white strut
  setPixel(ctx, 11, 27, '#00f0ff'); // boot light
  drawRect(ctx, 8, 27, 5, 2, '#1e293b'); // boot sole
  drawRect(ctx, 8, 28, 5, 1, '#0f172a');

  // Right leg
  drawRect(ctx, 18, 21, 5, 8, '#0f172a');
  drawRect(ctx, 19, 21, 3, 5, '#1e293b');
  drawRect(ctx, 19, 23, 3, 2, '#475569'); // knee plate
  drawRect(ctx, 19, 25, 4, 3, '#334155'); // greave
  drawRect(ctx, 22, 25, 1, 3, '#ffffff'); // outer white strut
  setPixel(ctx, 20, 27, '#00f0ff'); // boot light
  drawRect(ctx, 19, 27, 5, 2, '#1e293b'); // boot sole
  drawRect(ctx, 19, 28, 5, 1, '#0f172a');
}

// -------------------------------------------------------------
// 4. MULTI-VIEW INSPECTION SHEET GENERATOR (600x300)
// -------------------------------------------------------------
async function generateInspectionSheet(tileCanvas, frameKey, floorImg) {
  const sheet = createCanvas(600, 300);
  const sCtx = sheet.getContext('2d');
  sCtx.imageSmoothingEnabled = false;

  // Background
  sCtx.fillStyle = '#04060e';
  sCtx.fillRect(0, 0, 600, 300);

  // Subtle grid lines in background
  sCtx.strokeStyle = 'rgba(16, 26, 50, 0.4)';
  sCtx.lineWidth = 1;
  for (let x = 0; x < 600; x += 16) {
    sCtx.beginPath();
    sCtx.moveTo(x, 0);
    sCtx.lineTo(x, 300);
    sCtx.stroke();
  }
  for (let y = 0; y < 300; y += 16) {
    sCtx.beginPath();
    sCtx.moveTo(0, y);
    sCtx.lineTo(600, y);
    sCtx.stroke();
  }

  // --- PANEL 1: LEFT 8X ZOOM (256x256 at x:20, y:22) ---
  const p1X = 20, p1Y = 22, p1W = 256, p1H = 256;
  // Checkerboard for alpha transparency inspection (#080c1e and #0c122b)
  const checkSize = 16;
  for (let cy = 0; cy < p1H; cy += checkSize) {
    for (let cx = 0; cx < p1W; cx += checkSize) {
      const isAlt = ((cx / checkSize) + (cy / checkSize)) % 2 === 0;
      sCtx.fillStyle = isAlt ? '#080c1e' : '#0c122b';
      sCtx.fillRect(p1X + cx, p1Y + cy, checkSize, checkSize);
    }
  }
  // Draw 8x magnified tile
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p1X, p1Y, p1W, p1H);
  // Border box (cyan)
  sCtx.strokeStyle = '#00f0ff';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p1X - 0.5, p1Y - 0.5, p1W + 1, p1H + 1);

  // --- PANEL 2: TOP CENTER 3x3 CONTEXT GRID (192x192 at x:300, y:22) ---
  const p2X = 300, p2Y = 22, p2W = 192, p2H = 192;
  // 3x3 floor grid at 2x scale (64x64 each tile)
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      sCtx.drawImage(floorImg, 0, 0, 32, 32, p2X + gx * 64, p2Y + gy * 64, 64, 64);
    }
  }
  // Composite shell sprite at center (1, 1)
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p2X + 64, p2Y + 64, 64, 64);
  // Border box (cobalt blue)
  sCtx.strokeStyle = '#2563eb';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p2X - 0.5, p2Y - 0.5, p2W + 1, p2H + 1);

  // --- PANEL 3: BOTTOM CENTER 1x3 FOV ALPHA CHECK (192x64 at x:300, y:224) ---
  const p3X = 300, p3Y = 224, p3W = 192, p3H = 64;
  // 3 floor tiles
  for (let gx = 0; gx < 3; gx++) {
    sCtx.drawImage(floorImg, 0, 0, 32, 32, p3X + gx * 64, p3Y, 64, 64);
  }
  // Left: Active FOV (alpha = 1.0)
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p3X + 8, p3Y, 64, 64);

  // Right: Explored / Fog of War (alpha = 0.3)
  sCtx.save();
  sCtx.globalAlpha = 0.3;
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p3X + 120, p3Y, 64, 64);
  sCtx.restore();

  // Border box (cyan)
  sCtx.strokeStyle = '#00f0ff';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p3X - 0.5, p3Y - 0.5, p3W + 1, p3H + 1);

  // --- PANEL 4: TOP RIGHT 1:1 TRUE SIZE (32x32 at x:530, y:22) ---
  const p4X = 530, p4Y = 22, p4W = 32, p4H = 32;
  // Floor backing
  sCtx.drawImage(floorImg, 0, 0, 32, 32, p4X, p4Y, p4W, p4H);
  // Entity sprite
  sCtx.drawImage(tileCanvas, 0, 0, 32, 32, p4X, p4Y, p4W, p4H);
  // Border box
  sCtx.strokeStyle = '#38bdf8';
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p4X - 0.5, p4Y - 0.5, p4W + 1, p4H + 1);

  return sheet;
}

// -------------------------------------------------------------
// MAIN EXECUTION
// -------------------------------------------------------------
async function main() {
  const floorPath = path.resolve(__dirname, '../public/assets/tiles/floor.png');
  const floorImg = await loadImage(floorPath);

  const tiles = [
    { key: 'player_bastion', alias: 'bastion-v1', render: renderBastion, title: 'Bastion Shell', x: 0, y: 224 },
    { key: 'player_ghost', alias: 'ghost-v1', render: renderGhost, title: 'Ghost Shell', x: 32, y: 224 },
    { key: 'player_vanguard', alias: 'vanguard-v1', render: renderVanguard, title: 'Vanguard Shell', x: 64, y: 224 },
  ];

  const generatedCanvases = new Map();

  for (const t of tiles) {
    console.log(`Generating tile: ${t.key}...`);
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    t.render(ctx);
    generatedCanvases.set(t.key, canvas);

    const tileBuf = canvas.toBuffer('image/png');
    const tileOutPath = path.resolve(__dirname, `../public/assets/tiles/${t.key}.png`);
    fs.writeFileSync(tileOutPath, tileBuf);
    console.log(`Saved ${tileOutPath} (${tileBuf.length} bytes)`);

    console.log(`Generating inspection preview: ${t.key}_sheet...`);
    const previewCanvas = await generateInspectionSheet(canvas, t.key, floorImg);
    const previewBuf = previewCanvas.toBuffer('image/png');
    const previewOutPath = path.resolve(__dirname, `../public/assets/tiles/previews/${t.key}_sheet.png`);
    fs.writeFileSync(previewOutPath, previewBuf);
    console.log(`Saved ${previewOutPath} (${previewBuf.length} bytes)`);
  }

  // Composite generated tiles into master tileset
  const tilesetPaths = [
    path.resolve(__dirname, '../public/assets/tileset.png'),
    path.resolve(__dirname, '../public/assets/tiles/tileset.png'),
  ];
  const tilesetJsonPath = path.resolve(__dirname, '../public/assets/tileset.json');

  console.log(`Compositing shell tiles into master tileset: ${tilesetPaths[0]}...`);
  const masterTileset = await loadImage(tilesetPaths[0]);
  const sheetCanvas = createCanvas(masterTileset.width, masterTileset.height);
  const sheetCtx = sheetCanvas.getContext('2d');
  sheetCtx.imageSmoothingEnabled = false;
  sheetCtx.drawImage(masterTileset, 0, 0);

  for (const t of tiles) {
    const tileCanvas = generatedCanvases.get(t.key);
    sheetCtx.clearRect(t.x, t.y, 32, 32);
    sheetCtx.drawImage(tileCanvas, t.x, t.y, 32, 32);
  }

  const masterBuf = sheetCanvas.toBuffer('image/png');
  for (const tp of tilesetPaths) {
    fs.writeFileSync(tp, masterBuf);
    console.log(`Saved composite tileset to ${tp}`);
  }

  const jsonRaw = fs.readFileSync(tilesetJsonPath, 'utf-8');
  const tilesetJson = JSON.parse(jsonRaw);
  for (const t of tiles) {
    const frameData = {
      frame: { x: t.x, y: t.y, w: 32, h: 32 },
      sourceSize: { w: 32, h: 32 },
      spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
    };
    tilesetJson.frames[t.key] = frameData;
    if (t.alias) {
      tilesetJson.frames[t.alias] = frameData;
    }
  }
  fs.writeFileSync(tilesetJsonPath, JSON.stringify(tilesetJson, null, 2) + '\n');
  console.log(`Updated ${tilesetJsonPath} with shell frames and aliases.`);

  console.log('All 3 shell tiles and preview sheets successfully generated!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
