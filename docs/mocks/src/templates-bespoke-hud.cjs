// Bespoke HUD Templates for Styles 26 - 35

module.exports = `
<!-- ========================================================================
     BESPOKE HUD 26: TAIKOKU INDUSTRIAL MANIFEST (Marathon / Antireal / TDR)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-taikoku">
  <!-- Top Stamped Placard -->
  <div class="taikoku-header">
    <div class="taikoku-brand-kanji">
      <span>対空重工業</span>
      <span style="font-size: 13px; color: #444;">TAIKOKU HEAVY INDUSTRIES // LOGISTICS SPEC #884-X</span>
      <span class="badge">CLASS 4 HAZARD</span>
    </div>
    <div style="display: flex; align-items: center; gap: 14px;">
      <div style="font-size: 11px; color: #000; font-weight: 700;">
        LOT: <span style="font-family: monospace;">NRM-9942-B</span> | PALLET 09
      </div>
      <div class="taikoku-stamp-box">
        [ 検査済 2049.11.04 PASSED ]
      </div>
    </div>
  </div>

  <!-- Left Column: Vertical Barcode Ladder -->
  <aside class="taikoku-left-ladder">
    <div class="taikoku-vertical-text">CARGO CLASS 4.1 // EXPENDABLE RUNNER UNIT</div>
    <!-- SVG Barcode Ladder -->
    <svg class="taikoku-barcode-svg" viewBox="0 0 54 180">
      <rect x="0" y="0" width="4" height="180" fill="#f4f4f0"/>
      <rect x="6" y="0" width="2" height="180" fill="#f4f4f0"/>
      <rect x="11" y="0" width="6" height="180" fill="#f4f4f0"/>
      <rect x="20" y="0" width="2" height="180" fill="#f4f4f0"/>
      <rect x="24" y="0" width="8" height="180" fill="#f4f4f0"/>
      <rect x="35" y="0" width="3" height="180" fill="#f4f4f0"/>
      <rect x="41" y="0" width="5" height="180" fill="#f4f4f0"/>
      <rect x="49" y="0" width="3" height="180" fill="#f4f4f0"/>
    </svg>
    <div style="font-size: 9px; color: #d8ff00; font-family: monospace; text-align: center;">
      PALLET<br>#09
    </div>
  </aside>

  <!-- Center Bay: Recessed Viewport -->
  <section class="taikoku-viewport-bay">
    <span class="taikoku-corner-mark tl">+ [0,0]</span>
    <span class="taikoku-corner-mark tr">[36,0] +</span>
    <span class="taikoku-corner-mark bl">+ [0,15]</span>
    <span class="taikoku-corner-mark br">[36,15] +</span>
    <div class="map-ascii-grid" id="asciiMapContainer-taikoku"></div>
  </section>

  <!-- Right Column: Manifest Invoice Table -->
  <aside class="taikoku-manifest-table">
    <div class="taikoku-manifest-title">
      <span>SHIPPING MANIFEST SPEC</span>
      <span style="color: #ff6600;">TK-9942</span>
    </div>
    <div class="taikoku-spec-row">
      <span class="taikoku-spec-label">01. HULL CHASSIS</span>
      <span class="taikoku-spec-val" id="taikoku-shell">VANGUARD-v1</span>
    </div>
    <div class="taikoku-spec-row">
      <span class="taikoku-spec-label">02. INTEGRITY</span>
      <span class="taikoku-spec-val" style="color: #ff334b;" id="taikoku-hp">18 / 20 HP</span>
    </div>
    <div class="taikoku-spec-row">
      <span class="taikoku-spec-label">03. HEAT EXHAUST</span>
      <span class="taikoku-spec-val" style="color: #ffaa00;" id="taikoku-heat">38 / 100 CAL</span>
    </div>
    <div class="taikoku-spec-row">
      <span class="taikoku-spec-label">04. FLUX CONTAINMENT</span>
      <span class="taikoku-spec-val" style="color: #00f0ff;" id="taikoku-stability">88.4% PSI</span>
    </div>
    <div class="taikoku-spec-row">
      <span class="taikoku-spec-label">05. SCRAP REGISTERED</span>
      <span class="taikoku-spec-val" style="color: #d8ff00;" id="taikoku-scrap">1,420 KG</span>
    </div>

    <div style="margin-top: 10px; font-size: 10px; color: #8c96a8;">
      HOSTILE THREATS DETECTED:
    </div>
    <div style="font-size: 11px; color: #ff334b; font-family: monospace; line-height: 1.5;" id="taikoku-threats">
      • [m] STALKER-X (3m) // LOCK<br>
      • [b] SWARMER-04 (2m) // FAST<br>
      • [F] HEAVY-FRAG (6m) // SLAM
    </div>
  </aside>

  <!-- Bottom Dock: Freight Release Punch Levers -->
  <footer class="taikoku-dock-levers">
    <button class="taikoku-lever-btn" onclick="simCastAbility('phase_shift')">
      <span>推進 01: PHASE SHIFT</span>
      <span style="font-size: 10px; color: #d8ff00;">[KEY 1]</span>
    </button>
    <button class="taikoku-lever-btn" onclick="simCastAbility('neural_spike')">
      <span>射出 02: NEURAL SPIKE</span>
      <span style="font-size: 10px; color: #d8ff00;">[KEY 2]</span>
    </button>
    <button class="taikoku-lever-btn" onclick="simWaitTurn()">
      <span>排熱 03: VENT HEAT</span>
      <span style="font-size: 10px; color: #d8ff00;">[KEY W]</span>
    </button>
    <button class="taikoku-lever-btn" style="border-color: #ff334b;" onclick="simTakeDamage()">
      <span style="color: #ff334b;">衝撃 04: TAKE DAMAGE</span>
      <span style="font-size: 10px; color: #ff334b;">[-4 HP]</span>
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 27: GHOST-DIVE CYBER-BRAIN (Ghost in the Shell / Motoko)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-ghostdive">
  <!-- Top Cerebral Cortex EEG Header -->
  <div class="ghost-eeg-header">
    <div style="display: flex; align-items: center; gap: 14px;">
      <span style="font-size: 16px; font-weight: 800; color: #00f0ff; letter-spacing: 0.1em;">GHOST-DIVE TELEMETRY</span>
      <span style="background: rgba(0,240,255,0.15); border: 1px solid #00f0ff; color: #00f0ff; font-size: 10px; padding: 2px 8px;">DIVE LAYER 07</span>
    </div>
    <!-- Animated EEG SVG Brainwave -->
    <svg class="ghost-brainwave-anim" viewBox="0 0 220 36">
      <path d="M0,18 L30,18 L40,6 L50,30 L60,18 L90,18 L100,2 L110,34 L120,18 L150,18 L160,8 L170,28 L180,18 L220,18" fill="none" stroke="#00f0ff" stroke-width="2"/>
    </svg>
    <div style="font-size: 11px; color: #a855f7; font-weight: 700;">
      GHOST BARRIER: <span id="ghost-stability-text" style="color: #00f0ff;">88.4% [INTACT]</span>
    </div>
  </div>

  <!-- Left Column: Spinal Neural Bus -->
  <aside class="ghost-spinal-column">
    <div style="font-size: 11px; font-weight: 800; color: #00f0ff; margin-bottom: 4px;">SPINAL CABLE BUS</div>
    <div class="ghost-jack-port active">
      <span class="led"></span>
      <strong style="color: #fff; font-size: 11px;">JACK C1: SENSORY</strong>
      <div style="font-size: 9px; color: #64748b; margin-top: 2px;">LATENCY: 0.8ms // LINKED</div>
    </div>
    <div class="ghost-jack-port active">
      <span class="led"></span>
      <strong style="color: #fff; font-size: 11px;">JACK C2: MOTOR REFLEX</strong>
      <div style="font-size: 9px; color: #64748b; margin-top: 2px;">OUTPUT: 120Hz // NOMINAL</div>
    </div>
    <div class="ghost-jack-port active">
      <span class="led"></span>
      <strong style="color: #fff; font-size: 11px;">JACK C3: GHOST FIREWALL</strong>
      <div style="font-size: 9px; color: #64748b; margin-top: 2px;">CIPHER: RSA-8192-Q // OK</div>
    </div>
    <div class="ghost-jack-port">
      <span class="led" style="background: #a855f7; box-shadow: 0 0 8px #a855f7;"></span>
      <strong style="color: #fff; font-size: 11px;">JACK C4: DEEP NET BUFFER</strong>
      <div style="font-size: 9px; color: #64748b; margin-top: 2px;">STANDBY // ZERO-LEAK</div>
    </div>
  </aside>

  <!-- Center: Anatomical Split + Optical Feed -->
  <section class="ghost-center-chassis">
    <!-- SVG Cyborg Anatomical Wireframe -->
    <div class="ghost-anatomy-wireframe">
      <svg width="100" height="240" viewBox="0 0 100 240">
        <!-- Skull -->
        <circle cx="50" cy="30" r="18" fill="none" stroke="#00f0ff" stroke-width="1.5"/>
        <line x1="50" y1="12" x2="50" y2="48" stroke="#a855f7" stroke-width="1"/>
        <circle cx="50" cy="30" r="6" fill="rgba(0,240,255,0.3)" stroke="#00f0ff" stroke-width="1"/>
        <!-- Spine Vertebrae -->
        <line x1="50" y1="48" x2="50" y2="160" stroke="#00f0ff" stroke-width="2.5" stroke-dasharray="4 2"/>
        <!-- Rib Cage -->
        <path d="M25,75 Q50,65 75,75 M20,95 Q50,85 80,95 M25,115 Q50,105 75,115" fill="none" stroke="#00f0ff" stroke-width="1.2"/>
        <!-- Pelvis & Joints -->
        <circle cx="35" cy="170" r="5" fill="#a855f7"/>
        <circle cx="65" cy="170" r="5" fill="#a855f7"/>
        <line x1="35" y1="175" x2="30" y2="230" stroke="#00f0ff" stroke-width="1.5"/>
        <line x1="65" y1="175" x2="70" y2="230" stroke="#00f0ff" stroke-width="1.5"/>
      </svg>
      <div style="font-size: 9px; color: #00f0ff; text-align: center; margin-top: 6px;">
        SYNTH-ORGANIC<br>CHASSIS v1
      </div>
    </div>

    <!-- Active Optical Viewport -->
    <div class="ghost-optical-viewport">
      <div class="map-ascii-grid" id="asciiMapContainer-ghostdive"></div>
    </div>
  </section>

  <!-- Right Column: Deep Net Telemetry & Event Log -->
  <aside style="background: rgba(10, 17, 34, 0.7); border: 1px solid #1e3a6a; padding: 1rem; display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 11px; font-weight: 800; color: #a855f7;">NEURAL EVENT LOG</div>
    <div style="font-size: 11px; color: #e0f2fe;">HULL: <span id="ghost-hp" style="color: #ff1744;">18 / 20 HP</span></div>
    <div style="font-size: 11px; color: #e0f2fe;">HEAT: <span id="ghost-heat" style="color: #f59e0b;">38 / 100 CAL</span></div>
    <div style="font-size: 11px; color: #e0f2fe;">SCRAP: <span id="ghost-scrap" style="color: #00f0ff;">1,420 CR</span></div>
    <div style="flex: 1; border-top: 1px solid #1e3a6a; padding-top: 8px; font-size: 10px; color: #64748b; line-height: 1.4; overflow-y: auto;">
      > Ghost-link synchronized<br>
      > Threat pattern: Stalker detected<br>
      > Synapse buffer: Zero lag<br>
      > Memory sector 0x9FA0 open
    </div>
  </aside>

  <!-- Bottom Dock: Cervical Spinal Triggers -->
  <footer class="ghost-spinal-dock">
    <button class="ghost-neuro-btn" onclick="simCastAbility('phase_shift')">
      ⚡ C1: PHASE SHIFT [DODGE]
    </button>
    <button class="ghost-neuro-btn" onclick="simCastAbility('neural_spike')">
      💥 C2: NEURAL SPIKE [BLAST]
    </button>
    <button class="ghost-neuro-btn" onclick="simWaitTurn()">
      ⏳ OVERCLOCK / VENT HEAT
    </button>
    <button class="ghost-neuro-btn" style="border-color: #ff1744; color: #ff1744;" onclick="simTakeDamage()">
      💔 BIO-PULSE DAMAGE (-4 HP)
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 28: SEINEN MANGA COMIC PANELS (Akira / Tsutomu Nihei BLAME!)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-manga">
  <!-- Top Manga Chapter Banner -->
  <div class="manga-header-banner">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 20px; font-weight: 900;">第7話: 覚醒のサイボーグ</span>
      <span style="background: #e60012; color: #fff; font-size: 11px; padding: 2px 8px; font-weight: 800;">WEEKLY ISSUE #4028</span>
    </div>
    <div style="font-size: 12px; font-weight: 800;">
      現実安定度: <span id="manga-stability" style="color: #e60012;">88.4% [安定]</span>
    </div>
  </div>

  <!-- Left Column: Hero Close-Up Ink Panel -->
  <aside class="manga-panel manga-panel-angled" style="padding: 1rem; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <div style="font-size: 14px; font-weight: 900; color: #050505; border-bottom: 3px solid #050505; padding-bottom: 4px;">
        主人公: ヴァンガード
      </div>
      <div style="font-size: 11px; margin-top: 8px; line-height: 1.6; font-weight: 700;">
        機体状態: <span id="manga-hp" style="color: #e60012;">18 / 20 HP</span><br>
        神経熱量: <span id="manga-heat" style="color: #050505;">38 / 100 CAL</span><br>
        回収資材: <span id="manga-scrap" style="color: #e60012;">1,420 CR</span>
      </div>
    </div>
    <!-- Hand-drawn Style Ink Avatar -->
    <div style="border: 3px solid #050505; padding: 12px; text-align: center; background: #fff; box-shadow: 4px 4px 0 #050505;">
      <div style="font-size: 38px; font-weight: 900; color: #050505;">@</div>
      <div style="font-size: 10px; font-weight: 800; margin-top: 4px;">TARGET LOCKED</div>
    </div>
  </aside>

  <!-- Center Double-Page Hero Viewport -->
  <section class="manga-panel manga-map-viewport">
    <div class="manga-speedlines-bg"></div>
    <span class="manga-sfx-float" style="top: 14px; right: 18px;">ドォォン!</span>
    <span class="manga-sfx-float" style="bottom: 14px; left: 18px; color: #050505; animation-delay: 1s;">バチバチ!</span>
    <div class="map-ascii-grid" id="asciiMapContainer-manga"></div>
  </section>

  <!-- Right Column: Hostile Confrontation Panel -->
  <aside class="manga-panel manga-panel-angled" style="padding: 1rem; display: flex; flex-direction: column; gap: 10px;">
    <div style="font-size: 13px; font-weight: 900; color: #e60012; border-bottom: 2px solid #050505; padding-bottom: 4px;">
      強敵襲来 // THREATS
    </div>
    <div style="font-size: 11px; font-weight: 700; line-height: 1.8;">
      • [m] 影潜み (Stalker) - 3m<br>
      • [b] 増殖体 (Swarmer) - 2m<br>
      • [F] 断片巨躯 (Fragmenter) - 6m
    </div>
    <div style="margin-top: auto; border: 2px dashed #050505; padding: 8px; font-size: 10px; font-weight: 700; background: #eae6df;">
      次の一手を選択せよ…
    </div>
  </aside>

  <!-- Bottom Comic Action Dialogue Burst Buttons -->
  <footer class="manga-action-dock">
    <button class="manga-action-btn" onclick="simCastAbility('phase_shift')">
      ⚡ 瞬歩 PHASE SHIFT (1)
    </button>
    <button class="manga-action-btn" onclick="simCastAbility('neural_spike')">
      💥 刺突 NEURAL SPIKE (2)
    </button>
    <button class="manga-action-btn" onclick="simWaitTurn()">
      ⏳ 冷却 VENT HEAT (W)
    </button>
    <button class="manga-action-btn" style="border-color: #e60012; color: #e60012;" onclick="simTakeDamage()">
      💔 被弾 TAKE HIT (-4)
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 29: ZAIBATSU BIOTECH CLINICAL MONITOR (Clinical ICU / Cleanroom)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-biotech">
  <!-- Top EKG Waveform Header -->
  <div class="biotech-ekg-header">
    <div style="display: flex; align-items: center; gap: 16px;">
      <span style="font-size: 14px; font-weight: 800; color: #00f0ff;">ICU LIFE SUPPORT TELEMETRY</span>
      <span style="background: rgba(220,38,38,0.2); color: #dc2626; border: 1px solid #dc2626; font-size: 10px; padding: 2px 6px;">BIOHAZARD CLASS 4</span>
    </div>
    <!-- Sweeping EKG SVG Curve -->
    <svg class="biotech-ekg-svg" viewBox="0 0 240 38">
      <path d="M0,19 L40,19 L48,4 L56,34 L64,19 L100,19 L108,8 L116,30 L124,19 L170,19 L178,2 L186,36 L194,19 L240,19" fill="none" stroke="#2563eb" stroke-width="2"/>
    </svg>
    <div style="font-size: 11px; color: #f8fafc; font-family: monospace;">
      HR: <strong style="color: #00f0ff;">138 BPM</strong> | SPO2: <strong style="color: #2563eb;">98%</strong>
    </div>
  </div>

  <!-- Left Column: Glass IV Infusion Tubes -->
  <aside class="biotech-infusion-column">
    <div style="font-size: 11px; font-weight: 800; color: #00f0ff;">INFUSION RACK</div>
    
    <div class="biotech-iv-tube">
      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span>SYNTH-BLOOD</span>
        <span id="biotech-hp" style="color: #dc2626; font-weight: 700;">18 / 20 mL</span>
      </div>
      <div class="biotech-iv-level">
        <div class="biotech-iv-fill" style="width: 90%; background: #dc2626;"></div>
      </div>
    </div>

    <div class="biotech-iv-tube">
      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span>ELECTROLYTE</span>
        <span style="color: #2563eb; font-weight: 700;">40 / 50 mL</span>
      </div>
      <div class="biotech-iv-level">
        <div class="biotech-iv-fill" style="width: 80%; background: #2563eb;"></div>
      </div>
    </div>

    <div class="biotech-iv-tube">
      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span>CRYO-COOLANT</span>
        <span id="biotech-heat" style="color: #f59e0b; font-weight: 700;">38%</span>
      </div>
      <div class="biotech-iv-level">
        <div class="biotech-iv-fill" style="width: 38%; background: #f59e0b;"></div>
      </div>
    </div>
  </aside>

  <!-- Center Circular Microscope Petri Viewport -->
  <section class="biotech-microscope-viewport">
    <div class="biotech-graticule-ring"></div>
    <div style="position: absolute; top: 10px; left: 14px; font-size: 10px; color: #00f0ff; font-family: monospace;">
      SPECIMEN: HOMO-MECHANICUS // 100µm FIELD
    </div>
    <div class="map-ascii-grid" id="asciiMapContainer-biotech"></div>
  </section>

  <!-- Right Column: Pathology Report -->
  <aside style="background: #0d1422; border: 1px solid #22324f; padding: 1rem; display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 11px; font-weight: 800; color: #2563eb;">PATHOLOGY REPORT</div>
    <div style="font-size: 11px; color: #73849e;">REALITY STABILITY: <strong id="biotech-stability" style="color: #00f0ff;">88.4%</strong></div>
    <div style="font-size: 11px; color: #73849e;">SCRAP RECOVERY: <strong id="biotech-scrap" style="color: #f8fafc;">1,420 CR</strong></div>
    <div style="border-top: 1px solid #22324f; padding-top: 8px; font-size: 10px; color: #73849e; line-height: 1.5;">
      [✓] Gamma sterilization passed<br>
      [✓] Cryo-coolant circulation active<br>
      [!] Pathogen proximity alert: 3 units
    </div>
  </aside>

  <!-- Bottom Syringe Auto-Injectors Dock -->
  <footer class="biotech-syringe-dock">
    <button class="biotech-injector-btn" onclick="simCastAbility('phase_shift')">
      💉 SYR-01: PHASE SHIFT
    </button>
    <button class="biotech-injector-btn" onclick="simCastAbility('neural_spike')">
      ⚡ SYR-02: NEURAL SPIKE
    </button>
    <button class="biotech-injector-btn" onclick="simWaitTurn()">
      ❄️ SYR-03: CRYO VENT
    </button>
    <button class="biotech-injector-btn" style="border-color: #dc2626; color: #dc2626;" onclick="simTakeDamage()">
      💔 BIO-SHOCK HIT (-4 HP)
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 30: CHIBA BACK-ALLEY RIPPERDOC (Asymmetric Sheet Metal & Neon)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-ripperdoc">
  <!-- Top Crooked Neon Header -->
  <div class="ripperdoc-plate" style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; padding: 0 1.25rem;">
    <div class="ripperdoc-duct-tape"></div>
    <div class="ripperdoc-neon-sign">
      裏通り 義体屋 // CHIBA CHOP-SHOP
    </div>
    <div style="font-family: monospace; font-size: 12px; color: #39ff14;">
      STABILITY: <span id="ripperdoc-stability">88.4%</span> [NO BLOWOUT]
    </div>
  </div>

  <!-- Left Column: Exposed Circuit Breadboard -->
  <aside class="ripperdoc-plate" style="padding: 1rem; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <div style="font-size: 13px; font-weight: 700; color: #ff007f;">SALVAGED CHASSIS</div>
      <div style="font-size: 12px; color: #fff; margin-top: 6px; font-family: monospace;">
        HULL: <span id="ripperdoc-hp" style="color: #ff0033;">18 / 20</span><br>
        HEAT: <span id="ripperdoc-heat" style="color: #eab308;">38 CAL</span><br>
        SCRAP: <span id="ripperdoc-scrap" style="color: #39ff14;">1,420 ¥</span>
      </div>
    </div>
    <div style="border: 1px dashed #4a3636; padding: 8px; font-size: 10px; color: #9c8282; font-family: monospace;">
      JUMPER WIRES CONNECTED:<br>
      RED: RELAY 4<br>
      YELLOW: POT-10K<br>
      BLUE: GROUND
    </div>
  </aside>

  <!-- Center Cracked CRT Monitor Viewport -->
  <section class="ripperdoc-crt-viewport">
    <div style="position: absolute; top: 8px; right: 8px; background: #eab308; color: #000; font-size: 9px; font-weight: 900; padding: 2px 6px; transform: rotate(15deg);">
      CAUTION
    </div>
    <div class="map-ascii-grid" id="asciiMapContainer-ripperdoc"></div>
  </section>

  <!-- Right Column: Black Market Manifest -->
  <aside class="ripperdoc-plate" style="padding: 1rem; display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 13px; font-weight: 700; color: #39ff14;">CONTRABAND BOUNTY</div>
    <div style="font-size: 11px; font-family: monospace; color: #fff; line-height: 1.5;">
      • STALKER CHIP: 120¥<br>
      • SWARMER PACK: 80¥<br>
      • FRAGMENTER ARMOR: 350¥
    </div>
    <div style="margin-top: auto; border: 2px solid #ff0033; color: #ff0033; padding: 6px; font-size: 10px; font-weight: 900; text-align: center; transform: rotate(-3deg);">
      [ 没収品 // ILLEGAL ]
    </div>
  </aside>

  <!-- Bottom Heavy Knife Switches Dock -->
  <footer class="ripperdoc-dock-switches">
    <button class="ripperdoc-knife-btn" onclick="simCastAbility('phase_shift')">
      ⚡ SWITCH 1: PHASE SHIFT
    </button>
    <button class="ripperdoc-knife-btn" onclick="simCastAbility('neural_spike')">
      💥 SWITCH 2: NEURAL SPIKE
    </button>
    <button class="ripperdoc-knife-btn" onclick="simWaitTurn()">
      ⏳ OVERLOAD VENT HEAT
    </button>
    <button class="ripperdoc-knife-btn" style="border-color: #ff0033; color: #ff0033;" onclick="simTakeDamage()">
      💔 SHORT CIRCUIT HIT (-4)
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 31: NEO-TOKYO METRO TRANSIT (Tokyo Subway / Suica IC)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-tokyo-metro">
  <!-- Top Subway Route Map Tracker -->
  <div class="metro-station-tracker">
    <div class="metro-route-line">
      <div class="metro-station-node">新宿 SHINJUKU</div>
      <span>──●──</span>
      <div class="metro-station-node">渋谷 SHIBUYA</div>
      <span>──●──</span>
      <div class="metro-station-node current">階層7 FLOOR 07 (NOW)</div>
      <span>──◎──</span>
      <div class="metro-station-node">脱出ポッド EXTRACTION</div>
    </div>
    <div style="font-size: 11px; font-weight: 800; color: #00b259;">
      STABILITY: <span id="metro-stability">88.4%</span>
    </div>
  </div>

  <!-- Left Column: Suica IC Card Turnstile -->
  <aside class="metro-suica-gate">
    <div>
      <div style="font-size: 13px; font-weight: 800; color: #00b259;">PASMO / SUICA IC</div>
      <div style="font-size: 11px; color: #8b97a8; margin-top: 6px;">
        CARD ID: <strong style="color: #fff;">TK-4028</strong><br>
        BALANCE: <strong id="metro-scrap" style="color: #f39700;">¥ 1,420</strong>
      </div>
    </div>
    <div class="metro-ic-touchpad">
      [ ICカードをタッチ ]<br>
      TOUCH IC CARD
    </div>
  </aside>

  <!-- Center Platform Safety Window Viewport -->
  <section class="metro-platform-viewport">
    <div class="metro-destination-ribbon">
      <span>特急 RAPID EXPRESS // BOUND FOR DEEP SECTOR</span>
      <span>次の停車駅: 脱出ポッド</span>
    </div>
    <div class="map-ascii-grid" id="asciiMapContainer-tokyo-metro"></div>
  </section>

  <!-- Right Column: Platform LED Departure Board -->
  <aside class="metro-departure-board">
    <div style="font-size: 12px; font-weight: 800; color: #fff; border-bottom: 2px solid #323a48; padding-bottom: 4px;">
      発車標 // DEPARTURES
    </div>
    <div class="metro-led-row">
      <span>RAPID 04:18</span>
      <span>TRACK 2</span>
      <span style="color: #00b259;">ON TIME</span>
    </div>
    <div class="metro-led-row">
      <span>LOCAL 04:22</span>
      <span>TRACK 1</span>
      <span>DELAY 2M</span>
    </div>
    <div style="margin-top: auto; font-size: 10px; color: #8b97a8;">
      HULL: <span id="metro-hp" style="color: #e60012; font-weight: 700;">18/20</span> | HEAT: <span id="metro-heat" style="color: #f39700; font-weight: 700;">38%</span>
    </div>
  </aside>

  <!-- Bottom Emergency Door Release Dock -->
  <footer class="metro-emergency-dock">
    <button class="metro-release-btn" onclick="simCastAbility('phase_shift')">
      ⚡ 非常停止 01: PHASE SHIFT
    </button>
    <button class="metro-release-btn" onclick="simCastAbility('neural_spike')">
      💥 扉解放 02: NEURAL SPIKE
    </button>
    <button class="metro-release-btn" onclick="simWaitTurn()">
      ⏳ 空調排出 VENT HEAT
    </button>
    <button class="metro-release-btn" style="border-color: #e60012; color: #e60012;" onclick="simTakeDamage()">
      💔 非常ブレーキ TAKE HIT (-4)
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 32: NERV HEX-CANOPY HUD (Neon Genesis Evangelion / MAGI)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-nerv">
  <!-- Top MAGI Tri-Core Supercomputer Header -->
  <div class="nerv-magi-header">
    <div style="font-size: 15px; font-weight: 900; color: #ff7700; letter-spacing: 0.1em;">
      NERV HQ TACTICAL CANOPY
    </div>
    <div class="nerv-magi-nodes">
      <div class="nerv-magi-pill">MELCHIOR-1: 承認 AGREED</div>
      <div class="nerv-magi-pill">BALTHASAR-2: 承認 AGREED</div>
      <div class="nerv-magi-pill" style="border-color: #ffaa00; color: #ffaa00;">CASPER-3: 条件付</div>
    </div>
  </div>

  <!-- Left Column: Neural Synch-Rate Wing -->
  <aside class="nerv-sync-wing">
    <div>
      <div style="font-size: 12px; font-weight: 800; color: #ff7700;">SYNCHRONIZATION</div>
      <div style="font-size: 26px; font-weight: 900; color: #00ff66; margin: 6px 0;">89.4%</div>
      <!-- Sinusoidal Harmonic Waveform -->
      <svg class="nerv-sync-sine" viewBox="0 0 100 30">
        <path d="M0,15 Q25,0 50,15 T100,15" fill="none" stroke="#00ff66" stroke-width="2"/>
      </svg>
    </div>
    <div style="font-size: 11px; color: #8c8c9e;">
      EVA HULL: <span id="nerv-hp" style="color: #ff0033; font-weight: 800;">18 / 20</span><br>
      CORE HEAT: <span id="nerv-heat" style="color: #ffaa00; font-weight: 800;">38 CAL</span>
    </div>
  </aside>

  <!-- Center Hexagonal Viewport -->
  <section class="nerv-hex-viewport">
    <div class="map-ascii-grid" id="asciiMapContainer-nerv"></div>
  </section>

  <!-- Right Column: AT-Field Radar & Target Tracking -->
  <aside style="background: #121217; border: 1px solid #ff7700; padding: 1rem; display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 12px; font-weight: 800; color: #ff7700;">AT-FIELD INVERSION</div>
    <div style="font-size: 11px; color: #fff;">
      STABILITY: <span id="nerv-stability" style="color: #00ff66; font-weight: 800;">88.4%</span><br>
      RESONANCE: <span id="nerv-scrap" style="color: #ffaa00; font-weight: 800;">1,420 FLUX</span>
    </div>
    <div style="border-top: 1px solid #ff7700; padding-top: 8px; font-size: 10px; color: #8c8c9e; line-height: 1.5;">
      [!] Blood Pattern: BLUE detected<br>
      [✓] Umbilical cable connected<br>
      [✓] Internal battery: 04:59
    </div>
  </aside>

  <!-- Bottom Emergency Umbilical Clamps Dock -->
  <footer class="nerv-clamps-dock">
    <button class="nerv-clamp-btn" onclick="simCastAbility('phase_shift')">
      ⚡ アンビリカル切断 PHASE SHIFT
    </button>
    <button class="nerv-clamp-btn" onclick="simCastAbility('neural_spike')">
      💥 プログナイフ NEURAL SPIKE
    </button>
    <button class="nerv-clamp-btn" onclick="simWaitTurn()">
      ⏳ プラグ深度排出 VENT HEAT
    </button>
    <button class="nerv-clamp-btn" style="border-color: #ff0033; color: #ff0033;" onclick="simTakeDamage()">
      💔 ATフィールド損耗 HIT (-4)
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 33: HIGH-FREQUENCY STOCK TRADING (Wall Street & Greenbar)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-trading">
  <!-- Left Continuous Tractor Sprocket Margin -->
  <div class="trading-tractor-margin">
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
  </div>

  <!-- Top Scrolling Stock Ticker Bar -->
  <div class="trading-ticker-bar">
    <div class="trading-ticker-scroll">
      ▲ TAIKOKU HEAVY +4.2%  ▼ CYBER-DYNAMIC -1.8%  ▲ SCRAP/USDC 248.10  ▲ REALITY_FUTURES +12.4%  [BLOCK TRADE: 50,000 FLUX EXECUTED]  ▲ RUNNER_ETF +0.8%
    </div>
  </div>

  <!-- Right Continuous Tractor Sprocket Margin -->
  <div class="trading-tractor-margin" style="grid-column: 5 / 6; grid-row: 1 / 4;">
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
    <div class="trading-sprocket-hole"></div>
  </div>

  <!-- Left Column: L2 Order Book Depth Ladder -->
  <aside class="trading-order-book" style="grid-column: 2 / 3;">
    <div style="font-size: 11px; font-weight: 800; color: #ffb000; border-bottom: 1px solid #1e4231; padding-bottom: 4px;">
      ORDER BOOK (L2)
    </div>
    <div class="trading-ask-row"><span>ASK 252.0</span><span>14,000</span></div>
    <div class="trading-ask-row"><span>ASK 250.5</span><span>8,500</span></div>
    <div style="text-align: center; color: #ffb000; padding: 2px 0;">── SPREAD 0.5 ──</div>
    <div class="trading-bid-row"><span>BID 250.0</span><span>12,200</span></div>
    <div class="trading-bid-row"><span>BID 248.5</span><span>35,000</span></div>
    <div style="margin-top: auto; font-size: 10px; color: #6b8f7e;">
      HULL: <span id="trading-hp" style="color: #ff3344;">18 / 20</span><br>
      SCRAP: <span id="trading-scrap" style="color: #ffb000;">1,420 CR</span>
    </div>
  </aside>

  <!-- Center Financial Ledger Viewport -->
  <section class="trading-ledger-viewport" style="grid-column: 3 / 4;">
    <div class="map-ascii-grid" id="asciiMapContainer-trading"></div>
  </section>

  <!-- Right Column: Margin Risk & Candlestick Volatility -->
  <aside style="grid-column: 4 / 5; background: #0a140f; border: 1px solid #1e4231; padding: 10px; display: flex; flex-direction: column; gap: 6px;">
    <div style="font-size: 11px; font-weight: 800; color: #ffb000;">RISK MARGIN CALL</div>
    <div style="font-size: 11px; color: #e2f5ec;">STABILITY: <strong id="trading-stability" style="color: #00ff66;">88.4%</strong></div>
    <div style="font-size: 11px; color: #e2f5ec;">THERMAL: <strong id="trading-heat" style="color: #ffaa00;">38%</strong></div>
    <div style="border-top: 1px solid #1e4231; padding-top: 6px; font-size: 10px; color: #6b8f7e; line-height: 1.4;">
      MARGIN USAGE: 78.4%<br>
      LIQUIDATION THRESHOLD: 95%<br>
      [✓] High-frequency order routing OK
    </div>
  </aside>

  <!-- Bottom Algorithmic Execution Keys Dock -->
  <footer class="trading-execution-dock">
    <button class="trading-exec-btn" onclick="simCastAbility('phase_shift')">
      ▲ BUY LIMIT: PHASE SHIFT
    </button>
    <button class="trading-exec-btn" onclick="simCastAbility('neural_spike')">
      ▼ MARKET DUMP: NEURAL SPIKE
    </button>
    <button class="trading-exec-btn" onclick="simWaitTurn()">
      ⏳ SHORT VOL: VENT HEAT
    </button>
    <button class="trading-exec-btn" style="border-color: #ff3344; color: #ff3344;" onclick="simTakeDamage()">
      💔 MARGIN CALL HIT (-4)
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 34: 3D VOLUMETRIC HOLO-PODIUM (Star Wars / Prometheus)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-holo">
  <!-- Top Curved Holographic Status Arc -->
  <div class="holo-floating-card" style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between;">
    <div style="font-size: 15px; font-weight: 800; color: #38bdf8; letter-spacing: 0.1em;">
      VOLUMETRIC ORRERY TACTICAL PODIUM
    </div>
    <div style="font-size: 11px; color: #f0f9ff; font-family: monospace;">
      EMISSION: <span style="color: #38bdf8;">488nm</span> | COHERENCE: <span id="holo-stability" style="color: #818cf8;">88.4%</span>
    </div>
  </div>

  <!-- Left Floating Telemetry Glass Card -->
  <aside class="holo-floating-card" style="display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <div style="font-size: 12px; font-weight: 700; color: #38bdf8;">ORBITAL RUNNER</div>
      <div style="font-size: 12px; color: #fff; margin-top: 6px; font-family: monospace;">
        HULL: <span id="holo-hp" style="color: #f43f5e;">18 / 20</span><br>
        HEAT: <span id="holo-heat" style="color: #fbbf24;">38 CAL</span><br>
        FLUX: <span id="holo-scrap" style="color: #38bdf8;">1,420 CR</span>
      </div>
    </div>
    <div style="font-size: 10px; color: #64748b;">
      BEAM COILS: STABLE<br>
      PROJECTION ANGLE: +15°
    </div>
  </aside>

  <!-- Center 3D Perspective-Tilted Stage -->
  <section class="holo-3d-stage">
    <div class="holo-3d-map">
      <div class="map-ascii-grid" id="asciiMapContainer-holo"></div>
    </div>
    <div class="holo-emitter-disc"></div>
  </section>

  <!-- Right Floating Threat Card -->
  <aside class="holo-floating-card" style="display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 12px; font-weight: 700; color: #818cf8;">SPECTRAL PROXIMITY</div>
    <div style="font-size: 11px; font-family: monospace; color: #f0f9ff; line-height: 1.5;">
      • STALKER: 3.2m [LOCKED]<br>
      • SWARMER: 2.1m [APPROACHING]<br>
      • FRAGMENTER: 6.4m [HEAVY]
    </div>
  </aside>

  <!-- Bottom Holographic Gesture Rings Dock -->
  <footer class="holo-gesture-dock">
    <button class="holo-gesture-btn" onclick="simCastAbility('phase_shift')">
      ⚡ GESTURE 01: PHASE SHIFT
    </button>
    <button class="holo-gesture-btn" onclick="simCastAbility('neural_spike')">
      💥 GESTURE 02: NEURAL SPIKE
    </button>
    <button class="holo-gesture-btn" onclick="simWaitTurn()">
      ⏳ GESTURE 03: VENT HEAT
    </button>
    <button class="holo-gesture-btn" style="border-color: #f43f5e; color: #f43f5e;" onclick="simTakeDamage()">
      💔 COHERENCE LOSS HIT (-4)
    </button>
  </footer>
</div>


<!-- ========================================================================
     BESPOKE HUD 35: DEFCON ORBITAL DRONE RECON (Military Spy Satellite)
     ======================================================================== -->
<div class="bespoke-hud-view" id="hud-drone">
  <!-- Top Satellite Ephemeris Header -->
  <div class="drone-ephemeris-header">
    <div style="font-size: 11px; color: #22c55e;">
      SAT: <strong style="color: #fff;">KH-13 KEYHOLE</strong> // ORBIT: 418km // INC: 51.6° // LAT: 35.6762°N LON: 139.6503°E // CLASSIFIED NOFORN
    </div>
    <div class="drone-defcon-badge">
      [ DEFCON 2 // ARMED ]
    </div>
  </div>

  <!-- Left Column: SIGINT Waterfall Analyzer -->
  <aside style="background: #10141a; border: 1px solid #22c55e; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <div style="font-size: 12px; font-weight: 800; color: #22c55e;">SIGINT INTERCEPT</div>
      <div style="font-size: 11px; color: #fff; margin-top: 6px; font-family: monospace;">
        HULL: <span id="drone-hp" style="color: #ef4444;">18 / 20</span><br>
        HEAT: <span id="drone-heat" style="color: #eab308;">38 CAL</span><br>
        FLUX: <span id="drone-scrap" style="color: #22c55e;">1,420 CR</span>
      </div>
    </div>
    <div style="font-size: 10px; color: #6b7c72; font-family: monospace;">
      SATCOM UPLINK: 99.8%<br>
      CIPHER: TYPE-1 CRYPTO<br>
      REALITY: <span id="drone-stability" style="color: #22c55e;">88.4%</span>
    </div>
  </aside>

  <!-- Center Military Gunship Optics Viewport -->
  <section class="drone-gunship-viewport">
    <div class="drone-crosshair-lines"></div>
    <div style="position: absolute; top: 10px; left: 14px; font-size: 10px; color: #22c55e; font-family: monospace;">
      OPTIC: 8x FLIR // LASER RNG: 14.8m
    </div>
    <div class="map-ascii-grid" id="asciiMapContainer-drone"></div>
  </section>

  <!-- Right Column: Strike Munitions Rack -->
  <aside style="background: #10141a; border: 1px solid #22c55e; padding: 1rem; display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 12px; font-weight: 800; color: #22c55e;">PAYLOAD RACK</div>
    <div style="font-size: 11px; font-family: monospace; color: #f0fdf4; line-height: 1.5;">
      • AGM-114 HELLFIRE: ARMED<br>
      • KINETIC ROD: READY<br>
      • THERMAL SMOKE: 2 AVAIL
    </div>
  </aside>

  <!-- Bottom Weapon Release Safeties Dock -->
  <footer class="drone-strike-dock">
    <button class="drone-fire-btn" onclick="simCastAbility('phase_shift')">
      ⚡ MISSILE 01: PHASE SHIFT
    </button>
    <button class="drone-fire-btn" onclick="simCastAbility('neural_spike')">
      💥 ORBITAL 02: NEURAL SPIKE
    </button>
    <button class="drone-fire-btn" onclick="simWaitTurn()">
      ⏳ EXHAUST VENT HEAT
    </button>
    <button class="drone-fire-btn" style="border-color: #ef4444; color: #ef4444;" onclick="simTakeDamage()">
      💔 ARMOR BREACH HIT (-4)
    </button>
  </footer>
</div>
`;
