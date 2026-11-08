const fs = require('fs');
const path = require('path');
const { loadImage, createCanvas } = require('canvas');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const tilesetPaths = [
    path.join(rootDir, 'public/assets/tileset.png'),
    path.join(rootDir, 'public/assets/tiles/tileset.png'),
  ];
  const tilesetJsonPath = path.join(rootDir, 'public/assets/tileset.json');
  const animTilesDir = path.join(rootDir, 'public/assets/tiles/anim');

  const animationTiles = [
    // --- ROW 12 (y = 384): Player Shells & T1/T2 Enemies ---
    { key: 'player_vanguard_idle_1', aliases: ['player_vanguard_idle'], file: 'player_vanguard_idle_1.png', x: 0, y: 384 },
    { key: 'player_vanguard_atk_1', aliases: ['player_vanguard_attack_1'], file: 'player_vanguard_atk_1.png', x: 32, y: 384 },
    { key: 'player_bastion_idle_1', aliases: ['player_bastion_idle'], file: 'player_bastion_idle_1.png', x: 64, y: 384 },
    { key: 'player_bastion_atk_1', aliases: ['player_bastion_attack_1'], file: 'player_bastion_atk_1.png', x: 96, y: 384 },
    { key: 'player_ghost_idle_1', aliases: ['player_ghost_idle'], file: 'player_ghost_idle_1.png', x: 128, y: 384 },
    { key: 'player_ghost_atk_1', aliases: ['player_ghost_attack_1'], file: 'player_ghost_atk_1.png', x: 160, y: 384 },
    { key: 'player_idle_1', aliases: ['player_idle'], file: 'player_idle_1.png', x: 192, y: 384 },
    { key: 'player_atk_1', aliases: ['player_attack_1'], file: 'player_atk_1.png', x: 224, y: 384 },
    { key: 'enemy_null_pointer_idle_1', aliases: [], file: 'enemy_null_pointer_idle_1.png', x: 256, y: 384 },
    { key: 'enemy_null_pointer_atk_1', aliases: [], file: 'enemy_null_pointer_atk_1.png', x: 288, y: 384 },
    { key: 'enemy_buffer_overflow_idle_1', aliases: [], file: 'enemy_buffer_overflow_idle_1.png', x: 320, y: 384 },
    { key: 'enemy_buffer_overflow_atk_1', aliases: [], file: 'enemy_buffer_overflow_atk_1.png', x: 352, y: 384 },
    { key: 'enemy_fragmenter_idle_1', aliases: [], file: 'enemy_fragmenter_idle_1.png', x: 384, y: 384 },
    { key: 'enemy_fragmenter_atk_1', aliases: [], file: 'enemy_fragmenter_atk_1.png', x: 416, y: 384 },
    { key: 'enemy_logic_leaker_idle_1', aliases: [], file: 'enemy_logic_leaker_idle_1.png', x: 448, y: 384 },
    { key: 'enemy_logic_leaker_atk_1', aliases: [], file: 'enemy_logic_leaker_atk_1.png', x: 480, y: 384 },

    // --- ROW 13 (y = 416): T3 Enemies, Workstations, Vent, Stabilizer, Cryo & Capacitor ---
    { key: 'enemy_seed_eater_idle_1', aliases: [], file: 'enemy_seed_eater_idle_1.png', x: 0, y: 416 },
    { key: 'enemy_seed_eater_atk_1', aliases: [], file: 'enemy_seed_eater_atk_1.png', x: 32, y: 416 },
    { key: 'enemy_system_admin_idle_1', aliases: [], file: 'enemy_system_admin_idle_1.png', x: 64, y: 416 },
    { key: 'enemy_system_admin_atk_1', aliases: [], file: 'enemy_system_admin_atk_1.png', x: 96, y: 416 },
    { key: 'prop_workstation_n_anim_1', aliases: ['prop_workstation_anim_1'], file: 'prop_workstation_n_anim_1.png', x: 128, y: 416 },
    { key: 'prop_workstation_e_anim_1', aliases: [], file: 'prop_workstation_e_anim_1.png', x: 160, y: 416 },
    { key: 'prop_workstation_s_anim_1', aliases: [], file: 'prop_workstation_s_anim_1.png', x: 192, y: 416 },
    { key: 'prop_workstation_w_anim_1', aliases: [], file: 'prop_workstation_w_anim_1.png', x: 224, y: 416 },
    { key: 'prop_cooling_vent_spin_1', aliases: [], file: 'prop_cooling_vent_spin_1.png', x: 256, y: 416 },
    { key: 'prop_cooling_vent_spin_2', aliases: [], file: 'prop_cooling_vent_spin_2.png', x: 288, y: 416 },
    { key: 'prop_stabilizer_pulse_1', aliases: [], file: 'prop_stabilizer_pulse_1.png', x: 320, y: 416 },
    { key: 'prop_stabilizer_pulse_2', aliases: [], file: 'prop_stabilizer_pulse_2.png', x: 352, y: 416 },
    { key: 'prop_cryo_vat_anim_1', aliases: [], file: 'prop_cryo_vat_anim_1.png', x: 384, y: 416 },
    { key: 'prop_cryo_vat_anim_2', aliases: [], file: 'prop_cryo_vat_anim_2.png', x: 416, y: 416 },
    { key: 'prop_capacitor_bank_anim_1', aliases: [], file: 'prop_capacitor_bank_anim_1.png', x: 448, y: 416 },
    { key: 'prop_capacitor_bank_anim_2', aliases: [], file: 'prop_capacitor_bank_anim_2.png', x: 480, y: 416 },

    // --- ROW 14 (y = 448): Dead-Drop, Console, Safes/Lockers, Fixtures, Loot Glints ---
    { key: 'prop_dead_drop_anim_1', aliases: [], file: 'prop_dead_drop_anim_1.png', x: 0, y: 448 },
    { key: 'prop_subnet_console_anim_1', aliases: [], file: 'prop_subnet_console_anim_1.png', x: 32, y: 448 },
    { key: 'prop_safe_locked_blink_1', aliases: [], file: 'prop_safe_locked_blink_1.png', x: 64, y: 448 },
    { key: 'prop_locker_blink_1', aliases: [], file: 'prop_locker_blink_1.png', x: 96, y: 448 },
    { key: 'prop_biocabinet_blink_1', aliases: [], file: 'prop_biocabinet_blink_1.png', x: 128, y: 448 },
    { key: 'anchor_pulse_1', aliases: [], file: 'anchor_pulse_1.png', x: 160, y: 448 },
    { key: 'anchor_pulse_2', aliases: [], file: 'anchor_pulse_2.png', x: 192, y: 448 },
    { key: 'staircase_pulse_1', aliases: [], file: 'staircase_pulse_1.png', x: 224, y: 448 },
    { key: 'item_flux_glint_1', aliases: [], file: 'item_flux_glint_1.png', x: 256, y: 448 },
    { key: 'item_potion_glint_1', aliases: [], file: 'item_potion_glint_1.png', x: 288, y: 448 },
    { key: 'item_blueprint_glint_1', aliases: [], file: 'item_blueprint_glint_1.png', x: 320, y: 448 },
    { key: 'item_access_key_glint_1', aliases: [], file: 'item_access_key_glint_1.png', x: 352, y: 448 },
  ];

  console.log(`Loading master tileset from ${tilesetPaths[0]}`);
  const masterTileset = await loadImage(tilesetPaths[0]);

  const canvas = createCanvas(masterTileset.width, masterTileset.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Draw original tileset
  ctx.drawImage(masterTileset, 0, 0);

  // Composite animation delta frames into tileset
  for (const item of animationTiles) {
    const tilePath = path.join(animTilesDir, item.file);
    if (!fs.existsSync(tilePath)) {
      throw new Error(`Animation tile file not found: ${tilePath}`);
    }
    const tileImg = await loadImage(tilePath);
    ctx.clearRect(item.x, item.y, 32, 32);
    ctx.drawImage(tileImg, item.x, item.y, 32, 32);
  }

  // Save composite image to both targets
  const outBuffer = canvas.toBuffer('image/png');
  for (const p of tilesetPaths) {
    fs.writeFileSync(p, outBuffer);
    console.log(`Updated tileset atlas: ${p}`);
  }

  // Update tileset.json with frame coordinates and animations manifest
  const tilesetJson = JSON.parse(fs.readFileSync(tilesetJsonPath, 'utf-8'));

  for (const item of animationTiles) {
    const frameObj = {
      frame: { x: item.x, y: item.y, w: 32, h: 32 },
      sourceSize: { w: 32, h: 32 },
      spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
    };

    tilesetJson.frames[item.key] = frameObj;

    for (const alias of item.aliases) {
      tilesetJson.frames[alias] = frameObj;
    }
  }

  // Register template compatibility aliases for vault doors and anchors in frames
  if (tilesetJson.frames['prop_vault_door_locked_n']) {
    tilesetJson.frames['vault_door_locked_n'] = tilesetJson.frames['prop_vault_door_locked_n'];
    tilesetJson.frames['vault_door_locked_e'] = tilesetJson.frames['prop_vault_door_locked_e'];
    tilesetJson.frames['vault_door_locked_s'] = tilesetJson.frames['prop_vault_door_locked_s'];
    tilesetJson.frames['vault_door_locked_w'] = tilesetJson.frames['prop_vault_door_locked_w'];
  }
  if (tilesetJson.frames['anchor']) {
    tilesetJson.frames['prop_stability_anchor'] = tilesetJson.frames['anchor'];
  }

  // Helper to build workstation animation entry
  function makeWorkstationAnim(baseKey, animKey) {
    return {
      idle: {
        frames: [baseKey, animKey],
        frameDurationsMs: [400, 400],
        loop: 'loop',
      },
      interact: {
        frames: [animKey, baseKey],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: [baseKey],
        loop: 'once',
      },
    };
  }

  // Helper to build locker animation entry
  function makeLockerAnim(baseKey) {
    return {
      locked: {
        frames: [baseKey],
        loop: 'once',
      },
      idle: {
        frames: [baseKey, 'prop_locker_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      interact: {
        frames: [baseKey, 'prop_locker_blink_1'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: [baseKey],
        loop: 'once',
      },
    };
  }

  // Helper to build biocabinet animation entry
  function makeBiocabinetAnim(baseKey) {
    return {
      locked: {
        frames: [baseKey],
        loop: 'once',
      },
      idle: {
        frames: [baseKey, 'prop_biocabinet_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      interact: {
        frames: [baseKey, 'prop_biocabinet_blink_1'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: [baseKey],
        loop: 'once',
      },
    };
  }

  // Helper to build vault door animation entry
  function makeVaultDoorAnim(baseKey) {
    return {
      locked: {
        frames: [baseKey],
        loop: 'once',
      },
      idle: {
        frames: [baseKey],
        loop: 'once',
      },
      interact: {
        frames: [baseKey, 'prop_vault_door'],
        fps: 6,
        loop: 'once',
        nextState: 'open',
      },
      open: {
        frames: ['prop_vault_door'],
        loop: 'once',
      },
    };
  }

  // Helper to build enemy animation entry
  function makeEnemyAnim(enemyKey) {
    return {
      idle: {
        frames: [enemyKey, `${enemyKey}_idle_1`],
        fps: 4,
        loop: 'pingpong',
      },
      move: {
        frames: [enemyKey, `${enemyKey}_idle_1`],
        fps: 8,
        loop: 'once',
      },
      attack: {
        frames: [`${enemyKey}_atk_1`, enemyKey],
        fps: 8,
        loop: 'once',
      },
      hit: {
        frames: [enemyKey, `${enemyKey}_atk_1`],
        fps: 10,
        loop: 'once',
      },
    };
  }

  // Construct animations dictionary
  tilesetJson.animations = {
    // Player Shells
    player_vanguard: {
      idle: {
        frames: ['player_vanguard', 'player_vanguard_idle_1'],
        frameDurationsMs: [550, 250],
        loop: 'loop',
        desyncPhase: false,
      },
      move: {
        frames: ['player_vanguard_idle_1', 'player_vanguard'],
        fps: 12,
        loop: 'once',
      },
      attack: {
        frames: ['player_vanguard_atk_1', 'player_vanguard'],
        frameDurationsMs: [110, 60],
        loop: 'once',
      },
      interact: {
        frames: ['player_vanguard', 'player_vanguard_idle_1'],
        fps: 8,
        loop: 'once',
      },
    },
    player_bastion: {
      idle: {
        frames: ['player_bastion', 'player_bastion_idle_1'],
        frameDurationsMs: [550, 250],
        loop: 'loop',
        desyncPhase: false,
      },
      move: {
        frames: ['player_bastion_idle_1', 'player_bastion'],
        fps: 12,
        loop: 'once',
      },
      attack: {
        frames: ['player_bastion_atk_1', 'player_bastion'],
        frameDurationsMs: [110, 60],
        loop: 'once',
      },
      interact: {
        frames: ['player_bastion', 'player_bastion_idle_1'],
        fps: 8,
        loop: 'once',
      },
    },
    player_ghost: {
      idle: {
        frames: ['player_ghost', 'player_ghost_idle_1'],
        frameDurationsMs: [550, 250],
        loop: 'loop',
        desyncPhase: false,
      },
      move: {
        frames: ['player_ghost_idle_1', 'player_ghost'],
        fps: 12,
        loop: 'once',
      },
      attack: {
        frames: ['player_ghost_atk_1', 'player_ghost'],
        frameDurationsMs: [110, 60],
        loop: 'once',
      },
      interact: {
        frames: ['player_ghost', 'player_ghost_idle_1'],
        fps: 8,
        loop: 'once',
      },
    },
    player: {
      idle: {
        frames: ['player', 'player_idle_1'],
        frameDurationsMs: [550, 250],
        loop: 'loop',
        desyncPhase: false,
      },
      move: {
        frames: ['player_idle_1', 'player'],
        fps: 12,
        loop: 'once',
      },
      attack: {
        frames: ['player_atk_1', 'player'],
        frameDurationsMs: [110, 60],
        loop: 'once',
      },
      interact: {
        frames: ['player', 'player_idle_1'],
        fps: 8,
        loop: 'once',
      },
    },

    // Enemies (T1..T3) — subtle ambient idle loops and dedicated move clips
    enemy_null_pointer: makeEnemyAnim('enemy_null_pointer'),
    enemy_buffer_overflow: makeEnemyAnim('enemy_buffer_overflow'),
    enemy_fragmenter: makeEnemyAnim('enemy_fragmenter'),
    enemy_logic_leaker: makeEnemyAnim('enemy_logic_leaker'),
    enemy_seed_eater: makeEnemyAnim('enemy_seed_eater'),
    enemy_system_admin: makeEnemyAnim('enemy_system_admin'),

    // Workstations (base, active template, and directional variants)
    prop_workstation: makeWorkstationAnim('prop_workstation', 'prop_workstation_n_anim_1'),
    prop_workstation_active: makeWorkstationAnim('prop_workstation_active', 'prop_workstation_n_anim_1'),
    prop_workstation_n: makeWorkstationAnim('prop_workstation_n', 'prop_workstation_n_anim_1'),
    prop_workstation_e: makeWorkstationAnim('prop_workstation_e', 'prop_workstation_e_anim_1'),
    prop_workstation_s: makeWorkstationAnim('prop_workstation_s', 'prop_workstation_s_anim_1'),
    prop_workstation_w: makeWorkstationAnim('prop_workstation_w', 'prop_workstation_w_anim_1'),

    // Cooling Vent
    prop_cooling_vent: {
      idle: {
        frames: ['prop_cooling_vent', 'prop_cooling_vent_spin_1', 'prop_cooling_vent_spin_2'],
        fps: 8,
        loop: 'loop',
      },
      interact: {
        frames: ['prop_cooling_vent', 'prop_cooling_vent_spin_1'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: ['prop_cooling_vent'],
        loop: 'once',
      },
    },
    prop_cooling_vent_ready: {
      idle: {
        frames: ['prop_cooling_vent_ready', 'prop_cooling_vent_spin_1', 'prop_cooling_vent_spin_2'],
        fps: 8,
        loop: 'loop',
      },
      interact: {
        frames: ['prop_cooling_vent_ready', 'prop_cooling_vent_spin_1'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: ['prop_cooling_vent_ready'],
        loop: 'once',
      },
    },

    // Reality Stabilizer & Stability Anchor
    prop_stabilizer: {
      idle: {
        frames: ['prop_stabilizer', 'prop_stabilizer_pulse_1', 'prop_stabilizer_pulse_2'],
        fps: 5,
        loop: 'pingpong',
      },
      interact: {
        frames: ['prop_stabilizer', 'prop_stabilizer_pulse_1'],
        fps: 8,
        loop: 'once',
      },
      searched: {
        frames: ['prop_stabilizer'],
        loop: 'once',
      },
    },
    prop_stabilizer_active: {
      idle: {
        frames: ['prop_stabilizer_active', 'prop_stabilizer_pulse_1', 'prop_stabilizer_pulse_2'],
        fps: 5,
        loop: 'pingpong',
      },
      interact: {
        frames: ['prop_stabilizer_active', 'prop_stabilizer_pulse_1'],
        fps: 8,
        loop: 'once',
      },
      searched: {
        frames: ['prop_stabilizer_active'],
        loop: 'once',
      },
    },
    prop_stability_anchor: {
      idle: {
        frames: ['anchor', 'anchor_pulse_1', 'anchor_pulse_2'],
        fps: 4,
        loop: 'pingpong',
      },
      interact: {
        frames: ['anchor', 'anchor_pulse_1'],
        fps: 8,
        loop: 'once',
      },
    },

    // Cryo-Vat & Capacitor Bank
    prop_cryo_vat: {
      idle: {
        frames: ['prop_cryo_vat', 'prop_cryo_vat_anim_1', 'prop_cryo_vat_anim_2'],
        fps: 5,
        loop: 'loop',
      },
      interact: {
        frames: ['prop_cryo_vat', 'prop_cryo_vat_anim_1'],
        fps: 8,
        loop: 'once',
      },
    },
    prop_capacitor_bank: {
      idle: {
        frames: ['prop_capacitor_bank', 'prop_capacitor_bank_anim_1', 'prop_capacitor_bank_anim_2'],
        fps: 6,
        loop: 'pingpong',
      },
      interact: {
        frames: ['prop_capacitor_bank', 'prop_capacitor_bank_anim_1'],
        fps: 8,
        loop: 'once',
      },
    },

    // Dead-Drop & Subnet Console
    prop_dead_drop: {
      idle: {
        frames: ['prop_dead_drop', 'prop_dead_drop_anim_1'],
        frameDurationsMs: [500, 250],
        loop: 'loop',
      },
      interact: {
        frames: ['prop_dead_drop', 'prop_dead_drop_anim_1'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: ['prop_dead_drop'],
        loop: 'once',
      },
    },
    prop_dead_drop_ready: {
      idle: {
        frames: ['prop_dead_drop_ready', 'prop_dead_drop_anim_1'],
        frameDurationsMs: [500, 250],
        loop: 'loop',
      },
      interact: {
        frames: ['prop_dead_drop_ready', 'prop_dead_drop_anim_1'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: ['prop_dead_drop_ready'],
        loop: 'once',
      },
    },
    prop_subnet_console: {
      idle: {
        frames: ['prop_subnet_console', 'prop_subnet_console_anim_1'],
        frameDurationsMs: [500, 250],
        loop: 'loop',
      },
      interact: {
        frames: ['prop_subnet_console', 'prop_subnet_console_anim_1'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: ['prop_subnet_console'],
        loop: 'once',
      },
    },

    // Safes
    prop_safe: {
      idle: {
        frames: ['prop_safe'],
        loop: 'once',
      },
      interact: {
        frames: ['prop_safe_locked', 'prop_safe'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: ['prop_safe'],
        loop: 'once',
      },
    },
    prop_safe_locked: {
      locked: {
        frames: ['prop_safe_locked', 'prop_safe_locked_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      idle: {
        frames: ['prop_safe_locked', 'prop_safe_locked_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      interact: {
        frames: ['prop_safe_locked', 'prop_safe'],
        fps: 8,
        loop: 'once',
        nextState: 'searched',
      },
      searched: {
        frames: ['prop_safe'],
        loop: 'once',
      },
    },

    // Lockers (base, closed template, and directional variants)
    prop_locker: makeLockerAnim('prop_locker'),
    prop_locker_closed: makeLockerAnim('prop_locker_closed'),
    prop_locker_n: makeLockerAnim('prop_locker_n'),
    prop_locker_e: makeLockerAnim('prop_locker_e'),
    prop_locker_s: makeLockerAnim('prop_locker_s'),
    prop_locker_w: makeLockerAnim('prop_locker_w'),

    // Bio-Cabinets (base, full template, and directional variants)
    prop_biocabinet: makeBiocabinetAnim('prop_biocabinet'),
    prop_biocabinet_full: makeBiocabinetAnim('prop_biocabinet_full'),
    prop_biocabinet_n: makeBiocabinetAnim('prop_biocabinet_n'),
    prop_biocabinet_e: makeBiocabinetAnim('prop_biocabinet_e'),
    prop_biocabinet_s: makeBiocabinetAnim('prop_biocabinet_s'),
    prop_biocabinet_w: makeBiocabinetAnim('prop_biocabinet_w'),

    // Vault Doors (base, locked template, and directional variants)
    prop_vault_door: makeVaultDoorAnim('prop_vault_door'),
    prop_vault_door_locked: makeVaultDoorAnim('prop_vault_door_locked'),
    prop_vault_door_n: makeVaultDoorAnim('prop_vault_door_n'),
    prop_vault_door_e: makeVaultDoorAnim('prop_vault_door_e'),
    prop_vault_door_s: makeVaultDoorAnim('prop_vault_door_s'),
    prop_vault_door_w: makeVaultDoorAnim('prop_vault_door_w'),
    prop_vault_door_locked_n: makeVaultDoorAnim('prop_vault_door_locked_n'),
    prop_vault_door_locked_e: makeVaultDoorAnim('prop_vault_door_locked_e'),
    prop_vault_door_locked_s: makeVaultDoorAnim('prop_vault_door_locked_s'),
    prop_vault_door_locked_w: makeVaultDoorAnim('prop_vault_door_locked_w'),
    vault_door_locked_n: makeVaultDoorAnim('vault_door_locked_n'),
    vault_door_locked_e: makeVaultDoorAnim('vault_door_locked_e'),
    vault_door_locked_s: makeVaultDoorAnim('vault_door_locked_s'),
    vault_door_locked_w: makeVaultDoorAnim('vault_door_locked_w'),

    // World Fixtures
    anchor: {
      frames: ['anchor', 'anchor_pulse_1', 'anchor_pulse_2'],
      fps: 4,
      loop: 'pingpong',
    },
    staircase: {
      frames: ['staircase', 'staircase_pulse_1'],
      fps: 3,
      loop: 'loop',
    },

    // Key Loot Items
    item_flux: {
      frames: ['item_flux', 'item_flux_glint_1'],
      frameDurationsMs: [900, 150],
      loop: 'loop',
    },
    item_potion: {
      frames: ['item_potion', 'item_potion_glint_1'],
      frameDurationsMs: [900, 150],
      loop: 'loop',
    },
    item_blueprint: {
      frames: ['item_blueprint', 'item_blueprint_glint_1'],
      frameDurationsMs: [900, 150],
      loop: 'loop',
    },
    item_access_key: {
      frames: ['item_access_key', 'item_access_key_glint_1'],
      frameDurationsMs: [900, 150],
      loop: 'loop',
    },
  };

  fs.writeFileSync(tilesetJsonPath, JSON.stringify(tilesetJson, null, 2) + '\n');
  console.log(`Updated JSON manifest: ${tilesetJsonPath}`);
  console.log(`Total animations registered: ${Object.keys(tilesetJson.animations).length}`);
}

main().catch((err) => {
  console.error('Fatal error adding animation frames:', err);
  process.exit(1);
});
