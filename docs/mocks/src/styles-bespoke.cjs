// Bespoke CSS styles for the 10 AI Cyborg, Megacorp, Ghost in the Shell & Manga Layouts (Styles 26 - 35)

module.exports = `
/* ==========================================================================
   SERIES 3: 10 BESPOKE LAYOUT ARCHITECTURES (STYLES 26 - 35)
   ========================================================================== */

/* Universal Visibility Rules for Bespoke Layouts */
.bespoke-hud-view, .bespoke-workshop-view {
  display: none;
  width: 100%;
  max-width: 1380px;
  margin: 0 auto;
  box-sizing: border-box;
  height: calc(100vh - 175px);
  min-height: 520px;
  max-height: 780px;
  overflow: hidden;
}

/* --------------------------------------------------------------------------
   STYLE 26: TAIKOKU INDUSTRIAL MANIFEST (Bungie Marathon / Antireal / TDR)
   -------------------------------------------------------------------------- */
.theme-taikoku {
  --th-bg: #07080a;
  --th-surface: #11141a;
  --th-surface-alt: #171b24;
  --th-border: #f4f4f0;
  --th-accent: #d8ff00;
  --th-accent-secondary: #00f0ff;
  --th-danger: #ff334b;
  --th-warning: #ff6600;
  --th-text: #ffffff;
  --th-text-dim: #8c96a8;
  --th-font-display: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  --th-font-mono: 'JetBrains Mono', monospace;
}

#hud-taikoku {
  grid-template-rows: 56px minmax(0, 1fr) 68px;
  grid-template-columns: 80px minmax(0, 1fr) 300px;
  gap: 10px;
  background: #08090c;
  border: 3px solid #f4f4f0;
  padding: 10px;
  box-shadow: 0 0 40px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.8);
}

.taikoku-header {
  grid-column: 1 / -1;
  background: #f4f4f0;
  color: #000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  font-weight: 800;
  border-bottom: 3px solid #000;
  overflow: hidden;
}

.taikoku-brand-kanji {
  font-size: 18px;
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.taikoku-brand-kanji .badge {
  background: #000;
  color: #d8ff00;
  padding: 2px 6px;
  font-size: 10px;
}

.taikoku-stamp-box {
  border: 2px solid #ff334b;
  color: #ff334b;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 900;
  transform: rotate(-2deg);
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.taikoku-left-ladder {
  background: #11141a;
  border: 2px solid #28303f;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  overflow: hidden;
}

.taikoku-vertical-text {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 9px;
  letter-spacing: 0.15em;
  color: #d8ff00;
  font-weight: 700;
  text-transform: uppercase;
}

.taikoku-barcode-svg {
  width: 48px;
  height: 140px;
}

.taikoku-viewport-bay {
  background: #000;
  border: 3px solid #f4f4f0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.9);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.taikoku-corner-mark {
  position: absolute;
  color: #d8ff00;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 900;
}
.taikoku-corner-mark.tl { top: 6px; left: 6px; }
.taikoku-corner-mark.tr { top: 6px; right: 6px; }
.taikoku-corner-mark.bl { bottom: 6px; left: 6px; }
.taikoku-corner-mark.br { bottom: 6px; right: 6px; }

.taikoku-manifest-table {
  background: #11141a;
  border: 2px solid #28303f;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  overflow-y: auto;
}

.taikoku-manifest-title {
  font-size: 11px;
  font-weight: 800;
  color: #d8ff00;
  border-bottom: 2px solid #28303f;
  padding-bottom: 4px;
  display: flex;
  justify-content: space-between;
}

.taikoku-spec-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  padding: 3px 0;
  border-bottom: 1px dotted rgba(255,255,255,0.15);
}

.taikoku-spec-label { color: #8c96a8; }
.taikoku-spec-val { font-weight: 700; color: #fff; }

.taikoku-dock-levers {
  grid-column: 1 / -1;
  background: #11141a;
  border: 2px solid #f4f4f0;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 0.75rem;
  gap: 8px;
}

.taikoku-lever-btn {
  flex: 1;
  height: 48px;
  background: #1c222c;
  border: 2px solid #3d4a61;
  color: #fff;
  font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.taikoku-lever-btn::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  background: #d8ff00;
}

.taikoku-lever-btn:hover {
  background: #d8ff00;
  color: #000;
  border-color: #d8ff00;
}
.taikoku-lever-btn:hover::before { background: #000; }

/* Taikoku Workshop */
#workshop-taikoku {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: #08090c;
  border: 3px solid #f4f4f0;
  padding: 12px;
}

.taikoku-bill-of-lading {
  background: #f4f4f0;
  color: #000;
  padding: 1.25rem;
  font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  border: 3px solid #000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.taikoku-stamp-large {
  border: 2px dashed #ff334b;
  color: #ff334b;
  padding: 6px;
  text-align: center;
  font-weight: 900;
  font-size: 12px;
  transform: rotate(-3deg);
  margin-top: 0.75rem;
}


/* --------------------------------------------------------------------------
   STYLE 27: GHOST-DIVE CYBER-BRAIN (Ghost in the Shell / Motoko Kusanagi)
   -------------------------------------------------------------------------- */
.theme-ghostdive {
  --th-bg: #030712;
  --th-surface: #0a1122;
  --th-surface-alt: #101a33;
  --th-border: #1e3a6a;
  --th-accent: #00f0ff;
  --th-accent-secondary: #a855f7;
  --th-danger: #ff1744;
  --th-warning: #f59e0b;
  --th-text: #e0f2fe;
  --th-text-dim: #64748b;
  --th-font-display: 'Orbitron', 'Noto Sans JP', sans-serif;
  --th-font-mono: 'JetBrains Mono', monospace;
}

#hud-ghostdive {
  grid-template-rows: 56px minmax(0, 1fr) 64px;
  grid-template-columns: 220px minmax(0, 1fr) 280px;
  gap: 10px;
  background: radial-gradient(circle at 50% 50%, #061129 0%, #020612 100%);
  border: 2px solid #00f0ff;
  box-shadow: 0 0 30px rgba(0,240,255,0.25);
  padding: 10px;
}

.ghost-eeg-header {
  grid-column: 1 / -1;
  background: rgba(10, 17, 34, 0.8);
  border: 1px solid #1e3a6a;
  border-left: 5px solid #00f0ff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
}

.ghost-brainwave-anim {
  width: 180px;
  height: 32px;
}

.ghost-spinal-column {
  background: rgba(10, 17, 34, 0.7);
  border: 1px solid #1e3a6a;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.ghost-jack-port {
  border: 1px solid #1e3a6a;
  background: rgba(0,0,0,0.4);
  padding: 6px 8px;
  border-radius: 3px;
}

.ghost-jack-port.active {
  border-color: #00f0ff;
  box-shadow: inset 0 0 8px rgba(0,240,255,0.2);
}

.ghost-jack-port .led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00f0ff;
  box-shadow: 0 0 6px #00f0ff;
  display: inline-block;
  margin-right: 6px;
}

.ghost-center-chassis {
  display: flex;
  gap: 10px;
  align-items: stretch;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ghost-anatomy-wireframe {
  width: 110px;
  background: rgba(10, 17, 34, 0.5);
  border: 1px solid #1e3a6a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px;
  flex-shrink: 0;
}

.ghost-optical-viewport {
  flex: 1;
  background: #000;
  border: 1px solid #00f0ff;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(0,240,255,0.15);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ghost-spinal-dock {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}

.ghost-neuro-btn {
  flex: 1;
  background: linear-gradient(180deg, #0f1c38 0%, #070e1e 100%);
  border: 1px solid #00f0ff;
  color: #00f0ff;
  font-family: 'Orbitron', sans-serif;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-neuro-btn:hover {
  background: #00f0ff;
  color: #000;
  box-shadow: 0 0 14px #00f0ff;
}

/* Ghost Workshop */
#workshop-ghostdive {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: radial-gradient(circle at 50% 50%, #061129 0%, #020612 100%);
  border: 2px solid #00f0ff;
  padding: 12px;
}


/* --------------------------------------------------------------------------
   STYLE 28: SEINEN MANGA ACTION PANELS (Akira / Tsutomu Nihei BLAME!)
   -------------------------------------------------------------------------- */
.theme-manga {
  --th-bg: #f5f3ef;
  --th-surface: #ffffff;
  --th-surface-alt: #eae6df;
  --th-border: #050505;
  --th-accent: #e60012;
  --th-accent-secondary: #000000;
  --th-danger: #e60012;
  --th-warning: #ff6600;
  --th-text: #050505;
  --th-text-dim: #4a4a4a;
  --th-font-display: 'Syne', 'Noto Sans JP', sans-serif;
  --th-font-mono: 'JetBrains Mono', monospace;
}

#hud-manga {
  grid-template-rows: 56px minmax(0, 1fr) 64px;
  grid-template-columns: 240px minmax(0, 1fr) 260px;
  gap: 12px;
  background-color: #faf8f5;
  background-image: radial-gradient(#050505 18%, transparent 19%);
  background-size: 8px 8px;
  padding: 12px;
  border: 4px solid #050505;
}

.manga-panel {
  background: #ffffff;
  border: 3px solid #050505;
  box-shadow: 4px 4px 0 #050505;
  position: relative;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.manga-panel-angled {
  transform: skewX(-2deg);
}

.manga-header-banner {
  grid-column: 1 / -1;
  background: #050505;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  font-family: 'Syne', 'Noto Sans JP', sans-serif;
  border: 3px solid #050505;
  box-shadow: 4px 4px 0 #e60012;
}

.manga-sfx-float {
  position: absolute;
  font-family: 'Noto Sans JP', sans-serif;
  font-weight: 900;
  font-size: 22px;
  color: #e60012;
  text-shadow: 2px 2px 0 #050505, -1px -1px 0 #fff;
  z-index: 10;
  pointer-events: none;
  animation: mangaJitter 2s infinite ease-in-out;
}

@keyframes mangaJitter {
  0%, 100% { transform: scale(1) rotate(-8deg); }
  50% { transform: scale(1.08) rotate(-5deg); }
}

.manga-map-viewport {
  background: #050505;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid #050505;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.manga-speedlines-bg {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(from 0deg, rgba(255,255,255,0.04) 0deg 4deg, transparent 4deg 12deg);
  pointer-events: none;
}

.manga-action-dock {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}

.manga-action-btn {
  flex: 1;
  background: #ffffff;
  border: 3px solid #050505;
  box-shadow: 4px 4px 0 #050505;
  color: #050505;
  font-family: 'Syne', 'Noto Sans JP', sans-serif;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.1s ease;
  transform: skewX(-3deg);
}

.manga-action-btn:hover {
  background: #e60012;
  color: #ffffff;
  transform: skewX(-3deg) translate(-2px, -2px);
  box-shadow: 6px 6px 0 #050505;
}

/* Manga Workshop */
#workshop-manga {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background-color: #faf8f5;
  background-image: radial-gradient(#050505 18%, transparent 19%);
  background-size: 8px 8px;
  padding: 12px;
  border: 4px solid #050505;
}


/* --------------------------------------------------------------------------
   STYLE 29: ZAIBATSU BIOTECH CLINICAL MONITOR (Clinical ICU / Cleanroom)
   -------------------------------------------------------------------------- */
.theme-biotech {
  --th-bg: #0b0f17;
  --th-surface: #121927;
  --th-surface-alt: #1a2336;
  --th-border: #22324f;
  --th-accent: #2563eb;
  --th-accent-secondary: #00f0ff;
  --th-danger: #dc2626;
  --th-warning: #f59e0b;
  --th-text: #f8fafc;
  --th-text-dim: #73849e;
  --th-font-display: 'Space Grotesk', sans-serif;
  --th-font-mono: 'Share Tech Mono', monospace;
}

#hud-biotech {
  grid-template-rows: 56px minmax(0, 1fr) 64px;
  grid-template-columns: 200px minmax(0, 1fr) 260px;
  gap: 10px;
  background: #080c14;
  border: 2px solid #22324f;
  padding: 10px;
}

.biotech-ekg-header {
  grid-column: 1 / -1;
  background: #0d1422;
  border: 1px solid #22324f;
  border-top: 3px solid #00f0ff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
}

.biotech-ekg-svg {
  width: 200px;
  height: 32px;
}

.biotech-infusion-column {
  background: #0d1422;
  border: 1px solid #22324f;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.biotech-iv-tube {
  border: 1px solid #22324f;
  background: #060910;
  padding: 6px;
  border-radius: 4px;
}

.biotech-iv-level {
  height: 10px;
  background: #1e293b;
  border-radius: 5px;
  overflow: hidden;
  margin-top: 4px;
}

.biotech-iv-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #00f0ff);
  transition: width 0.3s ease;
}

.biotech-microscope-viewport {
  background: #000;
  border: 2px solid #00f0ff;
  border-radius: 6px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 40px rgba(0, 240, 255, 0.2);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.biotech-graticule-ring {
  position: absolute;
  width: 320px;
  height: 320px;
  border: 1px dashed rgba(0, 240, 255, 0.3);
  border-radius: 50%;
  pointer-events: none;
}

.biotech-syringe-dock {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}

.biotech-injector-btn {
  flex: 1;
  background: #111a2c;
  border: 1px solid #2563eb;
  color: #fff;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.biotech-injector-btn:hover {
  background: #2563eb;
  color: #fff;
  box-shadow: 0 0 12px #2563eb;
}

/* Biotech Workshop */
#workshop-biotech {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: #080c14;
  border: 2px solid #22324f;
  padding: 12px;
}


/* --------------------------------------------------------------------------
   STYLE 30: CHIBA BACK-ALLEY RIPPERDOC (Asymmetric Sheet Metal & Neon)
   -------------------------------------------------------------------------- */
.theme-ripperdoc {
  --th-bg: #141010;
  --th-surface: #1e1717;
  --th-surface-alt: #2a2020;
  --th-border: #4a3636;
  --th-accent: #ff007f;
  --th-accent-secondary: #39ff14;
  --th-danger: #ff0033;
  --th-warning: #eab308;
  --th-text: #fff0f5;
  --th-text-dim: #9c8282;
  --th-font-display: 'Rajdhani', 'Noto Sans JP', sans-serif;
  --th-font-mono: 'VT323', monospace;
}

#hud-ripperdoc {
  grid-template-rows: 56px minmax(0, 1fr) 64px;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  gap: 10px;
  background: #141010;
  border: 3px solid #4a3636;
  padding: 10px;
}

.ripperdoc-plate {
  background: #1e1717;
  border: 2px solid #3d2a2a;
  position: relative;
  box-shadow: 3px 3px 8px rgba(0,0,0,0.8);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ripperdoc-plate::after {
  content: '';
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  background: #665050;
  border-radius: 50%;
  box-shadow: inset 1px 1px 2px #000;
}

.ripperdoc-neon-sign {
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 16px;
  font-weight: 900;
  color: #ff007f;
  text-shadow: 0 0 10px #ff007f, 0 0 20px #ff007f;
  animation: neonFlicker 3s infinite alternate;
}

@keyframes neonFlicker {
  0%, 18%, 22%, 25%, 53%, 57%, 100% { opacity: 1; }
  20%, 24%, 55% { opacity: 0.4; }
}

.ripperdoc-duct-tape {
  position: absolute;
  background: rgba(180, 185, 195, 0.45);
  height: 16px;
  width: 60px;
  transform: rotate(-35deg);
  top: -6px;
  left: 20px;
  z-index: 5;
}

.ripperdoc-crt-viewport {
  background: #0d0a0a;
  border: 3px solid #4a3636;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 30px #000;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ripperdoc-dock-switches {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}

.ripperdoc-knife-btn {
  flex: 1;
  background: #2a2020;
  border: 2px solid #ff007f;
  color: #fff;
  font-family: 'Rajdhani', sans-serif;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(255,0,127,0.3);
}

.ripperdoc-knife-btn:hover {
  background: #ff007f;
  color: #000;
  box-shadow: 0 0 16px #ff007f;
}

/* Ripperdoc Workshop */
#workshop-ripperdoc {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: #141010;
  border: 3px solid #4a3636;
  padding: 12px;
}


/* --------------------------------------------------------------------------
   STYLE 31: NEO-TOKYO METRO TRANSIT (Tokyo Subway / Suica IC Card)
   -------------------------------------------------------------------------- */
.theme-tokyo-metro {
  --th-bg: #101216;
  --th-surface: #181c22;
  --th-surface-alt: #222730;
  --th-border: #323a48;
  --th-accent: #00b259;
  --th-accent-secondary: #f39700;
  --th-danger: #e60012;
  --th-warning: #ffcc00;
  --th-text: #ffffff;
  --th-text-dim: #8b97a8;
  --th-font-display: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  --th-font-mono: 'JetBrains Mono', monospace;
}

#hud-tokyo-metro {
  grid-template-rows: 58px minmax(0, 1fr) 64px;
  grid-template-columns: 220px minmax(0, 1fr) 280px;
  gap: 10px;
  background: #101216;
  border: 2px solid #323a48;
  padding: 10px;
}

.metro-station-tracker {
  grid-column: 1 / -1;
  background: #181c22;
  border: 2px solid #323a48;
  border-bottom: 4px solid #00b259;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
}

.metro-route-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  font-size: 11px;
  font-weight: 700;
}

.metro-station-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
}

.metro-station-node.current {
  background: #00b259;
  color: #000;
  font-weight: 800;
}

.metro-suica-gate {
  background: #181c22;
  border: 2px solid #323a48;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: auto;
}

.metro-ic-touchpad {
  background: #00b259;
  color: #000;
  padding: 10px;
  text-align: center;
  font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  font-size: 10px;
  font-weight: 800;
  border-radius: 4px;
  box-shadow: 0 0 14px rgba(0,178,89,0.4);
}

.metro-platform-viewport {
  background: #000;
  border: 2px solid #323a48;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.metro-destination-ribbon {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: #f39700;
  color: #000;
  padding: 3px 8px;
  font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  justify-content: space-between;
}

.metro-departure-board {
  background: #0a0c0f;
  border: 2px solid #323a48;
  padding: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.metro-led-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #ff9900;
  border-bottom: 1px dashed rgba(255,153,0,0.25);
  padding-bottom: 3px;
}

.metro-emergency-dock {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}

.metro-release-btn {
  flex: 1;
  background: #181c22;
  border: 2px solid #00b259;
  color: #fff;
  font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.metro-release-btn:hover {
  background: #00b259;
  color: #000;
}

/* Metro Workshop */
#workshop-tokyo-metro {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: #101216;
  border: 2px solid #323a48;
  padding: 12px;
}


/* --------------------------------------------------------------------------
   STYLE 32: NERV HEX-CANOPY HUD (Neon Genesis Evangelion / MAGI Tri-Core)
   -------------------------------------------------------------------------- */
.theme-nerv {
  --th-bg: #08080a;
  --th-surface: #121217;
  --th-surface-alt: #1a1a22;
  --th-border: #ff7700;
  --th-accent: #ff7700;
  --th-accent-secondary: #00ff66;
  --th-danger: #ff0033;
  --th-warning: #ffaa00;
  --th-text: #ffffff;
  --th-text-dim: #8c8c9e;
  --th-font-display: 'Oxanium', 'Noto Sans JP', sans-serif;
  --th-font-mono: 'JetBrains Mono', monospace;
}

#hud-nerv {
  grid-template-rows: 58px minmax(0, 1fr) 64px;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  gap: 10px;
  background: #08080a;
  border: 2px solid #ff7700;
  padding: 10px;
}

.nerv-magi-header {
  grid-column: 1 / -1;
  background: #121217;
  border: 1px solid #ff7700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
}

.nerv-magi-nodes {
  display: flex;
  gap: 8px;
}

.nerv-magi-pill {
  border: 1px solid #00ff66;
  color: #00ff66;
  padding: 3px 8px;
  font-size: 10px;
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  background: rgba(0,255,102,0.1);
}

.nerv-hex-viewport {
  background: #000;
  border: 2px solid #ff7700;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 30px rgba(255,119,0,0.25);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.nerv-sync-wing {
  background: #121217;
  border: 1px solid #ff7700;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: auto;
}

.nerv-sync-sine {
  width: 100%;
  height: 40px;
}

.nerv-clamps-dock {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}

.nerv-clamp-btn {
  flex: 1;
  background: #1a1410;
  border: 2px solid #ff7700;
  color: #ff7700;
  font-family: 'Oxanium', sans-serif;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nerv-clamp-btn:hover {
  background: #ff7700;
  color: #000;
  box-shadow: 0 0 14px #ff7700;
}

/* NERV Workshop */
#workshop-nerv {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: #08080a;
  border: 2px solid #ff7700;
  padding: 12px;
}


/* --------------------------------------------------------------------------
   STYLE 33: MEGACORP HIGH-FREQUENCY TRADING & TRACTOR PAPER
   -------------------------------------------------------------------------- */
.theme-trading {
  --th-bg: #040806;
  --th-surface: #0a140f;
  --th-surface-alt: #102119;
  --th-border: #1e4231;
  --th-accent: #ffb000;
  --th-accent-secondary: #00ff66;
  --th-danger: #ff3344;
  --th-warning: #ffaa00;
  --th-text: #e2f5ec;
  --th-text-dim: #6b8f7e;
  --th-font-display: 'Courier Prime', monospace;
  --th-font-mono: 'JetBrains Mono', monospace;
}

#hud-trading {
  grid-template-rows: 50px minmax(0, 1fr) 60px;
  grid-template-columns: 24px 220px minmax(0, 1fr) 260px 24px;
  gap: 8px;
  background: #07120c;
  border: 2px solid #1e4231;
  padding: 8px;
}

.trading-tractor-margin {
  background: #0a1810;
  border: 1px solid #142f22;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  padding: 6px 0;
}

.trading-sprocket-hole {
  width: 12px;
  height: 12px;
  background: #000;
  border-radius: 50%;
  border: 1px solid #1e4231;
}

.trading-ticker-bar {
  grid-column: 2 / 5;
  background: #000;
  border: 1px solid #ffb000;
  color: #ffb000;
  overflow: hidden;
  white-space: nowrap;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}

.trading-ticker-scroll {
  display: inline-block;
  animation: tickerSlide 25s linear infinite;
}

@keyframes tickerSlide {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

.trading-order-book {
  background: #0a140f;
  border: 1px solid #1e4231;
  padding: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.trading-bid-row { color: #00ff66; display: flex; justify-content: space-between; }
.trading-ask-row { color: #ff3344; display: flex; justify-content: space-between; }

.trading-ledger-viewport {
  background: #020503;
  border: 1px solid #1e4231;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.trading-execution-dock {
  grid-column: 2 / 5;
  display: flex;
  gap: 8px;
}

.trading-exec-btn {
  flex: 1;
  background: #0a140f;
  border: 1px solid #ffb000;
  color: #ffb000;
  font-family: 'Courier Prime', monospace;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}

.trading-exec-btn:hover {
  background: #ffb000;
  color: #000;
}

/* Trading Workshop */
#workshop-trading {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: #07120c;
  border: 2px solid #1e4231;
  padding: 12px;
}


/* --------------------------------------------------------------------------
   STYLE 34: 3D VOLUMETRIC HOLO-PODIUM (Star Wars / Prometheus Holotable)
   -------------------------------------------------------------------------- */
.theme-holo {
  --th-bg: #020617;
  --th-surface: #0b1528;
  --th-surface-alt: #13223f;
  --th-border: #1e3a6a;
  --th-accent: #38bdf8;
  --th-accent-secondary: #818cf8;
  --th-danger: #f43f5e;
  --th-warning: #fbbf24;
  --th-text: #f0f9ff;
  --th-text-dim: #64748b;
  --th-font-display: 'Chakra Petch', sans-serif;
  --th-font-mono: 'JetBrains Mono', monospace;
}

#hud-holo {
  grid-template-rows: 56px minmax(0, 1fr) 64px;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  gap: 10px;
  background: radial-gradient(circle at 50% 60%, #0c1a36 0%, #020617 100%);
  border: 1px solid #38bdf8;
  box-shadow: 0 0 40px rgba(56,189,248,0.2);
  padding: 10px;
}

.holo-floating-card {
  background: rgba(11, 21, 40, 0.65);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(56, 189, 248, 0.5);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.15);
  padding: 0.75rem;
  border-radius: 4px;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.holo-3d-stage {
  perspective: 900px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.holo-3d-map {
  transform: rotateX(15deg) scale(0.96);
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid #38bdf8;
  box-shadow: 0 0 30px rgba(56,189,248,0.3);
  padding: 0.75rem;
  border-radius: 6px;
}

.holo-emitter-disc {
  position: absolute;
  bottom: -6px;
  width: 260px;
  height: 30px;
  border-radius: 50%;
  background: radial-gradient(circle, #38bdf8 0%, rgba(56,189,248,0.1) 70%, transparent 100%);
  border: 1px solid #38bdf8;
  filter: blur(1px);
}

.holo-gesture-dock {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}

.holo-gesture-btn {
  flex: 1;
  background: rgba(11, 21, 40, 0.8);
  border: 1px solid #38bdf8;
  color: #38bdf8;
  font-family: 'Chakra Petch', sans-serif;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.holo-gesture-btn:hover {
  background: #38bdf8;
  color: #000;
  box-shadow: 0 0 16px #38bdf8;
}

/* Holo Workshop */
#workshop-holo {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: radial-gradient(circle at 50% 60%, #0c1a36 0%, #020617 100%);
  border: 1px solid #38bdf8;
  padding: 12px;
}


/* --------------------------------------------------------------------------
   STYLE 35: DEFCON ORBITAL DRONE RECON (Military Spy Satellite)
   -------------------------------------------------------------------------- */
.theme-drone {
  --th-bg: #090b0e;
  --th-surface: #10141a;
  --th-surface-alt: #161c24;
  --th-border: #22c55e;
  --th-accent: #22c55e;
  --th-accent-secondary: #06b6d4;
  --th-danger: #ef4444;
  --th-warning: #eab308;
  --th-text: #f0fdf4;
  --th-text-dim: #6b7c72;
  --th-font-display: 'Rajdhani', sans-serif;
  --th-font-mono: 'Share Tech Mono', monospace;
}

#hud-drone {
  grid-template-rows: 56px minmax(0, 1fr) 64px;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  gap: 10px;
  background: #090b0e;
  border: 2px solid #22c55e;
  padding: 10px;
}

.drone-ephemeris-header {
  grid-column: 1 / -1;
  background: #10141a;
  border: 1px solid #22c55e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  font-family: 'Share Tech Mono', monospace;
}

.drone-defcon-badge {
  background: #ef4444;
  color: #fff;
  padding: 3px 10px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.1em;
  animation: defconPulse 1.5s infinite;
}

@keyframes defconPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.drone-gunship-viewport {
  background: #000;
  border: 2px solid #22c55e;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 40px rgba(34,197,94,0.15);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.drone-crosshair-lines {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.drone-crosshair-lines::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(34,197,94,0.3);
}
.drone-crosshair-lines::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: rgba(34,197,94,0.3);
}

.drone-strike-dock {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}

.drone-fire-btn {
  flex: 1;
  background: #141a14;
  border: 2px solid #22c55e;
  color: #22c55e;
  font-family: 'Rajdhani', sans-serif;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.drone-fire-btn:hover {
  background: #22c55e;
  color: #000;
  box-shadow: 0 0 14px #22c55e;
}

/* Drone Workshop */
#workshop-drone {
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  background: #090b0e;
  border: 2px solid #22c55e;
  padding: 12px;
}
`;
