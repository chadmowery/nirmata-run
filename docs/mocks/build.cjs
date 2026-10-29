const fs = require('fs');
const path = require('path');

console.log("Compiling Nirmata Runner Mockup Showcase (docs/mocks/index.html)...");

// Load modules from ./src/
const baseCss = require('./src/styles-base.cjs');
const bespokeCss = require('./src/styles-bespoke.cjs');
const sharedHud = fs.readFileSync(path.join(__dirname, 'src/shared-hud.html'), 'utf8');
const sharedWorkshop = fs.readFileSync(path.join(__dirname, 'src/shared-workshop.html'), 'utf8');
const bespokeHud = require('./src/templates-bespoke-hud.cjs');
const bespokeWorkshop = require('./src/templates-bespoke-workshop.cjs');
const clientScript = require('./src/client-script.cjs');

const filterTabCss = `
/* Filter Tabs Bar */
.filter-tabs-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 1.25rem;
  background: #06090e;
  border-bottom: 1px solid #1b222d;
  overflow-x: auto;
}

.filter-tab-btn {
  background: #11161d;
  border: 1px solid #283344;
  color: #8c97a8;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 12px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-tab-btn:hover {
  background: #1b222d;
  color: #fff;
  border-color: #00f0ff;
}

.filter-tab-btn.active {
  background: #d8ff00;
  color: #000;
  border-color: #d8ff00;
  box-shadow: 0 0 10px rgba(216, 255, 0, 0.3);
}

.filter-tab-btn.active[data-filter="cyborg"] {
  background: #e60012;
  color: #fff;
  border-color: #e60012;
  box-shadow: 0 0 12px rgba(230, 0, 18, 0.4);
}

.style-pill.cyborg-marquee {
  border-color: rgba(230, 0, 18, 0.7);
}

.style-pill.cyborg-marquee.active {
  background: #e60012 !important;
  color: #fff !important;
  border-color: #e60012 !important;
  box-shadow: 0 0 12px rgba(230, 0, 18, 0.5);
}

/* Split View Flex/Grid Arrangement */
body.split-view-active .viewport-canvas {
  display: grid !important;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 1rem;
}
body.split-view-active #hudContainer,
body.split-view-active #workshopContainer {
  display: block !important;
  width: 100%;
}
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nirmata Runner — 35 Visual Style Mockups & Layout Paradigms</title>
  
  <!-- Modern Sci-Fi, Technical, Military, Editorial & Monospace Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,400;0,600;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:ital,wght@0,300;0,400;0,600;0,800;1,400&family=Orbitron:wght@500;700;900&family=Oxanium:wght@400;600;700;800&family=Rajdhani:wght@500;600;700&family=Share+Tech+Mono&family=Space+Grotesk:wght@400;600;700&family=Syne:wght@700;800&family=VT323&family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet">

  <style>
${baseCss}
${filterTabCss}
${bespokeCss}
  </style>
</head>
<body class="theme-taikoku" id="appRoot">

  <!-- ========================================================================
       MASTER HEADER BAR
       ======================================================================== -->
  <header class="master-header">
    <div class="master-primary-row">
      
      <!-- Brand & Project -->
      <div class="brand-cluster">
        <div class="brand-glyph">N</div>
        <div class="brand-title">
          Nirmata Runner <span class="brand-badge">35 STYLES</span>
        </div>
      </div>

      <!-- Quick Nav Buttons -->
      <button class="style-nav-arrow" onclick="cycleTheme(-1)">◀ PREV</button>

      <!-- Style Selector Pills Container (Injected by JS) -->
      <div class="style-picker-container" id="stylePickerContainer"></div>

      <button class="style-nav-arrow" onclick="cycleTheme(1)">NEXT ▶</button>

      <!-- View Switcher -->
      <div class="view-switcher">
        <button class="view-btn active" id="btnViewHud" onclick="switchView('hud')">🎮 HUD</button>
        <button class="view-btn" id="btnViewWorkshop" onclick="switchView('workshop')">🛠️ Workshop</button>
        <button class="view-btn" id="btnViewSplit" onclick="switchView('split')">📑 Split</button>
      </div>

    </div>

    <!-- Category Filter Tabs Row -->
    <div class="filter-tabs-row">
      <span style="font-size: 11px; font-weight: 800; color: #fff; margin-right: 6px;">SERIES:</span>
      <button class="filter-tab-btn active" data-filter="cyborg" onclick="setFilter('cyborg')">
        ★ SERIES 3: 10 Bespoke Megacorp, Manga & AI Cyborg Layouts (Styles 26–35)
      </button>
      <button class="filter-tab-btn" data-filter="all" onclick="setFilter('all')">
        All 35 Styles
      </button>
      <button class="filter-tab-btn" data-filter="experimental" onclick="setFilter('experimental')">
        Series 2: Experimental UI (Styles 16–25)
      </button>
      <button class="filter-tab-btn" data-filter="foundations" onclick="setFilter('foundations')">
        Series 1: Foundations (Styles 1–15)
      </button>
    </div>

    <!-- Master Sub-row: Simulation Actions & Documentation -->
    <div class="master-sub-row">
      <div class="sim-cluster">
        <span class="sim-label">Turn Actions:</span>
        <button class="sim-btn primary" onclick="simStepTurn()">▶ Step Turn (Z)</button>
        <button class="sim-btn" onclick="simCastAbility('phase_shift')">⚡ Phase Shift (1)</button>
        <button class="sim-btn" onclick="simCastAbility('neural_spike')">💥 Neural Spike (2)</button>
        <button class="sim-btn" onclick="simWaitTurn()">⏳ Vent Heat (W)</button>
        <button class="sim-btn danger" onclick="simTakeDamage()">💔 Hit (-4 HP)</button>
      </div>

      <div class="info-cluster">
        <div class="theme-description-banner" id="themeBanner"></div>
        <button class="spec-modal-trigger" onclick="openSpecModal()">
          ℹ️ Specs (All 35)
        </button>
      </div>
    </div>
  </header>

  <!-- ========================================================================
       MAIN CANVAS VIEWPORT
       ======================================================================== -->
  <main class="viewport-canvas">

    <!-- VIEW 1: IN-GAME HUD CONTAINER -->
    <div class="view-panel-container active" id="hudContainer">
      <!-- Shared Default HUD (for Styles 1 - 25) -->
      ${sharedHud}
      
      <!-- 10 Bespoke HUD Templates (for Styles 26 - 35) -->
      ${bespokeHud}
    </div>

    <!-- VIEW 2: OUT-OF-GAME WORKSHOP CONTAINER -->
    <div class="view-panel-container" id="workshopContainer">
      <!-- Shared Default Workshop (for Styles 1 - 25) -->
      ${sharedWorkshop}

      <!-- 10 Bespoke Workshop Templates (for Styles 26 - 35) -->
      ${bespokeWorkshop}
    </div>

  </main>

  <!-- ========================================================================
       DESIGN SPECIFICATION MODAL (ALL 35 STYLES)
       ======================================================================== -->
  <div class="spec-modal-backdrop" id="specModalBackdrop" onclick="if(event.target === this) closeSpecModal()">
    <div class="spec-modal-content">
      <button class="spec-modal-close" onclick="closeSpecModal()">✕ CLOSE</button>
      <h2>Visual Architecture & Layout Specifications (35 Paradigms)</h2>
      <p>Comprehensive design matrix detailing all 35 visual systems, architectural wireframes, design influences (Bungie Marathon / Antireal, Ghost in the Shell, Akira, NERV, Bloomberg), and typography tokens.</p>
      <div class="spec-grid" id="specModalGrid"></div>
    </div>
  </div>

  <!-- Client-side Interactive Engine -->
  ${clientScript}

</body>
</html>
`;

// Write to docs/mocks/index.html
const outPath = path.join(__dirname, 'index.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('✓ Successfully generated standalone mockups file: ' + outPath + ' (' + html.length + ' bytes)');
