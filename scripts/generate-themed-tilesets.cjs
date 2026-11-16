const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { compileAtlasSurfaces } = require('./lib/surface-compiler.cjs');

// Helper to convert RGB to HSL and back for intelligent palette mapping
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Drawing utility functions
function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ============================================================================
// THEME 1: TRAXUS INDUSTRIAL FOUNDRY / THERMAL SURGE
// ============================================================================

function renderTraxusFloor(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  // Base dark charcoal cast-iron plate
  drawRect(ctx, 0, 0, 32, 32, '#181210');

  // Recessed sub-deck seams with molten heat conduits (seamless at 0/31 boundaries)
  // Cross seams at x=8, 24 and y=8, 24
  drawRect(ctx, 0, 8, 32, 1, '#2c1912');
  drawRect(ctx, 0, 24, 32, 1, '#2c1912');
  drawRect(ctx, 8, 0, 1, 32, '#2c1912');
  drawRect(ctx, 24, 0, 1, 32, '#2c1912');

  // Molten thermal micro-channels in recessed channels
  drawRect(ctx, 2, 8, 4, 1, '#9a3412');
  drawRect(ctx, 10, 8, 12, 1, '#c2410c');
  drawRect(ctx, 14, 8, 4, 1, '#ea580c');
  setPixel(ctx, 16, 8, '#f97316');

  drawRect(ctx, 2, 24, 4, 1, '#9a3412');
  drawRect(ctx, 10, 24, 12, 1, '#c2410c');
  drawRect(ctx, 14, 24, 4, 1, '#ea580c');
  setPixel(ctx, 16, 24, '#f97316');

  drawRect(ctx, 8, 10, 1, 12, '#c2410c');
  drawRect(ctx, 8, 14, 1, 4, '#ea580c');
  setPixel(ctx, 8, 16, '#f97316');

  drawRect(ctx, 24, 10, 1, 12, '#c2410c');
  drawRect(ctx, 24, 14, 1, 4, '#ea580c');
  setPixel(ctx, 24, 16, '#f97316');

  // Cast iron diamond plate tread texture in panels
  const panelOffsets = [
    [10, 10], [18, 10], [10, 18], [18, 18]
  ];
  for (const [px, py] of panelOffsets) {
    drawRect(ctx, px, py, 4, 4, '#241a15');
    drawRect(ctx, px + 1, py + 1, 2, 2, '#33231c');
    setPixel(ctx, px + 1, py + 1, '#452f26'); // Tread specular ridge
  }

  // Heavy steel hex corner bolts
  const bolts = [
    [7, 7], [9, 7], [7, 9], [9, 9],
    [23, 7], [25, 7], [23, 9], [25, 9],
    [7, 23], [9, 23], [7, 25], [9, 25],
    [23, 23], [25, 23], [23, 25], [25, 25],
  ];
  for (const [bx, by] of bolts) {
    setPixel(ctx, bx, by, '#78350f');
  }

  // Molten glow intersection bleed at (8,8), (24,8), (8,24), (24,24)
  const joints = [[8, 8], [24, 8], [8, 24], [24, 24]];
  for (const [jx, jy] of joints) {
    setPixel(ctx, jx, jy, '#ffedd5');
    setPixel(ctx, jx - 1, jy, '#ea580c');
    setPixel(ctx, jx + 1, jy, '#ea580c');
    setPixel(ctx, jx, jy - 1, '#ea580c');
    setPixel(ctx, jx, jy + 1, '#ea580c');
  }
}

function renderTraxusWall(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Lower vertical shadow skirt
  drawRect(ctx, 0, 24, 32, 8, '#140c09');
  drawRect(ctx, 0, 28, 32, 4, '#0d0705');

  // Upper blast bulkhead face
  drawRect(ctx, 0, 0, 32, 24, '#261914');

  // Top roof cap (elevated 3/4 perspective)
  drawRect(ctx, 0, 0, 32, 8, '#3d261e');
  drawRect(ctx, 0, 0, 32, 1, '#523429'); // Top bevel edge
  drawRect(ctx, 0, 1, 32, 1, '#784c3d'); // High specular highlight

  // Traxus Black/Yellow Hazard Chevron band on upper front edge (y: 6-10)
  drawRect(ctx, 0, 6, 32, 5, '#140c09');
  for (let x = -8; x < 36; x += 8) {
    // Angled diagonal hazard stripe
    for (let dy = 0; dy < 5; dy++) {
      const hx = x + dy;
      if (hx >= 0 && hx < 32) setPixel(ctx, hx, 6 + dy, '#eab308');
      if (hx + 1 >= 0 && hx + 1 < 32) setPixel(ctx, hx + 1, 6 + dy, '#facc15');
      if (hx + 2 >= 0 && hx + 2 < 32) setPixel(ctx, hx + 2, 6 + dy, '#ca8a04');
    }
  }

  // Front lip bright specular highlight
  drawRect(ctx, 0, 11, 32, 1, '#ff9500'); // Blazing molten rim highlight
  drawRect(ctx, 0, 12, 32, 1, '#9a3412');

  // Bulkhead vertical panel ribs and heat louvers
  drawRect(ctx, 6, 13, 2, 11, '#1c120e');
  drawRect(ctx, 15, 13, 2, 11, '#1c120e');
  drawRect(ctx, 24, 13, 2, 11, '#1c120e');

  // Glowing thermal dissipation vents
  for (let vy = 15; vy <= 21; vy += 2) {
    drawRect(ctx, 9, vy, 5, 1, '#ea580c');
    drawRect(ctx, 18, vy, 5, 1, '#ea580c');
    setPixel(ctx, 11, vy, '#ffedd5');
    setPixel(ctx, 20, vy, '#ffedd5');
  }

  // Heavy hex bolt studs on skirt
  setPixel(ctx, 3, 26, '#a8a29e');
  setPixel(ctx, 12, 26, '#a8a29e');
  setPixel(ctx, 21, 26, '#a8a29e');
  setPixel(ctx, 29, 26, '#a8a29e');
}

function renderTraxusDoor(ctx) {
  // Threshold floor base
  renderTraxusFloor(ctx);

  // Left & Right Heavy Foundry Door Jambs
  drawRect(ctx, 0, 0, 7, 32, '#261914');
  drawRect(ctx, 25, 0, 7, 32, '#261914');
  drawRect(ctx, 0, 0, 7, 1, '#784c3d');
  drawRect(ctx, 25, 0, 7, 1, '#784c3d');

  // Jamb inner shadow bevels
  drawRect(ctx, 6, 0, 1, 32, '#140c09');
  drawRect(ctx, 25, 0, 1, 32, '#140c09');

  // Jamb hazard stripes
  for (let jy = 4; jy <= 24; jy += 6) {
    drawRect(ctx, 1, jy, 4, 2, '#eab308');
    drawRect(ctx, 26, jy, 4, 2, '#eab308');
  }

  // Top lintel arch
  drawRect(ctx, 7, 0, 18, 6, '#261914');
  drawRect(ctx, 7, 0, 18, 1, '#784c3d');
  drawRect(ctx, 7, 5, 18, 1, '#140c09');

  // Blazing Molten Laser Containment Barrier (y: 14-18)
  drawRect(ctx, 6, 14, 20, 5, 'rgba(234, 88, 12, 0.4)');
  drawRect(ctx, 7, 15, 18, 3, '#ea580c');
  drawRect(ctx, 7, 16, 18, 1, '#f97316');
  drawRect(ctx, 10, 16, 12, 1, '#ffffff'); // White hot plasma laser core

  // Emergency flashing beacon on top lintel
  drawRect(ctx, 14, 1, 4, 3, '#7c2d12');
  drawRect(ctx, 15, 2, 2, 2, '#ea580c');
  setPixel(ctx, 15, 2, '#ffffff');
}

// ============================================================================
// THEME 2: SEKIGUCHI BIO-CONTAINMENT LABS / CRYO-VIVARIUM
// ============================================================================

function renderSekiguchiFloor(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  // Sterile titanium cleanroom bone-white & teal base
  drawRect(ctx, 0, 0, 32, 32, '#062024');

  // Anti-static hexagonal cleanroom tiles (seamless across boundaries)
  // Cleanroom porcelain panels
  drawRect(ctx, 2, 2, 12, 12, '#082f35');
  drawRect(ctx, 18, 2, 12, 12, '#082f35');
  drawRect(ctx, 2, 18, 12, 12, '#082f35');
  drawRect(ctx, 18, 18, 12, 12, '#082f35');

  // Panel inner sheen
  drawRect(ctx, 3, 3, 10, 10, '#0a3d46');
  drawRect(ctx, 19, 3, 10, 10, '#0a3d46');
  drawRect(ctx, 3, 19, 10, 10, '#0a3d46');
  drawRect(ctx, 19, 19, 10, 10, '#0a3d46');

  // Bioluminescent Emerald Nanite Micro-Conduits in floor seams
  drawRect(ctx, 0, 15, 32, 2, '#04181b');
  drawRect(ctx, 15, 0, 2, 32, '#04181b');

  // Luminous emerald green nanite channels
  drawRect(ctx, 0, 15, 32, 1, '#059669');
  drawRect(ctx, 15, 0, 1, 32, '#059669');
  drawRect(ctx, 4, 15, 8, 1, '#10b981');
  drawRect(ctx, 20, 15, 8, 1, '#10b981');
  drawRect(ctx, 15, 4, 1, 8, '#10b981');
  drawRect(ctx, 15, 20, 1, 8, '#10b981');

  // Central Nanite Hub Diode at (15, 15)
  drawRect(ctx, 14, 14, 4, 4, '#064e3b');
  drawRect(ctx, 15, 15, 2, 2, '#34d399');
  setPixel(ctx, 15, 15, '#ffffff');

  // Sub-nanite node pings in each tile center
  setPixel(ctx, 8, 8, '#34d399');
  setPixel(ctx, 24, 8, '#34d399');
  setPixel(ctx, 8, 24, '#34d399');
  setPixel(ctx, 24, 24, '#34d399');

  // Red medical reference dot at corner
  setPixel(ctx, 7, 7, '#ef4444');
  setPixel(ctx, 23, 7, '#ef4444');
  setPixel(ctx, 7, 23, '#ef4444');
  setPixel(ctx, 23, 23, '#ef4444');
}

function renderSekiguchiWall(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Lower clinical shadow skirt
  drawRect(ctx, 0, 24, 32, 8, '#04171a');
  drawRect(ctx, 0, 28, 32, 4, '#020d0f');

  // Upper sterile bulkhead casing (porcelain white & surgical titanium)
  drawRect(ctx, 0, 0, 32, 24, '#1e293b');

  // Top roof cap (elevated 3/4 perspective)
  drawRect(ctx, 0, 0, 32, 8, '#cbd5e1');
  drawRect(ctx, 0, 0, 32, 1, '#e2e8f0'); // Top bevel edge
  drawRect(ctx, 0, 1, 32, 1, '#ffffff'); // Highest specular highlight

  // Cleanroom porcelain faceplate panels (y: 8-23)
  drawRect(ctx, 2, 8, 28, 15, '#f8fafc');
  drawRect(ctx, 3, 9, 26, 13, '#e2e8f0');

  // Horizontal sterile emerald laser seal (y: 7)
  drawRect(ctx, 0, 7, 32, 1, '#059669');
  drawRect(ctx, 0, 8, 32, 1, '#10b981');
  drawRect(ctx, 6, 8, 20, 1, '#6ee7b7'); // Specular mint highlight

  // Vertical Bioluminescent Nanite Coolant Tubes (x: 7-9 & 22-24)
  drawRect(ctx, 7, 9, 3, 14, '#042f2e');
  drawRect(ctx, 8, 9, 1, 14, '#10b981');
  setPixel(ctx, 8, 13, '#6ee7b7');
  setPixel(ctx, 8, 17, '#a7f3d0');
  setPixel(ctx, 8, 21, '#ffffff');

  drawRect(ctx, 22, 9, 3, 14, '#042f2e');
  drawRect(ctx, 23, 9, 1, 14, '#10b981');
  setPixel(ctx, 23, 13, '#6ee7b7');
  setPixel(ctx, 23, 17, '#a7f3d0');
  setPixel(ctx, 23, 21, '#ffffff');

  // Center Sekiguchi Medical Cross Emblem (x: 14-17, y: 13-17)
  drawRect(ctx, 14, 13, 4, 5, '#ef4444');
  drawRect(ctx, 15, 12, 2, 7, '#ef4444');
  drawRect(ctx, 15, 14, 2, 3, '#ffffff');

  // Bottom sanitary seal strip
  drawRect(ctx, 0, 23, 32, 1, '#059669');
}

function renderSekiguchiDoor(ctx) {
  // Threshold floor base
  renderSekiguchiFloor(ctx);

  // Left & Right Porcelain Cleanroom Jambs
  drawRect(ctx, 0, 0, 7, 32, '#cbd5e1');
  drawRect(ctx, 25, 0, 7, 32, '#cbd5e1');
  drawRect(ctx, 1, 1, 5, 30, '#f8fafc');
  drawRect(ctx, 26, 1, 5, 30, '#f8fafc');

  // Jamb inner shadow bevels
  drawRect(ctx, 6, 0, 1, 32, '#04171a');
  drawRect(ctx, 25, 0, 1, 32, '#04171a');

  // Vertical emerald laser status lines on jambs
  drawRect(ctx, 3, 6, 1, 20, '#10b981');
  drawRect(ctx, 28, 6, 1, 20, '#10b981');

  // Top lintel arch
  drawRect(ctx, 7, 0, 18, 6, '#cbd5e1');
  drawRect(ctx, 8, 1, 16, 4, '#f8fafc');
  drawRect(ctx, 7, 5, 18, 1, '#059669');

  // Sekiguchi Red Cross on lintel
  drawRect(ctx, 14, 1, 4, 4, '#ef4444');
  drawRect(ctx, 15, 0, 2, 6, '#ef4444');
  drawRect(ctx, 15, 2, 2, 2, '#ffffff');

  // Luminous Emerald Decontamination Laser Barrier (y: 14-18)
  drawRect(ctx, 6, 14, 20, 5, 'rgba(16, 185, 129, 0.4)');
  drawRect(ctx, 7, 15, 18, 3, '#059669');
  drawRect(ctx, 7, 16, 18, 1, '#10b981');
  drawRect(ctx, 10, 16, 12, 1, '#ffffff'); // Intense decontamination beam core
}

// ============================================================================
// THEME 3: DARK SUBNET / OVERCLOCKED QUANTUM GRID
// ============================================================================

function renderSubnetFloor(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  // Pitch black / deep indigo obsidian logic substrate
  drawRect(ctx, 0, 0, 32, 32, '#050713');

  // High-density printed circuit board (PCB) micro-bus traces
  // Recessed dark violet grid
  drawRect(ctx, 0, 8, 32, 1, '#1e1138');
  drawRect(ctx, 0, 24, 32, 1, '#1e1138');
  drawRect(ctx, 8, 0, 1, 32, '#1e1138');
  drawRect(ctx, 24, 0, 1, 32, '#1e1138');

  // Pulsing electric cyan & ultraviolet bus conduits
  drawRect(ctx, 2, 8, 6, 1, '#0284c7');
  drawRect(ctx, 10, 8, 12, 1, '#00f0ff');
  setPixel(ctx, 15, 8, '#ffffff');
  drawRect(ctx, 26, 8, 4, 1, '#0284c7');

  drawRect(ctx, 2, 24, 6, 1, '#0284c7');
  drawRect(ctx, 10, 24, 12, 1, '#00f0ff');
  setPixel(ctx, 15, 24, '#ffffff');
  drawRect(ctx, 26, 24, 4, 1, '#0284c7');

  drawRect(ctx, 8, 2, 1, 6, '#7e22ce');
  drawRect(ctx, 8, 10, 1, 12, '#a855f7');
  setPixel(ctx, 8, 15, '#f472b6');
  drawRect(ctx, 8, 26, 1, 4, '#7e22ce');

  drawRect(ctx, 24, 2, 1, 6, '#7e22ce');
  drawRect(ctx, 24, 10, 1, 12, '#a855f7');
  setPixel(ctx, 24, 15, '#f472b6');
  drawRect(ctx, 24, 26, 1, 4, '#7e22ce');

  // Center silicon wafer die (x: 11-20, y: 11-20)
  drawRect(ctx, 11, 11, 10, 10, '#0c0a22');
  drawRect(ctx, 12, 12, 8, 8, '#131138');
  drawRect(ctx, 14, 14, 4, 4, '#3b0764');
  setPixel(ctx, 15, 15, '#00f0ff');
  setPixel(ctx, 16, 15, '#ec4899');
  setPixel(ctx, 15, 16, '#a855f7');
  setPixel(ctx, 16, 16, '#ffffff');

  // Diagonal micro-bus gold contacts
  setPixel(ctx, 3, 3, '#eab308');
  setPixel(ctx, 28, 3, '#eab308');
  setPixel(ctx, 3, 28, '#eab308');
  setPixel(ctx, 28, 28, '#eab308');

  // Glowing optical quantum intersection nodes
  const nodes = [[8, 8], [24, 8], [8, 24], [24, 24]];
  for (const [nx, ny] of nodes) {
    setPixel(ctx, nx, ny, '#ffffff');
    setPixel(ctx, nx - 1, ny, '#00f0ff');
    setPixel(ctx, nx + 1, ny, '#00f0ff');
    setPixel(ctx, nx, ny - 1, '#ec4899');
    setPixel(ctx, nx, ny + 1, '#ec4899');
  }
}

function renderSubnetWall(ctx) {
  ctx.clearRect(0, 0, 32, 32);

  // Lower void shadow skirt
  drawRect(ctx, 0, 24, 32, 8, '#03040c');
  drawRect(ctx, 0, 28, 32, 4, '#010206');

  // Mainframe Server Rack Bulkhead (Obsidian & Deep Indigo)
  drawRect(ctx, 0, 0, 32, 24, '#0d0e24');

  // Top roof cap (elevated 3/4 perspective)
  drawRect(ctx, 0, 0, 32, 8, '#1e1b4b');
  drawRect(ctx, 0, 0, 32, 1, '#312e81');
  drawRect(ctx, 0, 1, 32, 1, '#818cf8'); // Electric violet specular ridge

  // Electric cyan laser rim edge (y: 7-8)
  drawRect(ctx, 0, 7, 32, 1, '#0284c7');
  drawRect(ctx, 0, 8, 32, 1, '#00f0ff'); // Blazing neon cyan front lip
  drawRect(ctx, 8, 8, 16, 1, '#ffffff');

  // Server rack modules / drive bays (y: 10-23)
  drawRect(ctx, 2, 10, 28, 13, '#080a18');

  // Rack slot divisions
  for (let ry = 10; ry <= 22; ry += 3) {
    drawRect(ctx, 3, ry, 26, 2, '#111827');
    // Blinking optical memory address LEDs (cyan, violet, magenta)
    setPixel(ctx, 5, ry, '#00f0ff');
    setPixel(ctx, 7, ry, '#a855f7');
    setPixel(ctx, 9, ry, '#ec4899');
    setPixel(ctx, 11, ry, '#00f0ff');

    // Optical data bus lines
    drawRect(ctx, 14, ry, 13, 1, '#1e1b4b');
    setPixel(ctx, 18, ry, '#38bdf8');
    setPixel(ctx, 23, ry, '#c084fc');
  }

  // Vertical Quantum Cooling Fins on Left and Right
  drawRect(ctx, 1, 9, 1, 14, '#6366f1');
  drawRect(ctx, 30, 9, 1, 14, '#6366f1');

  // Bottom high-voltage conduit line
  drawRect(ctx, 0, 23, 32, 1, '#ec4899');
}

function renderSubnetDoor(ctx) {
  // Threshold floor base
  renderSubnetFloor(ctx);

  // Left & Right Quantum Emitter Jambs
  drawRect(ctx, 0, 0, 7, 32, '#0d0e24');
  drawRect(ctx, 25, 0, 7, 32, '#0d0e24');
  drawRect(ctx, 0, 0, 7, 1, '#818cf8');
  drawRect(ctx, 25, 0, 7, 1, '#818cf8');

  // Jamb inner shadow bevels
  drawRect(ctx, 6, 0, 1, 32, '#020308');
  drawRect(ctx, 25, 0, 1, 32, '#020308');

  // Vertical laser emitter rails on jambs
  drawRect(ctx, 3, 4, 2, 24, '#3b0764');
  drawRect(ctx, 3, 6, 2, 20, '#a855f7');
  setPixel(ctx, 3, 10, '#ec4899');
  setPixel(ctx, 3, 18, '#ec4899');
  drawRect(ctx, 27, 4, 2, 24, '#3b0764');
  drawRect(ctx, 27, 6, 2, 20, '#a855f7');
  setPixel(ctx, 27, 10, '#ec4899');
  setPixel(ctx, 27, 18, '#ec4899');

  // Top lintel arch
  drawRect(ctx, 7, 0, 18, 6, '#0d0e24');
  drawRect(ctx, 7, 0, 18, 1, '#818cf8');
  drawRect(ctx, 7, 5, 18, 1, '#00f0ff');

  // Central Holographic Quantum Core on Lintel
  drawRect(ctx, 14, 1, 4, 4, '#581c87');
  drawRect(ctx, 15, 2, 2, 2, '#00f0ff');
  setPixel(ctx, 15, 2, '#ffffff');

  // Holographic Quantum Forcefield Barrier Beam (y: 14-18)
  drawRect(ctx, 6, 14, 20, 5, 'rgba(0, 240, 255, 0.45)');
  drawRect(ctx, 7, 15, 18, 3, '#7e22ce');
  drawRect(ctx, 7, 16, 18, 1, '#00f0ff');
  drawRect(ctx, 10, 16, 12, 1, '#ffffff'); // Blazing white/cyan singularity barrier beam
  setPixel(ctx, 9, 15, '#ec4899');
  setPixel(ctx, 22, 15, '#ec4899');
  setPixel(ctx, 12, 17, '#ec4899');
  setPixel(ctx, 19, 17, '#ec4899');
}

// ============================================================================
// SPRITE PALETTE RE-MAPPING ENGINE
// ============================================================================
// Intelligently maps base master sprites to the target biome/faction aesthetic

function recolorSprite(sourceCtx, destCtx, x, y, w, h, themeType) {
  const imgData = sourceCtx.getImageData(x, y, w, h);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    // Preserve drop shadows (very dark with partial alpha)
    if (a < 240 && r < 20 && g < 20 && b < 30) {
      destCtx.fillStyle = `rgba(5, 5, 12, ${a / 255})`;
      const px = (i / 4) % w;
      const py = Math.floor((i / 4) / w);
      destCtx.fillRect(x + px, y + py, 1, 1);
      continue;
    }

    const [hue, sat, lum] = rgbToHsl(r, g, b);
    let newR, newG, newB;

    if (themeType === 'traxus_foundry') {
      // Traxus Foundry: Cast-iron charcoal, amber, hazard yellow, molten orange/crimson
      // If it was white or specular
      if (lum > 0.85 && sat < 0.2) {
        // Specular highlight: white/pale amber
        [newR, newG, newB] = [255, Math.round(230 + (lum - 0.85) * 166), 200];
      } else if (sat < 0.15) {
        // Neutral greys: convert to weathered rust cast-iron
        const baseIron = [
          [24, 18, 16],
          [44, 28, 22],
          [68, 42, 32],
          [100, 64, 48],
          [140, 95, 75],
          [190, 140, 115]
        ];
        const idx = Math.min(baseIron.length - 1, Math.floor(lum * baseIron.length));
        [newR, newG, newB] = baseIron[idx];
      } else if (hue >= 0.45 && hue <= 0.65) {
        // Blue/cyan lights & displays: convert to molten orange/amber
        const orangeH = 0.08 + (lum * 0.04); // 0.08 is orange
        const orangeS = Math.min(1.0, sat * 1.2);
        [newR, newG, newB] = hslToRgb(orangeH, orangeS, Math.min(0.95, lum * 1.05));
      } else if (hue >= 0.25 && hue < 0.45) {
        // Greens: convert to Traxus hazard yellow / amber
        const yellowH = 0.12;
        [newR, newG, newB] = hslToRgb(yellowH, 0.95, lum);
      } else {
        // Reds/purples: enrich to intense furnace crimson
        const redH = 0.02;
        [newR, newG, newB] = hslToRgb(redH, Math.max(0.7, sat), lum);
      }
    } else if (themeType === 'sekiguchi_biolabs') {
      // Sekiguchi Bio-Labs: Sterile bone-white, clinical slate, bioluminescent emerald/mint
      if (lum > 0.8 && sat < 0.25) {
        // Keep pristine sterile white
        [newR, newG, newB] = [248, 250, 252];
      } else if (sat < 0.2) {
        // Greys: convert to surgical titanium slate with slight cool teal tint
        const slate = [
          [8, 24, 28],
          [16, 42, 48],
          [30, 60, 68],
          [71, 85, 105],
          [148, 163, 184],
          [226, 232, 240]
        ];
        const idx = Math.min(slate.length - 1, Math.floor(lum * slate.length));
        [newR, newG, newB] = slate[idx];
      } else if (hue >= 0.45 && hue <= 0.65) {
        // Blue/cyan: convert to glowing toxic emerald / mint green
        const mintH = 0.42; // Emerald mint
        [newR, newG, newB] = hslToRgb(mintH, Math.max(0.8, sat), Math.min(0.9, lum * 1.05));
      } else if (hue >= 0.05 && hue <= 0.20) {
        // Amber/yellow: convert to medical cross red or vivid mint
        if (lum > 0.6) {
          [newR, newG, newB] = hslToRgb(0.42, 0.9, lum);
        } else {
          [newR, newG, newB] = [239, 68, 68]; // Red
        }
      } else {
        // Keep medical reds crisp and vibrant
        [newR, newG, newB] = hslToRgb(0.98, 0.85, Math.max(0.4, lum));
      }
    } else if (themeType === 'dark_subnet') {
      // Dark Subnet: Deep pitch obsidian, electric neon cyan, quantum ultraviolet & magenta
      if (lum > 0.85 && sat < 0.2) {
        // Pure specular highlight: glowing electric cyan-white
        [newR, newG, newB] = [224, 242, 254];
      } else if (sat < 0.18) {
        // Neutral greys: convert to pitch obsidian & indigo server casing
        const obsidian = [
          [4, 6, 14],
          [11, 14, 28],
          [22, 22, 48],
          [40, 36, 78],
          [75, 70, 125],
          [140, 130, 195]
        ];
        const idx = Math.min(obsidian.length - 1, Math.floor(lum * obsidian.length));
        [newR, newG, newB] = obsidian[idx];
      } else if (hue >= 0.05 && hue <= 0.25) {
        // Yellow/orange/amber: convert to hot magenta / neon pink
        const pinkH = 0.92;
        [newR, newG, newB] = hslToRgb(pinkH, 0.9, lum);
      } else if (hue >= 0.25 && hue <= 0.45) {
        // Green: convert to electric neon cyan
        const cyanH = 0.52;
        [newR, newG, newB] = hslToRgb(cyanH, 0.95, lum);
      } else if (hue >= 0.45 && hue <= 0.70) {
        // Blue/cyan: hyper-saturate to quantum neon cyan (#00f0ff)
        const cyanH = 0.51;
        [newR, newG, newB] = hslToRgb(cyanH, 1.0, Math.min(0.85, lum * 1.1));
      } else {
        // Red/magenta: convert to electric violet / ultraviolet
        const violetH = 0.78;
        [newR, newG, newB] = hslToRgb(violetH, 0.9, Math.max(0.4, lum));
      }
    }

    const px = (i / 4) % w;
    const py = Math.floor((i / 4) / w);
    setPixel(destCtx, x + px, y + py, `rgba(${newR}, ${newG}, ${newB}, ${a / 255})`);
  }
}

// ============================================================================
// MASTER REVIEW INSPECTION SHEET (780x410)
// ============================================================================
async function generateThemedMasterSheet(
  tilesetCanvas,
  themedJson,
  themeName,
  themeTitle,
  themeAccentColor
) {
  const sheet = createCanvas(780, 410);
  const sCtx = sheet.getContext('2d');
  sCtx.imageSmoothingEnabled = false;

  const atlasW = tilesetCanvas.width;
  const atlasH = tilesetCanvas.height;
  const diffuseData = tilesetCanvas.getContext('2d').getImageData(0, 0, atlasW, atlasH).data;
  const surfaceBuffers = compileAtlasSurfaces(tilesetCanvas, themedJson, themeName);

  // Build helper offscreen canvases for _n and _m diagnostic views
  const makeDiagnosticCanvas = (mode) => {
    const c = createCanvas(atlasW, atlasH);
    const cCtx = c.getContext('2d');
    const imgData = cCtx.createImageData(atlasW, atlasH);
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (mode === 'normal') {
        imgData.data[i] = surfaceBuffers.normal[i];
        imgData.data[i + 1] = surfaceBuffers.normal[i + 1];
        imgData.data[i + 2] = surfaceBuffers.normal[i + 2];
        imgData.data[i + 3] = 255;
      } else {
        imgData.data[i] = surfaceBuffers.material[i];
        imgData.data[i + 1] = Math.round(surfaceBuffers.material[i + 1] * 0.45);
        imgData.data[i + 2] = surfaceBuffers.material[i + 3];
        imgData.data[i + 3] = 255;
      }
    }
    cCtx.putImageData(imgData, 0, 0);
    return c;
  };
  const normalAtlasCanvas = makeDiagnosticCanvas('normal');
  const materialAtlasCanvas = makeDiagnosticCanvas('material');

  // Dark background with subtle theme tint
  sCtx.fillStyle = '#05070d';
  sCtx.fillRect(0, 0, 780, 410);

  // Subtle background grid
  sCtx.strokeStyle = 'rgba(20, 30, 50, 0.35)';
  sCtx.lineWidth = 1;
  for (let x = 0; x < 780; x += 16) {
    sCtx.beginPath(); sCtx.moveTo(x, 0); sCtx.lineTo(x, 410); sCtx.stroke();
  }
  for (let y = 0; y < 410; y += 16) {
    sCtx.beginPath(); sCtx.moveTo(0, y); sCtx.lineTo(780, y); sCtx.stroke();
  }

  // --- HEADER TITLE BAR ---
  sCtx.fillStyle = themeAccentColor;
  sCtx.font = 'bold 13px monospace';
  sCtx.fillText(`[NIRMATA RUN] 4-VIEW G-BUFFER REVIEW // ${themeTitle.toUpperCase()}`, 24, 25);

  // Column Headers above panels
  sCtx.fillStyle = '#94a3b8';
  sCtx.font = '10px monospace';
  sCtx.fillText('1. ALBEDO   2. NORMAL (_n)', 24, 46);
  sCtx.fillText('3. MAT (_m) 4. UNLIT 9x9', 24, 198);
  sCtx.fillText('LIT 2.5D COMPOSITE (9x9 + SHADOW RAYMARCH)', 420, 46);

  const drawPanelBox = (px, py, size) => {
    sCtx.strokeStyle = themeAccentColor;
    sCtx.lineWidth = 1;
    sCtx.strokeRect(px - 0.5, py - 0.5, size + 1, size + 1);
  };

  // --- PANEL 1: UNLIT ALBEDO ATLAS (x: 24, y: 54, 132x132) ---
  const boxSize = 132;
  for (let cy = 0; cy < boxSize; cy += 11) {
    for (let cx = 0; cx < boxSize; cx += 11) {
      const isAlt = ((cx / 11) + (cy / 11)) % 2 === 0;
      sCtx.fillStyle = isAlt ? '#0a0d1c' : '#12162a';
      sCtx.fillRect(24 + cx, 54 + cy, 11, 11);
    }
  }
  sCtx.drawImage(tilesetCanvas, 0, 0, atlasW, atlasH, 24, 54, boxSize, boxSize);
  drawPanelBox(24, 54, boxSize);

  // --- PANEL 2: TANGENT NORMAL ATLAS (_n.png) (x: 174, y: 54, 132x132) ---
  sCtx.drawImage(normalAtlasCanvas, 0, 0, atlasW, atlasH, 174, 54, boxSize, boxSize);
  drawPanelBox(174, 54, boxSize);

  // --- PANEL 3: MATERIAL/HEIGHT ATLAS (_m.png) (x: 24, y: 206, 132x132) ---
  sCtx.drawImage(materialAtlasCanvas, 0, 0, atlasW, atlasH, 24, 206, boxSize, boxSize);
  drawPanelBox(24, 206, boxSize);

  // --- BUILD 288x288 MOCK DUNGEON ROOM G-BUFFER ---
  const roomW = 288;
  const roomH = 288;
  const roomDiff = new Uint8ClampedArray(roomW * roomH * 4);
  const roomNorm = new Uint8ClampedArray(roomW * roomH * 4);
  const roomMat = new Uint8ClampedArray(roomW * roomH * 4);

  const blitTile = (srcX, srcY, gridX, gridY) => {
    const dx0 = gridX * 32;
    const dy0 = gridY * 32;
    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < 32; px++) {
        const si = ((srcY + py) * atlasW + (srcX + px)) * 4;
        const a = diffuseData[si + 3];
        if (a < 10) continue;
        const di = ((dy0 + py) * roomW + (dx0 + px)) * 4;
        roomDiff[di] = diffuseData[si];
        roomDiff[di + 1] = diffuseData[si + 1];
        roomDiff[di + 2] = diffuseData[si + 2];
        roomDiff[di + 3] = 255;

        roomNorm[di] = surfaceBuffers.normal[si];
        roomNorm[di + 1] = surfaceBuffers.normal[si + 1];
        roomNorm[di + 2] = surfaceBuffers.normal[si + 2];
        roomNorm[di + 3] = surfaceBuffers.normal[si + 3];

        roomMat[di] = surfaceBuffers.material[si];
        roomMat[di + 1] = surfaceBuffers.material[si + 1];
        roomMat[di + 2] = surfaceBuffers.material[si + 2];
        roomMat[di + 3] = surfaceBuffers.material[si + 3];
      }
    }
  };

  for (let gy = 0; gy < 9; gy++) {
    for (let gx = 0; gx < 9; gx++) {
      blitTile(0, 0, gx, gy);
    }
  }
  for (let gx = 0; gx < 9; gx++) {
    blitTile(32, 0, gx, 0);
    blitTile(32, 0, gx, 8);
  }
  for (let gy = 1; gy < 8; gy++) {
    blitTile(32, 0, 0, gy);
    blitTile(32, 0, 8, gy);
  }
  blitTile(64, 0, 4, 0);
  blitTile(128, 0, 1, 2);
  blitTile(160, 0, 7, 2);
  blitTile(192, 0, 7, 5);
  blitTile(224, 0, 1, 5);
  blitTile(160, 32, 4, 7);
  blitTile(160, 64, 6, 6);
  blitTile(224, 64, 2, 6);
  blitTile(224, 32, 4, 2);
  blitTile(64, 64, 7, 7);
  blitTile(96, 64, 1, 7);
  blitTile(0, 64, 3, 5);
  blitTile(128, 96, 5, 5);
  blitTile(192, 96, 4, 6);
  blitTile(96, 0, 2, 3);
  blitTile(96, 32, 6, 3);
  blitTile(96, 96, 4, 4);
  blitTile(0, 224, 3, 4);

  // --- PANEL 4: UNLIT 9x9 MINI ROOM (x: 174, y: 206, 132x132) ---
  const unlitRoomCanvas = createCanvas(roomW, roomH);
  const uCtx = unlitRoomCanvas.getContext('2d');
  const uImg = uCtx.createImageData(roomW, roomH);
  uImg.data.set(roomDiff);
  uCtx.putImageData(uImg, 0, 0);
  sCtx.drawImage(unlitRoomCanvas, 0, 0, roomW, roomH, 174, 206, boxSize, boxSize);
  drawPanelBox(174, 206, boxSize);

  // --- RIGHT PANEL: LIT 2.5D COMPOSITE (9x9 @ 288x288 at x: 420, y: 56) ---
  const p2X = 420;
  const p2Y = 56;
  const litRoomCanvas = createCanvas(roomW, roomH);
  const lCtx = litRoomCanvas.getContext('2d');
  const litImg = lCtx.createImageData(roomW, roomH);

  // Simulated operative point light near center (3.5, 4.5) @ Lz = 22px
  const lx = 3.5 * 32 + 16;
  const ly = 4.5 * 32 + 16;
  const lz = 22;
  const radius = 175;
  const accentNorm = parseInt(themeAccentColor.slice(1), 16) || 0x00f0ff;
  const cr = 0.65 + (((accentNorm >> 16) & 255) / 255) * 0.45;
  const cg = 0.65 + (((accentNorm >> 8) & 255) / 255) * 0.45;
  const cb = 0.65 + ((accentNorm & 255) / 255) * 0.45;

  for (let py = 0; py < roomH; py++) {
    for (let px = 0; px < roomW; px++) {
      const i = (py * roomW + px) * 4;
      const ar = roomDiff[i] / 255;
      const ag = roomDiff[i + 1] / 255;
      const ab = roomDiff[i + 2] / 255;
      const nx = (roomNorm[i] / 255) * 2 - 1;
      const ny = (roomNorm[i + 1] / 255) * 2 - 1;
      const nz = Math.max(0.05, (roomNorm[i + 2] / 255) * 2 - 1);
      const spec = roomNorm[i + 3] / 255;
      const emissive = roomMat[i] / 255;
      const roughness = Math.max(0.08, roomMat[i + 2] / 255);
      const pz = (roomMat[i + 3] / 255) * 32;

      let outR = ar * 0.16;
      let outG = ag * 0.18;
      let outB = ab * 0.22;

      const dx = lx - px;
      const dy = ly - py;
      const dz = lz - pz;
      const d2 = Math.hypot(dx, dy);
      if (d2 < radius) {
        const d3 = Math.max(1, Math.hypot(d2, dz));
        const ndotl = Math.max(0, (nx * dx + ny * dy + nz * dz) / d3);
        const nd = d2 / radius;
        const win = Math.pow(Math.max(0, 1 - nd * nd), 2);
        const atten = (win / (1 + nd * nd * 3.5)) * 1.45;

        let shadow = 1.0;
        if (d2 > 3) {
          for (let s = 1; s <= 10; s++) {
            const t = s / 11;
            const sx = Math.round(px + dx * t);
            const sy = Math.round(py + dy * t);
            const si = (sy * roomW + sx) * 4;
            const occOp = roomMat[si + 1] / 255;
            const occZ = (roomMat[si + 3] / 255) * 32;
            const rayZ = pz + dz * t;
            if (occOp > 0.05 && occZ > rayZ + 0.65 && occZ > pz + 0.85) {
              shadow -= occOp * 0.62;
              if (shadow <= 0.08) {
                shadow = 0.08;
                break;
              }
            }
          }
        }

        const shininess = 48 + (6 - 48) * roughness;
        const hx = dx / d3;
        const hy = dy / d3;
        const hz = dz / d3 + 1;
        const hLen = Math.max(0.001, Math.hypot(hx, hy, hz));
        const ndoth = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
        const specPow = Math.pow(ndoth, shininess) * spec * 0.85;
        const f = atten * shadow;
        outR += (ar * ndotl + specPow) * cr * f;
        outG += (ag * ndotl + specPow) * cg * f;
        outB += (ab * ndotl + specPow) * cb * f;
      }

      outR += ar * emissive * 1.4;
      outG += ag * emissive * 1.4;
      outB += ab * emissive * 1.4;

      litImg.data[i] = Math.min(255, Math.round((outR / (1 + outR * 0.35)) * 255));
      litImg.data[i + 1] = Math.min(255, Math.round((outG / (1 + outG * 0.35)) * 255));
      litImg.data[i + 2] = Math.min(255, Math.round((outB / (1 + outB * 0.35)) * 255));
      litImg.data[i + 3] = 255;
    }
  }
  lCtx.putImageData(litImg, 0, 0);
  sCtx.drawImage(litRoomCanvas, p2X, p2Y);
  drawPanelBox(p2X, p2Y, roomW);

  // Subtitle under mock room
  sCtx.fillStyle = '#64748b';
  sCtx.font = '9px monospace';
  sCtx.fillText('Simulated Point Light @ Center: N·L Relief, Specular Glints & 2.5D Shadows', 420, 360);

  // Bottom caption (Spec §7.2.4)
  sCtx.fillStyle = '#94a3b8';
  sCtx.font = '10px monospace';
  sCtx.fillText('G-Buffer Verification: 1. Albedo | 2. Normal (_n.png) | 3. Material/Height (_m.png) | 4. Lit 2.5D Composite', 24, 386);

  return sheet;
}

// ============================================================================
// MAIN GENERATION SUITE
// ============================================================================
async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const baseTilesetPath = path.join(rootDir, 'public/assets/tileset.png');
  const baseJsonPath = path.join(rootDir, 'public/assets/tileset.json');

  console.log(`Loading master base tileset from ${baseTilesetPath}...`);
  const baseTilesetImg = await loadImage(baseTilesetPath);
  const baseJsonRaw = fs.readFileSync(baseJsonPath, 'utf-8');
  const baseJson = JSON.parse(baseJsonRaw);

  const baseCanvas = createCanvas(baseTilesetImg.width, baseTilesetImg.height);
  const baseCtx = baseCanvas.getContext('2d');
  baseCtx.drawImage(baseTilesetImg, 0, 0);

  const themes = [
    {
      id: 'traxus_foundry',
      filename: 'tileset_traxus_foundry.png',
      jsonFilename: 'tileset_traxus_foundry.json',
      previewFilename: 'tileset_traxus_foundry_sheet.png',
      title: 'Traxus Heavy Foundry // Thermal Surge',
      accentColor: '#f59e0b',
      renderFloor: renderTraxusFloor,
      renderWall: renderTraxusWall,
      renderDoor: renderTraxusDoor,
    },
    {
      id: 'sekiguchi_biolabs',
      filename: 'tileset_sekiguchi_biolabs.png',
      jsonFilename: 'tileset_sekiguchi_biolabs.json',
      previewFilename: 'tileset_sekiguchi_biolabs_sheet.png',
      title: 'Sekiguchi Gene-Labs // Cryo-Vivarium',
      accentColor: '#10b981',
      renderFloor: renderSekiguchiFloor,
      renderWall: renderSekiguchiWall,
      renderDoor: renderSekiguchiDoor,
    },
    {
      id: 'dark_subnet',
      filename: 'tileset_dark_subnet.png',
      jsonFilename: 'tileset_dark_subnet.json',
      previewFilename: 'tileset_dark_subnet_sheet.png',
      title: 'Dark Subnet // Overclocked Quantum Grid',
      accentColor: '#00f0ff',
      renderFloor: renderSubnetFloor,
      renderWall: renderSubnetWall,
      renderDoor: renderSubnetDoor,
    },
  ];

  for (const theme of themes) {
    console.log(`\n======================================================`);
    console.log(`Generating Themed Tileset: ${theme.title}`);
    console.log(`======================================================`);

    const themedCanvas = createCanvas(baseTilesetImg.width, baseTilesetImg.height);
    const themedCtx = themedCanvas.getContext('2d');
    themedCtx.imageSmoothingEnabled = false;

    // 1. Procedurally render core terrain tiles: floor, wall, door
    console.log(`- Rendering custom procedural floor, wall, and door tiles...`);
    const floorCanvas = createCanvas(32, 32);
    theme.renderFloor(floorCanvas.getContext('2d'));
    themedCtx.drawImage(floorCanvas, 0, 0); // (0, 0)

    const wallCanvas = createCanvas(32, 32);
    theme.renderWall(wallCanvas.getContext('2d'));
    themedCtx.drawImage(wallCanvas, 32, 0); // (32, 0)

    const doorCanvas = createCanvas(32, 32);
    theme.renderDoor(doorCanvas.getContext('2d'));
    themedCtx.drawImage(doorCanvas, 64, 0); // (64, 0)

    // 2. Intelligently recolor & adapt all remaining frames from base tileset
    console.log(`- Processing and adapting all entity, prop, item, and shell frames...`);
    const processedSlots = new Set(['0,0', '32,0', '64,0']);

    for (const [frameKey, frameDef] of Object.entries(baseJson.frames)) {
      const { x, y, w, h } = frameDef.frame;
      const slotKey = `${x},${y}`;
      if (processedSlots.has(slotKey)) continue;
      processedSlots.add(slotKey);

      recolorSprite(baseCtx, themedCtx, x, y, w, h, theme.id);
    }

    // 3. Save themed tileset PNG
    const outPngPath = path.join(rootDir, 'public/assets', theme.filename);
    const pngBuffer = themedCanvas.toBuffer('image/png');
    fs.writeFileSync(outPngPath, pngBuffer);
    console.log(`- Saved tileset image to ${outPngPath} (${pngBuffer.length} bytes)`);

    // Also place a copy in public/assets/tiles/ for consistency
    const altPngPath = path.join(rootDir, 'public/assets/tiles', theme.filename);
    fs.writeFileSync(altPngPath, pngBuffer);

    // 4. Save companion JSON manifest matching tileset.json
    const themedJson = JSON.parse(JSON.stringify(baseJson));
    themedJson.meta.image = theme.filename;
    themedJson.meta.themeId = theme.id;
    themedJson.meta.themeName = theme.title;
    const outJsonPath = path.join(rootDir, 'public/assets', theme.jsonFilename);
    fs.writeFileSync(outJsonPath, JSON.stringify(themedJson, null, 2) + '\n');
    console.log(`- Saved JSON manifest to ${outJsonPath}`);

    // 5. Generate and save master inspection preview sheet
    console.log(`- Generating master inspection preview sheet...`);
    const masterSheet = await generateThemedMasterSheet(
      themedCanvas,
      themedJson,
      theme.id,
      theme.title,
      theme.accentColor
    );
    const masterBuf = masterSheet.toBuffer('image/png');
    const previewDir = path.join(rootDir, 'docs/visual-design/previews');
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }
    const masterOutPath = path.join(previewDir, theme.previewFilename);
    fs.writeFileSync(masterOutPath, masterBuf);
    console.log(`- Saved inspection preview to ${masterOutPath} (${masterBuf.length} bytes)`);
  }

  console.log('\nAll 3 themed tilesets, JSON manifests, and review sheets successfully built!');
}

main().catch(err => {
  console.error('Fatal error during tileset generation:', err);
  process.exit(1);
});
