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
    { key: 'enemy_null_pointer_atk_1', aliases: ['enemy_null_pointer_idle_2'], file: 'enemy_null_pointer_atk_1.png', x: 288, y: 384 },
    { key: 'enemy_buffer_overflow_idle_1', aliases: [], file: 'enemy_buffer_overflow_idle_1.png', x: 320, y: 384 },
    { key: 'enemy_buffer_overflow_atk_1', aliases: ['enemy_buffer_overflow_idle_2'], file: 'enemy_buffer_overflow_atk_1.png', x: 352, y: 384 },
    { key: 'enemy_fragmenter_idle_1', aliases: [], file: 'enemy_fragmenter_idle_1.png', x: 384, y: 384 },
    { key: 'enemy_fragmenter_atk_1', aliases: ['enemy_fragmenter_idle_2'], file: 'enemy_fragmenter_atk_1.png', x: 416, y: 384 },
    { key: 'enemy_logic_leaker_idle_1', aliases: [], file: 'enemy_logic_leaker_idle_1.png', x: 448, y: 384 },
    { key: 'enemy_logic_leaker_atk_1', aliases: ['enemy_logic_leaker_idle_2'], file: 'enemy_logic_leaker_atk_1.png', x: 480, y: 384 },

    // --- ROW 13 (y = 416): T3 Enemies, Workstations, Vent, Stabilizer, Cryo & Capacitor ---
    { key: 'enemy_seed_eater_idle_1', aliases: [], file: 'enemy_seed_eater_idle_1.png', x: 0, y: 416 },
    { key: 'enemy_seed_eater_atk_1', aliases: ['enemy_seed_eater_idle_2'], file: 'enemy_seed_eater_atk_1.png', x: 32, y: 416 },
    { key: 'enemy_system_admin_idle_1', aliases: [], file: 'enemy_system_admin_idle_1.png', x: 64, y: 416 },
    { key: 'enemy_system_admin_atk_1', aliases: ['enemy_system_admin_idle_2'], file: 'enemy_system_admin_atk_1.png', x: 96, y: 416 },
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
    },

    // Enemies (T1..T3)
    enemy_null_pointer: {
      idle: {
        frames: ['enemy_null_pointer', 'enemy_null_pointer_idle_1', 'enemy_null_pointer_atk_1'],
        fps: 5,
        loop: 'pingpong',
      },
      attack: {
        frames: ['enemy_null_pointer', 'enemy_null_pointer_atk_1'],
        fps: 10,
        loop: 'once',
      },
      hit: {
        frames: ['enemy_null_pointer', 'enemy_null_pointer_atk_1'],
        fps: 12,
        loop: 'once',
      },
    },
    enemy_buffer_overflow: {
      idle: {
        frames: ['enemy_buffer_overflow', 'enemy_buffer_overflow_idle_1', 'enemy_buffer_overflow_atk_1'],
        fps: 5,
        loop: 'pingpong',
      },
      attack: {
        frames: ['enemy_buffer_overflow', 'enemy_buffer_overflow_atk_1'],
        fps: 10,
        loop: 'once',
      },
      hit: {
        frames: ['enemy_buffer_overflow', 'enemy_buffer_overflow_atk_1'],
        fps: 12,
        loop: 'once',
      },
    },
    enemy_fragmenter: {
      idle: {
        frames: ['enemy_fragmenter', 'enemy_fragmenter_idle_1', 'enemy_fragmenter_atk_1'],
        fps: 5,
        loop: 'pingpong',
      },
      attack: {
        frames: ['enemy_fragmenter', 'enemy_fragmenter_atk_1'],
        fps: 10,
        loop: 'once',
      },
      hit: {
        frames: ['enemy_fragmenter', 'enemy_fragmenter_atk_1'],
        fps: 12,
        loop: 'once',
      },
    },
    enemy_logic_leaker: {
      idle: {
        frames: ['enemy_logic_leaker', 'enemy_logic_leaker_idle_1', 'enemy_logic_leaker_atk_1'],
        fps: 5,
        loop: 'pingpong',
      },
      attack: {
        frames: ['enemy_logic_leaker', 'enemy_logic_leaker_atk_1'],
        fps: 10,
        loop: 'once',
      },
      hit: {
        frames: ['enemy_logic_leaker', 'enemy_logic_leaker_atk_1'],
        fps: 12,
        loop: 'once',
      },
    },
    enemy_seed_eater: {
      idle: {
        frames: ['enemy_seed_eater', 'enemy_seed_eater_idle_1', 'enemy_seed_eater_atk_1'],
        fps: 5,
        loop: 'pingpong',
      },
      attack: {
        frames: ['enemy_seed_eater', 'enemy_seed_eater_atk_1'],
        fps: 10,
        loop: 'once',
      },
      hit: {
        frames: ['enemy_seed_eater', 'enemy_seed_eater_atk_1'],
        fps: 12,
        loop: 'once',
      },
    },
    enemy_system_admin: {
      idle: {
        frames: ['enemy_system_admin', 'enemy_system_admin_idle_1', 'enemy_system_admin_atk_1'],
        fps: 5,
        loop: 'pingpong',
      },
      attack: {
        frames: ['enemy_system_admin', 'enemy_system_admin_atk_1'],
        fps: 10,
        loop: 'once',
      },
      hit: {
        frames: ['enemy_system_admin', 'enemy_system_admin_atk_1'],
        fps: 12,
        loop: 'once',
      },
    },

    // Workstations
    prop_workstation: {
      idle: {
        frames: ['prop_workstation', 'prop_workstation_n_anim_1'],
        frameDurationsMs: [400, 400],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_workstation'],
        loop: 'once',
      },
    },
    prop_workstation_n: {
      idle: {
        frames: ['prop_workstation_n', 'prop_workstation_n_anim_1'],
        frameDurationsMs: [400, 400],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_workstation_n'],
        loop: 'once',
      },
    },
    prop_workstation_e: {
      idle: {
        frames: ['prop_workstation_e', 'prop_workstation_e_anim_1'],
        frameDurationsMs: [400, 400],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_workstation_e'],
        loop: 'once',
      },
    },
    prop_workstation_s: {
      idle: {
        frames: ['prop_workstation_s', 'prop_workstation_s_anim_1'],
        frameDurationsMs: [400, 400],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_workstation_s'],
        loop: 'once',
      },
    },
    prop_workstation_w: {
      idle: {
        frames: ['prop_workstation_w', 'prop_workstation_w_anim_1'],
        frameDurationsMs: [400, 400],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_workstation_w'],
        loop: 'once',
      },
    },

    // Cooling Vent
    prop_cooling_vent: {
      idle: {
        frames: ['prop_cooling_vent', 'prop_cooling_vent_spin_1', 'prop_cooling_vent_spin_2'],
        fps: 8,
        loop: 'loop',
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
      searched: {
        frames: ['prop_cooling_vent_ready'],
        loop: 'once',
      },
    },

    // Reality Stabilizer
    prop_stabilizer: {
      idle: {
        frames: ['prop_stabilizer', 'prop_stabilizer_pulse_1', 'prop_stabilizer_pulse_2'],
        fps: 5,
        loop: 'pingpong',
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
      searched: {
        frames: ['prop_stabilizer_active'],
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
    },
    prop_capacitor_bank: {
      idle: {
        frames: ['prop_capacitor_bank', 'prop_capacitor_bank_anim_1', 'prop_capacitor_bank_anim_2'],
        fps: 6,
        loop: 'pingpong',
      },
    },

    // Dead-Drop & Subnet Console
    prop_dead_drop: {
      idle: {
        frames: ['prop_dead_drop', 'prop_dead_drop_anim_1'],
        frameDurationsMs: [500, 250],
        loop: 'loop',
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
      searched: {
        frames: ['prop_subnet_console'],
        loop: 'once',
      },
    },

    // Safes & Lockers
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
      searched: {
        frames: ['prop_safe_locked'],
        loop: 'once',
      },
    },
    prop_locker_n: {
      idle: {
        frames: ['prop_locker_n', 'prop_locker_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_locker_n'],
        loop: 'once',
      },
    },
    prop_locker_e: {
      idle: {
        frames: ['prop_locker_e', 'prop_locker_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_locker_e'],
        loop: 'once',
      },
    },
    prop_locker_s: {
      idle: {
        frames: ['prop_locker_s', 'prop_locker_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_locker_s'],
        loop: 'once',
      },
    },
    prop_locker_w: {
      idle: {
        frames: ['prop_locker_w', 'prop_locker_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_locker_w'],
        loop: 'once',
      },
    },
    prop_biocabinet_n: {
      idle: {
        frames: ['prop_biocabinet_n', 'prop_biocabinet_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_biocabinet_n'],
        loop: 'once',
      },
    },
    prop_biocabinet_e: {
      idle: {
        frames: ['prop_biocabinet_e', 'prop_biocabinet_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_biocabinet_e'],
        loop: 'once',
      },
    },
    prop_biocabinet_s: {
      idle: {
        frames: ['prop_biocabinet_s', 'prop_biocabinet_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_biocabinet_s'],
        loop: 'once',
      },
    },
    prop_biocabinet_w: {
      idle: {
        frames: ['prop_biocabinet_w', 'prop_biocabinet_blink_1'],
        frameDurationsMs: [700, 200],
        loop: 'loop',
      },
      searched: {
        frames: ['prop_biocabinet_w'],
        loop: 'once',
      },
    },

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
