module.exports = `
    /* ==========================================================================
       RESET & BASE TOKENS
       ========================================================================== */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }

    :root {
      --app-bg: #060709;
      --app-text: #e2e8f0;
      --nav-height: 56px;
      --subnav-height: 44px;
      
      /* Active Theme Dynamic Tokens (defaults to Style 1 Marathon Protocol) */
      --th-bg: #07080b;
      --th-surface: #0e1117;
      --th-surface-alt: #141821;
      --th-border: #28303f;
      --th-accent: #d8ff00; /* Acid Chartreuse */
      --th-accent-rgb: 216, 255, 0;
      --th-accent-secondary: #00f0ff; /* Surgical Cyan */
      --th-accent-secondary-rgb: 0, 240, 255;
      --th-danger: #ff334b;
      --th-warning: #ffaa00;
      --th-text: #ffffff;
      --th-text-dim: #798399;
      --th-font-display: 'Space Grotesk', sans-serif;
      --th-font-mono: 'JetBrains Mono', monospace;
      --th-radius: 0px;
    }

    body {
      background-color: var(--app-bg);
      color: var(--app-text);
      font-family: var(--th-font-mono);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      overflow-y: auto;
    }

    /* ==========================================================================
       GLOBAL MASTER CONTROLLER BAR (STICKY TOP)
       ========================================================================== */
    .master-header {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #090b0e;
      border-bottom: 2px solid #21262d;
      box-shadow: 0 4px 24px rgba(0,0,0,0.85);
      display: flex;
      flex-direction: column;
    }

    .master-primary-row {
      height: var(--nav-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0.85rem;
      gap: 0.65rem;
    }

    .brand-cluster {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 190px;
    }

    .brand-glyph {
      width: 26px;
      height: 26px;
      background: #d8ff00;
      color: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 15px;
      clip-path: polygon(0 0, 80% 0, 100% 20%, 100% 100%, 0 100%);
    }

    .brand-title {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .brand-badge {
      font-size: 9px;
      font-family: 'JetBrains Mono', monospace;
      padding: 2px 5px;
      background: rgba(216, 255, 0, 0.15);
      border: 1px solid #d8ff00;
      color: #d8ff00;
      letter-spacing: 0.05em;
    }

    /* 25 Style Carousel Bar */
    .style-picker-container {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #11141a;
      padding: 3px 6px;
      border: 1px solid #2d333b;
      border-radius: 4px;
      overflow-x: auto;
      max-width: 880px;
      scrollbar-width: thin;
    }

    .style-picker-container::-webkit-scrollbar {
      height: 4px;
    }
    .style-picker-container::-webkit-scrollbar-thumb {
      background: #363c46;
      border-radius: 2px;
    }

    .style-nav-arrow {
      background: #1e242c;
      border: 1px solid #363c46;
      color: #e2e8f0;
      font-size: 11px;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 3px;
      white-space: nowrap;
      transition: background 0.15s ease;
    }
    .style-nav-arrow:hover {
      background: #d8ff00;
      color: #000;
    }

    .style-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #8b949e;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      padding: 4px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.12s ease;
      white-space: nowrap;
      border-radius: 3px;
    }

    .style-btn:hover {
      color: #ffffff;
      background: rgba(255,255,255,0.08);
    }

    .style-btn.active {
      color: #000000;
      background: #d8ff00;
      border-color: #d8ff00;
      font-weight: 800;
      box-shadow: 0 0 10px rgba(216, 255, 0, 0.35);
    }

    .style-indicator-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    /* View Switcher */
    .view-switcher {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      background: #161b22;
      padding: 3px;
      border: 1px solid #30363d;
      border-radius: 4px;
    }

    .view-btn {
      background: transparent;
      border: none;
      color: #c9d1d9;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 12px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
      border-radius: 3px;
    }

    .view-btn:hover {
      color: #ffffff;
    }

    .view-btn.active {
      background: #00f0ff;
      color: #000000;
      font-weight: 800;
    }

    /* Sub-header Controls */
    .master-sub-row {
      height: var(--subnav-height);
      background: #0d1117;
      border-top: 1px solid #1f242c;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      font-size: 11px;
    }

    .sim-cluster {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .sim-label {
      color: #7d8590;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-right: 4px;
      font-size: 10px;
    }

    .sim-btn {
      background: #21262d;
      border: 1px solid #363c46;
      color: #e6edf3;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 3px 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.12s ease;
      border-radius: 3px;
    }

    .sim-btn:hover {
      background: #30363d;
      border-color: #8b949e;
      color: #ffffff;
    }

    .sim-btn:active {
      transform: scale(0.97);
    }

    .sim-btn.primary {
      background: rgba(0, 240, 255, 0.15);
      border-color: #00f0ff;
      color: #00f0ff;
    }

    .sim-btn.primary:hover {
      background: #00f0ff;
      color: #000;
    }

    .sim-btn.danger {
      background: rgba(255, 51, 68, 0.15);
      border-color: #ff3344;
      color: #ff3344;
    }

    .sim-btn.danger:hover {
      background: #ff3344;
      color: #fff;
    }

    .info-cluster {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .theme-description-banner {
      color: #8b949e;
      font-size: 11px;
    }

    .theme-description-banner strong {
      color: #e2e8f0;
    }

    .spec-modal-trigger {
      background: transparent;
      border: 1px dashed #7d8590;
      color: #e2e8f0;
      padding: 3px 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
      border-radius: 3px;
    }

    .spec-modal-trigger:hover {
      border-color: #d8ff00;
      color: #d8ff00;
    }

    /* ==========================================================================
       MAIN VIEWPORT CONTAINER & BASE CSS
       ========================================================================== */
    .viewport-canvas {
      flex: 1;
      position: relative;
      background: var(--th-bg);
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 100px);
      padding: 1.25rem;
      box-sizing: border-box;
      transition: background 0.25s ease;
    }

    .view-panel-container {
      display: none;
      width: 100%;
      height: 100%;
      flex: 1;
    }

    .view-panel-container.active {
      display: flex;
      flex-direction: column;
    }

    /* Default Grid HUD & Workshop */
    .hud-shell {
      display: grid;
      grid-template-columns: 310px 1fr 310px;
      grid-template-rows: auto 1fr auto;
      gap: 1rem;
      min-height: 700px;
      font-family: var(--th-font-mono);
      position: relative;
    }

    .workshop-shell {
      display: grid;
      grid-template-columns: 340px 1fr 340px;
      grid-template-rows: auto 1fr;
      gap: 1.25rem;
      min-height: 700px;
      font-family: var(--th-font-mono);
    }

    .split-mode-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      width: 100%;
      min-height: calc(100vh - 130px);
    }

    .split-col {
      display: flex;
      flex-direction: column;
      border: 1px dashed rgba(255,255,255,0.15);
      padding: 0.75rem;
      position: relative;
    }

    .split-col-header {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding-bottom: 0.5rem;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: space-between;
      color: var(--th-accent);
    }

    /* Standard Cards & Ribbons */
    .hud-top-ribbon, .workshop-header {
      grid-column: 1 / -1;
      background: var(--th-surface);
      border: 1px solid var(--th-border);
      padding: 0.65rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
    }

    .panel-card {
      background: var(--th-surface);
      border: 1px solid var(--th-border);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .panel-title-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--th-border);
      padding-bottom: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .panel-title-text {
      font-family: var(--th-font-display);
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--th-text);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .panel-subtag {
      font-size: 9px;
      background: rgba(255,255,255,0.06);
      color: var(--th-accent);
      padding: 2px 6px;
      border: 1px solid var(--th-accent);
    }

    .ribbon-run-info {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .meta-chip {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--th-text-dim);
    }

    .meta-val {
      font-size: 13px;
      font-weight: 700;
      color: var(--th-text);
      letter-spacing: 0.05em;
    }

    .stability-gauge-block {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 320px;
    }

    .stability-track {
      flex: 1;
      height: 12px;
      background: rgba(255,255,255,0.08);
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.2);
    }

    .stability-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--th-accent-secondary), var(--th-accent));
      transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .chassis-visual {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--th-surface-alt);
      padding: 0.75rem;
      margin-bottom: 0.75rem;
      border-left: 3px solid var(--th-accent);
    }

    .chassis-avatar {
      width: 48px;
      height: 48px;
      background: #000;
      border: 1px solid var(--th-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 900;
      color: var(--th-accent);
    }

    .segmented-meter {
      display: flex;
      gap: 2px;
      height: 10px;
      margin-top: 4px;
    }

    .meter-pip {
      flex: 1;
      background: rgba(255,255,255,0.12);
      transition: background 0.15s ease;
    }

    .meter-pip.active-hp {
      background: var(--th-danger);
    }

    .meter-pip.active-heat {
      background: var(--th-accent);
    }

    .viewport-frame {
      grid-column: 2 / 3;
      background: #040507;
      border: 1px solid var(--th-border);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .map-ascii-grid {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      line-height: 1.25;
      letter-spacing: 0.15em;
      white-space: pre;
      background: 
        radial-gradient(circle at center, transparent 40%, rgba(4,5,7,0.95) 90%),
        repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px);
      padding: 1rem;
    }

    .map-hud-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 0.75rem;
    }

    .hud-bottom-dock {
      grid-column: 1 / -1;
      background: var(--th-surface);
      border: 1px solid var(--th-border);
      padding: 0.75rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .ability-grid {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .ability-btn {
      background: var(--th-surface-alt);
      border: 1px solid var(--th-border);
      color: #ffffff;
      padding: 0.5rem 0.85rem;
      min-width: 150px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.15s ease;
      position: relative;
    }

    .ability-btn:hover {
      border-color: var(--th-accent);
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-2px);
    }

    .ability-key {
      font-size: 10px;
      font-weight: 800;
      background: var(--th-accent);
      color: #000;
      padding: 1px 4px;
      align-self: flex-start;
    }

    .ability-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .ability-heat-tag {
      font-size: 9px;
      color: var(--th-warning);
    }

    .wallet-counter-group {
      display: flex;
      align-items: center;
      gap: 1.75rem;
    }

    .wallet-card {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    .wallet-val {
      font-family: var(--th-font-display);
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
    }

    .wallet-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--th-text-dim);
      letter-spacing: 0.1em;
    }

    .upgrade-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .action-chip-btn {
      background: transparent;
      border: 1px solid var(--th-accent);
      color: var(--th-accent);
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 700;
      font-family: var(--th-font-mono);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .action-chip-btn:hover {
      background: var(--th-accent);
      color: #000;
    }

    /* ==========================================================================
       STYLES 1 - 15 THEME SELECTORS (PRESERVED)
       ========================================================================== */
    .theme-marathon {
      --th-bg: #07080b; --th-surface: #0e1117; --th-surface-alt: #141821; --th-border: #28303f;
      --th-accent: #d8ff00; --th-accent-secondary: #00f0ff; --th-danger: #ff334b; --th-warning: #ffaa00;
      --th-text: #ffffff; --th-text-dim: #798399; --th-font-display: 'Space Grotesk', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-cogmind {
      --th-bg: #020904; --th-surface: #041408; --th-surface-alt: #061c0c; --th-border: #0a3517;
      --th-accent: #00ff66; --th-accent-secondary: #ffb800; --th-danger: #ff3344; --th-warning: #ffb800;
      --th-text: #00ff66; --th-text-dim: #008f39; --th-font-display: 'VT323', monospace; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-clinical {
      --th-bg: #eceff4; --th-surface: #ffffff; --th-surface-alt: #f8fafc; --th-border: #cbd5e1;
      --th-accent: #ff0055; --th-accent-secondary: #ff6600; --th-danger: #ff0055; --th-warning: #ffaa00;
      --th-text: #0e1117; --th-text-dim: #64748b; --th-font-display: 'Space Grotesk', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-glitch {
      --th-bg: #090312; --th-surface: #130824; --th-surface-alt: #1c0d36; --th-border: #3d1b6d;
      --th-accent: #ff007f; --th-accent-secondary: #00ffff; --th-danger: #ff0033; --th-warning: #ffbb00;
      --th-text: #f5edff; --th-text-dim: #937ab5; --th-font-display: 'Orbitron', sans-serif; --th-font-mono: 'Share Tech Mono', monospace;
    }
    .theme-cassette {
      --th-bg: #141716; --th-surface: #1e2321; --th-surface-alt: #262c2a; --th-border: #363e3b;
      --th-accent: #ff8800; --th-accent-secondary: #00e5ff; --th-danger: #ff3322; --th-warning: #ffaa00;
      --th-text: #e2e8e5; --th-text-dim: #798681; --th-font-display: 'Chakra Petch', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-vector {
      --th-bg: #030305; --th-surface: #07090f; --th-surface-alt: #0a0e17; --th-border: #142838;
      --th-accent: #00f0ff; --th-accent-secondary: #ffffff; --th-danger: #ff2255; --th-warning: #00e5ff;
      --th-text: #ffffff; --th-text-dim: #5c7b94; --th-font-display: 'Orbitron', monospace; --th-font-mono: 'Share Tech Mono', monospace;
    }
    .theme-industrial {
      --th-bg: #141518; --th-surface: #1e2025; --th-surface-alt: #262930; --th-border: #3e4450;
      --th-accent: #ffe500; --th-accent-secondary: #ff1e27; --th-danger: #ff1e27; --th-warning: #ffe500;
      --th-text: #f0f2f5; --th-text-dim: #8892a0; --th-font-display: 'Chakra Petch', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-solar {
      --th-bg: #0a0614; --th-surface: #120b22; --th-surface-alt: #1a1030; --th-border: #381c60;
      --th-accent: #ff4500; --th-accent-secondary: #9d4edd; --th-danger: #ff0040; --th-warning: #ffaa00;
      --th-text: #fbeaff; --th-text-dim: #9d8db5; --th-font-display: 'Oxanium', sans-serif; --th-font-mono: 'Share Tech Mono', monospace;
    }
    .theme-cybermarket {
      --th-bg: #090a0f; --th-surface: #10121a; --th-surface-alt: #161a26; --th-border: #222b3d;
      --th-accent: #00ff88; --th-accent-secondary: #ff1493; --th-danger: #ff0055; --th-warning: #fff000;
      --th-text: #f0f8ff; --th-text-dim: #6d7f99; --th-font-display: 'Rajdhani', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-avionics {
      --th-bg: #06110a; --th-surface: #0a1c12; --th-surface-alt: #0e271a; --th-border: #163e29;
      --th-accent: #1eff50; --th-accent-secondary: #00d4ff; --th-danger: #ff2222; --th-warning: #ffcc00;
      --th-text: #d4ffd9; --th-text-dim: #4d8f63; --th-font-display: 'Oxanium', sans-serif; --th-font-mono: 'Share Tech Mono', monospace;
    }
    .theme-neobrutalist {
      --th-bg: #f2f2f2; --th-surface: #ffffff; --th-surface-alt: #e6e6e6; --th-border: #000000;
      --th-accent: #ff4d00; --th-accent-secondary: #000000; --th-danger: #ff1100; --th-warning: #ffaa00;
      --th-text: #000000; --th-text-dim: #555555; --th-font-display: 'Syne', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-biomechanical {
      --th-bg: #0c0907; --th-surface: #16110d; --th-surface-alt: #1f1813; --th-border: #3b2c22;
      --th-accent: #b8ff00; --th-accent-secondary: #e8dfd0; --th-danger: #990000; --th-warning: #a87820;
      --th-text: #e8dfd0; --th-text-dim: #8a7360; --th-font-display: 'Chakra Petch', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-apollo {
      --th-bg: #1c1f1e; --th-surface: #242927; --th-surface-alt: #2c3330; --th-border: #3d4743;
      --th-accent: #ffa500; --th-accent-secondary: #4df0d4; --th-danger: #e53935; --th-warning: #ffa500;
      --th-text: #f4eedd; --th-text-dim: #8b9994; --th-font-display: 'VT323', monospace; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-synthwave {
      --th-bg: #08081a; --th-surface: #10102b; --th-surface-alt: #18183d; --th-border: #3b226e;
      --th-accent: #00f0ff; --th-accent-secondary: #ff007f; --th-danger: #ff0055; --th-warning: #ffe600;
      --th-text: #ffffff; --th-text-dim: #9b8ec4; --th-font-display: 'Orbitron', sans-serif; --th-font-mono: 'Share Tech Mono', monospace;
    }
    .theme-classified {
      --th-bg: #dfd7c2; --th-surface: #eae3d2; --th-surface-alt: #f3ecdb; --th-border: #8a7f6c;
      --th-accent: #c41c1c; --th-accent-secondary: #1c448e; --th-danger: #c41c1c; --th-warning: #d97706;
      --th-text: #1b1d1e; --th-text-dim: #635b4c; --th-font-display: 'Courier Prime', monospace; --th-font-mono: 'Courier Prime', monospace;
    }

    /* ==========================================================================
       RADICALLY DIVERSE STRUCTURAL LAYOUT RULES (STYLES 16 - 25)
       ========================================================================== */

    /* STYLE 16: TACTICAL RADIAL / ORBITAL COCKPIT */
    .theme-radial {
      --th-bg: #050810; --th-surface: #0a1120; --th-surface-alt: #101b33; --th-border: #1a2f5a;
      --th-accent: #00e5ff; --th-accent-secondary: #7928ca; --th-danger: #ff0055; --th-warning: #00e5ff;
      --th-text: #e6f1ff; --th-text-dim: #6484b8; --th-font-display: 'Orbitron', sans-serif; --th-font-mono: 'Share Tech Mono', monospace;
    }
    .theme-radial .hud-shell {
      border-radius: 40px; border: 2px solid #00e5ff; box-shadow: 0 0 30px rgba(0, 229, 255, 0.2);
      padding: 1.25rem; background: radial-gradient(circle at center, #0a1120 40%, #03050a 100%);
    }
    .theme-radial .viewport-frame { border-radius: 30px; border: 2px solid #00e5ff; }
    .theme-radial .panel-card { border-radius: 20px; }
    .theme-radial .ability-btn { border-radius: 24px; border: 1px solid #00e5ff; }

    /* STYLE 17: MECH DASHBOARD CONSOLE (Top 60% Windshield / Bottom 40% Lower Cockpit) */
    .theme-mech {
      --th-bg: #0d0f11; --th-surface: #171b1f; --th-surface-alt: #20262c; --th-border: #333d47;
      --th-accent: #ff9900; --th-accent-secondary: #00d9ff; --th-danger: #ff2a2a; --th-warning: #ffaa00;
      --th-text: #d9e2ec; --th-text-dim: #718096; --th-font-display: 'Chakra Petch', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-mech .hud-shell {
      grid-template-columns: 260px 1fr 260px; grid-template-rows: auto 340px 1fr;
      border: 6px solid #283038; background: #111417; padding: 0.5rem;
    }
    .theme-mech .viewport-frame { grid-column: 1 / -1; height: 340px; border: 3px solid #ff9900; }
    .theme-mech .hud-left-col { grid-column: 1 / 2; grid-row: 3 / 4; }
    .theme-mech .hud-right-col { grid-column: 3 / 4; grid-row: 3 / 4; }
    .theme-mech .hud-bottom-dock { grid-column: 2 / 3; grid-row: 3 / 4; }

    /* STYLE 18: FLOATING DIEGETIC AR (Zero Opaque Boxes / Fullscreen Map) */
    .theme-diegetic {
      --th-bg: #000000; --th-surface: rgba(10, 20, 30, 0.45); --th-surface-alt: rgba(15, 30, 45, 0.55); --th-border: rgba(0, 240, 255, 0.4);
      --th-accent: #00f0ff; --th-accent-secondary: #39ff14; --th-danger: #ff0055; --th-warning: #ffaa00;
      --th-text: #ffffff; --th-text-dim: #8ab4f8; --th-font-display: 'Space Grotesk', sans-serif; --th-font-mono: 'Share Tech Mono', monospace;
    }
    .theme-diegetic .hud-shell { background: transparent; border: none; box-shadow: none; padding: 0; }
    .theme-diegetic .panel-card, .theme-diegetic .hud-top-ribbon, .theme-diegetic .hud-bottom-dock {
      background: rgba(4, 10, 18, 0.65); backdrop-filter: blur(8px); border: 1px solid rgba(0, 240, 255, 0.4);
    }
    .theme-diegetic .viewport-frame { border: 1px solid rgba(0, 240, 255, 0.6); background: rgba(0, 0, 0, 0.7); }

    /* STYLE 19: CCTV SECURITY SURVEILLANCE MATRIX (Multi-Monitor Split Bank) */
    .theme-cctv {
      --th-bg: #050607; --th-surface: #0b0e11; --th-surface-alt: #13171c; --th-border: #1f2730;
      --th-accent: #00ff88; --th-accent-secondary: #ff3344; --th-danger: #ff3344; --th-warning: #ffbb00;
      --th-text: #d0f5e4; --th-text-dim: #507d67; --th-font-display: 'VT323', monospace; --th-font-mono: 'Share Tech Mono', monospace;
    }
    .theme-cctv .hud-shell, .theme-cctv .workshop-shell { border: 4px solid #1f2730; background: #000; gap: 0.5rem; padding: 0.5rem; }
    .theme-cctv .panel-card, .theme-cctv .viewport-frame, .theme-cctv .hud-top-ribbon, .theme-cctv .hud-bottom-dock {
      border: 1px solid #00ff88; box-shadow: inset 0 0 15px rgba(0, 255, 136, 0.08); background: #040806;
    }

    /* STYLE 20: CLASSIC 90S STATUS BAR (Doom/Quake Bottom Monolithic Bar) */
    .theme-classicbar {
      --th-bg: #111113; --th-surface: #1e1e24; --th-surface-alt: #282830; --th-border: #424250;
      --th-accent: #ff0000; --th-accent-secondary: #0088ff; --th-danger: #ff0000; --th-warning: #ffcc00;
      --th-text: #ffffff; --th-text-dim: #8b8b99; --th-font-display: 'VT323', monospace; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-classicbar .hud-shell {
      grid-template-columns: 1fr; grid-template-rows: auto 420px auto; border: 4px outset #5a5a6a; background: #141418; padding: 0.5rem;
    }
    .theme-classicbar .viewport-frame { grid-column: 1 / -1; height: 420px; border: 3px inset #3a3a46; }
    .theme-classicbar .hud-left-col { display: none; }
    .theme-classicbar .hud-right-col { display: none; }
    .theme-classicbar .hud-bottom-dock {
      grid-column: 1 / -1; background: #23232c; border: 4px outset #525264; display: flex; justify-content: space-around; padding: 0.85rem;
    }

    /* STYLE 21: VERTICAL DATA-SLEEVE (Pip-Boy / 65% Map - 35% Tall Column) */
    .theme-datasleeve {
      --th-bg: #090c0a; --th-surface: #101712; --th-surface-alt: #17221b; --th-border: #233329;
      --th-accent: #33ff77; --th-accent-secondary: #ffb700; --th-danger: #ff3b30; --th-warning: #ffb700;
      --th-text: #e2f7ea; --th-text-dim: #5c856b; --th-font-display: 'Chakra Petch', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-datasleeve .hud-shell {
      grid-template-columns: 1fr 340px; grid-template-rows: auto 1fr; border: 2px solid #233329; background: #090c0a;
    }
    .theme-datasleeve .hud-top-ribbon { grid-column: 1 / 2; }
    .theme-datasleeve .viewport-frame { grid-column: 1 / 2; min-height: 520px; }
    .theme-datasleeve .hud-left-col { display: none; }
    .theme-datasleeve .hud-right-col { grid-column: 2 / 3; grid-row: 1 / 3; height: 100%; }
    .theme-datasleeve .hud-bottom-dock { grid-column: 1 / 2; }

    /* STYLE 22: DATA LAKE / REVERSE-ENGINEERING IDE (Wireshark / Ghidra Debugger) */
    .theme-datalake {
      --th-bg: #0b0e14; --th-surface: #111622; --th-surface-alt: #171f30; --th-border: #25334d;
      --th-accent: #38bdf8; --th-accent-secondary: #a855f7; --th-danger: #ef4444; --th-warning: #f59e0b;
      --th-text: #f0f6fc; --th-text-dim: #738a9c; --th-font-display: 'JetBrains Mono', monospace; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-datalake .hud-shell, .theme-datalake .workshop-shell { border: 1px solid #25334d; background: #0b0e14; font-size: 11px; }
    .theme-datalake .panel-card { border: 1px solid #1e293b; background: #0f172a; }

    /* STYLE 23: SWISS ASYMMETRIC ZINE (Ray Gun / David Carson Editorial) */
    .theme-zine {
      --th-bg: #ffffff; --th-surface: #ffffff; --th-surface-alt: #f0f0f0; --th-border: #000000;
      --th-accent: #ff0033; --th-accent-secondary: #000000; --th-danger: #ff0033; --th-warning: #000000;
      --th-text: #000000; --th-text-dim: #555555; --th-font-display: 'Syne', sans-serif; --th-font-mono: 'Space Grotesk', sans-serif;
    }
    .theme-zine .hud-shell, .theme-zine .workshop-shell { background: #ffffff; border: 4px solid #000000; padding: 1.25rem; }
    .theme-zine .viewport-frame { background: #000000; border: 4px solid #000000; transform: rotate(-0.5deg); }
    .theme-zine .panel-card { border: 3px solid #000000; transform: rotate(0.5deg); }
    .theme-zine .ability-btn {
      background: #000000; color: #ffffff; border: none; clip-path: polygon(0 0, 100% 0, 95% 100%, 0% 100%);
    }
    .theme-zine .ability-btn:hover { background: #ff0033; }

    /* STYLE 24: MODULAR EURORACK SYNTHESIZER (19-Inch Aluminum Audio Rack) */
    .theme-eurorack {
      --th-bg: #1a1c1e; --th-surface: #25282b; --th-surface-alt: #2f3438; --th-border: #454c52;
      --th-accent: #00ffaa; --th-accent-secondary: #ff3366; --th-danger: #ff3366; --th-warning: #ffaa00;
      --th-text: #e1e7ec; --th-text-dim: #828e98; --th-font-display: 'Oxanium', sans-serif; --th-font-mono: 'JetBrains Mono', monospace;
    }
    .theme-eurorack .hud-shell, .theme-eurorack .workshop-shell {
      border-left: 12px solid #33383d; border-right: 12px solid #33383d;
      border-top: 3px solid #4a5259; border-bottom: 3px solid #4a5259; background: #1e2023;
    }

    /* STYLE 25: HANDHELD CYBER-CONSOLE (Game Boy / Cyber-Deck Device) */
    .theme-handheld {
      --th-bg: #2a2e34; --th-surface: #383d45; --th-surface-alt: #464c56; --th-border: #565d69;
      --th-accent: #8bac0f; --th-accent-secondary: #9bbc0f; --th-danger: #d9534f; --th-warning: #f0ad4e;
      --th-text: #0f380f; --th-text-dim: #306230; --th-font-display: 'VT323', monospace; --th-font-mono: 'VT323', monospace;
    }
    .theme-handheld .hud-shell, .theme-handheld .workshop-shell {
      border-radius: 20px; border: 8px solid #4a505a; background: #8bac0f; color: #0f380f; padding: 1.25rem;
    }
    .theme-handheld .viewport-frame { background: #9bbc0f; border: 4px inset #8bac0f; color: #0f380f; }
    .theme-handheld .panel-card, .theme-handheld .hud-top-ribbon, .theme-handheld .hud-bottom-dock {
      background: #8bac0f; border: 2px solid #0f380f; color: #0f380f;
    }
    .theme-handheld .ability-btn { background: #306230; color: #9bbc0f; border-radius: 20px; }

    /* ==========================================================================
       DESIGN SPECIFICATION MODAL (ALL 25 STYLES)
       ========================================================================== */
    .spec-modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .spec-modal-backdrop.open {
      display: flex;
    }

    .spec-modal-content {
      background: #0d1117;
      border: 2px solid #d8ff00;
      width: 100%;
      max-width: 1020px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 2rem;
      box-shadow: 0 0 50px rgba(0,0,0,0.9);
      position: relative;
    }

    .spec-modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: #21262d;
      border: 1px solid #30363d;
      color: #fff;
      font-size: 14px;
      padding: 4px 10px;
      cursor: pointer;
    }

    .spec-modal-close:hover {
      background: #ff3344;
    }

    .spec-modal-content h2 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 22px;
      margin-bottom: 0.5rem;
      color: #d8ff00;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .spec-modal-content p {
      color: #c9d1d9;
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 1.25rem;
    }

    .spec-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .spec-card {
      background: #161b22;
      border: 1px solid #30363d;
      padding: 1rem;
    }

    .spec-card h3 {
      font-size: 12px;
      color: #00f0ff;
      text-transform: uppercase;
      margin-bottom: 0.4rem;
    }

    .swatch-row {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .swatch {
      width: 22px;
      height: 22px;
      border: 1px solid rgba(255,255,255,0.2);
    }
  `;
