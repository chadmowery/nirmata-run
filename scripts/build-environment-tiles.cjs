const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Helper drawing utilities
function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawDropShadow(ctx, cx, cy, rx, ry, alpha = 0.6) {
  ctx.fillStyle = `rgba(2, 6, 18, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// 1. prop_workstation_active (CyberAcme Workstation)
// ============================================================================
function renderWorkstationActive(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.65);

  // Terminal Desk Structure (graphite & ceramic white)
  drawRect(ctx, 4, 18, 24, 10, '#0f172a'); // Desk base chassis
  drawRect(ctx, 5, 19, 22, 3, '#1e293b');  // Upper desk apron
  drawRect(ctx, 3, 17, 26, 2, '#475569');  // Desk surface edge
  drawRect(ctx, 3, 17, 26, 1, '#94a3b8');  // Beveled highlight

  // Dual pedestal legs & cabling
  drawRect(ctx, 5, 22, 4, 7, '#0f172a');
  drawRect(ctx, 23, 22, 4, 7, '#0f172a');
  drawRect(ctx, 6, 23, 2, 6, '#1e293b');
  drawRect(ctx, 24, 23, 2, 6, '#1e293b');

  // Glowing fiber-optic conduits running down middle leg cavity
  drawRect(ctx, 15, 20, 2, 9, '#0284c7');
  setPixel(ctx, 15, 23, '#00f0ff');
  setPixel(ctx, 16, 26, '#00f0ff');

  // Keyboard deck & touch interface
  drawRect(ctx, 9, 16, 14, 2, '#1e293b');
  for (let kx = 10; kx <= 21; kx += 2) {
    setPixel(ctx, kx, 16, '#94a3b8');
  }

  // Left Secondary CRT Monitor (Cobalt data stream, x: 4-11, y: 7-16)
  drawRect(ctx, 4, 8, 8, 8, '#0f172a');
  drawRect(ctx, 4, 7, 8, 1, '#334155');
  drawRect(ctx, 5, 9, 6, 6, '#0284c7'); // Cobalt screen
  // Code rows
  setPixel(ctx, 6, 10, '#38bdf8');
  setPixel(ctx, 7, 10, '#38bdf8');
  setPixel(ctx, 6, 12, '#38bdf8');
  setPixel(ctx, 8, 12, '#38bdf8');
  setPixel(ctx, 9, 12, '#38bdf8');
  setPixel(ctx, 6, 13, '#38bdf8');
  setPixel(ctx, 7, 13, '#38bdf8');

  // Main Primary CRT Monitor (Cyan telemetry & waveform, x: 13-27, y: 4-16)
  drawRect(ctx, 13, 4, 14, 12, '#0f172a'); // Bezel outer
  drawRect(ctx, 14, 3, 12, 1, '#475569');  // Monitor top bevel
  drawRect(ctx, 15, 3, 10, 1, '#cbd5e1');  // Top highlight
  drawRect(ctx, 14, 5, 12, 10, '#042f2e'); // Deep screen backing

  // Scanlines & active waveform (Neon Cyan #00f0ff)
  drawRect(ctx, 15, 6, 10, 1, '#00f0ff'); // Header scanline
  setPixel(ctx, 16, 8, '#00f0ff');
  setPixel(ctx, 17, 9, '#5eead4');
  setPixel(ctx, 18, 8, '#00f0ff');
  setPixel(ctx, 19, 7, '#ffffff'); // Peak spike
  setPixel(ctx, 20, 8, '#00f0ff');
  setPixel(ctx, 21, 10, '#5eead4');
  setPixel(ctx, 22, 9, '#00f0ff');
  setPixel(ctx, 23, 9, '#00f0ff');
  // Blinking terminal cursor
  setPixel(ctx, 16, 12, '#ffffff');
  setPixel(ctx, 17, 12, '#00f0ff');
  // Status LEDs on bottom bezel
  setPixel(ctx, 15, 15, '#22c55e');
  setPixel(ctx, 17, 15, '#00f0ff');
}

// ============================================================================
// 2. prop_locker_closed (Traxus Security Locker)
// ============================================================================
function renderLockerClosed(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.7);

  // Heavy steel locker body (x: 6-25, y: 3-28)
  drawRect(ctx, 6, 4, 20, 25, '#0f172a'); // Shadow rim
  drawRect(ctx, 7, 3, 18, 25, '#1e293b'); // Main steel casing
  drawRect(ctx, 8, 4, 16, 23, '#334155'); // Front recessed door

  // Bevel highlights
  drawRect(ctx, 7, 3, 18, 1, '#64748b');
  drawRect(ctx, 8, 3, 16, 1, '#94a3b8');
  drawRect(ctx, 7, 4, 1, 23, '#475569');

  // Traxus Yellow/Black Hazard Cornice (y: 5-7, x: 8-23)
  drawRect(ctx, 8, 5, 16, 3, '#0f172a');
  for (let hx = 8; hx <= 22; hx += 4) {
    drawRect(ctx, hx, 5, 2, 3, '#eab308');
  }

  // Vertical center door division & reinforced jamb
  drawRect(ctx, 15, 8, 2, 19, '#1e293b');

  // Heavy Safety Orange Mechanical Lock Box & Latch (x: 13-18, y: 13-18)
  drawRect(ctx, 13, 13, 6, 6, '#7c2d12'); // Dark shadow rim
  drawRect(ctx, 14, 13, 4, 5, '#ff9500'); // Safety orange casing
  drawRect(ctx, 15, 14, 2, 3, '#f97316'); // Core latch
  setPixel(ctx, 15, 15, '#ffffff');       // Keyhole / bolt specular highlight
  setPixel(ctx, 16, 15, '#0f172a');

  // Lower ventilation louvers (y: 22-25)
  drawRect(ctx, 10, 22, 4, 1, '#0f172a');
  drawRect(ctx, 10, 24, 4, 1, '#0f172a');
  drawRect(ctx, 18, 22, 4, 1, '#0f172a');
  drawRect(ctx, 18, 24, 4, 1, '#0f172a');

  // Corner rivets
  setPixel(ctx, 8, 9, '#94a3b8');
  setPixel(ctx, 23, 9, '#94a3b8');
  setPixel(ctx, 8, 26, '#94a3b8');
  setPixel(ctx, 23, 26, '#94a3b8');
}

// ============================================================================
// 3. prop_biocabinet (Sekiguchi Bio-Dispenser)
// ============================================================================
function renderBiocabinet(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.65);

  // Sterile White/Titanium Exterior Frame (x: 6-25, y: 3-28)
  drawRect(ctx, 6, 4, 20, 25, '#0f172a');
  drawRect(ctx, 7, 3, 18, 25, '#cbd5e1'); // Stainless steel shell
  drawRect(ctx, 8, 4, 16, 24, '#f8fafc'); // Sterile bone-white front
  drawRect(ctx, 7, 3, 18, 1, '#ffffff');  // Top bright rim
  drawRect(ctx, 8, 3, 16, 1, '#ffffff');

  // Header Panel: Sekiguchi Medical Red Cross & Diode (y: 5-8)
  drawRect(ctx, 14, 5, 4, 4, '#ef4444');  // Red cross backing
  drawRect(ctx, 15, 4, 2, 6, '#ffffff');
  drawRect(ctx, 13, 6, 6, 2, '#ffffff');
  drawRect(ctx, 15, 6, 2, 2, '#ef4444');
  // Digital temp display
  setPixel(ctx, 21, 6, '#10b981');
  setPixel(ctx, 22, 6, '#10b981');

  // Reinforced Glass Containment Chamber (x: 8-23, y: 10-22)
  drawRect(ctx, 8, 10, 16, 13, '#064e3b'); // Deep green interior
  drawRect(ctx, 9, 11, 14, 11, '#042f2e');

  // Glowing Mint Bio-Canisters inside fluid chamber
  // Left canister
  drawRect(ctx, 10, 13, 3, 8, '#065f46');
  drawRect(ctx, 11, 13, 2, 7, '#10b981');
  drawRect(ctx, 11, 14, 1, 5, '#5eead4');
  setPixel(ctx, 11, 15, '#ffffff');
  // Center canister (active)
  drawRect(ctx, 15, 12, 3, 9, '#065f46');
  drawRect(ctx, 15, 12, 2, 8, '#10b981');
  drawRect(ctx, 16, 13, 1, 6, '#5eead4');
  setPixel(ctx, 16, 14, '#ffffff');
  // Right canister
  drawRect(ctx, 19, 14, 3, 7, '#065f46');
  drawRect(ctx, 20, 14, 2, 6, '#10b981');
  drawRect(ctx, 20, 15, 1, 4, '#5eead4');

  // Glass Specular Sheen Diagonal Reflection
  setPixel(ctx, 21, 11, 'rgba(255, 255, 255, 0.7)');
  setPixel(ctx, 20, 12, 'rgba(255, 255, 255, 0.5)');
  setPixel(ctx, 19, 13, 'rgba(255, 255, 255, 0.3)');
  setPixel(ctx, 13, 18, 'rgba(255, 255, 255, 0.4)');
  setPixel(ctx, 12, 19, 'rgba(255, 255, 255, 0.6)');

  // Lower Dispensing Tray / Pneumatic Hatch (y: 24-27)
  drawRect(ctx, 9, 24, 14, 3, '#334155');
  drawRect(ctx, 11, 25, 10, 1, '#0f172a');
  setPixel(ctx, 15, 26, '#10b981'); // Dispense ready diode
  setPixel(ctx, 16, 26, '#10b981');
}

// ============================================================================
// 4. prop_safe_locked (Encrypted Core Safe)
// ============================================================================
function renderSafeLocked(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.7);

  // Heavy Fortified Vault Safe Body (x: 5-26, y: 6-28)
  drawRect(ctx, 5, 7, 22, 22, '#0f172a');
  drawRect(ctx, 6, 6, 20, 22, '#1e293b');
  drawRect(ctx, 7, 7, 18, 20, '#334155'); // Front face

  // Heavy chamfered edges & bevel
  drawRect(ctx, 6, 6, 20, 1, '#64748b');
  drawRect(ctx, 7, 6, 18, 1, '#cbd5e1'); // Bright top rim
  drawRect(ctx, 6, 7, 1, 20, '#475569');

  // Reinforced Corner Brackets & Heavy Hex Bolts
  const corners = [
    [8, 8], [22, 8], [8, 23], [22, 23]
  ];
  for (const [bx, by] of corners) {
    drawRect(ctx, bx - 1, by - 1, 3, 3, '#0f172a');
    setPixel(ctx, bx, by, '#94a3b8');
  }

  // Recessed Lock Housing (x: 10-21, y: 11-21)
  drawRect(ctx, 10, 11, 12, 10, '#0f172a');
  drawRect(ctx, 11, 12, 10, 8, '#1e293b');

  // Glowing Safety Orange Cryptographic Rotary Dial & Keypad
  drawRect(ctx, 13, 13, 6, 6, '#7c2d12');
  drawRect(ctx, 14, 13, 4, 6, '#ff9500');
  drawRect(ctx, 13, 14, 6, 4, '#ff9500');
  drawRect(ctx, 14, 14, 4, 4, '#fbbf24'); // Center gold hub
  setPixel(ctx, 15, 15, '#ffffff');       // Specular flash
  setPixel(ctx, 16, 15, '#ffffff');

  // Digital Security Status Diode (Locked: Pulsing Red / Orange)
  setPixel(ctx, 12, 13, '#ef4444');
  setPixel(ctx, 19, 13, '#ff9500');

  // Heavy Vault Door Hinges on Left Edge
  drawRect(ctx, 5, 9, 2, 4, '#94a3b8');
  drawRect(ctx, 5, 21, 2, 4, '#94a3b8');
}

// ============================================================================
// 5. prop_vault_door (Encrypted Vault Blast Door)
// ============================================================================
function renderVaultDoor(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 13, 2.5, 0.7);

  // Outer Archway / Bulkhead Frame (x: 2-29, y: 2-29)
  drawRect(ctx, 2, 3, 28, 26, '#0f172a');
  drawRect(ctx, 3, 2, 26, 26, '#1e293b');
  drawRect(ctx, 3, 2, 26, 2, '#64748b'); // Top arch lintel
  drawRect(ctx, 4, 2, 24, 1, '#cbd5e1'); // High specular highlight

  // Heavy Vertical Door Jambs
  drawRect(ctx, 3, 4, 3, 24, '#334155');
  drawRect(ctx, 26, 4, 3, 24, '#334155');

  // Sliding Blast Hatch Panels (x: 6-25, y: 4-27)
  drawRect(ctx, 6, 4, 20, 24, '#0f172a');
  drawRect(ctx, 7, 5, 18, 22, '#1e293b');

  // Interlocking Chevron Teeth Seam in Center (x: 14-17, y: 5-26)
  drawRect(ctx, 15, 5, 2, 22, '#0f172a');
  for (let ty = 6; ty <= 24; ty += 4) {
    setPixel(ctx, 14, ty, '#334155');
    setPixel(ctx, 17, ty + 2, '#334155');
  }

  // Blazing Safety-Orange Laser Containment Barrier Beam (y: 15-17, x: 5-26)
  drawRect(ctx, 5, 15, 22, 3, '#ea580c');
  drawRect(ctx, 5, 16, 22, 1, '#ff9500');
  drawRect(ctx, 9, 16, 14, 1, '#ffffff'); // White hot plasma laser core

  // Dual Hydraulic Locking Pistons on Flanks
  drawRect(ctx, 7, 9, 3, 5, '#64748b');
  setPixel(ctx, 8, 10, '#cbd5e1');
  drawRect(ctx, 22, 9, 3, 5, '#64748b');
  setPixel(ctx, 23, 10, '#cbd5e1');

  // Emergency Warning Beacon Strobe on Lintel
  drawRect(ctx, 14, 1, 4, 2, '#7c2d12');
  drawRect(ctx, 15, 1, 2, 2, '#ff9500');
  setPixel(ctx, 15, 1, '#ffffff');
}

// ============================================================================
// 6. prop_cooling_vent_ready (Thermal Cooling Vent)
// ============================================================================
function renderCoolingVentReady(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 28, 12, 3, 0.7);

  // Industrial Floor Grille Ring / Frame (x: 4-27, y: 6-27)
  drawRect(ctx, 4, 7, 24, 20, '#0f172a');
  drawRect(ctx, 5, 6, 22, 20, '#1e293b');
  drawRect(ctx, 6, 7, 20, 18, '#334155'); // Metal grille plate

  // Riveted Outer Flange
  drawRect(ctx, 5, 6, 22, 1, '#64748b');
  drawRect(ctx, 6, 6, 20, 1, '#cbd5e1');

  // Corner mounting hex bolts
  setPixel(ctx, 6, 8, '#94a3b8');
  setPixel(ctx, 25, 8, '#94a3b8');
  setPixel(ctx, 6, 24, '#94a3b8');
  setPixel(ctx, 25, 24, '#94a3b8');

  // Recessed Intake Cavity (x: 8-23, y: 9-23)
  drawRect(ctx, 8, 9, 16, 15, '#042f2e'); // Deep cyan cavern
  drawRect(ctx, 9, 10, 14, 13, '#083344');

  // Angled Radiator Louvers & Frosty Neon Cyan Refrigerant Glow
  for (let ly = 11; ly <= 21; ly += 2) {
    drawRect(ctx, 10, ly, 12, 1, '#0284c7');
    drawRect(ctx, 11, ly, 10, 1, '#00f0ff');
    setPixel(ctx, 15, ly, '#ffffff'); // Freezing core vapor
    setPixel(ctx, 16, ly, '#ffffff');
  }

  // Frost crystal deposits around rim
  setPixel(ctx, 7, 12, '#a5f3fc');
  setPixel(ctx, 8, 11, '#e0f2fe');
  setPixel(ctx, 24, 19, '#a5f3fc');
  setPixel(ctx, 23, 20, '#e0f2fe');

  // Analog Pressure Gauge Dial on top border
  drawRect(ctx, 14, 5, 4, 3, '#0f172a');
  drawRect(ctx, 15, 5, 2, 2, '#00f0ff');
  setPixel(ctx, 15, 5, '#ffffff');
}

// ============================================================================
// 7. prop_dead_drop (Telemetry Dead-Drop Uplink)
// ============================================================================
function renderDeadDrop(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.65);

  // Heavy Ground Anchoring Tripod Base (x: 7-24, y: 22-28)
  drawRect(ctx, 7, 24, 18, 4, '#0f172a');
  drawRect(ctx, 9, 23, 14, 4, '#1e293b');
  drawRect(ctx, 14, 20, 4, 5, '#334155'); // Center swivel turret

  // Tripod leg struts
  drawRect(ctx, 8, 25, 4, 2, '#475569');
  drawRect(ctx, 20, 25, 4, 2, '#475569');
  setPixel(ctx, 7, 26, '#94a3b8');
  setPixel(ctx, 24, 26, '#94a3b8');

  // Parabolic Satellite Dish Bowl (Angled up/right, x: 7-25, y: 5-19)
  drawRect(ctx, 8, 7, 16, 12, '#0f172a'); // Outer shadow curve
  drawRect(ctx, 9, 6, 15, 12, '#334155'); // Dish metal exterior
  drawRect(ctx, 10, 7, 13, 10, '#64748b'); // Dish concavity
  drawRect(ctx, 11, 8, 11, 8, '#94a3b8');  // Reflector interior
  drawRect(ctx, 10, 5, 12, 1, '#cbd5e1'); // Rim highlight

  // Central Feed Horn Transmitter Spire & Orange Pulse
  drawRect(ctx, 15, 10, 3, 7, '#0f172a');
  drawRect(ctx, 15, 9, 2, 5, '#ff9500');  // Safety orange feed horn
  drawRect(ctx, 15, 8, 2, 2, '#f59e0b');
  setPixel(ctx, 15, 8, '#ffffff');        // Transmission pulse core

  // Uplink Telemetry Diode & Beacon Antenna Mast
  drawRect(ctx, 21, 3, 2, 6, '#475569');
  setPixel(ctx, 21, 2, '#38bdf8');        // Pulsing orbital beacon light
  setPixel(ctx, 22, 2, '#00f0ff');
}

// ============================================================================
// 8. prop_stabilizer (Reality Stabilizer Node)
// ============================================================================
function renderStabilizer(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.7);

  // Quantum Phase Anchor Pedestal Base (x: 6-25, y: 22-28)
  drawRect(ctx, 6, 23, 20, 6, '#0f172a');
  drawRect(ctx, 7, 22, 18, 5, '#1e293b');
  drawRect(ctx, 8, 23, 16, 3, '#334155');
  drawRect(ctx, 7, 22, 18, 1, '#64748b'); // Base rim highlight

  // Quantum capacitor coils in base
  setPixel(ctx, 10, 24, '#00f0ff');
  setPixel(ctx, 12, 24, '#00f0ff');
  setPixel(ctx, 19, 24, '#00f0ff');
  setPixel(ctx, 21, 24, '#00f0ff');

  // Dual Magnetic Containment Pylons (Left: x: 6-9, Right: x: 22-25, y: 5-22)
  // Left pylon
  drawRect(ctx, 6, 6, 4, 17, '#0f172a');
  drawRect(ctx, 7, 5, 3, 17, '#334155');
  drawRect(ctx, 8, 5, 1, 16, '#94a3b8'); // Specular ridge
  drawRect(ctx, 8, 4, 2, 2, '#00f0ff');  // Emitter tip
  // Right pylon
  drawRect(ctx, 22, 6, 4, 17, '#0f172a');
  drawRect(ctx, 22, 5, 3, 17, '#334155');
  drawRect(ctx, 23, 5, 1, 16, '#94a3b8');
  drawRect(ctx, 22, 4, 2, 2, '#00f0ff'); // Emitter tip

  // Floating Quantum Stabilizer Octahedron Core (Centered at x: 12-19, y: 8-17)
  // Outer energy containment aura
  drawRect(ctx, 13, 8, 6, 9, '#083344');
  drawRect(ctx, 12, 9, 8, 7, '#083344');

  // Octahedral crystalline diamond core
  drawRect(ctx, 14, 8, 4, 9, '#0284c7');
  drawRect(ctx, 13, 9, 6, 7, '#0284c7');
  drawRect(ctx, 14, 9, 4, 7, '#00f0ff'); // Vibrant cyan energy core
  drawRect(ctx, 15, 10, 2, 5, '#ffffff'); // White blazing singularity center

  // Radiating horizontal phase ring
  drawRect(ctx, 10, 12, 12, 1, 'rgba(0, 240, 255, 0.7)');
  setPixel(ctx, 9, 12, '#67e8f9');
  setPixel(ctx, 22, 12, '#67e8f9');
}

// ============================================================================
// 9. prop_subnet_console (CyberAcme Subnet Recon Console)
// ============================================================================
function renderSubnetConsole(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.65);

  // Pedestal Column & Chassis (x: 5-26, y: 15-28)
  drawRect(ctx, 5, 16, 22, 12, '#0f172a');
  drawRect(ctx, 6, 15, 20, 12, '#1e293b');
  drawRect(ctx, 7, 16, 18, 4, '#334155');
  drawRect(ctx, 6, 15, 20, 1, '#64748b');

  // Angled Radar Terminal Deck (x: 4-27, y: 5-16)
  drawRect(ctx, 4, 6, 24, 11, '#0f172a');
  drawRect(ctx, 5, 5, 22, 11, '#334155');
  drawRect(ctx, 6, 5, 20, 1, '#cbd5e1'); // Lintel highlight

  // Circular Radar Scope Screen (x: 7-19, y: 6-15)
  drawRect(ctx, 8, 6, 10, 9, '#022c22'); // Dark emerald scope backing
  drawRect(ctx, 7, 7, 12, 7, '#022c22');
  // Radar rings
  drawRect(ctx, 9, 7, 8, 7, '#064e3b');
  drawRect(ctx, 10, 8, 6, 5, '#022c22');
  setPixel(ctx, 12, 10, '#10b981'); // Center ping
  setPixel(ctx, 13, 10, '#ffffff');
  // Radar sweep line & recon blips
  setPixel(ctx, 14, 9, '#34d399');
  setPixel(ctx, 15, 8, '#00f0ff');  // Detected Staircase / Vault blip
  setPixel(ctx, 10, 12, '#ef4444'); // Detected Corrupted Node blip

  // Side Comms Spire & Network Antenna (x: 21-25, y: 2-15)
  drawRect(ctx, 22, 3, 2, 12, '#475569');
  drawRect(ctx, 21, 2, 4, 2, '#94a3b8');
  setPixel(ctx, 22, 1, '#00f0ff');  // Telemetry antenna tip
  setPixel(ctx, 23, 1, '#ffffff');

  // Network activity LED bar (y: 19)
  setPixel(ctx, 9, 19, '#10b981');
  setPixel(ctx, 11, 19, '#00f0ff');
  setPixel(ctx, 13, 19, '#10b981');
  setPixel(ctx, 15, 19, '#eab308');
}

// ============================================================================
// 10. prop_crate_cover (Traxus Low-Cover Freight Crate)
// ============================================================================
function renderCrateCover(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.7);

  // Low-Cover Stamped Steel Cargo Crate (x: 4-27, y: 11-28)
  drawRect(ctx, 4, 12, 24, 16, '#0f172a'); // Outer shadow bevel
  drawRect(ctx, 5, 11, 22, 16, '#1e293b'); // Main steel body
  drawRect(ctx, 6, 12, 20, 14, '#334155'); // Front panel face

  // Top beveled lid edge
  drawRect(ctx, 5, 11, 22, 1, '#64748b');
  drawRect(ctx, 6, 11, 20, 1, '#cbd5e1'); // Bright highlight

  // Traxus Hazard Caution Stripe Across Center (y: 16-19, x: 6-25)
  drawRect(ctx, 6, 16, 20, 4, '#0f172a');
  for (let cx = 6; cx <= 24; cx += 4) {
    drawRect(ctx, cx, 16, 2, 4, '#facc15'); // Signal yellow hazard band
  }

  // Heavy Corner Reinforcement Plates & Exposed Hex Bolts
  const corners = [
    [6, 13], [24, 13], [6, 23], [24, 23]
  ];
  for (const [cx, cy] of corners) {
    drawRect(ctx, cx - 1, cy - 1, 3, 3, '#0f172a');
    setPixel(ctx, cx, cy, '#94a3b8');
  }

  // Stenciled Faction Label "TRX"
  setPixel(ctx, 13, 22, '#94a3b8');
  setPixel(ctx, 14, 22, '#94a3b8');
  setPixel(ctx, 16, 22, '#94a3b8');
  setPixel(ctx, 18, 22, '#94a3b8');
}

// ============================================================================
// 11. prop_cryo_vat (Sekiguchi Cryo-Containment Vat)
// ============================================================================
function renderCryoVat(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 10, 2.5, 0.7);

  // Industrial Base Mounting Ring (x: 7-24, y: 24-28)
  drawRect(ctx, 7, 25, 18, 4, '#0f172a');
  drawRect(ctx, 8, 24, 16, 4, '#1e293b');
  drawRect(ctx, 9, 24, 14, 2, '#475569');

  // Pressurized Cylindrical Glass Vat (x: 8-23, y: 5-24)
  drawRect(ctx, 8, 6, 16, 18, '#0f172a'); // Outer shell
  drawRect(ctx, 9, 5, 14, 19, '#042f2e'); // Deep toxic fluid

  // Volatile Mint-Green Chemical Fluid (#059669 / #34d399 / #a7f3d0)
  drawRect(ctx, 10, 8, 12, 15, '#059669');
  drawRect(ctx, 11, 9, 10, 13, '#10b981');
  drawRect(ctx, 12, 10, 8, 11, '#34d399');

  // Suspended dark bio-specimen silhouette inside
  drawRect(ctx, 14, 12, 4, 6, '#064e3b');
  setPixel(ctx, 15, 13, '#0f172a');
  setPixel(ctx, 16, 13, '#0f172a');

  // Rising fluid bubbles
  setPixel(ctx, 12, 12, '#a7f3d0');
  setPixel(ctx, 18, 15, '#a7f3d0');
  setPixel(ctx, 13, 17, '#a7f3d0');
  setPixel(ctx, 19, 11, '#ffffff');

  // Glass Specular Sheen (Curved highlight on left & right rim)
  drawRect(ctx, 9, 7, 1, 15, 'rgba(255, 255, 255, 0.75)');
  drawRect(ctx, 22, 7, 1, 15, 'rgba(56, 189, 248, 0.5)');

  // Top Pressure Relief Manifold & Emergency Valve (x: 9-22, y: 2-6)
  drawRect(ctx, 9, 3, 14, 3, '#1e293b');
  drawRect(ctx, 10, 2, 12, 2, '#475569');
  drawRect(ctx, 11, 2, 10, 1, '#cbd5e1');
  // Red emergency shutoff valve
  drawRect(ctx, 14, 1, 4, 2, '#ef4444');
  setPixel(ctx, 15, 1, '#fca5a5');
}

// ============================================================================
// 12. prop_capacitor_bank (CyberAcme Overcharged Capacitor Bank)
// ============================================================================
function renderCapacitorBank(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 29, 11, 2.5, 0.7);

  // Heavy Transformer Sub-Base (x: 5-26, y: 23-28)
  drawRect(ctx, 5, 24, 22, 5, '#0f172a');
  drawRect(ctx, 6, 23, 20, 5, '#1e293b');
  drawRect(ctx, 7, 23, 18, 2, '#475569');

  // Dual Ceramic Insulator Capacitor Towers (Left: x: 7-13, Right: x: 18-24, y: 6-23)
  // Left tower (stacked ribbed ceramic discs)
  for (let dy = 6; dy <= 20; dy += 3) {
    drawRect(ctx, 7, dy, 7, 2, '#0f172a');
    drawRect(ctx, 8, dy, 5, 2, '#334155');
    drawRect(ctx, 8, dy, 5, 1, '#94a3b8');
  }
  // Right tower
  for (let dy = 6; dy <= 20; dy += 3) {
    drawRect(ctx, 18, dy, 7, 2, '#0f172a');
    drawRect(ctx, 19, dy, 5, 2, '#334155');
    drawRect(ctx, 19, dy, 5, 1, '#94a3b8');
  }

  // Central Copper Bus Bars & Energy Core (x: 14-17, y: 9-23)
  drawRect(ctx, 15, 10, 2, 13, '#b45309'); // Copper bus
  drawRect(ctx, 15, 11, 2, 10, '#d97706');
  setPixel(ctx, 15, 14, '#fde68a');

  // Crackling Electric Blue / Cyan EMP Spark Arc between Anodes (y: 4-8)
  drawRect(ctx, 9, 4, 3, 2, '#00f0ff');
  drawRect(ctx, 20, 4, 3, 2, '#00f0ff');
  // Discharging spark arc
  setPixel(ctx, 12, 5, '#38bdf8');
  setPixel(ctx, 13, 6, '#00f0ff');
  setPixel(ctx, 14, 5, '#ffffff'); // Intense spark core
  setPixel(ctx, 15, 6, '#ffffff');
  setPixel(ctx, 16, 5, '#00f0ff');
  setPixel(ctx, 17, 6, '#38bdf8');
  setPixel(ctx, 18, 5, '#00f0ff');
  setPixel(ctx, 19, 4, '#e0f2fe');

  // EMP warning hazard badge on base
  drawRect(ctx, 14, 25, 4, 2, '#eab308');
  setPixel(ctx, 15, 25, '#0f172a');
}

// ============================================================================
// 13. item_access_key (Cryptographic Keycard)
// ============================================================================
function renderAccessKey(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 27, 8, 2, 0.6);

  // Military-grade Cryptographic Keycard (Angled isometric token, x: 8-23, y: 7-25)
  drawRect(ctx, 8, 8, 16, 17, '#0f172a');
  drawRect(ctx, 9, 7, 14, 17, '#1e293b'); // Dark carbon card body
  drawRect(ctx, 10, 8, 12, 15, '#334155');

  // Bevel edge highlights
  drawRect(ctx, 9, 7, 14, 1, '#94a3b8');
  drawRect(ctx, 10, 7, 12, 1, '#ffffff');

  // Top Lanyard / Keyring Slot (x: 14-17, y: 9-11)
  drawRect(ctx, 14, 9, 4, 3, '#0f172a');

  // Gold Cryptographic Bus Contacts (y: 19-23)
  for (let px = 11; px <= 20; px += 3) {
    drawRect(ctx, px, 19, 2, 4, '#d97706');
    drawRect(ctx, px, 19, 2, 3, '#fbbf24');
    setPixel(ctx, px, 19, '#fef08a');
  }

  // Central Cryptographic Microchip with Glowing Neon Cyan Authorization Diode
  drawRect(ctx, 12, 13, 8, 5, '#0f172a');
  drawRect(ctx, 13, 14, 6, 3, '#0284c7');
  drawRect(ctx, 14, 14, 4, 3, '#00f0ff');
  setPixel(ctx, 15, 15, '#ffffff'); // Bright auth LED
  setPixel(ctx, 16, 15, '#ffffff');
}

// ============================================================================
// 14. item_scavenger_siphon (Scavenger Siphon Augment)
// ============================================================================
function renderScavengerSiphon(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 27, 8, 2, 0.6);

  // Translucent Hexagonal Cyberware Module (x: 7-24, y: 6-25)
  drawRect(ctx, 7, 9, 18, 14, '#0f172a');
  drawRect(ctx, 9, 7, 14, 18, '#0f172a');
  drawRect(ctx, 8, 8, 16, 16, '#042f2e'); // Deep cyan backing
  drawRect(ctx, 9, 8, 14, 15, '#0f766e');

  // Hex shield border highlight
  drawRect(ctx, 10, 7, 12, 1, '#5eead4');
  drawRect(ctx, 10, 23, 12, 1, '#115e59');

  // Stylized Hexagonal Siphon Shield Glyph (Centered at x: 12-19, y: 11-19)
  drawRect(ctx, 13, 11, 6, 9, '#0284c7');
  drawRect(ctx, 12, 12, 8, 7, '#0284c7');
  drawRect(ctx, 13, 12, 6, 7, '#00f0ff');
  drawRect(ctx, 14, 13, 4, 5, '#38bdf8');
  drawRect(ctx, 15, 14, 2, 3, '#ffffff'); // Energy core

  // Peripheral Vacuum / Siphon Intake Ports
  setPixel(ctx, 10, 11, '#5eead4');
  setPixel(ctx, 21, 11, '#5eead4');
  setPixel(ctx, 10, 19, '#5eead4');
  setPixel(ctx, 21, 19, '#5eead4');

  // Heat vent vents (lower ports)
  setPixel(ctx, 13, 21, '#38bdf8');
  setPixel(ctx, 18, 21, '#38bdf8');
}

// ============================================================================
// 15. item_kinetic_breacher (Kinetic Breacher Augment)
// ============================================================================
function renderKineticBreacher(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 27, 8, 2, 0.65);

  // Heavy Industrial Kinetic Ram Module (x: 7-24, y: 6-25)
  drawRect(ctx, 7, 7, 18, 18, '#0f172a');
  drawRect(ctx, 8, 6, 16, 18, '#1e293b');
  drawRect(ctx, 9, 7, 14, 16, '#334155');

  // Bevel & structural edge
  drawRect(ctx, 8, 6, 16, 1, '#94a3b8');
  drawRect(ctx, 9, 6, 14, 1, '#cbd5e1');

  // Dual Hydraulic Compression Cylinders (Left: x: 9-11, Right: x: 20-22)
  drawRect(ctx, 9, 9, 3, 12, '#0f172a');
  drawRect(ctx, 10, 9, 2, 11, '#64748b');
  drawRect(ctx, 20, 9, 3, 12, '#0f172a');
  drawRect(ctx, 20, 9, 2, 11, '#64748b');

  // Explosive Crimson Impact Burst Spike Glyph (x: 13-18, y: 9-20)
  drawRect(ctx, 14, 9, 4, 11, '#7f1d1d');
  drawRect(ctx, 13, 10, 6, 9, '#b91c1c');
  drawRect(ctx, 14, 11, 4, 7, '#ef4444'); // Crimson fire
  drawRect(ctx, 15, 12, 2, 5, '#f97316'); // Orange core
  setPixel(ctx, 15, 13, '#fef08a');       // Blazing yellow spark
  setPixel(ctx, 16, 13, '#fef08a');

  // Heavy corner hex fasteners
  setPixel(ctx, 9, 7, '#cbd5e1');
  setPixel(ctx, 22, 7, '#cbd5e1');
  setPixel(ctx, 9, 22, '#cbd5e1');
  setPixel(ctx, 22, 22, '#cbd5e1');
}

// ============================================================================
// 16. item_thermal_bypass (Thermal Bypass Augment)
// ============================================================================
function renderThermalBypass(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  drawDropShadow(ctx, 16, 27, 8, 2, 0.65);

  // Overclock Heat-Sink Shunt Chip (x: 7-24, y: 6-25)
  drawRect(ctx, 7, 7, 18, 18, '#0f172a');
  drawRect(ctx, 8, 6, 16, 18, '#1e293b');
  drawRect(ctx, 9, 7, 14, 16, '#334155');

  // Top highlight
  drawRect(ctx, 8, 6, 16, 1, '#ff9500'); // Heat warning rim
  drawRect(ctx, 9, 6, 14, 1, '#fed7aa');

  // Vertical Heat Dissipation Radiator Fins (Safety Orange #ff9500 / #f97316)
  for (let fx = 10; fx <= 21; fx += 3) {
    drawRect(ctx, fx, 8, 2, 7, '#7c2d12');
    drawRect(ctx, fx, 8, 2, 6, '#ea580c');
    drawRect(ctx, fx, 8, 1, 5, '#ff9500');
    setPixel(ctx, fx, 9, '#fef08a'); // Superheated fin tip
  }

  // Integrated Medical Nanite Repair Sub-Processor (Lower Green Half, y: 16-22)
  drawRect(ctx, 10, 16, 12, 6, '#064e3b');
  drawRect(ctx, 11, 17, 10, 4, '#042f2e');
  // Medical recovery cross
  drawRect(ctx, 15, 17, 2, 4, '#10b981');
  drawRect(ctx, 14, 18, 4, 2, '#10b981');
  setPixel(ctx, 15, 18, '#d1fae5');
  setPixel(ctx, 16, 18, '#d1fae5');

  // Shunt bus conduit between heat sink and nanite core
  drawRect(ctx, 15, 13, 2, 3, '#f59e0b');
}

// ============================================================================
// MULTI-VIEW INSPECTION SHEET GENERATOR (600x300)
// ============================================================================
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
  // Composite prop/item sprite at center (1, 1)
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

// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function main() {
  const floorPath = path.resolve(__dirname, '../public/assets/tiles/floor.png');
  const floorImg = await loadImage(floorPath);

  const tiles = [
    { key: 'prop_workstation_active', render: renderWorkstationActive, title: 'Workstation Terminal' },
    { key: 'prop_locker_closed', render: renderLockerClosed, title: 'Security Locker' },
    { key: 'prop_biocabinet', alias: 'prop_biocabinet_full', render: renderBiocabinet, title: 'Bio-Dispenser Cabinet' },
    { key: 'prop_safe_locked', render: renderSafeLocked, title: 'Encrypted Core Safe' },
    { key: 'prop_vault_door', alias: 'prop_vault_door_locked', render: renderVaultDoor, title: 'Encrypted Vault Door' },
    { key: 'prop_cooling_vent_ready', render: renderCoolingVentReady, title: 'Thermal Cooling Vent' },
    { key: 'prop_dead_drop', alias: 'prop_dead_drop_ready', render: renderDeadDrop, title: 'Telemetry Dead-Drop Uplink' },
    { key: 'prop_stabilizer', alias: 'prop_stabilizer_active', render: renderStabilizer, title: 'Reality Stabilizer Node' },
    { key: 'prop_subnet_console', render: renderSubnetConsole, title: 'Subnet Recon Console' },
    { key: 'prop_crate_cover', render: renderCrateCover, title: 'Low-Cover Cargo Crate' },
    { key: 'prop_cryo_vat', render: renderCryoVat, title: 'Cryo-Containment Vat' },
    { key: 'prop_capacitor_bank', render: renderCapacitorBank, title: 'Overcharged Capacitor Bank' },
    { key: 'item_access_key', render: renderAccessKey, title: 'Access Keycard' },
    { key: 'item_scavenger_siphon', render: renderScavengerSiphon, title: 'Scavenger Siphon Augment' },
    { key: 'item_kinetic_breacher', render: renderKineticBreacher, title: 'Kinetic Breacher Augment' },
    { key: 'item_thermal_bypass', render: renderThermalBypass, title: 'Thermal Bypass Augment' },
  ];

  console.log(`Starting generation for ${tiles.length} interactive environment tiles...`);

  for (const t of tiles) {
    console.log(`Generating tile: ${t.key}...`);
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    t.render(ctx);

    const tileBuf = canvas.toBuffer('image/png');
    const tileOutPath = path.resolve(__dirname, `../public/assets/tiles/${t.key}.png`);
    fs.writeFileSync(tileOutPath, tileBuf);
    console.log(`Saved ${tileOutPath} (${tileBuf.length} bytes)`);

    // If alias exists, also write the alias file
    if (t.alias) {
      const aliasOutPath = path.resolve(__dirname, `../public/assets/tiles/${t.alias}.png`);
      fs.writeFileSync(aliasOutPath, tileBuf);
      console.log(`Saved alias ${aliasOutPath}`);
    }

    console.log(`Generating inspection preview: ${t.key}_sheet...`);
    const previewCanvas = await generateInspectionSheet(canvas, t.key, floorImg);
    const previewBuf = previewCanvas.toBuffer('image/png');
    const previewDir = path.resolve(__dirname, '../docs/visual-design/previews');
    if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
    const previewOutPath = path.join(previewDir, `${t.key}_sheet.png`);
    fs.writeFileSync(previewOutPath, previewBuf);
    console.log(`Saved ${previewOutPath} (${previewBuf.length} bytes)`);
  }

  console.log('All 16 tiles and preview sheets successfully generated!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
