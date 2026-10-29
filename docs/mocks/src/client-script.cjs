// Full Client-side Interactive Engine for all 35 Styles

const themes = require('./themes-data.cjs');

module.exports = `
<script>
  var THEMES = ${JSON.stringify(themes, null, 2)};

  // Start with Theme 26 (Taikoku Industrial Manifest)
  var currentThemeIndex = 25;
  var currentFilter = 'cyborg'; // 'cyborg', 'all', 'experimental', 'foundations'

  var state = {
    theme: 'taikoku',
    view: 'hud',
    player: {
      shellId: 'vanguard',
      shellName: 'VANGUARD-v1',
      hp: 18,
      maxHp: 20,
      armor: 2,
      speed: 120,
      stability: 5,
      heat: 35,
      maxHeat: 100,
      heatTier: 1,
      realityStability: 88.4,
      scrap: 1420,
      flux: 380,
      turn: 142,
      floor: 7,
      seed: '#W-4028',
      x: 14,
      y: 8
    },
    entities: [
      { id: 'e1', name: 'Null-Pointer (Stalker)', glyph: 'm', hp: 4, maxHp: 6, dist: '3m', color: '#ff3344', behavior: 'Teleport behind' },
      { id: 'e2', name: 'Buffer-Overflow (Swarmer)', glyph: 'b', hp: 3, maxHp: 3, dist: '2m', color: '#ff7700', behavior: 'Detonation pack' },
      { id: 'e3', name: 'Fragmenter (Heavy)', glyph: 'F', hp: 16, maxHp: 20, dist: '6m', color: '#ff0055', behavior: 'Dead-zone slam' }
    ],
    logs: [
      { time: '14:20:12', tag: 'COMBAT', text: 'Null-Pointer staggered for 4 kinetic DMG.', color: '#d8ff00' },
      { time: '14:20:10', tag: 'HEAT', text: 'Heat vented -15 via Displacement_Venting.arc', color: '#00f0ff' },
      { time: '14:20:08', tag: 'KERNEL', text: 'Floor 07 seed reconciled. Stability bleed: -0.01/turn.', color: '#8899a6' },
      { time: '14:20:02', tag: 'RADAR', text: '3 Hostiles detected within neural scan radius.', color: '#ffaa00' }
    ],
    shells: {
      vanguard: { id: 'vanguard', name: 'VANGUARD-v1', archetype: 'Skirmisher', hp: 20, speed: 120, armor: 2, stab: 5, ports: '2 Firm / 1 Aug / 2 Soft' },
      bastion: { id: 'bastion', name: 'BASTION-v1', archetype: 'Heavy Enforcer', hp: 25, speed: 80, armor: 3, stab: 10, ports: '1 Firm / 1 Aug / 1 Soft' },
      ghost: { id: 'ghost', name: 'GHOST-v1', archetype: 'Recon Infiltrator', hp: 15, speed: 100, armor: 1, stab: 8, ports: '2 Firm / 2 Aug / 3 Soft' }
    },
    shellUpgrades: {
      vanguard: { speed: 1, armor: 1, stability: 2, ports: 0 },
      bastion: { speed: 0, armor: 2, stability: 1, ports: 0 },
      ghost: { speed: 2, armor: 0, stability: 1, ports: 1 }
    },
    lockedBlueprints: [
      { id: 'bp_phase', name: 'Phase_Shift.sh', type: 'firmware', rarity: 'v1', cost: 50, desc: 'Phase dodge 3 tiles, ignores collision' },
      { id: 'bp_overclock', name: 'Overclock_Resonance.arc', type: 'augment', rarity: 'v2', cost: 75, desc: 'ON_OVERCLOCK → Pulses 6 AoE shockwave' },
      { id: 'bp_kinetic', name: 'KINETIC_LINK.exe', type: 'firmware', rarity: 'v2', cost: 75, desc: 'Chain damage to 3 adjacent nodes' },
      { id: 'bp_leech', name: 'Static_Siphon.arc', type: 'augment', rarity: 'v1', cost: 50, desc: 'ON_HIT → Leeches +3 Shield/Scrap' }
    ],
    compiledLibrary: [
      { id: 'bp_spike', name: 'Neural_Spike.exe', type: 'firmware', rarity: 'v1', desc: 'Direct neural ranged strike (35 Heat)' },
      { id: 'bp_basic', name: 'BASIC_STRIKE.exe', type: 'firmware', rarity: 'v0', desc: 'Kinetic strike (5 Heat)' },
      { id: 'bp_vent', name: 'Displacement_Venting.arc', type: 'augment', rarity: 'v1', desc: 'Vents 15 Heat on movement' }
    ],
    shopItems: [
      { id: 'sw_bleed', name: 'Bleed.exe (v2)', type: 'software', price: 120, desc: '+3 DOT bleed damage for 3 turns' },
      { id: 'sw_loader', name: 'Auto-Loader.msi (v1)', type: 'software', price: 90, desc: 'Reduces firmware recovery cycle by 1 turn' },
      { id: 'sw_vamp', name: 'Vampire.exe (v1)', type: 'software', price: 150, desc: 'Converts 20% of kinetic damage into HP repair' },
      { id: 'sw_armor', name: 'Nano-Weave.dll (v2)', type: 'software', price: 110, desc: '+1 Passive Armor plate' }
    ]
  };

  // Filter Categories
  function setFilter(filterName) {
    currentFilter = filterName;
    document.querySelectorAll('.filter-tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-filter') === filterName);
    });
    renderStylePicker();
  }

  function renderStylePicker() {
    var container = document.getElementById('stylePickerContainer');
    if (!container) return;
    container.innerHTML = '';

    var filtered = THEMES.filter(function(t) {
      if (currentFilter === 'all') return true;
      return t.series === currentFilter;
    });

    filtered.forEach(function(theme) {
      var realIndex = THEMES.findIndex(function(t) { return t.id === theme.id; });
      var btn = document.createElement('button');
      btn.className = 'style-pill' + (realIndex === currentThemeIndex ? ' active' : '');
      if (theme.num >= 26) btn.classList.add('cyborg-marquee');
      
      var prefix = theme.num >= 26 ? '★ ' : '';
      btn.innerHTML = '<span class=\"pill-num\">' + prefix + theme.num + '.</span> ' + theme.name;
      btn.onclick = function() { selectThemeByIndex(realIndex); };
      container.appendChild(btn);
    });
  }

  // Core View & Theme Visibility Controller
  function updateViewVisibility() {
    var isBespoke = currentThemeIndex >= 25;
    var theme = THEMES[currentThemeIndex];
    
    var hudCont = document.getElementById('hudContainer');
    var wsCont = document.getElementById('workshopContainer');
    var hudShell = document.getElementById('hudShellRoot');
    var wsShell = document.getElementById('workshopShellRoot');

    // 1. Toggle Outer Containers based on View Mode
    if (state.view === 'hud') {
      if (hudCont) hudCont.style.display = 'block';
      if (wsCont) wsCont.style.display = 'none';
      document.body.classList.remove('split-view-active');
    } else if (state.view === 'workshop') {
      if (hudCont) hudCont.style.display = 'none';
      if (wsCont) wsCont.style.display = 'block';
      document.body.classList.remove('split-view-active');
    } else if (state.view === 'split') {
      if (hudCont) hudCont.style.display = 'block';
      if (wsCont) wsCont.style.display = 'block';
      document.body.classList.add('split-view-active');
    }

    // 2. Hide all Bespoke Layouts
    document.querySelectorAll('.bespoke-hud-view').forEach(function(el) { el.style.display = 'none'; });
    document.querySelectorAll('.bespoke-workshop-view').forEach(function(el) { el.style.display = 'none'; });

    // 3. Show Appropriate Active Layout
    if (isBespoke) {
      // Hide original shared containers
      if (hudShell) hudShell.style.display = 'none';
      if (wsShell) wsShell.style.display = 'none';

      // Show active bespoke HUD and Workshop
      var activeHud = document.getElementById('hud-' + theme.id);
      var activeWs = document.getElementById('workshop-' + theme.id);

      if (activeHud && (state.view === 'hud' || state.view === 'split')) {
        activeHud.style.display = 'grid';
      }
      if (activeWs && (state.view === 'workshop' || state.view === 'split')) {
        activeWs.style.display = 'grid';
      }
    } else {
      // Original Theme (1 - 25)
      if (hudShell && (state.view === 'hud' || state.view === 'split')) {
        hudShell.style.display = 'grid';
      }
      if (wsShell && (state.view === 'workshop' || state.view === 'split')) {
        wsShell.style.display = 'grid';
      }
    }
  }

  function selectThemeByIndex(index) {
    if (index < 0 || index >= THEMES.length) return;
    currentThemeIndex = index;
    var theme = THEMES[index];
    state.theme = theme.id;

    // Apply Theme Class
    document.body.className = 'theme-' + theme.id;

    // Update Banner
    var banner = document.getElementById('themeBanner');
    if (banner) {
      var badgeHtml = theme.num >= 26 ? '<span style=\"background: #e60012; color: #fff; padding: 2px 6px; font-size: 10px; font-weight: 800; margin-right: 6px;\">BESPOKE LAYOUT</span>' : '';
      banner.innerHTML = badgeHtml + 'Active: <strong>' + theme.num + '. ' + theme.name + '</strong> — ' + theme.desc + ' <span style=\"color:' + theme.color + ';\">[' + theme.layout + ']</span>';
    }

    updateViewVisibility();
    renderStylePicker();
    renderAsciiMap();
    updateHUD();
    updateWorkshop();
  }

  function cycleTheme(dir) {
    var newIdx = (currentThemeIndex + dir + THEMES.length) % THEMES.length;
    selectThemeByIndex(newIdx);
  }

  function switchView(viewName) {
    state.view = viewName;

    document.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
    if (viewName === 'hud') {
      var btn = document.getElementById('btnViewHud'); if (btn) btn.classList.add('active');
    } else if (viewName === 'workshop') {
      var btn = document.getElementById('btnViewWorkshop'); if (btn) btn.classList.add('active');
    } else if (viewName === 'split') {
      var btn = document.getElementById('btnViewSplit'); if (btn) btn.classList.add('active');
    }

    updateViewVisibility();
    renderAsciiMap();
    updateHUD();
    updateWorkshop();
  }

  // Generate ASCII Map for all active viewports
  function renderAsciiMap() {
    var width = 36;
    var height = 15;
    var grid = [];

    for (var y = 0; y < height; y++) {
      var row = [];
      for (var x = 0; x < width; x++) {
        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
          row.push('#');
        } else if ((x === 18 && y !== 7) || (x === 10 && y > 8) || (x === 26 && y < 6)) {
          row.push('#');
        } else if (x === 18 && y === 7) {
          row.push('+');
        } else {
          row.push('.');
        }
      }
      grid.push(row);
    }

    // Place Runner, Entities, and Anchor
    grid[7][14] = '<span style=\"color: #d8ff00; font-weight: 900;\">@</span>';
    grid[6][17] = '<span style=\"color: #ff3344; font-weight: 800;\">m</span>';
    grid[8][16] = '<span style=\"color: #ff7700; font-weight: 800;\">b</span>';
    grid[5][20] = '<span style=\"color: #ff0055; font-weight: 800;\">F</span>';
    grid[9][28] = '<span style=\"color: #00f0ff; font-weight: 900;\">Ω</span>';
    grid[3][8] = '<span style=\"color: #ffaa00;\">*</span>';
    grid[11][5] = '<span style=\"color: #ffaa00;\">*</span>';

    var renderedText = grid.map(function(r) { return r.join(''); }).join('\\n');

    document.querySelectorAll('.map-ascii-grid').forEach(function(el) {
      el.innerHTML = renderedText;
    });
  }

  // Update Stats across Shared and Bespoke HUDs
  function updateHUD() {
    // 1. Shared HUD elements
    var hudDepth = document.getElementById('hudDepthSeed');
    if (hudDepth) hudDepth.textContent = 'FLOOR 0' + state.player.floor + ' // ' + state.player.seed;

    var hudTurn = document.getElementById('hudChronoTurn');
    if (hudTurn) hudTurn.textContent = 'T-0' + state.player.turn + ' // 04:18';

    var hudScrap = document.getElementById('hudScrap');
    if (hudScrap) hudScrap.textContent = state.player.scrap.toLocaleString() + ' CR';

    var stabVal = state.player.realityStability.toFixed(1);
    var hudStab = document.getElementById('hudStabilityVal');
    if (hudStab) hudStab.textContent = stabVal + '% [STABLE]';

    var hudStabBar = document.getElementById('hudStabilityBar');
    if (hudStabBar) hudStabBar.style.width = stabVal + '%';

    var hudHpText = document.getElementById('hudHpText');
    if (hudHpText) hudHpText.textContent = state.player.hp + ' / ' + state.player.maxHp + ' HP';

    var hpMeter = document.getElementById('hudHpMeter');
    if (hpMeter) {
      hpMeter.innerHTML = '';
      for (var i = 0; i < state.player.maxHp; i++) {
        var pip = document.createElement('div');
        pip.className = 'meter-pip' + (i < state.player.hp ? ' active-hp' : '');
        hpMeter.appendChild(pip);
      }
    }

    var heatMeter = document.getElementById('hudHeatMeter');
    if (heatMeter) {
      heatMeter.innerHTML = '';
      var activeCount = Math.round((state.player.heat / state.player.maxHeat) * 20);
      for (var i = 0; i < 20; i++) {
        var pip = document.createElement('div');
        pip.className = 'meter-pip' + (i < activeCount ? ' active-heat' : '');
        heatMeter.appendChild(pip);
      }
    }

    var hudHeatText = document.getElementById('hudHeatText');
    if (hudHeatText) hudHeatText.textContent = state.player.heat + ' / ' + state.player.maxHeat + ' °C';

    var hudHeatLabel = document.getElementById('hudHeatLabel');
    if (hudHeatLabel) hudHeatLabel.textContent = 'NEURAL HEAT [TIER ' + state.player.heatTier + ']';

    var entitiesList = document.getElementById('hudEntitiesList');
    if (entitiesList) {
      entitiesList.innerHTML = state.entities.map(function(e) {
        return '<div style=\"background: var(--th-surface-alt); border-left: 2px solid ' + e.color + '; padding: 4px 6px; display: flex; align-items: center; justify-content: space-between; font-size: 10px;\">' +
          '<div>' +
            '<span style=\"font-weight: 800; color: ' + e.color + ';\">[' + e.glyph + '] ' + e.name + '</span>' +
            '<div style=\"font-size: 9px; color: var(--th-text-dim);\">' + e.behavior + ' // DIST: ' + e.dist + '</div>' +
          '</div>' +
          '<div style=\"text-align: right; font-weight: 700; color: var(--th-text);\">' +
            e.hp + '/' + e.maxHp +
          '</div>' +
        '</div>';
      }).join('');
    }

    var logContainer = document.getElementById('hudLogContainer');
    if (logContainer) {
      logContainer.innerHTML = state.logs.map(function(l) {
        return '<div style=\"display: flex; gap: 6px; line-height: 1.4;\">' +
          '<span style=\"color: var(--th-text-dim);\">' + l.time + '</span>' +
          '<span style=\"color: ' + l.color + '; font-weight: 700;\">[' + l.tag + ']</span>' +
          '<span style=\"color: var(--th-text);\">' + l.text + '</span>' +
        '</div>';
      }).join('');
    }

    // 2. Bespoke HUD Elements
    var tkHp = document.getElementById('taikoku-hp'); if (tkHp) tkHp.textContent = state.player.hp + ' / ' + state.player.maxHp + ' HP';
    var tkHeat = document.getElementById('taikoku-heat'); if (tkHeat) tkHeat.textContent = state.player.heat + ' / 100 CAL';
    var tkStab = document.getElementById('taikoku-stability'); if (tkStab) tkStab.textContent = stabVal + '% PSI';
    var tkScrap = document.getElementById('taikoku-scrap'); if (tkScrap) tkScrap.textContent = state.player.scrap.toLocaleString() + ' KG';

    var ghHp = document.getElementById('ghost-hp'); if (ghHp) ghHp.textContent = state.player.hp + ' / ' + state.player.maxHp + ' HP';
    var ghHeat = document.getElementById('ghost-heat'); if (ghHeat) ghHeat.textContent = state.player.heat + ' / 100 CAL';
    var ghStab = document.getElementById('ghost-stability-text'); if (ghStab) ghStab.textContent = stabVal + '% [INTACT]';
    var ghScrap = document.getElementById('ghost-scrap'); if (ghScrap) ghScrap.textContent = state.player.scrap.toLocaleString() + ' CR';

    var mgHp = document.getElementById('manga-hp'); if (mgHp) mgHp.textContent = state.player.hp + ' / ' + state.player.maxHp + ' HP';
    var mgHeat = document.getElementById('manga-heat'); if (mgHeat) mgHeat.textContent = state.player.heat + ' / 100 CAL';
    var mgStab = document.getElementById('manga-stability'); if (mgStab) mgStab.textContent = stabVal + '% [安定]';
    var mgScrap = document.getElementById('manga-scrap'); if (mgScrap) mgScrap.textContent = state.player.scrap.toLocaleString() + ' CR';

    var btHp = document.getElementById('biotech-hp'); if (btHp) btHp.textContent = state.player.hp + ' / ' + state.player.maxHp + ' mL';
    var btHeat = document.getElementById('biotech-heat'); if (btHeat) btHeat.textContent = state.player.heat + '%';
    var btStab = document.getElementById('biotech-stability'); if (btStab) btStab.textContent = stabVal + '%';
    var btScrap = document.getElementById('biotech-scrap'); if (btScrap) btScrap.textContent = state.player.scrap.toLocaleString() + ' CR';

    var rdHp = document.getElementById('ripperdoc-hp'); if (rdHp) rdHp.textContent = state.player.hp + ' / ' + state.player.maxHp;
    var rdHeat = document.getElementById('ripperdoc-heat'); if (rdHeat) rdHeat.textContent = state.player.heat + ' CAL';
    var rdStab = document.getElementById('ripperdoc-stability'); if (rdStab) rdStab.textContent = stabVal + '%';
    var rdScrap = document.getElementById('ripperdoc-scrap'); if (rdScrap) rdScrap.textContent = state.player.scrap.toLocaleString() + ' ¥';

    var mtHp = document.getElementById('metro-hp'); if (mtHp) mtHp.textContent = state.player.hp + ' / ' + state.player.maxHp;
    var mtHeat = document.getElementById('metro-heat'); if (mtHeat) mtHeat.textContent = state.player.heat + '%';
    var mtStab = document.getElementById('metro-stability'); if (mtStab) mtStab.textContent = stabVal + '%';
    var mtScrap = document.getElementById('metro-scrap'); if (mtScrap) mtScrap.textContent = '¥ ' + state.player.scrap.toLocaleString();

    var nvHp = document.getElementById('nerv-hp'); if (nvHp) nvHp.textContent = state.player.hp + ' / ' + state.player.maxHp;
    var nvHeat = document.getElementById('nerv-heat'); if (nvHeat) nvHeat.textContent = state.player.heat + ' CAL';
    var nvStab = document.getElementById('nerv-stability'); if (nvStab) nvStab.textContent = stabVal + '%';
    var nvScrap = document.getElementById('nerv-scrap'); if (nvScrap) nvScrap.textContent = state.player.scrap.toLocaleString() + ' FLUX';

    var tdHp = document.getElementById('trading-hp'); if (tdHp) tdHp.textContent = state.player.hp + ' / ' + state.player.maxHp;
    var tdHeat = document.getElementById('trading-heat'); if (tdHeat) tdHeat.textContent = state.player.heat + '%';
    var tdStab = document.getElementById('trading-stability'); if (tdStab) tdStab.textContent = stabVal + '%';
    var tdScrap = document.getElementById('trading-scrap'); if (tdScrap) tdScrap.textContent = state.player.scrap.toLocaleString() + ' CR';

    var hlHp = document.getElementById('holo-hp'); if (hlHp) hlHp.textContent = state.player.hp + ' / ' + state.player.maxHp;
    var hlHeat = document.getElementById('holo-heat'); if (hlHeat) hlHeat.textContent = state.player.heat + ' CAL';
    var hlStab = document.getElementById('holo-stability'); if (hlStab) hlStab.textContent = stabVal + '%';
    var hlScrap = document.getElementById('holo-scrap'); if (hlScrap) hlScrap.textContent = state.player.scrap.toLocaleString() + ' CR';

    var drHp = document.getElementById('drone-hp'); if (drHp) drHp.textContent = state.player.hp + ' / ' + state.player.maxHp;
    var drHeat = document.getElementById('drone-heat'); if (drHeat) drHeat.textContent = state.player.heat + ' CAL';
    var drStab = document.getElementById('drone-stability'); if (drStab) drStab.textContent = stabVal + '%';
    var drScrap = document.getElementById('drone-scrap'); if (drScrap) drScrap.textContent = state.player.scrap.toLocaleString() + ' CR';
  }

  // Update Workshop for Shared Themes 1 - 25 & Bespoke Themes
  function updateWorkshop() {
    var wsFlux = document.getElementById('wsFluxVal');
    if (wsFlux) wsFlux.textContent = state.player.flux;

    var wsScrap = document.getElementById('wsScrapVal');
    if (wsScrap) wsScrap.textContent = state.player.scrap.toLocaleString();

    var wsCompiled = document.getElementById('wsBlueprintsCompiledVal');
    if (wsCompiled) wsCompiled.textContent = state.compiledLibrary.length;

    var activeShellKey = state.player.shellId;
    var shellData = state.shells[activeShellKey];
    var upgrades = state.shellUpgrades[activeShellKey];

    // Shared Workshop: Shell Specs & Upgrades Station
    var specsArea = document.getElementById('shellSpecsUpgradeArea');
    if (specsArea && shellData && upgrades) {
      specsArea.innerHTML = 
        '<div style=\"background: var(--th-surface-alt); padding: 0.75rem; margin-bottom: 1rem; border-left: 3px solid var(--th-accent);\">' +
          '<div style=\"font-size: 13px; font-weight: 800; color: var(--th-text);\">' + shellData.name + '</div>' +
          '<div style=\"font-size: 10px; color: var(--th-accent); text-transform: uppercase;\">Archetype: ' + shellData.archetype + '</div>' +
          '<div style=\"font-size: 10px; color: var(--th-text-dim); margin-top: 4px;\">Port Config: ' + shellData.ports + '</div>' +
        '</div>' +

        '<div class=\"upgrade-row\">' +
          '<div>' +
            '<div style=\"font-size: 11px; font-weight: 700; color: var(--th-text);\">SERVO SPEED</div>' +
            '<div style=\"font-size: 10px; color: var(--th-text-dim);\">Base: ' + shellData.speed + ' + ' + (upgrades.speed * 10) + '</div>' +
          '</div>' +
          '<button class=\"action-chip-btn\" onclick=\"upgradeStat(&quot;speed&quot;)\">+10 SPD [50 FLUX]</button>' +
        '</div>' +

        '<div class=\"upgrade-row\">' +
          '<div>' +
            '<div style=\"font-size: 11px; font-weight: 700; color: var(--th-text);\">ARMOR PLATING</div>' +
            '<div style=\"font-size: 10px; color: var(--th-text-dim);\">Base: ' + shellData.armor + ' + ' + upgrades.armor + '</div>' +
          '</div>' +
          '<button class=\"action-chip-btn\" onclick=\"upgradeStat(&quot;armor&quot;)\">+1 ARMOR [45 FLUX]</button>' +
        '</div>' +

        '<div class=\"upgrade-row\">' +
          '<div>' +
            '<div style=\"font-size: 11px; font-weight: 700; color: var(--th-text);\">STABILITY SHIELD</div>' +
            '<div style=\"font-size: 10px; color: var(--th-text-dim);\">Base: ' + shellData.stab + ' + ' + (upgrades.stability * 2) + '</div>' +
          '</div>' +
          '<button class=\"action-chip-btn\" onclick=\"upgradeStat(&quot;stability&quot;)\">+2 STAB [35 FLUX]</button>' +
        '</div>' +

        '<div class=\"upgrade-row\">' +
          '<div>' +
            '<div style=\"font-size: 11px; font-weight: 700; color: var(--th-text);\">PORT EXPANSION</div>' +
            '<div style=\"font-size: 10px; color: var(--th-text-dim);\">Additional Ports: ' + upgrades.ports + '</div>' +
          '</div>' +
          '<button class=\"action-chip-btn\" onclick=\"upgradeStat(&quot;ports&quot;)\">+1 PORT [100 FLUX]</button>' +
        '</div>';
    }

    // Shared Workshop: Locked Blueprints
    var lockedList = document.getElementById('wsLockedList');
    if (lockedList) {
      if (state.lockedBlueprints.length === 0) {
        lockedList.innerHTML = '<div style=\"font-size: 10px; color: var(--th-text-dim); padding: 1rem 0;\">NO LOCKED ARTIFACTS // EXTRACT MORE FROM SIMULATIONS</div>';
      } else {
        lockedList.innerHTML = state.lockedBlueprints.map(function(bp) {
          return '<div style=\"background: var(--th-surface-alt); border: 1px solid var(--th-border); padding: 0.6rem; display: flex; align-items: center; justify-content: space-between;\">' +
            '<div>' +
              '<div style=\"font-size: 11px; font-weight: 700; color: var(--th-text);\">' + bp.name + '</div>' +
              '<div style=\"font-size: 9px; color: var(--th-text-dim);\">' + bp.desc + '</div>' +
              '<div style=\"font-size: 9px; color: #ffaa00; margin-top: 2px;\">TIER: ' + bp.rarity.toUpperCase() + ' | ' + bp.type.toUpperCase() + '</div>' +
            '</div>' +
            '<button class=\"action-chip-btn\" style=\"border-color: var(--th-accent-secondary); color: var(--th-accent-secondary);\" onclick=\"compileBlueprint(&quot;' + bp.id + '&quot;)\">' +
              'COMPILE [' + bp.cost + ' FLUX]' +
            '</button>' +
          '</div>';
        }).join('');
      }
    }

    // Shared Workshop: Compiled Library
    var compiledList = document.getElementById('wsCompiledList');
    if (compiledList) {
      compiledList.innerHTML = state.compiledLibrary.map(function(bp) {
        return '<div style=\"background: var(--th-surface-alt); border-left: 3px solid var(--th-accent); padding: 0.5rem; display: flex; align-items: center; justify-content: space-between;\">' +
          '<div>' +
            '<div style=\"font-size: 11px; font-weight: 700; color: var(--th-accent);\">' + bp.name + '</div>' +
            '<div style=\"font-size: 9px; color: var(--th-text-dim);\">' + bp.desc + '</div>' +
          '</div>' +
          '<span style=\"font-size: 9px; font-weight: 800; background: rgba(255,255,255,0.08); color: var(--th-accent); padding: 2px 6px;\">' +
            'READY TO SOCKET' +
          '</span>' +
        '</div>';
      }).join('');
    }

    // Shared Workshop: Software Exchange Shop
    var shopList = document.getElementById('wsShopList');
    if (shopList) {
      shopList.innerHTML = state.shopItems.map(function(item) {
        return '<div style=\"background: var(--th-surface-alt); border: 1px solid var(--th-border); padding: 0.65rem; display: flex; align-items: center; justify-content: space-between;\">' +
          '<div>' +
            '<div style=\"font-size: 11px; font-weight: 700; color: var(--th-text);\">' + item.name + '</div>' +
            '<div style=\"font-size: 9px; color: var(--th-text-dim);\">' + item.desc + '</div>' +
          '</div>' +
          '<button class=\"action-chip-btn\" style=\"border-color: #ffaa00; color: #ffaa00;\" onclick=\"buySoftware(&quot;' + item.id + '&quot;)\">' +
            'BUY [' + item.price + ' CR]' +
          '</button>' +
        '</div>';
      }).join('');
    }
  }

  // Simulation Actions
  function simStepTurn() {
    state.player.turn++;
    state.player.heat = Math.max(0, state.player.heat - 5);
    state.player.realityStability = Math.max(10, state.player.realityStability - 0.4);
    state.logs.unshift({ time: '14:21:0' + (state.player.turn % 10), tag: 'TURN', text: 'Step turn executed. Reality Anchor degrades (-0.4%).', color: '#00f0ff' });
    updateHUD();
    renderAsciiMap();
  }

  function simCastAbility(ability) {
    state.player.turn++;
    if (ability === 'phase_shift') {
      state.player.heat = Math.min(100, state.player.heat + 25);
      state.logs.unshift({ time: '14:21:12', tag: 'PHASE', text: 'Phase Shift engaged (+25 Heat). Dodged incoming fire.', color: '#d8ff00' });
    } else if (ability === 'neural_spike') {
      state.player.heat = Math.min(100, state.player.heat + 35);
      state.logs.unshift({ time: '14:21:15', tag: 'STRIKE', text: 'Neural Spike fired (+35 Heat). Dealt 8 kinetic damage.', color: '#ff3344' });
    } else {
      state.player.heat = Math.min(100, state.player.heat + 10);
      state.logs.unshift({ time: '14:21:18', tag: 'ACTION', text: ability.toUpperCase() + ' invoked.', color: '#ffaa00' });
    }
    updateHUD();
    renderAsciiMap();
  }

  function simWaitTurn() {
    state.player.turn++;
    state.player.heat = Math.max(0, state.player.heat - 30);
    state.logs.unshift({ time: '14:21:22', tag: 'VENT', text: 'Thermal exhaust valves open (-30 Heat).', color: '#00f0ff' });
    updateHUD();
    renderAsciiMap();
  }

  function simTakeDamage() {
    state.player.hp = Math.max(1, state.player.hp - 4);
    state.logs.unshift({ time: '14:21:28', tag: 'DAMAGE', text: 'CRITICAL IMPACT! Hull breach detected (-4 HP).', color: '#ff3344' });
    updateHUD();
  }

  function selectShell(shellId) {
    if (state.shells[shellId]) {
      state.player.shellId = shellId;
      var s = state.shells[shellId];
      state.player.shellName = s.name;
      state.player.maxHp = s.hp;
      state.player.hp = Math.min(state.player.hp, s.hp);
      state.player.speed = s.speed;
      state.player.armor = s.armor;

      document.querySelectorAll('#btnShellVanguard, #btnShellBastion, #btnShellGhost').forEach(function(b) {
        b.classList.remove('active');
      });
      var activeBtn = document.getElementById('btnShell' + shellId.charAt(0).toUpperCase() + shellId.slice(1));
      if (activeBtn) activeBtn.classList.add('active');

      updateHUD();
      updateWorkshop();
    }
  }

  function upgradeStat(stat) {
    var activeShellKey = state.player.shellId;
    var upgrades = state.shellUpgrades[activeShellKey];
    if (stat === 'speed' && state.player.flux >= 50) {
      state.player.flux -= 50;
      upgrades.speed++;
    } else if (stat === 'armor' && state.player.flux >= 45) {
      state.player.flux -= 45;
      upgrades.armor++;
    } else if (stat === 'stability' && state.player.flux >= 35) {
      state.player.flux -= 35;
      upgrades.stability++;
    } else if (stat === 'ports' && state.player.flux >= 100) {
      state.player.flux -= 100;
      upgrades.ports++;
    } else if (stat === 'maxHp' && state.player.scrap >= 80) {
      state.player.scrap -= 80;
      state.player.maxHp += 2;
      state.player.hp += 2;
    } else {
      alert('Insufficient Flux / Scrap for this upgrade!');
      return;
    }
    updateHUD();
    updateWorkshop();
  }

  function compileBlueprint(bpId) {
    var bpIdx = state.lockedBlueprints.findIndex(function(b) { return b.id === bpId; });
    if (bpIdx !== -1) {
      var bp = state.lockedBlueprints[bpIdx];
      if (state.player.flux >= bp.cost) {
        state.player.flux -= bp.cost;
        state.compiledLibrary.push(bp);
        state.lockedBlueprints.splice(bpIdx, 1);
        updateWorkshop();
      } else {
        alert('Insufficient Flux to compile blueprint! Need ' + bp.cost + ' Flux.');
      }
    }
  }

  function buySoftware(swId) {
    var sw = state.shopItems.find(function(s) { return s.id === swId; });
    if (sw) {
      if (state.player.scrap >= sw.price) {
        state.player.scrap -= sw.price;
        alert('Purchased and socketed ' + sw.name + ' for ' + sw.price + ' CR!');
        updateHUD();
        updateWorkshop();
      } else {
        alert('Insufficient Scrap! Need ' + sw.price + ' CR.');
      }
    }
  }

  // Spec Modal
  function openSpecModal() {
    var modal = document.getElementById('specModalBackdrop');
    var grid = document.getElementById('specModalGrid');
    if (!modal || !grid) return;

    grid.innerHTML = '';
    THEMES.forEach(function(th) {
      var card = document.createElement('div');
      card.className = 'spec-card';
      var badge = th.num >= 26 ? ' <span style=\"background:#e60012;color:#fff;font-size:9px;padding:1px 4px;font-weight:900;\">NEW BESPOKE</span>' : '';
      card.innerHTML = '<h3>' + th.num + '. ' + th.name + badge + '</h3>' +
        '<div style=\"font-size:11px;color:#8ab4f8;margin-bottom:4px;\">Layout: ' + th.layout + '</div>' +
        '<p style=\"font-size:11px;margin-bottom:8px;\">' + th.desc + '</p>' +
        '<div class=\"swatch-row\"><div class=\"swatch\" style=\"background:' + th.color + ';\"></div></div>';
      grid.appendChild(card);
    });

    modal.classList.add('open');
  }

  function closeSpecModal() {
    var modal = document.getElementById('specModalBackdrop');
    if (modal) modal.classList.remove('open');
  }

  // Keyboard Navigation
  window.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight') cycleTheme(1);
    else if (e.key === 'ArrowLeft') cycleTheme(-1);
    else if (e.key === 'z' || e.key === 'Z') simStepTurn();
    else if (e.key === '1') simCastAbility('phase_shift');
    else if (e.key === '2') simCastAbility('neural_spike');
    else if (e.key === 'w' || e.key === 'W') simWaitTurn();
    else if (e.key === 'Escape') closeSpecModal();
  });

  // Init
  window.addEventListener('DOMContentLoaded', function() {
    setFilter('cyborg'); // Show Bespoke Series 3 marquee pills by default
    selectThemeByIndex(25); // Activate Theme 26: Taikoku Industrial Manifest
    switchView('hud');
  });
</script>
`;
