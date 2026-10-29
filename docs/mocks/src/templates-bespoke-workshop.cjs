// Bespoke Workshop Templates for Styles 26 - 35

module.exports = `
<!-- ========================================================================
     BESPOKE WORKSHOP 26: TAIKOKU INDUSTRIAL MANIFEST
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-taikoku">
  <!-- Bill of Lading Document -->
  <aside class="taikoku-bill-of-lading">
    <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px;">
      <strong>対空重工業 // ASSEMBLY BILL OF LADING</strong>
      <span>REV.04</span>
    </div>
    <div style="font-size: 11px; line-height: 1.6;">
      CHASSIS BATCH: <strong>VANGUARD-v1</strong><br>
      DESTINATION: <strong>DEEP SECTOR EXTRACTION</strong><br>
      AUTHORIZED INSPECTOR: <strong>#TK-8842</strong>
    </div>
    <!-- Interactive Chassis Buttons -->
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; margin-bottom: 6px;">SELECT SHELL MANIFEST:</div>
      <button class="sim-btn" style="width: 100%; margin-bottom: 4px; background: #000; color: #d8ff00;" onclick="selectShell('vanguard')">VANGUARD-v1 (Skirmisher)</button>
      <button class="sim-btn" style="width: 100%; margin-bottom: 4px; background: #000; color: #fff;" onclick="selectShell('bastion')">BASTION-v1 (Heavy Enforcer)</button>
      <button class="sim-btn" style="width: 100%; background: #000; color: #fff;" onclick="selectShell('ghost')">GHOST-v1 (Infiltrator)</button>
    </div>
    <div class="taikoku-stamp-large">
      [ 検査済 INSPECTION PASSED 2049.11.04 ]
    </div>
  </aside>

  <!-- Assembly Floor Table -->
  <section style="background: #11141a; border: 2px solid #28303f; padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 800; color: #d8ff00; border-bottom: 2px solid #28303f; padding-bottom: 8px;">
      ASSEMBLY BLUEPRINTS & HARDWARE CALIBRATION
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: #171b24; border: 1px solid #3d4a61; padding: 12px;">
        <div style="font-weight: 700; color: #fff; font-size: 12px;">Phase_Shift.sh</div>
        <div style="font-size: 11px; color: #8c96a8; margin: 4px 0;">Cost: 50 CR // v1 Firmware</div>
        <button class="sim-btn primary" style="width: 100%; font-size: 11px;" onclick="compileBlueprint('bp_phase')">FABRICATE (50 CR)</button>
      </div>
      <div style="background: #171b24; border: 1px solid #3d4a61; padding: 12px;">
        <div style="font-weight: 700; color: #fff; font-size: 12px;">Overclock_Resonance.arc</div>
        <div style="font-size: 11px; color: #8c96a8; margin: 4px 0;">Cost: 75 CR // v2 Augment</div>
        <button class="sim-btn primary" style="width: 100%; font-size: 11px;" onclick="compileBlueprint('bp_overclock')">FABRICATE (75 CR)</button>
      </div>
    </div>
    <!-- Stat Upgrade Levers -->
    <div style="margin-top: auto; border-top: 1px solid #28303f; padding-top: 12px; display: flex; gap: 12px;">
      <button class="sim-btn" style="flex: 1;" onclick="upgradeStat('maxHp')">+ HULL HP (+2) [100 CR]</button>
      <button class="sim-btn" style="flex: 1;" onclick="upgradeStat('speed')">+ SERVO SPEED (+10) [80 CR]</button>
      <button class="sim-btn" style="flex: 1;" onclick="upgradeStat('armor')">+ ARMOR PLATE (+1) [120 CR]</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 27: GHOST-DIVE CYBER-BRAIN (Ghost in the Shell)
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-ghostdive">
  <!-- Prosthetic Surgery Suite -->
  <aside style="background: rgba(10, 17, 34, 0.8); border: 1px solid #00f0ff; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 14px; font-weight: 800; color: #00f0ff; border-bottom: 1px solid #1e3a6a; padding-bottom: 6px;">
      NEURO-PROSTHETIC SUITE
    </div>
    <div style="font-size: 11px; color: #e0f2fe; line-height: 1.6;">
      CHASSIS CORE: <strong style="color: #00f0ff;">GHOST-COMPATIBLE</strong><br>
      SYNAPSE BANDWIDTH: <strong style="color: #a855f7;">4.8 TB/s</strong><br>
      WETWARE BUFFER: <strong style="color: #00f0ff;">CLEARED</strong>
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; color: #00f0ff; margin-bottom: 6px;">HOT-SWAP CYBER-BODY:</div>
      <button class="ghost-neuro-btn" style="width: 100%; height: 38px; margin-bottom: 6px;" onclick="selectShell('vanguard')">VANGUARD CYBORG</button>
      <button class="ghost-neuro-btn" style="width: 100%; height: 38px; margin-bottom: 6px;" onclick="selectShell('bastion')">BASTION ARMORED</button>
      <button class="ghost-neuro-btn" style="width: 100%; height: 38px;" onclick="selectShell('ghost')">GHOST INFILTRATOR</button>
    </div>
  </aside>

  <!-- Wetware Socket Assembly -->
  <section style="background: rgba(10, 17, 34, 0.5); border: 1px solid #1e3a6a; padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 800; color: #a855f7; border-bottom: 1px solid #1e3a6a; padding-bottom: 8px;">
      WETWARE NEURO-IMPLANTS & SOCKETS
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: rgba(0,0,0,0.4); border: 1px solid #00f0ff; padding: 12px; border-radius: 4px;">
        <div style="font-weight: 700; color: #00f0ff; font-size: 12px;">Bleed.exe (v2)</div>
        <div style="font-size: 11px; color: #64748b; margin: 4px 0;">Damage DOT Implant // 120 CR</div>
        <button class="ghost-neuro-btn" style="width: 100%; height: 32px; font-size: 11px;" onclick="buySoftware('sw_bleed')">SLOT IMPLANT (120 CR)</button>
      </div>
      <div style="background: rgba(0,0,0,0.4); border: 1px solid #a855f7; padding: 12px; border-radius: 4px;">
        <div style="font-weight: 700; color: #a855f7; font-size: 12px;">Vampire.exe (v1)</div>
        <div style="font-size: 11px; color: #64748b; margin: 4px 0;">Kinetic Life-Leech // 150 CR</div>
        <button class="ghost-neuro-btn" style="width: 100%; height: 32px; font-size: 11px; border-color: #a855f7; color: #a855f7;" onclick="buySoftware('sw_vamp')">SLOT IMPLANT (150 CR)</button>
      </div>
    </div>
    <!-- Cybernetic Stat Refinement -->
    <div style="margin-top: auto; border-top: 1px solid #1e3a6a; padding-top: 12px; display: flex; gap: 12px;">
      <button class="ghost-neuro-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ SYNTH HULL (+2)</button>
      <button class="ghost-neuro-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ MOTOR REFLEX (+10)</button>
      <button class="ghost-neuro-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ CHITIN ARMOR (+1)</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 28: SEINEN MANGA COMIC PANELS (Akira / BLAME!)
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-manga">
  <!-- Storyboard Desk -->
  <aside class="manga-panel" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 16px; font-weight: 900; color: #050505; border-bottom: 3px solid #050505; padding-bottom: 6px;">
      漫画工房 // MANGA DRAFTING
    </div>
    <div style="font-size: 12px; font-weight: 700; line-height: 1.8;">
      原稿規格: B4判 原稿用紙<br>
      使用画材: Gペン・丸ペン・墨汁<br>
      進行状況: 第7話 ネーム完成
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; margin-bottom: 6px;">主人公機体を選択:</div>
      <button class="manga-action-btn" style="width: 100%; height: 38px; margin-bottom: 6px;" onclick="selectShell('vanguard')">ヴァンガード (近接型)</button>
      <button class="manga-action-btn" style="width: 100%; height: 38px; margin-bottom: 6px;" onclick="selectShell('bastion')">バスティオン (重装甲)</button>
      <button class="manga-action-btn" style="width: 100%; height: 38px;" onclick="selectShell('ghost')">ゴースト (潜入型)</button>
    </div>
  </aside>

  <!-- Manuscript Blueprints -->
  <section class="manga-panel" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 15px; font-weight: 900; color: #e60012; border-bottom: 3px solid #050505; padding-bottom: 8px;">
      必殺技の作画・習得 // ABILITY BLUEPRINTS
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="border: 3px solid #050505; padding: 12px; box-shadow: 4px 4px 0 #050505; background: #fff;">
        <div style="font-weight: 900; color: #050505; font-size: 13px;">Phase_Shift.sh (瞬歩)</div>
        <div style="font-size: 11px; font-weight: 700; color: #4a4a4a; margin: 4px 0;">消費: 50 CR // 距離3マス瞬間移動</div>
        <button class="manga-action-btn" style="width: 100%; height: 34px; font-size: 11px;" onclick="compileBlueprint('bp_phase')">習得する (50 CR)</button>
      </div>
      <div style="border: 3px solid #050505; padding: 12px; box-shadow: 4px 4px 0 #050505; background: #fff;">
        <div style="font-weight: 900; color: #e60012; font-size: 13px;">Overclock_Resonance.arc</div>
        <div style="font-size: 11px; font-weight: 700; color: #4a4a4a; margin: 4px 0;">消費: 75 CR // 衝撃波発生</div>
        <button class="manga-action-btn" style="width: 100%; height: 34px; font-size: 11px; border-color: #e60012; color: #e60012;" onclick="compileBlueprint('bp_overclock')">習得する (75 CR)</button>
      </div>
    </div>
    <!-- Stat Enhancements -->
    <div style="margin-top: auto; border-top: 3px solid #050505; padding-top: 12px; display: flex; gap: 12px;">
      <button class="manga-action-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ 耐久力強化 (+2)</button>
      <button class="manga-action-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ 瞬発力強化 (+10)</button>
      <button class="manga-action-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ 装甲板追加 (+1)</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 29: ZAIBATSU BIOTECH CLINICAL MONITOR
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-biotech">
  <aside style="background: #0d1422; border: 1px solid #22324f; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 14px; font-weight: 800; color: #00f0ff; border-bottom: 1px solid #22324f; padding-bottom: 6px;">
      AUTOCLAVE & BIO-ASSAY
    </div>
    <div style="font-size: 11px; color: #73849e; line-height: 1.6;">
      STERILIZATION: <strong style="color: #00f0ff;">100% COMPLETE</strong><br>
      REAGENT PURITY: <strong style="color: #2563eb;">99.8%</strong><br>
      CHAMBER PRESSURE: <strong style="color: #f8fafc;">1.2 ATM</strong>
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; color: #00f0ff; margin-bottom: 6px;">SPECIMEN SHELL:</div>
      <button class="biotech-injector-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('vanguard')">HOMO-VANGUARD</button>
      <button class="biotech-injector-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('bastion')">HOMO-BASTION</button>
      <button class="biotech-injector-btn" style="width: 100%; height: 36px;" onclick="selectShell('ghost')">HOMO-GHOST</button>
    </div>
  </aside>

  <section style="background: #080c14; border: 1px solid #22324f; padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 800; color: #2563eb; border-bottom: 1px solid #22324f; padding-bottom: 8px;">
      PHARMACOLOGICAL SYNTHESIS
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: #0d1422; border: 1px solid #2563eb; padding: 12px; border-radius: 4px;">
        <div style="font-weight: 700; color: #00f0ff; font-size: 12px;">Bleed.exe (v2)</div>
        <div style="font-size: 11px; color: #73849e; margin: 4px 0;">Coagulant Inhibitor // 120 CR</div>
        <button class="biotech-injector-btn" style="width: 100%; height: 32px;" onclick="buySoftware('sw_bleed')">SYNTHESIZE (120 CR)</button>
      </div>
      <div style="background: #0d1422; border: 1px solid #2563eb; padding: 12px; border-radius: 4px;">
        <div style="font-weight: 700; color: #00f0ff; font-size: 12px;">Vampire.exe (v1)</div>
        <div style="font-size: 11px; color: #73849e; margin: 4px 0;">Cellular Repair Serum // 150 CR</div>
        <button class="biotech-injector-btn" style="width: 100%; height: 32px;" onclick="buySoftware('sw_vamp')">SYNTHESIZE (150 CR)</button>
      </div>
    </div>
    <div style="margin-top: auto; border-top: 1px solid #22324f; padding-top: 12px; display: flex; gap: 12px;">
      <button class="biotech-injector-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ SYNTH-BLOOD (+2)</button>
      <button class="biotech-injector-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ ADRENAL GLAND (+10)</button>
      <button class="biotech-injector-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ BONE DENSITY (+1)</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 30: CHIBA BACK-ALLEY RIPPERDOC
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-ripperdoc">
  <aside class="ripperdoc-plate" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 15px; font-weight: 900; color: #ff007f;">
      RIPPERDOC OPERATING CHAIR
    </div>
    <div style="font-size: 11px; color: #fff; font-family: monospace; line-height: 1.6;">
      ANESTHETIC: NONE AVAILABLE<br>
      STERILIZATION: BLOWTORCH<br>
      BLACK-MARKET STATUS: ACTIVE
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 700; color: #39ff14; margin-bottom: 6px;">SELECT STOLEN SHELL:</div>
      <button class="ripperdoc-knife-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('vanguard')">STOLEN VANGUARD</button>
      <button class="ripperdoc-knife-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('bastion')">MILITARY BASTION</button>
      <button class="ripperdoc-knife-btn" style="width: 100%; height: 36px;" onclick="selectShell('ghost')">CORPO GHOST</button>
    </div>
  </aside>

  <section class="ripperdoc-plate" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 700; color: #39ff14; border-bottom: 2px solid #4a3636; padding-bottom: 8px;">
      CONTRABAND FIRMWARE BURNING
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: #141010; border: 1px solid #ff007f; padding: 12px;">
        <div style="font-weight: 700; color: #ff007f; font-size: 13px;">Phase_Shift.sh</div>
        <div style="font-size: 11px; color: #9c8282; margin: 4px 0;">Cracked Corp Firmware // 50¥</div>
        <button class="ripperdoc-knife-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_phase')">BURN TO CHIP (50¥)</button>
      </div>
      <div style="background: #141010; border: 1px solid #39ff14; padding: 12px;">
        <div style="font-weight: 700; color: #39ff14; font-size: 13px;">Overclock_Resonance.arc</div>
        <div style="font-size: 11px; color: #9c8282; margin: 4px 0;">Hazard Overclock // 75¥</div>
        <button class="ripperdoc-knife-btn" style="width: 100%; height: 32px; border-color: #39ff14; color: #39ff14;" onclick="compileBlueprint('bp_overclock')">BURN TO CHIP (75¥)</button>
      </div>
    </div>
    <div style="margin-top: auto; border-top: 2px solid #4a3636; padding-top: 12px; display: flex; gap: 12px;">
      <button class="ripperdoc-knife-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ WELDED PLATES (+2)</button>
      <button class="ripperdoc-knife-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ OVERVOLT MOTOR (+10)</button>
      <button class="ripperdoc-knife-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ REBAR ARMOR (+1)</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 31: NEO-TOKYO METRO TRANSIT
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-tokyo-metro">
  <aside style="background: #181c22; border: 2px solid #323a48; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 14px; font-weight: 800; color: #00b259; border-bottom: 2px solid #323a48; padding-bottom: 6px;">
      TOKYO METRO RAIL DEPOT
    </div>
    <div style="font-size: 11px; color: #8b97a8; line-height: 1.6;">
      SWITCHING YARD: <strong>TRACK 4 ACTIVE</strong><br>
      OVERHEAD CATENARY: <strong>1,500V DC OK</strong><br>
      TICKET FARE BALANCE: <strong style="color: #f39700;">¥ 1,420</strong>
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; color: #fff; margin-bottom: 6px;">SELECT TRAIN CAR CHASSIS:</div>
      <button class="metro-release-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('vanguard')">SERIES 10000 VANGUARD</button>
      <button class="metro-release-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('bastion')">SERIES 8000 BASTION</button>
      <button class="metro-release-btn" style="width: 100%; height: 36px;" onclick="selectShell('ghost')">SERIES 01 GHOST</button>
    </div>
  </aside>

  <section style="background: #101216; border: 2px solid #323a48; padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 800; color: #f39700; border-bottom: 2px solid #323a48; padding-bottom: 8px;">
      IC TICKET VENDING & UPGRADES
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: #181c22; border: 1px solid #323a48; padding: 12px;">
        <div style="font-weight: 800; color: #00b259; font-size: 12px;">Phase_Shift.sh</div>
        <div style="font-size: 11px; color: #8b97a8; margin: 4px 0;">Commuter Pass // ¥ 50</div>
        <button class="metro-release-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_phase')">PURCHASE (¥ 50)</button>
      </div>
      <div style="background: #181c22; border: 1px solid #323a48; padding: 12px;">
        <div style="font-weight: 800; color: #f39700; font-size: 12px;">Overclock_Resonance.arc</div>
        <div style="font-size: 11px; color: #8b97a8; margin: 4px 0;">Express Ticket // ¥ 75</div>
        <button class="metro-release-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_overclock')">PURCHASE (¥ 75)</button>
      </div>
    </div>
    <div style="margin-top: auto; border-top: 2px solid #323a48; padding-top: 12px; display: flex; gap: 12px;">
      <button class="metro-release-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ CARRIAGE HULL (+2)</button>
      <button class="metro-release-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ TRAIN SPEED (+10)</button>
      <button class="metro-release-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ RAIL BOGIE ARMOR (+1)</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 32: NERV HEX-CANOPY HUD
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-nerv">
  <aside style="background: #121217; border: 1px solid #ff7700; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 14px; font-weight: 800; color: #ff7700; border-bottom: 1px solid #ff7700; padding-bottom: 6px;">
      NERV CAGE EVA REPAIR GANTRY
    </div>
    <div style="font-size: 11px; color: #8c8c9e; line-height: 1.6;">
      UMBILICAL DOCK: <strong>CAGE 07 CONNECTED</strong><br>
      RESTRAINT HYDRAULICS: <strong>LOCKED</strong><br>
      MAGI CONSENSUS: <strong>AGREED (2/3)</strong>
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; color: #ff7700; margin-bottom: 6px;">SELECT EVA TESTBED:</div>
      <button class="nerv-clamp-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('vanguard')">EVA UNIT-01 (Vanguard)</button>
      <button class="nerv-clamp-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('bastion')">EVA UNIT-02 (Bastion)</button>
      <button class="nerv-clamp-btn" style="width: 100%; height: 36px;" onclick="selectShell('ghost')">EVA UNIT-00 (Ghost)</button>
    </div>
  </aside>

  <section style="background: #08080a; border: 1px solid #ff7700; padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 800; color: #00ff66; border-bottom: 1px solid #ff7700; padding-bottom: 8px;">
      TACTICAL WEAPONRY & HARMONICS
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: #121217; border: 1px solid #00ff66; padding: 12px;">
        <div style="font-weight: 800; color: #00ff66; font-size: 12px;">Phase_Shift.sh</div>
        <div style="font-size: 11px; color: #8c8c9e; margin: 4px 0;">AT-Field Phase Distortion // 50 CR</div>
        <button class="nerv-clamp-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_phase')">SYNCHRONIZE (50 CR)</button>
      </div>
      <div style="background: #121217; border: 1px solid #ff7700; padding: 12px;">
        <div style="font-weight: 800; color: #ff7700; font-size: 12px;">Overclock_Resonance.arc</div>
        <div style="font-size: 11px; color: #8c8c9e; margin: 4px 0;">Berserk Mode Resonance // 75 CR</div>
        <button class="nerv-clamp-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_overclock')">SYNCHRONIZE (75 CR)</button>
      </div>
    </div>
    <div style="margin-top: auto; border-top: 1px solid #ff7700; padding-top: 12px; display: flex; gap: 12px;">
      <button class="nerv-clamp-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ EVA PLATING (+2)</button>
      <button class="nerv-clamp-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ SYNC REFLEX (+10)</button>
      <button class="nerv-clamp-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ AT-BARRIER (+1)</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 33: MEGACORP HIGH-FREQUENCY TRADING
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-trading">
  <aside style="background: #0a140f; border: 1px solid #1e4231; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 14px; font-weight: 800; color: #ffb000; border-bottom: 1px solid #1e4231; padding-bottom: 6px;">
      WALL STREET M&A BOARDROOM
    </div>
    <div style="font-size: 11px; color: #6b8f7e; line-height: 1.6;">
      CORPORATE SYMBOL: <strong>NRM-RUN</strong><br>
      DIVIDEND YIELD: <strong>8.4% APY</strong><br>
      PROXY VOTING POWER: <strong style="color: #ffb000;">1,420 SHARES</strong>
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; color: #ffb000; margin-bottom: 6px;">SELECT ASSET CLASS:</div>
      <button class="trading-exec-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('vanguard')">EQUITY VANGUARD</button>
      <button class="trading-exec-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('bastion')">BOND BASTION</button>
      <button class="trading-exec-btn" style="width: 100%; height: 36px;" onclick="selectShell('ghost')">DERIVATIVE GHOST</button>
    </div>
  </aside>

  <section style="background: #07120c; border: 1px solid #1e4231; padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 800; color: #00ff66; border-bottom: 1px solid #1e4231; padding-bottom: 8px;">
      ALGORITHMIC HIGH-FREQUENCY STRATEGIES
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: #0a140f; border: 1px solid #ffb000; padding: 12px;">
        <div style="font-weight: 700; color: #ffb000; font-size: 12px;">Phase_Shift.sh</div>
        <div style="font-size: 11px; color: #6b8f7e; margin: 4px 0;">Flash Arbitrage // 50 CR</div>
        <button class="trading-exec-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_phase')">EXECUTE BUY (50 CR)</button>
      </div>
      <div style="background: #0a140f; border: 1px solid #00ff66; padding: 12px;">
        <div style="font-weight: 700; color: #00ff66; font-size: 12px;">Overclock_Resonance.arc</div>
        <div style="font-size: 11px; color: #6b8f7e; margin: 4px 0;">Leveraged Volatility // 75 CR</div>
        <button class="trading-exec-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_overclock')">EXECUTE BUY (75 CR)</button>
      </div>
    </div>
    <div style="margin-top: auto; border-top: 1px solid #1e4231; padding-top: 12px; display: flex; gap: 12px;">
      <button class="trading-exec-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ CAPITAL RESERVES (+2)</button>
      <button class="trading-exec-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ LATENCY REDUCTION (+10)</button>
      <button class="trading-exec-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ COLLATERAL BUFFER (+1)</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 34: 3D VOLUMETRIC HOLO-PODIUM
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-holo">
  <aside class="holo-floating-card" style="display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 14px; font-weight: 800; color: #38bdf8; border-bottom: 1px solid rgba(56,189,248,0.4); padding-bottom: 6px;">
      HOLO-CAD 3D WORKBENCH
    </div>
    <div style="font-size: 11px; color: #f0f9ff; line-height: 1.6;">
      EXPLODED VIEW: <strong>ENABLED</strong><br>
      ROTATION AXIS: <strong>Y-360°</strong><br>
      LIGHT CONVERGENCE: <strong style="color: #38bdf8;">NOMINAL</strong>
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; color: #38bdf8; margin-bottom: 6px;">LOAD 3D CHASSIS:</div>
      <button class="holo-gesture-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('vanguard')">CAD: VANGUARD-v1</button>
      <button class="holo-gesture-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('bastion')">CAD: BASTION-v1</button>
      <button class="holo-gesture-btn" style="width: 100%; height: 36px;" onclick="selectShell('ghost')">CAD: GHOST-v1</button>
    </div>
  </aside>

  <section class="holo-floating-card" style="display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 800; color: #818cf8; border-bottom: 1px solid rgba(56,189,248,0.4); padding-bottom: 8px;">
      PHOTON SCHEMATICS & FIELD MODULATION
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: rgba(0,0,0,0.5); border: 1px solid #38bdf8; padding: 12px; border-radius: 4px;">
        <div style="font-weight: 700; color: #38bdf8; font-size: 12px;">Phase_Shift.sh</div>
        <div style="font-size: 11px; color: #64748b; margin: 4px 0;">Photon Displacement // 50 CR</div>
        <button class="holo-gesture-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_phase')">EMIT SCHEMATIC (50 CR)</button>
      </div>
      <div style="background: rgba(0,0,0,0.5); border: 1px solid #818cf8; padding: 12px; border-radius: 4px;">
        <div style="font-weight: 700; color: #818cf8; font-size: 12px;">Overclock_Resonance.arc</div>
        <div style="font-size: 11px; color: #64748b; margin: 4px 0;">Laser Resonance // 75 CR</div>
        <button class="holo-gesture-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_overclock')">EMIT SCHEMATIC (75 CR)</button>
      </div>
    </div>
    <div style="margin-top: auto; border-top: 1px solid rgba(56,189,248,0.4); padding-top: 12px; display: flex; gap: 12px;">
      <button class="holo-gesture-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ HULL FIELD (+2)</button>
      <button class="holo-gesture-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ EMITTER CLOCK (+10)</button>
      <button class="holo-gesture-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ REFRACTIVE SHIELD (+1)</button>
    </div>
  </section>
</div>


<!-- ========================================================================
     BESPOKE WORKSHOP 35: DEFCON ORBITAL DRONE RECON
     ======================================================================== -->
<div class="bespoke-workshop-view" id="workshop-drone">
  <aside style="background: #10141a; border: 1px solid #22c55e; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 14px; font-weight: 800; color: #22c55e; border-bottom: 1px solid #22c55e; padding-bottom: 6px;">
      SPACE FORCE SKUNKWORKS HANGAR
    </div>
    <div style="font-size: 11px; color: #6b7c72; line-height: 1.6;">
      LAUNCH PYLON: <strong>READY</strong><br>
      SOLAR ARRAY DEPLOYMENT: <strong>100%</strong><br>
      KINETIC ROD PAYLOAD: <strong style="color: #22c55e;">ARMED</strong>
    </div>
    <div style="margin-top: 10px;">
      <div style="font-size: 11px; font-weight: 800; color: #22c55e; margin-bottom: 6px;">SELECT DRONE DRIVER:</div>
      <button class="drone-fire-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('vanguard')">RECON DRONE (Vanguard)</button>
      <button class="drone-fire-btn" style="width: 100%; height: 36px; margin-bottom: 6px;" onclick="selectShell('bastion')">GUNSHIP DRONE (Bastion)</button>
      <button class="drone-fire-btn" style="width: 100%; height: 36px;" onclick="selectShell('ghost')">STEALTH SATELLITE (Ghost)</button>
    </div>
  </aside>

  <section style="background: #090b0e; border: 1px solid #22c55e; padding: 1.5rem; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 14px; font-weight: 800; color: #06b6d4; border-bottom: 1px solid #22c55e; padding-bottom: 8px;">
      TACTICAL MUNITIONS ORDNANCE
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div style="background: #10141a; border: 1px solid #22c55e; padding: 12px;">
        <div style="font-weight: 800; color: #22c55e; font-size: 12px;">Phase_Shift.sh</div>
        <div style="font-size: 11px; color: #6b7c72; margin: 4px 0;">Orbital Micro-Thruster // 50 CR</div>
        <button class="drone-fire-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_phase')">ARM PAYLOAD (50 CR)</button>
      </div>
      <div style="background: #10141a; border: 1px solid #06b6d4; padding: 12px;">
        <div style="font-weight: 800; color: #06b6d4; font-size: 12px;">Overclock_Resonance.arc</div>
        <div style="font-size: 11px; color: #6b7c72; margin: 4px 0;">Kinetic Shockwave // 75 CR</div>
        <button class="drone-fire-btn" style="width: 100%; height: 32px;" onclick="compileBlueprint('bp_overclock')">ARM PAYLOAD (75 CR)</button>
      </div>
    </div>
    <div style="margin-top: auto; border-top: 1px solid #22c55e; padding-top: 12px; display: flex; gap: 12px;">
      <button class="drone-fire-btn" style="height: 42px;" onclick="upgradeStat('maxHp')">+ COMPOSITE HULL (+2)</button>
      <button class="drone-fire-btn" style="height: 42px;" onclick="upgradeStat('speed')">+ REACTION WHEELS (+10)</button>
      <button class="drone-fire-btn" style="height: 42px;" onclick="upgradeStat('armor')">+ KEVLAR SHIELD (+1)</button>
    </div>
  </section>
</div>
`;
