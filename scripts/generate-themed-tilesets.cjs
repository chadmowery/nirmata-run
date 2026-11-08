const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

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
async function generateThemedMasterSheet(tilesetCanvas, themeName, themeTitle, themeAccentColor) {
  const sheet = createCanvas(780, 410);
  const sCtx = sheet.getContext('2d');
  sCtx.imageSmoothingEnabled = false;

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
  sCtx.fillText(`[NIRMATA RUN] THEMED ATLAS REVIEW // ${themeTitle.toUpperCase()}`, 24, 25);

  // Column Headers above panels
  sCtx.fillStyle = '#94a3b8';
  sCtx.font = '10px monospace';
  sCtx.fillText(`SPRITESHEET ATLAS (${tilesetCanvas.width}x${tilesetCanvas.height} RGBA8888)`, 24, 46);
  sCtx.fillText('SECTOR GAMEPLAY MOCKUP (9x9 TILES)', 420, 46);

  // --- PANEL 1: LEFT ATLAS PREVIEW (x: 24, y: 56) ---
  const p1X = 24, p1Y = 56, p1W = 256, p1H = 256;
  // Checkerboard for alpha transparency inspection (#0a0d1c and #12162a)
  const checkSize = 16;
  for (let cy = 0; cy < p1H; cy += checkSize) {
    for (let cx = 0; cx < p1W; cx += checkSize) {
      const isAlt = ((cx / checkSize) + (cy / checkSize)) % 2 === 0;
      sCtx.fillStyle = isAlt ? '#0a0d1c' : '#12162a';
      sCtx.fillRect(p1X + cx, p1Y + cy, checkSize, checkSize);
    }
  }
  // Draw atlas
  sCtx.drawImage(tilesetCanvas, 0, 0, tilesetCanvas.width, tilesetCanvas.height, p1X, p1Y, p1W, p1H);
  // Border box
  sCtx.strokeStyle = themeAccentColor;
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p1X - 0.5, p1Y - 0.5, p1W + 1, p1H + 1);

  // Subtitle under Atlas
  sCtx.fillStyle = '#64748b';
  sCtx.font = '9px monospace';
  sCtx.fillText('TexturePacker JSON Hash | RGBA8888 Lossless PNG', 24, 330);

  // --- PANEL 2: RIGHT 288x288 MOCK DUNGEON ROOM (x: 420, y: 56) ---
  // A 9x9 room of 32x32 tiles (9*32 = 288 px)
  const p2X = 420, p2Y = 56;

  // Helper to draw a specific frame from the tileset into the mock room
  const drawTile = (srcX, srcY, gridX, gridY) => {
    sCtx.drawImage(tilesetCanvas, srcX, srcY, 32, 32, p2X + gridX * 32, p2Y + gridY * 32, 32, 32);
  };

  // 1. Draw floor everywhere first
  for (let gy = 0; gy < 9; gy++) {
    for (let gx = 0; gx < 9; gx++) {
      drawTile(0, 0, gx, gy); // floor at (0, 0)
    }
  }

  // 2. Draw surrounding walls
  for (let gx = 0; gx < 9; gx++) {
    drawTile(32, 0, gx, 0); // top wall at (32, 0)
    drawTile(32, 0, gx, 8); // bottom wall
  }
  for (let gy = 1; gy < 8; gy++) {
    drawTile(32, 0, 0, gy); // left wall
    drawTile(32, 0, 8, gy); // right wall
  }

  // 3. Draw door at top center (4, 0)
  drawTile(64, 0, 4, 0);

  // 4. Place interactive props around room
  drawTile(128, 0, 1, 2);  // prop_workstation at (1, 2)
  drawTile(160, 0, 7, 2);  // prop_locker at (7, 2)
  drawTile(192, 0, 7, 5);  // prop_biocabinet at (7, 5)
  drawTile(224, 0, 1, 5);  // prop_safe at (1, 5)
  drawTile(160, 32, 4, 7); // prop_cooling_vent at (4, 7)
  drawTile(160, 64, 6, 6); // prop_crate_cover at (6, 6)
  drawTile(224, 64, 2, 6); // prop_capacitor_bank at (2, 6)
  drawTile(224, 32, 4, 2); // prop_stabilizer at (4, 2)

  // 5. Place Staircase & Anchor
  drawTile(64, 64, 7, 7);  // staircase at (7, 7)
  drawTile(96, 64, 1, 7);  // anchor at (1, 7)

  // 6. Place Loot Items
  drawTile(0, 64, 3, 5);   // item_potion at (3, 5)
  drawTile(128, 96, 5, 5); // item_access_key at (5, 5)
  drawTile(192, 96, 4, 6); // item_kinetic_breacher at (4, 6)

  // 7. Place Hostiles / Enemies
  drawTile(96, 0, 2, 3);   // enemy_logic_leaker at (2, 3)
  drawTile(96, 32, 6, 3);  // enemy_fragmenter at (6, 3)
  drawTile(96, 96, 4, 4);  // enemy_system_admin at (4, 4)

  // 8. Place Player Operative Shell in active center-left
  drawTile(0, 224, 3, 4);  // player_bastion at (3, 4)

  // Border around mock dungeon room
  sCtx.strokeStyle = themeAccentColor;
  sCtx.lineWidth = 1;
  sCtx.strokeRect(p2X - 0.5, p2Y - 0.5, 288 + 1, 288 + 1);

  // Subtitle under mock room
  sCtx.fillStyle = '#64748b';
  sCtx.font = '9px monospace';
  sCtx.fillText('Context: 3/4 Elevated Walls, Seamless Floor, Doors, Props, & Chassis', 420, 360);

  // Bottom caption
  sCtx.fillStyle = '#94a3b8';
  sCtx.font = '10px monospace';
  sCtx.fillText('Alpha Verification: Dimmed to 30% under Fog-of-War | Opaque Floor (a=255) | Transparent Sprites', 24, 386);

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
