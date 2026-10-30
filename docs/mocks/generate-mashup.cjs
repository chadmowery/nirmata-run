const fs = require('fs');
const path = require('path');

console.log("Generating Standalone Mockup: Solaris Vector (#6) x Taikoku Industrial Manifest (#26)...");

const outputHtmlPath = path.join(__dirname, 'mashup-6-26.html');
const publicHtmlPath = path.join(__dirname, '../../public/mashup-6-26.html');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nirmata Runner — Taikoku Vector Manifest (Mock #6 x #26 Mashup)</title>
  
  <!-- Typography from Mock #26 (Space Grotesk, Noto Sans JP, JetBrains Mono) + #6 (Orbitron, Share Tech Mono) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=Noto+Sans+JP:wght@400;600;700;800;900&family=Orbitron:wght@500;700;900&family=Share+Tech+Mono&family=Space+Grotesk:wght@400;600;700;800&display=swap" rel="stylesheet">

  <style>
    /* ==========================================================================
       DESIGN TOKENS: TAIKOKU INDUSTRIAL MANIFEST (#26) x SOLARIS VECTOR (#6)
       ========================================================================== */
    :root {
      --c-bg: #040609;
      --c-surface: #0a0e15;
      --c-surface-elevated: #111722;
      --c-surface-ivory: #f4f4f0;
      --c-border: #1c2638;
      --c-border-bright: #36445d;
      --c-border-ivory: #f4f4f0;
      
      /* Signature Taikoku Acid Lime + Solaris Laser Cyan */
      --c-accent: #d8ff00;          /* Taikoku Acid Chartreuse */
      --c-accent-secondary: #00f0ff;/* Solaris Vector Cyan */
      --c-danger: #ff2a4b;          /* Taikoku Stamp Crimson */
      --c-warning: #ff6600;         /* Industrial Hazard Orange */
      
      --c-text: #ffffff;
      --c-text-ivory: #f4f4f0;
      --c-text-dim: #79889e;
      --c-text-muted: #4a5668;
      
      --font-display: 'Space Grotesk', 'Noto Sans JP', sans-serif;
      --font-mono: 'JetBrains Mono', 'Share Tech Mono', monospace;
      --font-vector: 'Share Tech Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }

    body {
      background: var(--c-bg);
      color: var(--c-text);
      font-family: var(--font-display);
      font-size: 13px;
      line-height: 1.4;
      overflow-x: hidden;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Subtle CRT / Oscilloscope scanline texture */
    body::after {
      content: "";
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: linear-gradient(rgba(18, 24, 34, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
      background-size: 100% 3px;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.55;
    }
    body.no-scanlines::after {
      display: none;
    }

    /* ==========================================================================
       TOP SCREEN SWITCHER BAR & CONTROL MATRIX (STANDALONE CONTROLS)
       ========================================================================== */
    .screen-nav-bar {
      position: sticky;
      top: 0;
      z-index: 2000;
      background: #06090e;
      border-bottom: 2px solid #283344;
      box-shadow: 0 4px 20px rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
    }

    .nav-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 1rem;
      background: #020305;
      border-bottom: 1px solid #141c28;
      font-size: 11px;
    }

    .brand-mark {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

    .brand-badge {
      background: var(--c-accent);
      color: #000;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.1em;
    }

    .brand-sub {
      color: var(--c-accent-secondary);
      font-family: var(--font-mono);
      font-size: 10px;
    }

    .global-sim-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tool-btn {
      background: #111620;
      border: 1px solid #2a3547;
      color: var(--c-text-dim);
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      cursor: pointer;
      border-radius: 2px;
      transition: all 0.15s ease;
    }
    .tool-btn:hover {
      background: #1c2536;
      color: #fff;
      border-color: var(--c-accent-secondary);
    }
    .tool-btn.active {
      background: var(--c-accent);
      color: #000;
      border-color: var(--c-accent);
    }

    .screen-pills-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 1rem;
      overflow-x: auto;
      white-space: nowrap;
      background: #080d14;
    }

    .screen-group-tag {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.15em;
      color: var(--c-text-muted);
      text-transform: uppercase;
      padding: 0 4px;
      margin-left: 6px;
    }

    .screen-pill {
      background: #101520;
      border: 1px solid #263346;
      color: #8c9bb0;
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      cursor: pointer;
      border-radius: 2px;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .screen-pill:hover {
      background: #192233;
      color: #fff;
      border-color: var(--c-accent-secondary);
    }
    .screen-pill.active {
      background: var(--c-accent);
      color: #000;
      border-color: var(--c-accent);
      font-weight: 800;
      box-shadow: 0 0 10px rgba(216, 255, 0, 0.4);
    }
    .screen-pill.active.modal-pill {
      background: var(--c-accent-secondary);
      color: #000;
      border-color: var(--c-accent-secondary);
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
    }
    .screen-pill.active.danger-pill {
      background: var(--c-danger);
      color: #fff;
      border-color: var(--c-danger);
      box-shadow: 0 0 12px rgba(255, 42, 75, 0.5);
    }

    /* ==========================================================================
       SHARED TAIKOKU / SOLARIS ATOMIC COMPONENTS
       ========================================================================== */
    .view-screen {
      display: none;
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      padding: 1rem;
      min-height: calc(100vh - 85px);
      flex: 1;
      position: relative;
    }
    .view-screen.active {
      display: block;
    }

    /* Centered Screen Framework for Title, Transitions & Run End Screens */
    .view-screen-centered {
      display: none;
      width: 100%;
      min-height: calc(100vh - 85px);
      flex: 1;
      padding: 2.5rem 1rem;
      box-sizing: border-box;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    .view-screen-centered.active {
      display: flex !important;
    }

    /* Inverted Stark Taikoku Placard Header */
    .taikoku-placard {
      background: var(--c-surface-ivory);
      color: #000;
      border: 3px solid #000;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.6);
    }
    .placard-title {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.08em;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .placard-kanji {
      font-size: 18px;
      letter-spacing: 0.12em;
    }
    .placard-tag {
      background: #000;
      color: var(--c-accent);
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
    }
    .placard-meta {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    /* Red Angled Inspection Stamp */
    .taikoku-stamp {
      border: 2px solid var(--c-danger);
      color: var(--c-danger);
      padding: 3px 8px;
      font-family: var(--font-display);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.1em;
      transform: rotate(-2.5deg);
      white-space: nowrap;
      text-transform: uppercase;
      box-shadow: 0 0 8px rgba(255, 42, 75, 0.25);
    }

    /* Standard Card / Box Framing */
    .panel-card {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: 2px;
      position: relative;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    }
    .panel-card::before, .panel-card::after {
      content: "";
      position: absolute;
      width: 6px; height: 6px;
      pointer-events: none;
    }
    .panel-card::before {
      top: -1px; left: -1px;
      border-top: 2px solid var(--c-accent);
      border-left: 2px solid var(--c-accent);
    }
    .panel-card::after {
      bottom: -1px; right: -1px;
      border-bottom: 2px solid var(--c-accent-secondary);
      border-right: 2px solid var(--c-accent-secondary);
    }

    .panel-header {
      padding: 8px 12px;
      background: #0c121c;
      border-bottom: 1px solid var(--c-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .panel-heading-text {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .panel-badge {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--c-accent);
      background: rgba(216, 255, 0, 0.1);
      border: 1px solid rgba(216, 255, 0, 0.3);
      padding: 1px 5px;
    }

    /* Dotted leader row */
    .dotted-spec-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 11px;
      padding: 4px 0;
      border-bottom: 1px dotted rgba(255,255,255,0.12);
      font-family: var(--font-display);
    }
    .spec-label {
      color: var(--c-text-dim);
      font-weight: 600;
    }
    .spec-val {
      font-family: var(--font-mono);
      font-weight: 700;
      color: #fff;
    }

    /* Heavy Mechanical Lever Buttons (Mock #26) */
    .btn-lever {
      background: #111824;
      border: 1px solid #28364d;
      color: #fff;
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 800;
      padding: 8px 14px 8px 20px;
      position: relative;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      transition: all 0.15s ease;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .btn-lever::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5px;
      background: var(--c-accent);
      transition: width 0.15s ease;
    }
    .btn-lever:hover {
      background: var(--c-accent);
      color: #000;
      border-color: var(--c-accent);
      box-shadow: 0 0 14px rgba(216, 255, 0, 0.4);
    }
    .btn-lever:hover::before {
      background: #000;
      width: 8px;
    }
    .btn-lever.cyan::before {
      background: var(--c-accent-secondary);
    }
    .btn-lever.cyan:hover {
      background: var(--c-accent-secondary);
      color: #000;
      border-color: var(--c-accent-secondary);
      box-shadow: 0 0 14px rgba(0, 240, 255, 0.4);
    }
    .btn-lever.danger::before {
      background: var(--c-danger);
    }
    .btn-lever.danger:hover {
      background: var(--c-danger);
      color: #fff;
      border-color: var(--c-danger);
      box-shadow: 0 0 14px rgba(255, 42, 75, 0.5);
    }
    .btn-lever:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* Barcode SVG styling */
    .barcode-ladder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .barcode-svg {
      width: 48px;
      height: 120px;
      filter: drop-shadow(0 0 2px rgba(216,255,0,0.3));
    }

    /* ==========================================================================
       SCREEN 1: MAIN MENU / GATEWAY
       ========================================================================== */
    #screen-menu {
      min-height: calc(100vh - 85px);
    }
    .menu-construct {
      width: 100%;
      max-width: 960px;
      margin: auto;
      border: 3px solid #f4f4f0;
      background: #080c14;
      box-shadow: 0 0 60px rgba(0,0,0,0.9), inset 0 0 40px rgba(0,0,0,0.8);
      position: relative;
      overflow: hidden;
    }
    .menu-main-grid {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr) 220px;
      min-height: 480px;
    }
    .menu-left-ladder {
      background: #0d121c;
      border-right: 2px solid #1f2a3c;
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
    }
    .menu-center-hero {
      padding: 2rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: radial-gradient(circle at center, #0f1826 0%, #06090e 100%);
    }
    .menu-hero-canvas {
      width: 100%;
      height: 180px;
      display: block;
    }
    .menu-action-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 1.5rem;
    }
    .menu-right-telemetry {
      background: #0d121c;
      border-left: 2px solid #1f2a3c;
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 14px;
      font-size: 11px;
    }

    /* ==========================================================================
       HUB COMMON SHELL (MOCK #6 MULTI-COLUMN LAYOUT WITH TAIKOKU HEADERS)
       ========================================================================== */
    .hub-tabs-row {
      display: flex;
      align-items: stretch;
      background: #0c121c;
      border: 2px solid #233044;
      border-bottom: none;
      margin-bottom: 0;
    }
    .hub-tab-btn {
      flex: 1;
      padding: 10px 12px;
      background: transparent;
      border: none;
      border-right: 1px solid #233044;
      color: var(--c-text-dim);
      font-family: var(--font-display);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.15s ease;
    }
    .hub-tab-btn:hover {
      background: #141c2a;
      color: #fff;
    }
    .hub-tab-btn.active {
      background: var(--c-accent);
      color: #000;
      font-weight: 900;
    }
    .hub-tab-btn .tab-badge {
      font-family: var(--font-mono);
      font-size: 10px;
      background: rgba(0,0,0,0.3);
      padding: 1px 6px;
      border-radius: 2px;
    }

    .hub-wallet-bar {
      padding: 8px 16px;
      background: #090e17;
      border: 2px solid #233044;
      border-top: none;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 20px;
      font-family: var(--font-mono);
      font-size: 11px;
      margin-bottom: 12px;
    }
    .wallet-chip {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .wallet-chip-label {
      color: var(--c-text-dim);
      font-weight: 600;
    }
    .wallet-chip-val {
      font-weight: 800;
      font-size: 13px;
    }

    /* 3-Column Layouts (Mock #6 Blueprint) */
    .three-col-grid {
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr) 340px;
      gap: 14px;
      align-items: stretch;
    }

    /* ==========================================================================
       SCREEN 2: HUB - SHELL DIAGNOSTICS TAB
       ========================================================================== */
    .shell-wireframe-view {
      position: relative;
      height: 380px;
      background: #030508;
      border: 1px solid var(--c-border);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    #shell3DCanvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .wireframe-overlay-controls {
      position: absolute;
      bottom: 8px;
      right: 8px;
      display: flex;
      gap: 6px;
    }
    .shell-selector-group {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }
    .shell-pill-btn {
      flex: 1;
      padding: 8px 6px;
      background: #111722;
      border: 1px solid #243247;
      color: #94a3b8;
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      text-align: center;
    }
    .shell-pill-btn.active {
      background: var(--c-accent);
      color: #000;
      border-color: var(--c-accent);
      box-shadow: 0 0 10px rgba(216, 255, 0, 0.3);
    }

    /* ==========================================================================
       SCREEN 3: HUB - LOADOUT CONFIGURATION TAB
       ========================================================================== */
    .loadout-slots-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
    }
    .socket-row {
      background: #0d121c;
      border: 1px solid #202b3c;
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: all 0.15s ease;
    }
    .socket-row.equipped {
      border-left: 4px solid var(--c-accent);
      background: #101724;
    }
    .socket-row.empty {
      border-left: 4px solid #334155;
      opacity: 0.7;
    }

    /* ==========================================================================
       SCREEN 4: HUB - WORKSHOP & BLUEPRINT COMPILATION
       ========================================================================== */
    .blueprint-entry {
      background: #0d131e;
      border: 1px solid #1f2b3e;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      transition: all 0.15s ease;
    }
    .blueprint-entry.compiled {
      border-left: 4px solid var(--c-accent-secondary);
    }
    .blueprint-entry.available {
      border-left: 4px solid var(--c-accent);
    }

    /* ==========================================================================
       SCREEN 5: HUB - PERSISTENT VAULT & STASH
       ========================================================================== */
    .vault-grid-container {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 6px;
      padding: 12px;
      background: #070a10;
      border: 1px solid var(--c-border);
      max-height: 480px;
      overflow-y: auto;
    }
    .vault-slot {
      aspect-ratio: 1;
      background: #0d121c;
      border: 1px solid #202c3e;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      cursor: pointer;
      position: relative;
      transition: all 0.15s ease;
    }
    .vault-slot:hover {
      border-color: var(--c-accent);
      background: #151d2c;
    }
    .vault-slot.filled {
      border-color: #3b4d68;
    }
    .vault-slot.selected {
      border-color: var(--c-accent);
      background: rgba(216, 255, 0, 0.12);
      box-shadow: 0 0 10px rgba(216, 255, 0, 0.3);
    }
    .vault-overflow-banner {
      background: #ff2a4b;
      color: #fff;
      padding: 8px 14px;
      font-weight: 800;
      letter-spacing: 0.08em;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      border: 2px solid #fff;
      animation: pulse-danger 1.5s infinite;
    }
    @keyframes pulse-danger {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }

    /* ==========================================================================
       SCREEN 6: HUB - INITIALIZE / DEPLOYMENT PROTOCOL
       ========================================================================== */
    .run-mode-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 1.5rem;
    }
    .run-mode-card {
      background: #0c121c;
      border: 2px solid #253347;
      padding: 1.25rem;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 240px;
      position: relative;
      transition: all 0.15s ease;
    }
    .run-mode-card:hover {
      border-color: var(--c-accent-secondary);
      background: #121a28;
    }
    .run-mode-card.active {
      border-color: var(--c-accent);
      background: #101826;
      box-shadow: 0 0 20px rgba(216, 255, 0, 0.25);
    }
    .run-mode-card.weekly-card.active {
      border-color: #ffaa00;
      box-shadow: 0 0 20px rgba(255, 170, 0, 0.3);
    }

    /* ==========================================================================
       SCREEN 7: HUB - GLOBAL LEADERBOARDS
       ========================================================================== */
    .leaderboard-table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-mono);
      font-size: 11px;
    }
    .leaderboard-table th {
      background: #0e1520;
      color: var(--c-text-dim);
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #263346;
      font-weight: 700;
    }
    .leaderboard-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #18202d;
    }
    .leaderboard-table tr:hover td {
      background: #121926;
      color: var(--c-accent);
    }
    .rank-1 { color: var(--c-accent); font-weight: 900; }
    .rank-2 { color: var(--c-accent-secondary); font-weight: 800; }
    .rank-3 { color: #ffaa00; font-weight: 800; }

    /* ==========================================================================
       SCREEN 10: IN-GAME TACTICAL HUD (FLAGSHIP SOLARIS LAYOUT X TAIKOKU STYLE)
       ========================================================================== */
    .hud-construct {
      display: grid;
      grid-template-rows: 54px minmax(0, 1fr) 68px;
      gap: 10px;
      height: calc(100vh - 110px);
      min-height: 580px;
    }

    /* Top Ribbon */
    .hud-ribbon {
      background: #080d16;
      border: 2px solid #233044;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.25rem;
    }
    .hud-meta-chips {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .hud-chip {
      display: flex;
      flex-direction: column;
    }
    .hud-chip-label {
      font-size: 9px;
      letter-spacing: 0.12em;
      color: var(--c-text-dim);
      font-weight: 700;
    }
    .hud-chip-val {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 800;
      color: #fff;
    }

    .stability-gauge-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      width: 260px;
      gap: 4px;
    }
    .stability-track {
      width: 100%;
      height: 8px;
      background: #111824;
      border: 1px solid #29384e;
      position: relative;
      overflow: hidden;
    }
    .stability-fill {
      height: 100%;
      background: linear-gradient(90deg, #00f0ff, #d8ff00);
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.6);
      transition: width 0.3s ease;
    }

    /* 3-Column Middle Body */
    .hud-main-grid {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr) 300px;
      gap: 10px;
      min-height: 0;
    }

    /* Center Oscilloscope Tactical Viewport */
    .tactical-viewport-bay {
      background: #020406;
      border: 2px solid #f4f4f0;
      position: relative;
      display: flex;
      flex-direction: column;
      box-shadow: inset 0 0 40px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8);
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    #tacticalCanvas {
      width: 100%;
      height: 100%;
      display: block;
      background: #020305;
    }
    .corner-mark {
      position: absolute;
      color: var(--c-accent);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 900;
      pointer-events: none;
    }
    .corner-mark.tl { top: 6px; left: 8px; }
    .corner-mark.tr { top: 6px; right: 8px; }
    .corner-mark.bl { bottom: 6px; left: 8px; }
    .corner-mark.br { bottom: 6px; right: 8px; }

    .viewport-status-tag {
      position: absolute;
      top: 8px;
      left: 30px;
      background: rgba(0,0,0,0.8);
      border: 1px solid var(--c-accent-secondary);
      color: var(--c-accent-secondary);
      font-family: var(--font-mono);
      font-size: 10px;
      padding: 2px 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      pointer-events: none;
    }

    .viewport-controls-hint {
      position: absolute;
      bottom: 8px;
      left: 10px;
      background: rgba(0,0,0,0.8);
      color: var(--c-text-dim);
      font-family: var(--font-mono);
      font-size: 10px;
      padding: 4px 8px;
      display: flex;
      gap: 10px;
    }

    /* Left Column: Diagnostics & Meters */
    .hud-col-left {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }
    .meter-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
    }
    .meter-track {
      width: 100%;
      height: 12px;
      background: #0e1520;
      border: 1px solid #233045;
      position: relative;
      overflow: hidden;
    }
    .meter-fill-hp {
      height: 100%;
      background: #00f0ff;
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
      transition: width 0.2s ease;
    }
    .meter-fill-heat {
      height: 100%;
      background: linear-gradient(90deg, #ffaa00, #ff2a4b);
      box-shadow: 0 0 10px rgba(255, 100, 0, 0.5);
      transition: width 0.2s ease;
    }

    /* Right Column: Telemetry Log & Radar */
    .hud-col-right {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: hidden;
    }
    .telemetry-feed {
      flex: 1;
      background: #06090e;
      border: 1px solid var(--c-border);
      padding: 8px;
      font-family: var(--font-mono);
      font-size: 10px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .log-item {
      display: flex;
      gap: 6px;
      line-height: 1.3;
    }
    .log-time { color: var(--c-text-muted); }
    .log-tag { font-weight: 800; }
    .log-msg { color: #cbd5e1; }

    /* Bottom Levers Bar */
    .hud-bottom-bar {
      background: #080d16;
      border: 2px solid #233044;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      gap: 10px;
    }
    .ability-slots-group {
      display: flex;
      gap: 8px;
      flex: 1;
    }
    .ability-lever {
      flex: 1;
      height: 48px;
      background: #0f1622;
      border: 1px solid #27364b;
      color: #fff;
      font-family: var(--font-display);
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      cursor: pointer;
      position: relative;
      transition: all 0.15s ease;
    }
    .ability-lever::before {
      content: "";
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 4px;
      background: var(--c-accent);
    }
    .ability-lever:hover {
      background: var(--c-accent);
      color: #000;
      border-color: var(--c-accent);
    }
    .ability-lever:hover::before {
      background: #000;
    }

    /* ==========================================================================
       MODAL SCREENS (INVENTORY, ANCHOR, STAIRS, RITUAL)
       ========================================================================== */
    .modal-backdrop-view {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(3, 5, 8, 0.88);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1500;
      padding: 85px 1.5rem 1.5rem 1.5rem;
      box-sizing: border-box;
      overflow-y: auto;
    }
    .modal-box {
      width: 100%;
      max-width: 880px;
      margin: auto;
      background: #0a0e16;
      border: 3px solid #f4f4f0;
      box-shadow: 0 0 50px rgba(0,0,0,0.95);
      position: relative;
      max-height: calc(100vh - 120px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* BSOD Glitch Frame */
    .bsod-frame {
      background: #001238;
      border: 4px solid #00f0ff;
      color: #ffffff;
      padding: 3rem;
      font-family: var(--font-mono);
      width: 100%;
      max-width: 900px;
      margin: auto;
      box-shadow: 0 0 60px rgba(0, 240, 255, 0.4);
      position: relative;
    }

    /* Run Results Bill of Lading Manifest */
    .manifest-bill {
      background: var(--c-surface-ivory);
      color: #000;
      border: 4px solid #000;
      padding: 2rem;
      font-family: var(--font-display);
      width: 100%;
      max-width: 920px;
      margin: auto;
      box-shadow: 0 0 50px rgba(0,0,0,0.9);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Responsive adjustments */
    @media (max-width: 1100px) {
      .three-col-grid, .hud-main-grid {
        grid-template-columns: 1fr;
      }
      .hud-construct {
        height: auto;
      }
    }
  </style>
</head>
<body>

  <!-- ========================================================================
       TOP GLOBAL CONTROL MATRIX & SCREEN SELECTOR
       ======================================================================== -->
  <nav class="screen-nav-bar">
    <div class="nav-header-row">
      <div class="brand-mark">
        <span class="brand-badge">対空重工業 // TAIKOKU VECTOR</span>
        <span>STYLE MASHUP: MOCK #6 (LAYOUT) × MOCK #26 (TYPOGRAPHY & INDUSTRIAL MANIFEST)</span>
        <span class="brand-sub">[SOLARIS WIREFRAME + CONSTRUCTIVIST PACKAGING]</span>
      </div>

      <div class="global-sim-controls">
        <span style="color: var(--c-text-dim); font-size: 10px; font-family: var(--font-mono);">SIM PARAMS:</span>
        <button class="tool-btn" onclick="simStats('dmg')">-5 HP</button>
        <button class="tool-btn" onclick="simStats('heal')">+5 HP</button>
        <button class="tool-btn" onclick="simStats('heat')">+25 HEAT</button>
        <button class="tool-btn" onclick="simStats('vent')">-25 VENT</button>
        <button class="tool-btn" onclick="simStats('step')">STEP TURN [SPACE]</button>
        <button class="tool-btn" id="btnScanlines" onclick="toggleScanlines()">CRT SCANLINES</button>
      </div>
    </div>

    <!-- Screen Navigator Pills -->
    <div class="screen-pills-row">
      <span class="screen-group-tag">PRIMARY:</span>
      <button class="screen-pill active" onclick="switchScreen('menu')" id="pill-menu">01. TITLE MENU</button>
      <button class="screen-pill" onclick="switchScreen('hud')" id="pill-hud">10. TACTICAL HUD (IN-GAME)</button>
      
      <span class="screen-group-tag">HUB SUITE:</span>
      <button class="screen-pill" onclick="switchScreen('hub-shell')" id="pill-hub-shell">02. SHELL DIAGNOSTICS</button>
      <button class="screen-pill" onclick="switchScreen('hub-loadout')" id="pill-hub-loadout">03. LOADOUT</button>
      <button class="screen-pill" onclick="switchScreen('hub-workshop')" id="pill-hub-workshop">04. WORKSHOP</button>
      <button class="screen-pill" onclick="switchScreen('hub-vault')" id="pill-hub-vault">05. VAULT & STASH</button>
      <button class="screen-pill" onclick="switchScreen('hub-init')" id="pill-hub-init">06. INITIALIZE PROTOCOL</button>
      <button class="screen-pill" onclick="switchScreen('hub-leaderboard')" id="pill-hub-leaderboard">07. LEADERBOARDS</button>

      <span class="screen-group-tag">TACTICAL MODALS:</span>
      <button class="screen-pill modal-pill" onclick="switchScreen('modal-inventory')" id="pill-modal-inventory">11. INVENTORY [I]</button>
      <button class="screen-pill modal-pill" onclick="switchScreen('modal-anchor')" id="pill-modal-anchor">12. STABILITY ANCHOR [E]</button>
      <button class="screen-pill modal-pill" onclick="switchScreen('modal-stairs')" id="pill-modal-stairs">13. AIRLOCK DESCENT [D]</button>

      <span class="screen-group-tag">TRANSITIONS & RUN END:</span>
      <button class="screen-pill modal-pill" onclick="switchScreen('modal-ritual')" id="pill-modal-ritual">08. PRE-FLIGHT RITUAL</button>
      <button class="screen-pill" onclick="switchScreen('boot-seq')" id="pill-boot-seq">09. BOOT SEQUENCE</button>
      <button class="screen-pill danger-pill" onclick="switchScreen('screen-bsod')" id="pill-screen-bsod">14. FATAL BSOD CRASH</button>
      <button class="screen-pill modal-pill" onclick="switchScreen('screen-results')" id="pill-screen-results">15. RUN RESULTS</button>
    </div>
  </nav>

  <!-- ========================================================================
       SCREEN 1: TITLE / MAIN MENU (GATEWAY)
       ======================================================================== -->
  <main class="view-screen-centered active" id="screen-menu">
    <div class="menu-construct">
      <!-- Inverted Taikoku Placard -->
      <div class="taikoku-placard" style="margin-bottom: 0; border: none; border-bottom: 3px solid #000;">
        <div class="placard-title">
          <span class="placard-kanji">対空重工業</span>
          <span>NIRMATA RUNNER // TAIKOKU VECTOR MANIFEST</span>
        </div>
        <div class="placard-meta">
          <span class="taikoku-stamp">合格 // LINK CERTIFIED</span>
          <span>BUILD: v1.0.4-TK-VEC</span>
        </div>
      </div>

      <div class="menu-main-grid">
        <!-- Left Barcode Ladder & Japanese Placards -->
        <div class="menu-left-ladder">
          <div style="font-family: var(--font-mono); font-size: 9px; color: var(--c-text-dim); text-align: center;">
            SPECIFICATION TK-8890<br>
            HEAVY VECTOR DYNAMICS
          </div>

          <div class="barcode-ladder">
            <svg class="barcode-svg" viewBox="0 0 48 120">
              <rect x="2" y="0" width="3" height="120" fill="#d8ff00"/>
              <rect x="8" y="0" width="2" height="120" fill="#d8ff00"/>
              <rect x="13" y="0" width="6" height="120" fill="#d8ff00"/>
              <rect x="22" y="0" width="2" height="120" fill="#d8ff00"/>
              <rect x="27" y="0" width="4" height="120" fill="#d8ff00"/>
              <rect x="34" y="0" width="2" height="120" fill="#d8ff00"/>
              <rect x="38" y="0" width="5" height="120" fill="#d8ff00"/>
            </svg>
            <span style="font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; color: var(--c-accent);">TK-88902-C</span>
          </div>

          <div style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: var(--c-accent-secondary);">
            神経リンク同期完了 // NEURAL LINK READY
          </div>
        </div>

        <!-- Center Hero & Action Levers -->
        <div class="menu-center-hero">
          <div>
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.15em; color: var(--c-accent-secondary); margin-bottom: 4px;">
              PERSISTENT SUITE // TURN-BASED EXTRACTION ROGUELIKE
            </div>
            <h1 style="font-size: 38px; font-weight: 900; letter-spacing: 0.05em; line-height: 1.1; color: #fff;">
              NIRMATA<span style="color: var(--c-accent);">_RUNNER</span>
            </h1>
            <p style="font-size: 12px; color: var(--c-text-dim); margin-top: 6px;">
              Modular 1px oscilloscope wireframe telemetry engineered with high-contrast constructivist shipping manifests.
            </p>
          </div>

          <!-- Rotating Vector Wireframe Canvas -->
          <canvas id="menuHeroCanvas" class="menu-hero-canvas"></canvas>

          <!-- Heavy Mechanical Action Buttons -->
          <div class="menu-action-stack">
            <button class="btn-lever" onclick="switchScreen('hub-shell')">
              <span>[01] ENTER NEURAL DECK [神経デッキ接続]</span>
              <span style="font-family: var(--font-mono); font-size: 10px;">→</span>
            </button>
            <button class="btn-lever cyan" onclick="switchScreen('hud')">
              <span>[02] DIRECT DEPLOY: TACTICAL HUD [即時出撃]</span>
              <span style="font-family: var(--font-mono); font-size: 10px;">TACTICAL</span>
            </button>
            <button class="btn-lever" onclick="switchScreen('hub-leaderboard')">
              <span>[03] RECON LEADERBOARDS [戦績記録]</span>
              <span style="font-family: var(--font-mono); font-size: 10px;">DAILY/WEEKLY</span>
            </button>
          </div>
        </div>

        <!-- Right Side Telemetry -->
        <div class="menu-right-telemetry">
          <div style="font-weight: 800; color: var(--c-accent); border-bottom: 1px solid #233044; padding-bottom: 4px;">
            SYSTEM TELEMETRY
          </div>
          <div class="dotted-spec-row">
            <span class="spec-label">KERNEL</span>
            <span class="spec-val">v1.04-TK</span>
          </div>
          <div class="dotted-spec-row">
            <span class="spec-label">ACTIVE SEED</span>
            <span class="spec-val">#W-4028</span>
          </div>
          <div class="dotted-spec-row">
            <span class="spec-label">FLUX BALANCE</span>
            <span class="spec-val" style="color: var(--c-accent-secondary);">380 FLX</span>
          </div>
          <div class="dotted-spec-row">
            <span class="spec-label">SCRAP WALLET</span>
            <span class="spec-val" style="color: #ffaa00;">1,420 CR</span>
          </div>
          <div class="dotted-spec-row">
            <span class="spec-label">CHASSIS SYNC</span>
            <span class="spec-val">VANGUARD-v1</span>
          </div>

          <div style="margin-top: auto; border: 1px dashed var(--c-danger); padding: 8px; text-align: center;">
            <div style="color: var(--c-danger); font-weight: 800; font-size: 10px;">SECURITY NOTICE</div>
            <div style="font-size: 9px; color: var(--c-text-dim); margin-top: 2px;">Permadeath active on Weekly One-Shot protocol.</div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- ========================================================================
       SCREEN 2: HUB - SHELL DIAGNOSTICS (3-COLUMN SOLARIS WIREFRAME)
       ======================================================================== -->
  <section class="view-screen" id="screen-hub-shell">
    <div class="taikoku-placard">
      <div class="placard-title">
        <span class="placard-kanji">機体診断</span>
        <span>SHELL CHASSIS DIAGNOSTICS & HARDWARE MOD DOCK</span>
      </div>
      <div class="placard-meta">
        <span class="taikoku-stamp">認証完了 // DOCK ACTIVE</span>
        <span>NEURAL DECK // HUB PROTOCOL</span>
      </div>
    </div>

    <!-- Hub Sub-Navigation -->
    <div class="hub-tabs-row">
      <button class="hub-tab-btn active" onclick="switchScreen('hub-shell')">SHELL [機体]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-loadout')">LOADOUT [装備]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-workshop')">WORKSHOP [工房]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-vault')">VAULT [保管庫]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-init')">INITIALIZE [出撃]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-leaderboard')">LEADERBOARDS [順位]</button>
    </div>

    <div class="hub-wallet-bar">
      <div class="wallet-chip">
        <span class="wallet-chip-label">META FLUX:</span>
        <span class="wallet-chip-val" style="color: var(--c-accent-secondary);" id="hubFluxVal">380 FLX</span>
      </div>
      <div class="wallet-chip">
        <span class="wallet-chip-label">RUN SCRAP:</span>
        <span class="wallet-chip-val" style="color: #ffaa00;" id="hubScrapVal">1,420 CR</span>
      </div>
    </div>

    <!-- 3-Column Solaris Layout with Taikoku Styling -->
    <div class="three-col-grid">
      <!-- Col 1: Shell Chassis Specs -->
      <aside class="panel-card" style="padding: 1rem;">
        <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
          <span class="panel-heading-text">CHASSIS SPECIFICATIONS</span>
          <span class="panel-badge">FLUX SINK</span>
        </div>

        <div class="shell-selector-group">
          <button class="shell-pill-btn active" id="btnShell-vanguard" onclick="selectShell('vanguard')">VANGUARD</button>
          <button class="shell-pill-btn" id="btnShell-bastion" onclick="selectShell('bastion')">BASTION</button>
          <button class="shell-pill-btn" id="btnShell-ghost" onclick="selectShell('ghost')">GHOST</button>
        </div>

        <div id="shellSpecsDetails">
          <!-- Populated dynamically by JS -->
        </div>
      </aside>

      <!-- Col 2: Interactive 3D Vector Wireframe Canvas -->
      <section class="panel-card" style="padding: 1rem; display: flex; flex-direction: column;">
        <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
          <span class="panel-heading-text">1PX VECTOR WIREFRAME HOLOGRAM // MODEL VIEW</span>
          <span class="panel-badge" style="color: var(--c-accent-secondary); border-color: var(--c-accent-secondary);">ROTATING 3D</span>
        </div>

        <div class="shell-wireframe-view">
          <canvas id="shell3DCanvas"></canvas>
          <div class="wireframe-overlay-controls">
            <button class="tool-btn" onclick="toggleWireframeRotation()">PAUSE / ROTATE</button>
            <button class="tool-btn" onclick="resetWireframeCam()">RESET CAM</button>
          </div>
        </div>

        <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 11px; color: var(--c-text-dim);">
          <span>ROTATION AXIS: [Y-AUTO, X-TILT 15°]</span>
          <span style="color: var(--c-accent);">VECTOR PHOSPHOR: 00F0FF // D8FF00</span>
        </div>
      </section>

      <!-- Col 3: Persistent Upgrades Station -->
      <aside class="panel-card" style="padding: 1rem;">
        <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
          <span class="panel-heading-text">HARDWARE UPGRADE DOCK</span>
          <span class="panel-badge">META REINFORCE</span>
        </div>

        <div style="font-size: 11px; color: var(--c-text-dim); margin-bottom: 12px;">
          Permanent shell modifications persist through standard runs.
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div class="socket-row equipped">
            <div>
              <div style="font-weight: 800; font-size: 11px;">LOCOMOTION COILS</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">+10 Base Movement Speed</div>
            </div>
            <button class="btn-lever" onclick="upgradeShell('speed')" style="padding: 4px 8px; font-size: 10px;">50 FLX</button>
          </div>

          <div class="socket-row equipped">
            <div>
              <div style="font-weight: 800; font-size: 11px;">TITANIUM COMPOSITE PLATING</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">+1 Passive Armor Absorption</div>
            </div>
            <button class="btn-lever" onclick="upgradeShell('armor')" style="padding: 4px 8px; font-size: 10px;">75 FLX</button>
          </div>

          <div class="socket-row equipped">
            <div>
              <div style="font-weight: 800; font-size: 11px;">REALITY TETHER STABILIZER</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">+2 Baseline Stability Factor</div>
            </div>
            <button class="btn-lever" onclick="upgradeShell('stability')" style="padding: 4px 8px; font-size: 10px;">60 FLX</button>
          </div>

          <div class="socket-row empty">
            <div>
              <div style="font-weight: 800; font-size: 11px;">SUBROUTINE BUS EXPANSION</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">+1 Software Slot (Locked)</div>
            </div>
            <button class="btn-lever cyan" onclick="upgradeShell('ports')" style="padding: 4px 8px; font-size: 10px;">120 FLX</button>
          </div>
        </div>
      </aside>
    </div>
  </section>

  <!-- ========================================================================
       SCREEN 3: HUB - LOADOUT CONFIGURATION TAB
       ======================================================================== -->
  <section class="view-screen" id="screen-hub-loadout">
    <div class="taikoku-placard">
      <div class="placard-title">
        <span class="placard-kanji">装備換装</span>
        <span>LOADOUT CONFIGURATION & FIRMWARE SOCKET MATRIX</span>
      </div>
      <div class="placard-meta">
        <span class="taikoku-stamp">承認待 // SOCKET MATRIX</span>
        <span>MEMORY: 12 / 16 MB LOADED</span>
      </div>
    </div>

    <!-- Hub Sub-Navigation -->
    <div class="hub-tabs-row">
      <button class="hub-tab-btn" onclick="switchScreen('hub-shell')">SHELL [機体]</button>
      <button class="hub-tab-btn active" onclick="switchScreen('hub-loadout')">LOADOUT [装備]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-workshop')">WORKSHOP [工房]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-vault')">VAULT [保管庫]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-init')">INITIALIZE [出撃]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-leaderboard')">LEADERBOARDS [順位]</button>
    </div>

    <div class="three-col-grid" style="margin-top: 14px;">
      <!-- Col 1: Active Socket Matrix -->
      <aside class="panel-card" style="padding: 1rem;">
        <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
          <span class="panel-heading-text">INSTALLED HARDWARE</span>
          <span class="panel-badge">VANGUARD-v1</span>
        </div>

        <div class="loadout-slots-container">
          <div style="font-size: 10px; font-weight: 800; color: var(--c-accent); margin-bottom: 2px;">FIRMWARE SLOTS (ACTIVE ABILITIES)</div>
          <div class="socket-row equipped">
            <div>
              <div style="font-weight: 800; color: #fff;">Phase_Shift.sh</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">Cooldown: 12 Turns // Heat +20</div>
            </div>
            <button class="tool-btn" onclick="unequipSlot('firmware', 0)">UNEQUIP</button>
          </div>
          <div class="socket-row equipped">
            <div>
              <div style="font-weight: 800; color: #fff;">Kinetic_Link.exe</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">Cooldown: 8 Turns // Heat +15</div>
            </div>
            <button class="tool-btn" onclick="unequipSlot('firmware', 1)">UNEQUIP</button>
          </div>

          <div style="font-size: 10px; font-weight: 800; color: var(--c-accent-secondary); margin-top: 8px; margin-bottom: 2px;">AUGMENT SLOTS (PASSIVE MODIFIERS)</div>
          <div class="socket-row equipped">
            <div>
              <div style="font-weight: 800; color: #fff;">Overclock_Resonance.arc</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">ON_OVERCLOCK → 6 AoE Shockwave</div>
            </div>
            <button class="tool-btn" onclick="unequipSlot('augment', 0)">UNEQUIP</button>
          </div>

          <div style="font-size: 10px; font-weight: 800; color: #ffaa00; margin-top: 8px; margin-bottom: 2px;">SOFTWARE SLOTS (UTILITY SUBROUTINES)</div>
          <div class="socket-row empty">
            <div style="font-size: 11px; color: var(--c-text-dim);">EMPTY SOCKET [スロット空]</div>
            <button class="tool-btn" disabled>SLOT</button>
          </div>
        </div>
      </aside>

      <!-- Col 2: Selected Item Technical Placard -->
      <section class="panel-card" style="padding: 1.25rem;">
        <div class="panel-header" style="margin: -1.25rem -1.25rem 1.25rem -1.25rem;">
          <span class="panel-heading-text">CIRCUIT TELEMETRY // SCHEMATIC PREVIEW</span>
          <span class="panel-badge">TECH TIER 2</span>
        </div>

        <div style="border: 2px solid var(--c-border); background: #070a10; padding: 1rem; position: relative;">
          <div class="corner-mark tl">+</div>
          <div class="corner-mark tr">+</div>
          <div class="corner-mark bl">+</div>
          <div class="corner-mark br">+</div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--c-border); padding-bottom: 8px;">
            <div>
              <span style="font-size: 18px; font-weight: 900; color: var(--c-accent);">Phase_Shift.sh</span>
              <div style="font-size: 10px; color: var(--c-text-dim); font-family: var(--font-mono);">SHA-256: 8a7c...3b01 // TAIKOKU TACTICAL CODEC</div>
            </div>
            <span class="taikoku-stamp">CLASS 2 // ACTIVE</span>
          </div>

          <div style="margin: 1rem 0; font-size: 12px; line-height: 1.5; color: #cbd5e1;">
            Phase-shifts runner through spatial coordinates up to 3 tiles forward. Penetrates hostile hitboxes and ignores wall collision during transit. Incurs +20 Heat penalty.
          </div>

          <div class="dotted-spec-row">
            <span class="spec-label">COOLDOWN CYCLES</span>
            <span class="spec-val">12 TURNS</span>
          </div>
          <div class="dotted-spec-row">
            <span class="spec-label">THERMAL INJECTION</span>
            <span class="spec-val" style="color: #ff6600;">+20 HEAT TIER 1</span>
          </div>
          <div class="dotted-spec-row">
            <span class="spec-label">MEMORY CONSUMPTION</span>
            <span class="spec-val">4.0 MB BUFFER</span>
          </div>
        </div>
      </section>

      <!-- Col 3: Reserve Module Drawer -->
      <aside class="panel-card" style="padding: 1rem;">
        <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
          <span class="panel-heading-text">RESERVE HARDWARE STASH</span>
          <span class="panel-badge">4 AVAILABLE</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 440px; overflow-y: auto;">
          <div class="blueprint-entry available">
            <div>
              <div style="font-weight: 800; font-size: 11px;">Thermal_Sink.sys</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">Augment // Passive -20% Heat Gain</div>
            </div>
            <button class="btn-lever" onclick="alert('Equipped Thermal_Sink.sys')" style="padding: 4px 8px; font-size: 10px;">EQUIP</button>
          </div>

          <div class="blueprint-entry available">
            <div>
              <div style="font-weight: 800; font-size: 11px;">EMP_Disruption.sh</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">Firmware // Stun hostiles 2 turns</div>
            </div>
            <button class="btn-lever" onclick="alert('Equipped EMP_Disruption.sh')" style="padding: 4px 8px; font-size: 10px;">EQUIP</button>
          </div>

          <div class="blueprint-entry available">
            <div>
              <div style="font-weight: 800; font-size: 11px;">Decoy_Echo.dat</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">Software // Spawns holographic lure</div>
            </div>
            <button class="btn-lever cyan" onclick="alert('Equipped Decoy_Echo.dat')" style="padding: 4px 8px; font-size: 10px;">EQUIP</button>
          </div>
        </div>
      </aside>
    </div>
  </section>

  <!-- ========================================================================
       SCREEN 4: HUB - WORKSHOP & BLUEPRINT COMPILATION
       ======================================================================== -->
  <section class="view-screen" id="screen-hub-workshop">
    <div class="taikoku-placard">
      <div class="placard-title">
        <span class="placard-kanji">工作端末</span>
        <span>BLUEPRINT COMPILATION & HARDWARE WORKSHOP</span>
      </div>
      <div class="placard-meta">
        <span class="taikoku-stamp">製作可能 // FABRICATION</span>
        <span>COMPILER v2.4</span>
      </div>
    </div>

    <!-- Hub Sub-Navigation -->
    <div class="hub-tabs-row">
      <button class="hub-tab-btn" onclick="switchScreen('hub-shell')">SHELL [機体]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-loadout')">LOADOUT [装備]</button>
      <button class="hub-tab-btn active" onclick="switchScreen('hub-workshop')">WORKSHOP [工房]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-vault')">VAULT [保管庫]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-init')">INITIALIZE [出撃]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-leaderboard')">LEADERBOARDS [順位]</button>
    </div>

    <div class="three-col-grid" style="margin-top: 14px;">
      <!-- Blueprint Database -->
      <aside class="panel-card" style="padding: 1rem;">
        <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
          <span class="panel-heading-text">BLUEPRINT REPOSITORY</span>
          <span class="panel-badge">FLUX COMPILER</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="blueprint-entry compiled">
            <div>
              <div style="font-weight: 800; font-size: 11px; color: var(--c-accent-secondary);">Phase_Shift.sh</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">STATUS: COMPILED // IN STASH</div>
            </div>
            <span style="font-family: var(--font-mono); font-size: 10px; color: var(--c-accent-secondary);">OK</span>
          </div>

          <div class="blueprint-entry available">
            <div>
              <div style="font-weight: 800; font-size: 11px;">Nanite_Repair_Core.arc</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">COST: 100 FLUX // TIER 2</div>
            </div>
            <button class="btn-lever" onclick="compileBlueprint('Nanite_Repair_Core.arc', 100)" style="padding: 4px 8px; font-size: 10px;">COMPILE</button>
          </div>

          <div class="blueprint-entry available">
            <div>
              <div style="font-weight: 800; font-size: 11px;">Cryo_Thermal_Venting.arc</div>
              <div style="font-size: 10px; color: var(--c-text-dim);">COST: 75 FLUX // TIER 1</div>
            </div>
            <button class="btn-lever" onclick="compileBlueprint('Cryo_Thermal_Venting.arc', 75)" style="padding: 4px 8px; font-size: 10px;">COMPILE</button>
          </div>
        </div>
      </aside>

      <!-- Center Compilation Terminal -->
      <section class="panel-card" style="padding: 1.25rem;">
        <div class="panel-header" style="margin: -1.25rem -1.25rem 1.25rem -1.25rem;">
          <span class="panel-heading-text">QUANTUM COMPILATION CHAMBER</span>
          <span class="panel-badge">SYNTHESIS</span>
        </div>

        <div style="background: #06090e; border: 2px solid var(--c-border); padding: 1.5rem; text-align: center;">
          <div style="font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 6px;">COMPILATION BUFFER READY</div>
          <div style="font-size: 11px; color: var(--c-text-dim); margin-bottom: 1.5rem;">Select blueprint from left matrix to synthesize into physical hardware module.</div>

          <div style="width: 100%; height: 10px; background: #111824; border: 1px solid #28374d; margin-bottom: 1rem; overflow: hidden;">
            <div id="compilerProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f0ff, #d8ff00); transition: width 0.8s ease;"></div>
          </div>

          <div style="display: flex; justify-content: center; gap: 12px;">
            <button class="btn-lever cyan" onclick="triggerSimCompilation()">SYNTHESIZE TEST ARTIFACT</button>
          </div>
        </div>
      </section>

      <!-- Scrap Recycling Station -->
      <aside class="panel-card" style="padding: 1rem;">
        <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
          <span class="panel-heading-text">SCRAP RECYCLING & SALVAGE</span>
          <span class="panel-badge">FLUX CONVERSION</span>
        </div>

        <div style="font-size: 11px; color: var(--c-text-dim); margin-bottom: 12px;">
          Grind surplus unequipped gear recovered from previous runs into Meta Flux.
        </div>

        <div class="dotted-spec-row">
          <span class="spec-label">SCRAP EXCHANGE RATE</span>
          <span class="spec-val">100 CR → 15 FLUX</span>
        </div>
        <div class="dotted-spec-row">
          <span class="spec-label">RECOVERY EFFICIENCY</span>
          <span class="spec-val">94.2% [MIL-SPEC]</span>
        </div>

        <div style="margin-top: 1rem;">
          <button class="btn-lever" onclick="recycleScrapForFlux()" style="width: 100%;">EXCHANGE 200 SCRAP → 30 FLUX</button>
        </div>
      </aside>
    </div>
  </section>

  <!-- ========================================================================
       SCREEN 5: HUB - PERSISTENT VAULT & STASH
       ======================================================================== -->
  <section class="view-screen" id="screen-hub-vault">
    <div class="taikoku-placard">
      <div class="placard-title">
        <span class="placard-kanji">物資保管庫</span>
        <span>PERSISTENT SECURE VAULT // 48-CONTAINER CARGO MATRIX</span>
      </div>
      <div class="placard-meta">
        <span class="taikoku-stamp">封印済 // SEALED</span>
        <span>SLOTS: 18 / 48 OCCUPIED</span>
      </div>
    </div>

    <!-- Hub Sub-Navigation -->
    <div class="hub-tabs-row">
      <button class="hub-tab-btn" onclick="switchScreen('hub-shell')">SHELL [機体]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-loadout')">LOADOUT [装備]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-workshop')">WORKSHOP [工房]</button>
      <button class="hub-tab-btn active" onclick="switchScreen('hub-vault')">VAULT [保管庫]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-init')">INITIALIZE [出撃]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-leaderboard')">LEADERBOARDS [順位]</button>
    </div>

    <!-- Vault Overflow Warning Banner Simulation -->
    <div class="vault-overflow-banner" id="vaultOverflowAlert">
      <span>⚠️ 警告: VAULT OVERFLOW DETECTED // 3 RECOVERED ITEMS UNRESOLVED</span>
      <button class="tool-btn" onclick="resolveVaultOverflow()" style="background: #000; color: #fff;">RESOLVE OVERFLOW</button>
    </div>

    <div class="three-col-grid">
      <!-- 48-Slot Container Grid (Mock #6 high density) -->
      <section class="panel-card" style="grid-column: 1 / 3; padding: 1rem;">
        <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
          <span class="panel-heading-text">CARGO BAYS [A-01 THROUGH F-08]</span>
          <span class="panel-badge">SECURE CONTAINMENT</span>
        </div>

        <div class="vault-grid-container" id="vaultSlotsGrid">
          <!-- Populated dynamically with 48 slots -->
        </div>
      </section>

      <!-- Item Inspection Drawer -->
      <aside class="panel-card" style="padding: 1.25rem;">
        <div class="panel-header" style="margin: -1.25rem -1.25rem 1.25rem -1.25rem;">
          <span class="panel-heading-text">MANIFEST INSPECTOR</span>
          <span class="panel-badge">ITEM DATA</span>
        </div>

        <div id="vaultItemInspector" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 16px; font-weight: 800; color: var(--c-accent);" id="inspItemName">KINETIC_LINK.exe</div>
          <div style="font-size: 10px; font-family: var(--font-mono); color: var(--c-text-dim);" id="inspItemId">SERIAL: TK-MOD-9941</div>

          <div style="font-size: 11px; line-height: 1.4; color: #cbd5e1; border-top: 1px solid var(--c-border); padding-top: 8px;" id="inspItemDesc">
            Chains kinetic damage between adjacent hostiles within 2 tile radius. High damage conductivity.
          </div>

          <div class="dotted-spec-row">
            <span class="spec-label">TYPE</span>
            <span class="spec-val">ACTIVE FIRMWARE</span>
          </div>
          <div class="dotted-spec-row">
            <span class="spec-label">SCRAP VALUE</span>
            <span class="spec-val" style="color: #ffaa00;">180 CR</span>
          </div>

          <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 8px;">
            <button class="btn-lever" onclick="alert('Item transferred to active loadout!')">TRANSFER TO LOADOUT</button>
            <button class="btn-lever danger" onclick="alert('Item salvaged for 180 Scrap!')">SALVAGE FOR SCRAP</button>
          </div>
        </div>
      </aside>
    </div>
  </section>

  <!-- ========================================================================
       SCREEN 6: HUB - INITIALIZE / DEPLOYMENT PROTOCOL
       ======================================================================== -->
  <section class="view-screen" id="screen-hub-init">
    <div class="taikoku-placard">
      <div class="placard-title">
        <span class="placard-kanji">出撃認可</span>
        <span>DEPLOYMENT PROTOCOL // MISSION PROFILE & RUN MUTATORS</span>
      </div>
      <div class="placard-meta">
        <span class="taikoku-stamp">出撃可能 // CLEAR TO LAUNCH</span>
        <span>AUTH-TOKEN: #TK-INIT-90</span>
      </div>
    </div>

    <!-- Hub Sub-Navigation -->
    <div class="hub-tabs-row">
      <button class="hub-tab-btn" onclick="switchScreen('hub-shell')">SHELL [機体]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-loadout')">LOADOUT [装備]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-workshop')">WORKSHOP [工房]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-vault')">VAULT [保管庫]</button>
      <button class="hub-tab-btn active" onclick="switchScreen('hub-init')">INITIALIZE [出撃]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-leaderboard')">LEADERBOARDS [順位]</button>
    </div>

    <div style="margin-top: 14px;">
      <div class="run-mode-grid">
        <!-- Mode 1: Simulation -->
        <div class="run-mode-card" onclick="selectRunMode('simulation')" id="modeCard-simulation">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: 800; font-size: 14px;">STANDARD SIMULATION</span>
              <span class="panel-badge">TRAINING</span>
            </div>
            <div style="font-size: 11px; color: var(--c-text-dim); margin-top: 8px;">
              Zero permadeath risk. Practice tactical patterns and test newly compiled firmware builds without hardware loss.
            </div>
          </div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: var(--c-accent-secondary);">
            REWARD MULTIPLIER: 1.0x SCRAP
          </div>
        </div>

        <!-- Mode 2: Daily Challenge -->
        <div class="run-mode-card" onclick="selectRunMode('daily')" id="modeCard-daily">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: 800; font-size: 14px;">DAILY CHALLENGE</span>
              <span class="panel-badge" style="color: var(--c-accent); border-color: var(--c-accent);">DAILY SEED</span>
            </div>
            <div style="font-size: 11px; color: var(--c-text-dim); margin-top: 8px;">
              Fixed seed standardized across all global runners. Compete on the daily leaderboard with fixed mutator profiles.
            </div>
          </div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: var(--c-accent);">
            MUTATOR: SOLAR_FLARE (+50% Heat)
          </div>
        </div>

        <!-- Mode 3: Weekly One-Shot -->
        <div class="run-mode-card weekly-card active" onclick="selectRunMode('weekly')" id="modeCard-weekly">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: 900; font-size: 14px; color: #ffaa00;">WEEKLY ONE-SHOT</span>
              <span class="taikoku-stamp" style="font-size: 8px;">永久死亡 // PERMADEATH</span>
            </div>
            <div style="font-size: 11px; color: var(--c-text-dim); margin-top: 8px;">
              Single attempt per calendar week. High-tier blueprint drops, quadruple scrap multipliers, permanent shell loss on KIA.
            </div>
          </div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: #ffaa00;">
            REWARD MULTIPLIER: 4.0x SCRAP & FLUX
          </div>
        </div>
      </div>

      <!-- Protocol Specifications & Launch Commitment -->
      <div class="panel-card" style="padding: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #fff;">SELECTED PROTOCOL: <span id="initSelectedModeLabel" style="color: #ffaa00;">WEEKLY ONE-SHOT</span></div>
          <div style="font-size: 11px; color: var(--c-text-dim); margin-top: 4px;">
            Seed: #W-4028 // Verified Neural Bridge // Shell: VANGUARD-v1 // Permadeath active
          </div>
        </div>

        <button class="btn-lever" onclick="switchScreen('modal-ritual')" style="padding: 12px 24px; font-size: 13px;">
          <span>COMMIT TO DEPLOYMENT RITUAL [発進確認]</span>
          <span>→</span>
        </button>
      </div>
    </div>
  </section>

  <!-- ========================================================================
       SCREEN 7: HUB - GLOBAL LEADERBOARDS
       ======================================================================== -->
  <section class="view-screen" id="screen-hub-leaderboard">
    <div class="taikoku-placard">
      <div class="placard-title">
        <span class="placard-kanji">戦績順位</span>
        <span>GLOBAL NEURAL RECON LEADERBOARD // CERTIFIED OPERATORS</span>
      </div>
      <div class="placard-meta">
        <span class="taikoku-stamp">認証済 // VERIFIED RUNS</span>
        <span>SEED: #W-4028</span>
      </div>
    </div>

    <!-- Hub Sub-Navigation -->
    <div class="hub-tabs-row">
      <button class="hub-tab-btn" onclick="switchScreen('hub-shell')">SHELL [機体]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-loadout')">LOADOUT [装備]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-workshop')">WORKSHOP [工房]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-vault')">VAULT [保管庫]</button>
      <button class="hub-tab-btn" onclick="switchScreen('hub-init')">INITIALIZE [出撃]</button>
      <button class="hub-tab-btn active" onclick="switchScreen('hub-leaderboard')">LEADERBOARDS [順位]</button>
    </div>

    <div class="panel-card" style="margin-top: 14px; padding: 1.25rem;">
      <div class="panel-header" style="margin: -1.25rem -1.25rem 1.25rem -1.25rem;">
        <span class="panel-heading-text">TOP OPERATOR RECON RANKINGS</span>
        <span class="panel-badge">WEEKLY ONE-SHOT</span>
      </div>

      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>RANK</th>
            <th>RUNNER CALLSIGN</th>
            <th>SHELL</th>
            <th>DEPTH</th>
            <th>TURNS</th>
            <th>SCRAP EXTRACTED</th>
            <th>SCORE</th>
            <th>VERIFIED HASH</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="rank-1">#01</td>
            <td style="font-weight: 800; color: #fff;">TK-KUSANAGI-99</td>
            <td>GHOST-v1</td>
            <td>FLOOR 14</td>
            <td>388</td>
            <td>4,820 CR</td>
            <td class="rank-1">12,480</td>
            <td style="color: var(--c-text-muted);">9f4a...210b</td>
          </tr>
          <tr>
            <td class="rank-2">#02</td>
            <td style="font-weight: 800; color: #fff;">OPERATOR-NEXUS</td>
            <td>BASTION-v1</td>
            <td>FLOOR 12</td>
            <td>412</td>
            <td>3,910 CR</td>
            <td class="rank-2">10,910</td>
            <td style="color: var(--c-text-muted);">7c8e...551a</td>
          </tr>
          <tr>
            <td class="rank-3">#03</td>
            <td style="font-weight: 800; color: #fff;">VOID_WALKER_01</td>
            <td>VANGUARD-v1</td>
            <td>FLOOR 11</td>
            <td>290</td>
            <td>3,200 CR</td>
            <td class="rank-3">9,800</td>
            <td style="color: var(--c-text-muted);">3b1d...892e</td>
          </tr>
          <tr>
            <td>#04</td>
            <td style="font-weight: 800; color: #fff;">NEO-SHINJUKU</td>
            <td>VANGUARD-v1</td>
            <td>FLOOR 09</td>
            <td>210</td>
            <td>2,450 CR</td>
            <td>7,450</td>
            <td style="color: var(--c-text-muted);">4e2f...110a</td>
          </tr>
          <tr>
            <td>#05</td>
            <td style="font-weight: 800; color: #fff;">CYBER-TAIKOKU</td>
            <td>BASTION-v1</td>
            <td>FLOOR 08</td>
            <td>184</td>
            <td>1,980 CR</td>
            <td>6,180</td>
            <td style="color: var(--c-text-muted);">1a0c...667b</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- ========================================================================
       SCREEN 10: IN-GAME TACTICAL HUD (FLAGSHIP SOLARIS LAYOUT X TAIKOKU STYLE)
       ======================================================================== -->
  <section class="view-screen" id="screen-hud">
    <div class="hud-construct">
      
      <!-- Top HUD Telemetry Ribbon -->
      <header class="hud-ribbon">
        <div class="hud-meta-chips">
          <div class="hud-chip">
            <span class="hud-chip-label">PROTOCOL</span>
            <span class="hud-chip-val" style="color: #ffaa00;" id="hudRunMode">WEEKLY ONE-SHOT</span>
          </div>
          <div class="hud-chip">
            <span class="hud-chip-label">DEPTH // SEED</span>
            <span class="hud-chip-val" id="hudDepthSeed">FLOOR 07 // #W-4028</span>
          </div>
          <div class="hud-chip">
            <span class="hud-chip-label">CHRONO // TURN</span>
            <span class="hud-chip-val" id="hudChronoTurn">T-0142 // 04:18</span>
          </div>
          <div class="hud-chip">
            <span class="hud-chip-label">SCRAP RECOVERED</span>
            <span class="hud-chip-val" style="color: #ffaa00;" id="hudScrap">1,420 CR</span>
          </div>
        </div>

        <div class="stability-gauge-wrap">
          <div style="display: flex; justify-content: space-between; width: 100%; font-size: 10px;">
            <span style="color: var(--c-text-dim); font-weight: 700;">REALITY STABILITY</span>
            <span style="font-family: var(--font-mono); font-weight: 800; color: var(--c-accent-secondary);" id="hudStabilityVal">88.4% [STABLE]</span>
          </div>
          <div class="stability-track">
            <div class="stability-fill" id="hudStabilityBar" style="width: 88.4%;"></div>
          </div>
        </div>
      </header>

      <!-- 3-Column Tactical Ops Body -->
      <div class="hud-main-grid">
        
        <!-- Left Column: Chassis Diagnostics & Heat -->
        <aside class="panel-card hud-col-left" style="padding: 10px;">
          <div class="panel-header" style="margin: -10px -10px 10px -10px;">
            <span class="panel-heading-text">CHASSIS DIAGNOSTICS</span>
            <span class="panel-badge" id="hudShellTag">VANGUARD-v1</span>
          </div>

          <div style="display: flex; gap: 10px; align-items: center; border-bottom: 1px solid var(--c-border); padding-bottom: 8px;">
            <div style="width: 44px; height: 44px; background: #0c121c; border: 2px solid var(--c-accent); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: var(--c-accent);">
              @
            </div>
            <div>
              <div style="font-weight: 800; font-size: 13px;">RUNNER // OPERATOR</div>
              <div style="font-size: 10px; color: var(--c-text-dim); font-family: var(--font-mono);">SYNC: 99.8% // BUFFER NORMAL</div>
            </div>
          </div>

          <!-- Meters -->
          <div class="meter-container">
            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;">
              <span>HEALTH CAPACITY</span>
              <span id="hudHpText" style="font-family: var(--font-mono); color: var(--c-accent-secondary);">18 / 20 HP</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill-hp" id="hudHpBar" style="width: 90%;"></div>
            </div>
          </div>

          <div class="meter-container">
            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;">
              <span>CORE HEAT DISSIPATION</span>
              <span id="hudHeatText" style="font-family: var(--font-mono); color: #ff6600;">35 / 100 [TIER 1]</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill-heat" id="hudHeatBar" style="width: 35%;"></div>
            </div>
          </div>

          <!-- Installed Firmware Status -->
          <div style="border-top: 1px solid var(--c-border); padding-top: 8px;">
            <div style="font-size: 10px; font-weight: 800; color: var(--c-text-dim); margin-bottom: 6px;">SOCKETED FIRMWARE</div>
            <div class="dotted-spec-row">
              <span class="spec-label">Phase_Shift.sh</span>
              <span class="spec-val" style="color: var(--c-accent);">READY [1]</span>
            </div>
            <div class="dotted-spec-row">
              <span class="spec-label">Displacement_Vent.arc</span>
              <span class="spec-val" style="color: var(--c-accent-secondary);">READY [2]</span>
            </div>
            <div class="dotted-spec-row">
              <span class="spec-label">Kinetic_Link.exe</span>
              <span class="spec-val" style="color: var(--c-text-muted);">CD 3 [3]</span>
            </div>
          </div>

          <div style="margin-top: auto; border: 1px solid var(--c-border); background: #070a10; padding: 6px; text-align: center;">
            <button class="tool-btn" onclick="simStats('vent')" style="width: 100%;">EMERGENCY VENT HEAT (-25)</button>
          </div>
        </aside>

        <!-- Center Column: 1px Oscilloscope Vector Viewport Bay -->
        <main class="tactical-viewport-bay">
          <div class="corner-mark tl">┌ TK-VEC ┐</div>
          <div class="corner-mark tr">┌ FOV 88° ┐</div>
          <div class="corner-mark bl" id="tacCoordBadge">└ POS: 14/08 ┘</div>
          <div class="corner-mark br">└ SECTOR 07 ┘</div>

          <div class="viewport-status-tag">1PX OSCILLOSCOPE TACTICAL SCANNER // REAL-TIME</div>

          <canvas id="tacticalCanvas"></canvas>

          <div class="viewport-controls-hint">
            <span>[WASD / ARROWS] Move Runner</span>
            <span>[SPACE] Step Turn</span>
            <span>[I] Open Inventory</span>
            <span>[E] Anchor Terminal</span>
          </div>
        </main>

        <!-- Right Column: Combat Telemetry & Radar Tracker -->
        <aside class="panel-card hud-col-right" style="padding: 10px;">
          <div class="panel-header" style="margin: -10px -10px 10px -10px;">
            <span class="panel-heading-text">NEARBY HOSTILES</span>
            <span class="panel-badge" style="color: var(--c-danger); border-color: var(--c-danger);">3 DETECTED</span>
          </div>

          <!-- Hostiles radar list -->
          <div style="display: flex; flex-direction: column; gap: 6px;" id="hudHostileRadar">
            <!-- Populated by JS -->
          </div>

          <div class="panel-header" style="margin: 10px -10px 10px -10px;">
            <span class="panel-heading-text">COMBAT TELEMETRY</span>
            <span class="panel-badge">REAL-TIME</span>
          </div>

          <div class="telemetry-feed" id="hudTelemetryFeed">
            <!-- Populated dynamically by JS -->
          </div>
        </aside>
      </div>

      <!-- Bottom Levers Bar (Weapon & Ability Hotbar) -->
      <footer class="hud-bottom-bar">
        <div class="ability-slots-group">
          <div class="ability-lever" onclick="triggerAbility(1)">
            <div>
              <span style="font-family: var(--font-mono); color: var(--c-accent); margin-right: 6px;">[1]</span>
              <span>PHASE_SHIFT.sh</span>
            </div>
            <span style="font-size: 10px; color: var(--c-text-dim);">+20 HEAT</span>
          </div>

          <div class="ability-lever" onclick="triggerAbility(2)">
            <div>
              <span style="font-family: var(--font-mono); color: var(--c-accent-secondary); margin-right: 6px;">[2]</span>
              <span>DISPLACEMENT_VENT.arc</span>
            </div>
            <span style="font-size: 10px; color: var(--c-text-dim);">-15 HEAT</span>
          </div>

          <div class="ability-lever" onclick="triggerAbility(3)">
            <div>
              <span style="font-family: var(--font-mono); color: #ffaa00; margin-right: 6px;">[3]</span>
              <span>KINETIC_LINK.exe</span>
            </div>
            <span style="font-size: 10px; color: var(--c-text-dim);">CD: 3T</span>
          </div>

          <div class="ability-lever" onclick="switchScreen('modal-anchor')">
            <div>
              <span style="font-family: var(--font-mono); color: var(--c-accent); margin-right: 6px;">[E]</span>
              <span>ANCHOR TETHER [アンカー]</span>
            </div>
            <span style="font-size: 10px; color: var(--c-accent);">EXTRACTION</span>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn-lever" onclick="switchScreen('modal-inventory')">INVENTORY [I]</button>
          <button class="btn-lever cyan" onclick="switchScreen('modal-stairs')">STAIRCASE [D]</button>
          <button class="btn-lever danger" onclick="triggerBSOD()">TRIGGER BSOD</button>
        </div>
      </footer>
    </div>
  </section>

  <!-- ========================================================================
       SCREEN 11: IN-GAME MODAL: INVENTORY & EQUIPMENT OVERLAY
       ======================================================================== -->
  <div class="modal-backdrop-view" id="modal-inventory" style="display: none;">
    <div class="modal-box">
      <div class="taikoku-placard" style="margin-bottom: 0; border: none; border-bottom: 3px solid #000;">
        <div class="placard-title">
          <span class="placard-kanji">戦術インベントリ</span>
          <span>TACTICAL BACKPACK & ACTIVE EQUIPMENT SLOTS</span>
        </div>
        <button class="tool-btn" onclick="switchScreen('hud')">✕ CLOSE [ESC]</button>
      </div>

      <div style="display: grid; grid-template-columns: 320px minmax(0, 1fr); padding: 1.25rem; gap: 14px; flex: 1; overflow-y: auto;">
        <!-- Left: Equipment Paperdoll Slots -->
        <div class="panel-card" style="padding: 1rem;">
          <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
            <span class="panel-heading-text">EQUIPPED HARDWARE</span>
            <span class="panel-badge">SLOTS</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div class="socket-row equipped">
              <span style="font-size: 10px; color: var(--c-text-dim);">PRIMARY:</span>
              <span style="font-weight: 800;">Kinetic Rail-Carbine</span>
            </div>
            <div class="socket-row equipped">
              <span style="font-size: 10px; color: var(--c-text-dim);">ARMOR:</span>
              <span style="font-weight: 800;">Vanguard Composite Mesh</span>
            </div>
            <div class="socket-row equipped">
              <span style="font-size: 10px; color: var(--c-text-dim);">FIRMWARE 1:</span>
              <span style="font-weight: 800; color: var(--c-accent);">Phase_Shift.sh</span>
            </div>
            <div class="socket-row equipped">
              <span style="font-size: 10px; color: var(--c-text-dim);">FIRMWARE 2:</span>
              <span style="font-weight: 800; color: var(--c-accent);">Displacement_Vent.arc</span>
            </div>
            <div class="socket-row equipped">
              <span style="font-size: 10px; color: var(--c-text-dim);">AUGMENT:</span>
              <span style="font-weight: 800; color: var(--c-accent-secondary);">Overclock_Resonance.arc</span>
            </div>
          </div>
        </div>

        <!-- Right: 20-Slot Tactical Backpack Grid -->
        <div class="panel-card" style="padding: 1rem;">
          <div class="panel-header" style="margin: -1rem -1rem 1rem -1rem;">
            <span class="panel-heading-text">TACTICAL BACKPACK [4x5 GRID]</span>
            <span class="panel-badge">7 / 20 SLOTS</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 1rem;">
            <div class="vault-slot filled selected">
              <span style="font-weight: 800;">RAIL</span>
              <span style="font-size: 8px; color: var(--c-accent);">AMMO</span>
            </div>
            <div class="vault-slot filled">
              <span style="font-weight: 800;">GEL</span>
              <span style="font-size: 8px; color: var(--c-accent-secondary);">VENT</span>
            </div>
            <div class="vault-slot filled">
              <span style="font-weight: 800;">NANO</span>
              <span style="font-size: 8px; color: #ffaa00;">HEAL</span>
            </div>
            <div class="vault-slot filled">
              <span style="font-weight: 800;">CORE</span>
              <span style="font-size: 8px; color: var(--c-danger);">SCRAP</span>
            </div>
            <div class="vault-slot filled">
              <span style="font-weight: 800;">CHIP</span>
              <span style="font-size: 8px; color: var(--c-accent);">MOD</span>
            </div>
            <!-- Empty slots -->
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
            <div class="vault-slot"><span style="color: #334155;">-</span></div>
          </div>

          <div style="border-top: 1px solid var(--c-border); padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--c-text-dim);">SELECTED: RAIL_AMMO_PACK (x40 RDS)</span>
            <div style="display: flex; gap: 8px;">
              <button class="btn-lever" onclick="alert('Item consumed!')" style="padding: 4px 10px; font-size: 10px;">USE ITEM</button>
              <button class="btn-lever danger" onclick="alert('Item discarded!')" style="padding: 4px 10px; font-size: 10px;">DROP</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================
       SCREEN 12: IN-GAME MODAL: STABILITY ANCHOR EXTRACTION OVERLAY
       ======================================================================== -->
  <div class="modal-backdrop-view" id="modal-anchor" style="display: none;">
    <div class="modal-box" style="max-width: 680px;">
      <div class="taikoku-placard" style="margin-bottom: 0; border: none; border-bottom: 3px solid #000;">
        <div class="placard-title">
          <span class="placard-kanji">現実固定装置</span>
          <span>STABILITY ANCHOR TERMINAL // EXTRACTION PROTOCOL</span>
        </div>
        <button class="tool-btn" onclick="switchScreen('hud')">✕ ABORT</button>
      </div>

      <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
        <div style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">
          You have established a localized reality anchor lock. You may initiate emergency sub-orbital extraction to secure all recovered scrap and hardware, or pay scrap to stabilize the tether and descend deeper.
        </div>

        <div class="dotted-spec-row">
          <span class="spec-label">CURRENT FLOOR DEPTH</span>
          <span class="spec-val">FLOOR 07 // SUB-STRUCTURE</span>
        </div>
        <div class="dotted-spec-row">
          <span class="spec-label">UNSECURED SCRAP RECOVERED</span>
          <span class="spec-val" style="color: #ffaa00; font-size: 14px;">1,420 CR [READY TO VAULT]</span>
        </div>
        <div class="dotted-spec-row">
          <span class="spec-label">REALITY STABILITY INDEX</span>
          <span class="spec-val" style="color: var(--c-accent-secondary);">88.4% [STABLE]</span>
        </div>

        <div style="margin-top: 1rem; display: flex; gap: 12px;">
          <button class="btn-lever" onclick="triggerExtractionWin()" style="flex: 1; padding: 12px; font-size: 12px;">
            <span>INITIATE EXTRACTION [離脱承認]</span>
            <span style="font-family: var(--font-mono);">100% REWARDS</span>
          </button>
          <button class="btn-lever cyan" onclick="switchScreen('modal-stairs')" style="flex: 1; padding: 12px; font-size: 12px;">
            <span>PAY TETHER (300 CR) & DESCEND [降下]</span>
            <span style="font-family: var(--font-mono);">NEXT FLOOR</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================
       SCREEN 13: IN-GAME MODAL: STAIRCASE AIRLOCK DESCENT
       ======================================================================== -->
  <div class="modal-backdrop-view" id="modal-stairs" style="display: none;">
    <div class="modal-box" style="max-width: 600px;">
      <div class="taikoku-placard" style="margin-bottom: 0; border: none; border-bottom: 3px solid #000;">
        <div class="placard-title">
          <span class="placard-kanji">隔壁降下</span>
          <span>AIRLOCK DESCENT // TRANSIT TO SUB-LEVEL 08</span>
        </div>
        <button class="tool-btn" onclick="switchScreen('hud')">✕ CANCEL</button>
      </div>

      <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
        <div style="font-size: 12px; color: #cbd5e1;">
          Transit airlock seals will pressurize. Atmospheric hazard telemetry indicates elevated threat multiplier on Floor 08.
        </div>

        <div class="dotted-spec-row">
          <span class="spec-label">CURRENT FLOOR</span>
          <span class="spec-val">FLOOR 07</span>
        </div>
        <div class="dotted-spec-row">
          <span class="spec-label">DESTINATION SUB-LEVEL</span>
          <span class="spec-val" style="color: var(--c-accent);">FLOOR 08</span>
        </div>
        <div class="dotted-spec-row">
          <span class="spec-label">THREAT ESCALATION</span>
          <span class="spec-val" style="color: var(--c-danger);">+25% HOSTILE DENSITY</span>
        </div>

        <div style="margin-top: 1rem;">
          <button class="btn-lever cyan" onclick="descendFloor()" style="width: 100%; padding: 12px; font-size: 12px;">
            AUTHORIZE AIRLOCK DESCENT // 昇降機降下
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================
       SCREEN 8: PRE-FLIGHT DEPLOYMENT RITUAL OVERLAY
       ======================================================================== -->
  <div class="modal-backdrop-view" id="modal-ritual" style="display: none;">
    <div class="modal-box" style="max-width: 740px;">
      <div class="taikoku-placard" style="margin-bottom: 0; border: none; border-bottom: 3px solid #000;">
        <div class="placard-title">
          <span class="placard-kanji">出撃前点検</span>
          <span>PRE-FLIGHT HARDWARE VERIFICATION & LAUNCH RITUAL</span>
        </div>
        <button class="tool-btn" onclick="switchScreen('hub-init')">✕ ABORT</button>
      </div>

      <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
        <div style="font-size: 12px; color: #cbd5e1;">
          Confirm active loadout configuration before committing neural link into the sub-structure.
        </div>

        <div class="dotted-spec-row">
          <span class="spec-label">SELECTED SHELL CHASSIS</span>
          <span class="spec-val" style="color: var(--c-accent);">VANGUARD-v1 [SKIRMISHER]</span>
        </div>
        <div class="dotted-spec-row">
          <span class="spec-label">EQUIPPED FIRMWARE (2)</span>
          <span class="spec-val">Phase_Shift.sh, Kinetic_Link.exe</span>
        </div>
        <div class="dotted-spec-row">
          <span class="spec-label">EQUIPPED AUGMENT (1)</span>
          <span class="spec-val">Overclock_Resonance.arc</span>
        </div>
        <div class="dotted-spec-row">
          <span class="spec-label">OPERATION MODE</span>
          <span class="spec-val" style="color: #ffaa00;">WEEKLY ONE-SHOT // PERMADEATH</span>
        </div>

        <div style="border: 1px dashed var(--c-danger); padding: 10px; margin-top: 8px;">
          <div style="color: var(--c-danger); font-weight: 800; font-size: 11px;">HAZARD INDEMNITY NOTICE</div>
          <div style="font-size: 10px; color: var(--c-text-dim); margin-top: 2px;">
            By committing, you acknowledge that shell destruction results in immediate hardware zeroing. No rollback permitted.
          </div>
        </div>

        <div style="margin-top: 1rem;">
          <button class="btn-lever" onclick="switchScreen('boot-seq')" style="width: 100%; padding: 14px; font-size: 13px;">
            <span>AUTHORIZE LAUNCH // 発進承認</span>
            <span>ENGAGE NEURAL LINK →</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================
       SCREEN 9: BOOT SEQUENCE SCREEN
       ======================================================================== -->
  <main class="view-screen-centered" id="boot-seq" style="display: none;">
    <div class="panel-card" style="width: 100%; max-width: 680px; margin: auto; padding: 2rem; background: #06090f; border: 3px solid var(--c-accent); box-shadow: 0 0 50px rgba(216, 255, 0, 0.25);">
      <div style="font-size: 11px; font-weight: 900; color: var(--c-accent); letter-spacing: 0.15em; margin-bottom: 1rem;">
        TAIKOKU KERNEL BOOT SEQUENCE // VEC-OS 1.0.4
      </div>

      <div id="bootTerminalLines" style="font-family: var(--font-mono); font-size: 12px; line-height: 1.8; color: #fff; min-height: 160px;">
        <!-- Populated line by line -->
      </div>

      <div style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 10px; color: var(--c-text-dim);">CONNECTING RUNNER NEURAL BUS...</span>
        <button class="btn-lever" onclick="switchScreen('hud')">SKIP BOOT [出撃]</button>
      </div>
    </div>
  </main>

  <!-- ========================================================================
       SCREEN 14: END-OF-RUN: BSOD / CRITICAL SYSTEM FAILURE
       ======================================================================== -->
  <main class="view-screen-centered" id="screen-bsod" style="display: none;">
    <div class="bsod-frame">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00f0ff; padding-bottom: 12px; margin-bottom: 1.5rem;">
        <span style="font-size: 20px; font-weight: 900; letter-spacing: 0.1em;">*** FATAL_EXCEPTION: REALITY_COLLAPSE ***</span>
        <span class="taikoku-stamp" style="border-color: #00f0ff; color: #00f0ff;">STOP 0x0000007E</span>
      </div>

      <p style="font-size: 13px; line-height: 1.6; margin-bottom: 1rem;">
        A fatal hardware exception has been encountered in chassis module NIRMATA_VANGUARD.SYS at base register 0xFFFFF80002E5A188.<br>
        Reality stability dropped below minimum containment threshold (0.0%).
      </p>

      <div style="background: rgba(0,0,0,0.5); padding: 1rem; border: 1px dashed rgba(0,240,255,0.4); font-size: 11px; line-height: 1.6; color: #cbd5e1; margin-bottom: 1.5rem;">
        <div>*** CALL STACK DUMP:</div>
        <div>[0x01] ecs_delta.sys + 0x48a1 (TurnReconciliationFailure)</div>
        <div>[0x02] combat_system.sys + 0x12fc (BufferOverflowStagger)</div>
        <div>[0x03] gravedigger.sys + 0x0091 (DyingEntityDestroyed)</div>
        <div>Dumping physical neural memory to persistent core: 100% COMPLETE.</div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button class="btn-lever cyan" onclick="triggerDefeatResults()">PROCEED TO POST-MORTEM AUTOPSY [検視]</button>
      </div>
    </div>
  </main>

  <!-- ========================================================================
       SCREEN 15: END-OF-RUN: MISSION EXTRACTION / RUN RESULTS MANIFEST
       ======================================================================== -->
  <main class="view-screen-centered" id="screen-results" style="display: none;">
    <div class="manifest-bill">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 10px;">
        <div>
          <div style="font-size: 10px; font-weight: 900; letter-spacing: 0.15em; color: #555;">
            TAIKOKU HEAVY DYNAMICS // BILL OF LADING & POST-MISSION RECORD
          </div>
          <h2 style="font-size: 26px; font-weight: 900; letter-spacing: 0.05em;" id="resultsTitle">
            MISSION COMPLETED // EXTRACTION SUCCESSFUL
          </h2>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <span class="taikoku-stamp" id="resultsStamp">承認済 // SECURED</span>
          <span style="font-family: var(--font-mono); font-size: 10px; font-weight: 700;">LOT: TK-RUN-4028-X</span>
        </div>
      </div>

      <!-- Mode Toggle for Mock Viewing -->
      <div style="display: flex; gap: 8px; margin: 4px 0;">
        <button class="tool-btn active" id="btnResExtract" onclick="toggleResultsType(true)">PREVIEW: EXTRACTION SUCCESS</button>
        <button class="tool-btn" id="btnResDefeat" onclick="toggleResultsType(false)">PREVIEW: DEFEAT / KIA</button>
      </div>

      <!-- Telemetry Ledger Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border: 2px solid #000; padding: 12px; background: #fff;">
        <div>
          <div style="font-size: 10px; color: #666; font-weight: 700;">FLOORS CLEARED</div>
          <div style="font-size: 20px; font-weight: 900;" id="resFloors">07</div>
        </div>
        <div>
          <div style="font-size: 10px; color: #666; font-weight: 700;">THREATS NEUTRALIZED</div>
          <div style="font-size: 20px; font-weight: 900;" id="resThreats">24</div>
        </div>
        <div>
          <div style="font-size: 10px; color: #666; font-weight: 700;">TURNS ELAPSED</div>
          <div style="font-size: 20px; font-weight: 900;" id="resTurns">142</div>
        </div>
        <div>
          <div style="font-size: 10px; color: #666; font-weight: 700;">FINAL SCORE</div>
          <div style="font-size: 20px; font-weight: 900; color: #008800;" id="resScore">3,860</div>
        </div>
      </div>

      <!-- Recovered Cargo Manifest -->
      <div style="border: 2px solid #000; padding: 12px; background: #fff;">
        <div style="font-size: 11px; font-weight: 900; letter-spacing: 0.08em; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px;">
          RECOVERED SECURED ASSETS // LEDGER
        </div>
        <div class="dotted-spec-row" style="color: #000;">
          <span style="color: #444; font-weight: 700;">RUN SCRAP SECURED TO VAULT</span>
          <span style="font-weight: 900; font-family: var(--font-mono); color: #b36b00;" id="resScrapLedger">+1,420 CR</span>
        </div>
        <div class="dotted-spec-row" style="color: #000;">
          <span style="color: #444; font-weight: 700;">META FLUX REWARD</span>
          <span style="font-weight: 900; font-family: var(--font-mono); color: #007788;" id="resFluxLedger">+120 FLX</span>
        </div>
        <div class="dotted-spec-row" style="color: #000;">
          <span style="color: #444; font-weight: 700;">BLUEPRINTS RECOVERED</span>
          <span style="font-weight: 900; font-family: var(--font-mono); color: #008800;">Overclock_Resonance.arc (v2)</span>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 6px;">
        <button class="btn-lever" onclick="returnToDeckFromResults()" style="padding: 12px 24px; font-size: 12px;">
          RETURN TO NEURAL DECK [デッキ帰還]
        </button>
      </div>
    </div>
  </main>

  <!-- ========================================================================
       CLIENT INTERACTIVE SIMULATION ENGINE & 2D/3D VECTOR CANVASES
       ======================================================================== -->
  <script>
    // State Model
    var state = {
      currentScreen: 'menu',
      player: {
        shellId: 'vanguard',
        hp: 18,
        maxHp: 20,
        heat: 35,
        maxHeat: 100,
        stability: 88.4,
        scrap: 1420,
        flux: 380,
        turn: 142,
        floor: 7,
        x: 14,
        y: 8
      },
      shells: {
        vanguard: { name: 'VANGUARD-v1', arch: 'Skirmisher [突撃型]', hp: 20, speed: 120, armor: 2, stab: 5, heatVent: '18/s' },
        bastion: { name: 'BASTION-v1', arch: 'Heavy Enforcer [重装型]', hp: 25, speed: 80, armor: 4, stab: 10, heatVent: '12/s' },
        ghost: { name: 'GHOST-v1', arch: 'Recon Infiltrator [潜入型]', hp: 15, speed: 100, armor: 1, stab: 8, heatVent: '22/s' }
      },
      hostiles: [
        { id: 'h1', glyph: 'm', name: 'Null-Pointer (Stalker)', dist: '3m', hp: 4, maxHp: 6, x: 17, y: 8, behavior: 'Teleport behind runner' },
        { id: 'h2', glyph: 'b', name: 'Buffer-Overflow (Swarmer)', dist: '2m', hp: 3, maxHp: 3, x: 15, y: 10, behavior: 'Volatile thermal pack' },
        { id: 'h3', glyph: 'F', name: 'Fragmenter (Heavy)', dist: '6m', hp: 16, maxHp: 20, x: 20, y: 12, behavior: 'Area shock slam' }
      ],
      logs: [
        { time: '14:20:12', tag: 'COMBAT', text: 'Null-Pointer staggered for 4 kinetic DMG.', color: '#d8ff00' },
        { time: '14:20:10', tag: 'HEAT', text: 'Heat vented -15 via Displacement_Venting.arc', color: '#00f0ff' },
        { time: '14:20:08', tag: 'KERNEL', text: 'Floor 07 seed reconciled. Stability: 88.4%.', color: '#79889e' },
        { time: '14:20:02', tag: 'RADAR', text: '3 Hostiles detected within neural scan radius.', color: '#ffaa00' }
      ],
      wireframeRotating: true,
      scanlinesActive: true
    };

    // Screen Switching Matrix
    function switchScreen(screenId) {
      state.currentScreen = screenId;

      // Hide all screens
      var screens = document.querySelectorAll('.view-screen, .view-screen-centered, .modal-backdrop-view');
      screens.forEach(function(s) {
        s.style.display = 'none';
        s.classList.remove('active');
      });

      // Deactivate all pills
      var pills = document.querySelectorAll('.screen-pill');
      pills.forEach(function(p) { p.classList.remove('active'); });

      // Activate target
      var target = document.getElementById(screenId) || document.getElementById('screen-' + screenId);
      if (target) {
        if (target.classList.contains('modal-backdrop-view') || target.classList.contains('view-screen-centered')) {
          target.style.display = 'flex';
        } else {
          target.style.display = 'block';
        }
        target.classList.add('active');
      }

      var activePill = document.getElementById('pill-' + screenId) || document.getElementById('pill-screen-' + screenId);
      if (activePill) activePill.classList.add('active');

      // Initialize screen-specific graphics
      if (screenId === 'hud') {
        resizeTacticalCanvas();
      } else if (screenId === 'hub-shell') {
        renderShellSpecs();
        resize3DCanvas();
      } else if (screenId === 'boot-seq') {
        runBootSequence();
      } else if (screenId === 'hub-vault') {
        renderVaultGrid();
      }

      window.scrollTo(0, 0);
    }

    // Toggle CRT Scanlines
    function toggleScanlines() {
      state.scanlinesActive = !state.scanlinesActive;
      document.body.classList.toggle('no-scanlines', !state.scanlinesActive);
      document.getElementById('btnScanlines').classList.toggle('active', state.scanlinesActive);
    }

    // Simulator State Adjustments
    function simStats(action) {
      if (action === 'dmg') {
        state.player.hp = Math.max(0, state.player.hp - 5);
        addLog('COMBAT', 'Received 5 kinetic DMG from Hostile unit.', '#ff2a4b');
        if (state.player.hp === 0) triggerBSOD();
      } else if (action === 'heal') {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 5);
        addLog('KERNEL', 'Repaired +5 HP via Nanite reservoir.', '#00f0ff');
      } else if (action === 'heat') {
        state.player.heat = Math.min(state.player.maxHeat, state.player.heat + 25);
        addLog('HEAT', 'Heat injected +25! Core thermal stress elevated.', '#ff6600');
        if (state.player.heat >= 100) triggerBSOD();
      } else if (action === 'vent') {
        state.player.heat = Math.max(0, state.player.heat - 25);
        addLog('HEAT', 'Displacement venting discharged -25 Heat.', '#00f0ff');
      } else if (action === 'step') {
        state.player.turn++;
        state.player.stability = Math.max(10, (state.player.stability - 0.2).toFixed(1));
        addLog('KERNEL', 'Turn ' + state.player.turn + ' executed. Stability -0.2%.', '#79889e');
      }
      updateHudUI();
    }

    function addLog(tag, text, color) {
      var now = new Date();
      var time = now.toTimeString().split(' ')[0];
      state.logs.unshift({ time: time, tag: tag, text: text, color: color });
      if (state.logs.length > 20) state.logs.pop();
      renderTelemetryFeed();
    }

    function updateHudUI() {
      // HP
      var hpPercent = (state.player.hp / state.player.maxHp) * 100;
      var hpBar = document.getElementById('hudHpBar');
      var hpText = document.getElementById('hudHpText');
      if (hpBar) hpBar.style.width = hpPercent + '%';
      if (hpText) hpText.textContent = state.player.hp + ' / ' + state.player.maxHp + ' HP';

      // Heat
      var heatPercent = (state.player.heat / state.player.maxHeat) * 100;
      var heatBar = document.getElementById('hudHeatBar');
      var heatText = document.getElementById('hudHeatText');
      var tier = state.player.heat > 75 ? 'TIER 3 [CRITICAL]' : state.player.heat > 40 ? 'TIER 2 [ELEVATED]' : 'TIER 1 [NORMAL]';
      if (heatBar) heatBar.style.width = heatPercent + '%';
      if (heatText) heatText.textContent = state.player.heat + ' / ' + state.player.maxHeat + ' [' + tier + ']';

      // Stability
      var stabBar = document.getElementById('hudStabilityBar');
      var stabVal = document.getElementById('hudStabilityVal');
      if (stabBar) stabBar.style.width = state.player.stability + '%';
      if (stabVal) stabVal.textContent = state.player.stability + '% [' + (state.player.stability > 50 ? 'STABLE' : 'CRITICAL') + ']';

      // Turn
      var turnVal = document.getElementById('hudChronoTurn');
      if (turnVal) turnVal.textContent = 'T-' + String(state.player.turn).padStart(4, '0') + ' // 04:18';

      // Scrap & Flux
      var scrapText = document.getElementById('hudScrap');
      if (scrapText) scrapText.textContent = state.player.scrap.toLocaleString() + ' CR';
      var hubScrap = document.getElementById('hubScrapVal');
      if (hubScrap) hubScrap.textContent = state.player.scrap.toLocaleString() + ' CR';
      var hubFlux = document.getElementById('hubFluxVal');
      if (hubFlux) hubFlux.textContent = state.player.flux.toLocaleString() + ' FLX';
    }

    function renderTelemetryFeed() {
      var feed = document.getElementById('hudTelemetryFeed');
      if (!feed) return;
      feed.innerHTML = state.logs.map(function(l) {
        return '<div class="log-item">' +
          '<span class="log-time">[' + l.time + ']</span> ' +
          '<span class="log-tag" style="color:' + l.color + ';">[' + l.tag + ']</span> ' +
          '<span class="log-msg">' + l.text + '</span>' +
          '</div>';
      }).join('');
    }

    function renderHostileRadar() {
      var radar = document.getElementById('hudHostileRadar');
      if (!radar) return;
      radar.innerHTML = state.hostiles.map(function(h) {
        return '<div style="background: #0d121c; border: 1px solid #233044; padding: 6px 8px;">' +
          '<div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 11px;">' +
            '<span style="color: var(--c-danger);">' + h.glyph + ' ' + h.name + '</span>' +
            '<span style="font-family: var(--font-mono); color: var(--c-accent);">' + h.dist + '</span>' +
          '</div>' +
          '<div style="font-size: 9px; color: var(--c-text-dim); margin-top: 2px;">' + h.behavior + '</div>' +
          '</div>';
      }).join('');
    }

    function selectRunMode(mode) {
      document.querySelectorAll('.run-mode-card').forEach(function(c) { c.classList.remove('active'); });
      var card = document.getElementById('modeCard-' + mode);
      if (card) card.classList.add('active');
      var label = document.getElementById('initSelectedModeLabel');
      if (label) {
        if (mode === 'simulation') {
          label.textContent = 'STANDARD SIMULATION';
          label.style.color = 'var(--c-accent-secondary)';
        } else if (mode === 'daily') {
          label.textContent = 'DAILY CHALLENGE';
          label.style.color = 'var(--c-accent)';
        } else {
          label.textContent = 'WEEKLY ONE-SHOT';
          label.style.color = '#ffaa00';
        }
      }
    }

    function upgradeShell(stat) {
      var costs = { speed: 50, armor: 75, stability: 60, ports: 120 };
      var cost = costs[stat] || 50;
      if (state.player.flux < cost) {
        alert('Insufficient Flux balance. Required: ' + cost + ' FLUX.');
        return;
      }
      state.player.flux -= cost;
      var s = state.shells[state.player.shellId];
      if (stat === 'speed') s.speed += 10;
      if (stat === 'armor') s.armor += 1;
      if (stat === 'stability') s.stab += 2;
      updateHudUI();
      renderShellSpecs();
      alert('Upgraded ' + stat.toUpperCase() + ' on ' + s.name + '! -' + cost + ' FLUX.');
    }

    function unequipSlot(type, index) {
      alert('Unequipped ' + type + ' slot [' + index + ']. Transferred to reserve stash.');
    }

    function compileBlueprint(name, cost) {
      if (state.player.flux < cost) {
        alert('Insufficient Flux balance. Required: ' + cost + ' FLUX.');
        return;
      }
      state.player.flux -= cost;
      updateHudUI();
      var bar = document.getElementById('compilerProgressBar');
      if (bar) {
        bar.style.width = '100%';
        setTimeout(function() {
          bar.style.width = '0%';
          alert('Compiled ' + name + '! Transferred to hardware inventory.');
        }, 900);
      }
    }

    function triggerSimCompilation() {
      var bar = document.getElementById('compilerProgressBar');
      if (bar) {
        bar.style.width = '100%';
        setTimeout(function() {
          bar.style.width = '0%';
          alert('Synthesized Test Artifact: Overclock_Resonance.arc (v2) compiled into cargo bay.');
        }, 800);
      }
    }

    function recycleScrapForFlux() {
      if (state.player.scrap < 200) {
        alert('Insufficient Scrap. Required: 200 CR.');
        return;
      }
      state.player.scrap -= 200;
      state.player.flux += 30;
      updateHudUI();
      alert('Recycled 200 Scrap into +30 Flux.');
    }

    // Shell Selection in Diagnostics
    function selectShell(shellId) {
      state.player.shellId = shellId;
      document.querySelectorAll('.shell-pill-btn').forEach(function(b) { b.classList.remove('active'); });
      var btn = document.getElementById('btnShell-' + shellId);
      if (btn) btn.classList.add('active');
      renderShellSpecs();
    }

    function renderShellSpecs() {
      var s = state.shells[state.player.shellId];
      var area = document.getElementById('shellSpecsDetails');
      if (!area) return;
      area.innerHTML =
        '<div style="margin-bottom: 12px;">' +
          '<div style="font-size: 18px; font-weight: 900; color: var(--c-accent);">' + s.name + '</div>' +
          '<div style="font-size: 11px; color: var(--c-text-dim);">' + s.arch + '</div>' +
        '</div>' +
        '<div class="dotted-spec-row"><span class="spec-label">BASE SPEED</span><span class="spec-val">' + s.speed + ' T/SEC</span></div>' +
        '<div class="dotted-spec-row"><span class="spec-label">ARMOR RATING</span><span class="spec-val">' + s.armor + ' REDUCTION</span></div>' +
        '<div class="dotted-spec-row"><span class="spec-label">MAX HEALTH</span><span class="spec-val">' + s.hp + ' HP</span></div>' +
        '<div class="dotted-spec-row"><span class="spec-label">HEAT DISSIPATION</span><span class="spec-val">' + s.heatVent + '</span></div>' +
        '<div class="dotted-spec-row"><span class="spec-label">STABILITY RETENTION</span><span class="spec-val">' + s.stab + ' FACTOR</span></div>';
    }

    // 48-Slot Vault Grid Render
    function renderVaultGrid() {
      var container = document.getElementById('vaultSlotsGrid');
      if (!container || container.children.length > 0) return;
      var items = [
        { name: 'KINETIC_LINK', type: 'FIRM', tier: 'v2', desc: 'Chains kinetic damage to adjacent hostiles.' },
        { name: 'PHASE_SHIFT', type: 'FIRM', tier: 'v1', desc: 'Phase-shifts runner up to 3 tiles forward.' },
        { name: 'THERMAL_SINK', type: 'AUG', tier: 'v1', desc: 'Reduces heat accumulation by -20%.' },
        { name: 'RAIL_CARBINE', type: 'WEAP', tier: 'v3', desc: 'Mil-spec kinetic accelerator weapon.' },
        { name: 'NANO_REPAIR', type: 'SOFT', tier: 'v1', desc: 'Emergency nanite restoration packet.' }
      ];

      for (var i = 0; i < 48; i++) {
        var row = String.fromCharCode(65 + Math.floor(i / 8));
        var col = String((i % 8) + 1).padStart(2, '0');
        var slotId = row + '-' + col;
        var item = items[i % items.length];
        var isFilled = i < 18;

        var slot = document.createElement('div');
        slot.className = 'vault-slot' + (isFilled ? ' filled' : '');
        if (i === 0) slot.classList.add('selected');
        slot.dataset.slotId = slotId;

        if (isFilled) {
          slot.innerHTML = '<span style="font-weight: 800; font-size: 8px; color: var(--c-accent);">' + item.type + '</span>' +
                           '<span style="font-size: 7px; color: var(--c-text-dim);">' + slotId + '</span>';
        } else {
          slot.innerHTML = '<span style="font-size: 8px; color: #1e293b;">' + slotId + '</span>';
        }

        slot.onclick = function() {
          document.querySelectorAll('.vault-slot').forEach(function(s) { s.classList.remove('selected'); });
          this.classList.add('selected');
        };
        container.appendChild(slot);
      }
    }

    function resolveVaultOverflow() {
      document.getElementById('vaultOverflowAlert').style.display = 'none';
      alert('Vault overflow resolved: Stashed 3 items into newly cleared bay.');
    }

    // Boot Sequence Animation
    function runBootSequence() {
      var term = document.getElementById('bootTerminalLines');
      if (!term) return;
      term.innerHTML = '';
      var lines = [
        '[0.012s] TAIKOKU KERNEL BOOT INITIALIZED...',
        '[0.084s] QUANTUM BUS SYNC: 64-BIT BUFFER LOCKED',
        '[0.210s] SEED ROTATION: #W-4028 VERIFIED & ANCHORED',
        '[0.450s] CHASSIS SYNC: VANGUARD-v1 OPERATIONAL',
        '[0.720s] NEURAL LINK ENGAGED. ENTERING SUB-STRUCTURE.'
      ];
      var idx = 0;
      var timer = setInterval(function() {
        if (idx < lines.length) {
          var p = document.createElement('div');
          p.textContent = lines[idx];
          p.style.color = (idx === lines.length - 1) ? 'var(--c-accent)' : '#fff';
          term.appendChild(p);
          idx++;
        } else {
          clearInterval(timer);
          setTimeout(function() {
            switchScreen('hud');
          }, 600);
        }
      }, 250);
    }

    // In-Game Tactical Abilities & Actions
    function triggerAbility(slot) {
      if (slot === 1) {
        simStats('heat');
        addLog('ABILITY', 'Triggered Phase_Shift.sh! Warped 3 tiles forward.', '#d8ff00');
      } else if (slot === 2) {
        simStats('vent');
        addLog('ABILITY', 'Displacement_Vent.arc vented -15 Heat.', '#00f0ff');
      } else if (slot === 3) {
        addLog('ABILITY', 'Kinetic_Link.exe linked 3 hostiles.', '#ffaa00');
      }
    }

    function triggerBSOD() {
      switchScreen('screen-bsod');
    }

    function triggerDefeatResults() {
      toggleResultsType(false);
      switchScreen('screen-results');
    }

    function triggerExtractionWin() {
      toggleResultsType(true);
      switchScreen('screen-results');
    }

    function toggleResultsType(isWin) {
      document.getElementById('btnResExtract').classList.toggle('active', isWin);
      document.getElementById('btnResDefeat').classList.toggle('active', !isWin);
      var title = document.getElementById('resultsTitle');
      var stamp = document.getElementById('resultsStamp');
      if (isWin) {
        title.textContent = 'MISSION COMPLETED // EXTRACTION SUCCESSFUL';
        title.style.color = '#000';
        stamp.textContent = '承認済 // SECURED';
        stamp.style.borderColor = 'var(--c-accent)';
        stamp.style.color = '#008800';
      } else {
        title.textContent = 'NEURAL LINK SEVERED // OPERATOR KIA';
        title.style.color = 'var(--c-danger)';
        stamp.textContent = '全損 // CATASTROPHIC LOSS';
        stamp.style.borderColor = 'var(--c-danger)';
        stamp.style.color = 'var(--c-danger)';
      }
    }

    function returnToDeckFromResults() {
      state.player.hp = state.player.maxHp;
      state.player.heat = 0;
      state.player.stability = 100;
      state.player.scrap += 1420;
      state.player.flux += 120;
      updateHudUI();
      switchScreen('hub-shell');
    }

    function descendFloor() {
      state.player.floor++;
      state.player.stability = Math.min(100, state.player.stability + 10);
      document.getElementById('hudDepthSeed').textContent = 'FLOOR 0' + state.player.floor + ' // #W-4028';
      addLog('AIRLOCK', 'Descended into Floor 0' + state.player.floor + '. Threat matrix escalated.', '#00f0ff');
      switchScreen('hud');
    }

    // ========================================================================
    // 2D LIVE VECTOR TACTICAL CANVAS (SOLARIS 1PX WIREFRAME + RADAR)
    // ========================================================================
    var tacCanvas = document.getElementById('tacticalCanvas');
    var tacCtx = tacCanvas.getContext('2d');
    var scanlineOffset = 0;

    function resizeTacticalCanvas() {
      if (!tacCanvas) return;
      tacCanvas.width = tacCanvas.parentElement.clientWidth;
      tacCanvas.height = tacCanvas.parentElement.clientHeight;
    }

    function renderTacticalViewport() {
      if (!tacCanvas || state.currentScreen !== 'hud') return;
      var w = tacCanvas.width;
      var h = tacCanvas.height;
      if (w === 0 || h === 0) return;

      tacCtx.fillStyle = '#020407';
      tacCtx.fillRect(0, 0, w, h);

      var cx = w / 2;
      var cy = h / 2;
      var gridSize = 28;

      // 1. Draw 1px Oscilloscope Vector Grid
      tacCtx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      tacCtx.lineWidth = 1;
      tacCtx.beginPath();
      for (var x = (cx % gridSize); x < w; x += gridSize) {
        tacCtx.moveTo(x, 0); tacCtx.lineTo(x, h);
      }
      for (var y = (cy % gridSize); y < h; y += gridSize) {
        tacCtx.moveTo(0, y); tacCtx.lineTo(w, y);
      }
      tacCtx.stroke();

      // 2. Draw Room Wireframe Walls (1px Glowing Cyan Lines)
      tacCtx.strokeStyle = '#00f0ff';
      tacCtx.lineWidth = 1.5;
      tacCtx.shadowColor = 'rgba(0, 240, 255, 0.6)';
      tacCtx.shadowBlur = 6;
      tacCtx.strokeRect(cx - 180, cy - 140, 360, 280);
      tacCtx.strokeRect(cx - 320, cy - 80, 140, 160);
      tacCtx.strokeRect(cx + 180, cy - 80, 140, 160);

      // Open Corridor Portals
      tacCtx.clearRect(cx - 181, cy - 30, 4, 60);
      tacCtx.clearRect(cx + 179, cy - 30, 4, 60);

      // 3. Distance Circles (Radar Envelopes)
      tacCtx.shadowBlur = 0;
      tacCtx.strokeStyle = 'rgba(216, 255, 0, 0.15)';
      tacCtx.setLineDash([4, 4]);
      tacCtx.beginPath();
      tacCtx.arc(cx, cy, 80, 0, Math.PI * 2);
      tacCtx.arc(cx, cy, 160, 0, Math.PI * 2);
      tacCtx.stroke();
      tacCtx.setLineDash([]);

      // 4. Draw Hostile Markers (m, b, F) with Threat Vectors
      state.hostiles.forEach(function(hostile, i) {
        var hx = cx + (i === 0 ? 90 : i === 1 ? -120 : 180);
        var hy = cy + (i === 0 ? -40 : i === 1 ? 70 : 80);

        // Vector line to player
        tacCtx.strokeStyle = 'rgba(255, 42, 75, 0.3)';
        tacCtx.lineWidth = 1;
        tacCtx.beginPath();
        tacCtx.moveTo(cx, cy);
        tacCtx.lineTo(hx, hy);
        tacCtx.stroke();

        // Hostile Glyph Box
        tacCtx.fillStyle = '#080d16';
        tacCtx.strokeStyle = '#ff2a4b';
        tacCtx.lineWidth = 1.5;
        tacCtx.strokeRect(hx - 12, hy - 12, 24, 24);
        tacCtx.fillRect(hx - 12, hy - 12, 24, 24);

        tacCtx.fillStyle = '#ff2a4b';
        tacCtx.font = 'bold 12px "JetBrains Mono", monospace';
        tacCtx.textAlign = 'center';
        tacCtx.textBaseline = 'middle';
        tacCtx.fillText(hostile.glyph, hx, hy);
      });

      // 5. Draw Runner @ Glyph with Solaris Oscilloscope Halo
      var playerOffsetX = (state.player.x - 14) * 20;
      var playerOffsetY = (state.player.y - 8) * 20;
      var px = cx + playerOffsetX;
      var py = cy + playerOffsetY;

      tacCtx.strokeStyle = '#d8ff00';
      tacCtx.lineWidth = 1.5;
      tacCtx.shadowColor = 'rgba(216, 255, 0, 0.8)';
      tacCtx.shadowBlur = 10;

      tacCtx.beginPath();
      tacCtx.arc(px, py, 18, 0, Math.PI * 2);
      tacCtx.stroke();

      tacCtx.fillStyle = '#d8ff00';
      tacCtx.font = '900 16px "Space Grotesk", sans-serif';
      tacCtx.textAlign = 'center';
      tacCtx.textBaseline = 'middle';
      tacCtx.fillText('@', px, py);
      tacCtx.shadowBlur = 0;

      // Update position badge
      var posEl = document.getElementById('tacCoordBadge');
      if (posEl) posEl.textContent = '└ POS: ' + state.player.x + '/' + state.player.y + ' ┘';

      // 6. Oscilloscope Sweep Beam
      scanlineOffset = (scanlineOffset + 1.5) % h;
      tacCtx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      tacCtx.lineWidth = 2;
      tacCtx.beginPath();
      tacCtx.moveTo(0, scanlineOffset);
      tacCtx.lineTo(w, scanlineOffset);
      tacCtx.stroke();
    }

    // ========================================================================
    // 3D ROTATING VECTOR WIREFRAME CANVAS (SHELL CHASSIS)
    // ========================================================================
    var shell3DCanvas = document.getElementById('shell3DCanvas');
    var shell3DCtx = shell3DCanvas.getContext('2d');
    var rotAngleY = 0;
    var rotAngleX = 0.2;

    function resize3DCanvas() {
      if (!shell3DCanvas) return;
      shell3DCanvas.width = shell3DCanvas.parentElement.clientWidth;
      shell3DCanvas.height = shell3DCanvas.parentElement.clientHeight;
    }

    // 3D Polyhedron Vertices for Chassis Hologram
    var vertices = [
      [-1, -1.2, -1], [1, -1.2, -1], [1, 1.2, -1], [-1, 1.2, -1],
      [-1, -1.2, 1], [1, -1.2, 1], [1, 1.2, 1], [-1, 1.2, 1],
      [0, -1.8, 0], [0, 1.8, 0] // Nose & Engine pylons
    ];
    var edges = [
      [0,1], [1,2], [2,3], [3,0],
      [4,5], [5,6], [6,7], [7,4],
      [0,4], [1,5], [2,6], [3,7],
      [8,0], [8,1], [8,4], [8,5],
      [9,2], [9,3], [9,6], [9,7]
    ];

    function render3DWireframe() {
      if (!shell3DCanvas || state.currentScreen !== 'hub-shell') return;
      var w = shell3DCanvas.width;
      var h = shell3DCanvas.height;
      if (w === 0 || h === 0) return;

      shell3DCtx.fillStyle = '#030508';
      shell3DCtx.fillRect(0, 0, w, h);

      if (state.wireframeRotating) {
        rotAngleY += 0.015;
      }

      var scale = Math.min(w, h) * 0.26;
      var cx = w / 2;
      var cy = h / 2;

      // Project vertices
      var projected = vertices.map(function(v) {
        // Rotate Y
        var x1 = v[0] * Math.cos(rotAngleY) - v[2] * Math.sin(rotAngleY);
        var z1 = v[0] * Math.sin(rotAngleY) + v[2] * Math.cos(rotAngleY);
        // Rotate X
        var y2 = v[1] * Math.cos(rotAngleX) - z1 * Math.sin(rotAngleX);
        var z2 = v[1] * Math.sin(rotAngleX) + z1 * Math.cos(rotAngleX);

        var fov = 3.5;
        var depth = fov / (fov + z2);
        return [cx + x1 * scale * depth, cy + y2 * scale * depth];
      });

      // Draw Edges
      shell3DCtx.strokeStyle = '#00f0ff';
      shell3DCtx.lineWidth = 1.5;
      shell3DCtx.shadowColor = 'rgba(0, 240, 255, 0.8)';
      shell3DCtx.shadowBlur = 8;
      shell3DCtx.beginPath();
      edges.forEach(function(e) {
        shell3DCtx.moveTo(projected[e[0]][0], projected[e[0]][1]);
        shell3DCtx.lineTo(projected[e[1]][0], projected[e[1]][1]);
      });
      shell3DCtx.stroke();

      // Draw Joint Nodes (Acid chartreuse points)
      shell3DCtx.fillStyle = '#d8ff00';
      shell3DCtx.shadowColor = 'rgba(216, 255, 0, 0.9)';
      shell3DCtx.shadowBlur = 6;
      projected.forEach(function(p) {
        shell3DCtx.fillRect(p[0] - 2.5, p[1] - 2.5, 5, 5);
      });
      shell3DCtx.shadowBlur = 0;
    }

    function toggleWireframeRotation() {
      state.wireframeRotating = !state.wireframeRotating;
    }
    function resetWireframeCam() {
      rotAngleY = 0;
      rotAngleX = 0.2;
    }

    // ========================================================================
    // MENU HERO CANVAS (ROTATING WIREFRAME DIAMOND)
    // ========================================================================
    var menuHeroCanvas = document.getElementById('menuHeroCanvas');
    var menuHeroCtx = menuHeroCanvas ? menuHeroCanvas.getContext('2d') : null;
    var menuAngle = 0;

    function renderMenuHero() {
      if (!menuHeroCanvas || state.currentScreen !== 'menu') return;
      var w = menuHeroCanvas.parentElement.clientWidth;
      var h = 180;
      menuHeroCanvas.width = w;
      menuHeroCanvas.height = h;

      menuHeroCtx.clearRect(0, 0, w, h);
      menuAngle += 0.02;

      var cx = w / 2;
      var cy = h / 2;
      var radius = 55;

      menuHeroCtx.strokeStyle = 'rgba(216, 255, 0, 0.8)';
      menuHeroCtx.lineWidth = 1.5;
      menuHeroCtx.shadowColor = 'rgba(216, 255, 0, 0.5)';
      menuHeroCtx.shadowBlur = 8;

      // Draw Diamond Frame
      menuHeroCtx.beginPath();
      for (var i = 0; i < 4; i++) {
        var a = menuAngle + (i * Math.PI / 2);
        var x = cx + Math.cos(a) * radius;
        var y = cy + Math.sin(a) * (radius * 0.7);
        if (i === 0) menuHeroCtx.moveTo(x, y);
        else menuHeroCtx.lineTo(x, y);
      }
      menuHeroCtx.closePath();
      menuHeroCtx.stroke();

      // Inner Counter-Rotating Hexagon
      menuHeroCtx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
      menuHeroCtx.beginPath();
      for (var j = 0; j < 6; j++) {
        var a2 = -menuAngle * 1.5 + (j * Math.PI / 3);
        var x2 = cx + Math.cos(a2) * (radius * 0.5);
        var y2 = cy + Math.sin(a2) * (radius * 0.35);
        if (j === 0) menuHeroCtx.moveTo(x2, y2);
        else menuHeroCtx.lineTo(x2, y2);
      }
      menuHeroCtx.closePath();
      menuHeroCtx.stroke();
    }

    // Main Animation Loop
    function animationLoop() {
      if (state.currentScreen === 'hud') {
        renderTacticalViewport();
      } else if (state.currentScreen === 'hub-shell') {
        render3DWireframe();
      } else if (state.currentScreen === 'menu') {
        renderMenuHero();
      }
      requestAnimationFrame(animationLoop);
    }

    // Keyboard Shortcuts & Tactical Movement
    window.addEventListener('keydown', function(e) {
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key) && state.currentScreen === 'hud') {
        e.preventDefault();
        var dx = (e.key === 'd' || e.key === 'ArrowRight') ? 1 : (e.key === 'a' || e.key === 'ArrowLeft') ? -1 : 0;
        var dy = (e.key === 's' || e.key === 'ArrowDown') ? 1 : (e.key === 'w' || e.key === 'ArrowUp') ? -1 : 0;
        state.player.x += dx;
        state.player.y += dy;
        state.player.turn++;
        state.player.heat = Math.max(0, state.player.heat - 1);
        addLog('NAV', 'Moved to sector X:' + state.player.x + ' Y:' + state.player.y + '.', '#00f0ff');
        updateHudUI();
      } else if (e.key === ' ' && state.currentScreen === 'hud') {
        e.preventDefault();
        simStats('step');
      } else if ((e.key === 'i' || e.key === 'I') && (state.currentScreen === 'hud' || state.currentScreen === 'modal-inventory')) {
        switchScreen(state.currentScreen === 'modal-inventory' ? 'hud' : 'modal-inventory');
      } else if ((e.key === 'e' || e.key === 'E') && state.currentScreen === 'hud') {
        switchScreen('modal-anchor');
      } else if ((e.key === 'd' || e.key === 'D') && state.currentScreen === 'hud') {
        switchScreen('modal-stairs');
      } else if (e.key === 'Escape') {
        if (state.currentScreen.startsWith('modal-')) switchScreen('hud');
      }
    });

    window.addEventListener('resize', function() {
      resizeTacticalCanvas();
      resize3DCanvas();
    });

    // Boot
    window.addEventListener('DOMContentLoaded', function() {
      updateHudUI();
      renderTelemetryFeed();
      renderHostileRadar();
      renderShellSpecs();
      requestAnimationFrame(animationLoop);
    });
  </script>
</body>
</html>
`;

fs.writeFileSync(outputHtmlPath, htmlContent, 'utf8');
console.log("Created: " + outputHtmlPath + " (" + Buffer.byteLength(htmlContent) + " bytes)");

fs.writeFileSync(publicHtmlPath, htmlContent, 'utf8');
console.log("Created: " + publicHtmlPath + " (for Next.js dev server at /mashup-6-26.html)");
