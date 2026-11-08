const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const TILE_SIZE = 32;

function drawDropShadow(ctx, cx, cy, rx, ry, alpha = 0.5) {
  ctx.fillStyle = `rgba(2, 6, 18, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function setPixel(ctx, x, y, color) {
  if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawRect(ctx, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const masterTilesetPath = path.join(rootDir, 'public/assets/tileset.png');
  const tilesetJsonPath = path.join(rootDir, 'public/assets/tileset.json');
  const outDir = path.join(rootDir, 'public/assets/tiles/anim');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const masterTileset = await loadImage(masterTilesetPath);
  const tilesetJson = JSON.parse(fs.readFileSync(tilesetJsonPath, 'utf-8'));

  function getBaseTileCanvas(key) {
    const frameDef = tilesetJson.frames[key];
    if (!frameDef) {
      throw new Error(`Base tile '${key}' not found in tileset.json`);
    }
    const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      masterTileset,
      frameDef.frame.x,
      frameDef.frame.y,
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
      TILE_SIZE,
      TILE_SIZE
    );
    return { canvas, ctx };
  }

  const generators = {
    // -------------------------------------------------------------
    // Player Shells
    // -------------------------------------------------------------
    'player_vanguard_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('player_vanguard');
      // Visor cyan telemetry scan & reactor core breathing pulse
      drawRect(ctx, 12, 10, 8, 2, '#00ffff'); // visor glow
      setPixel(ctx, 15, 11, '#ffffff'); // bright optical glint
      drawRect(ctx, 14, 18, 4, 3, '#00e5ff'); // reactor core flare
      setPixel(ctx, 15, 19, '#ffffff');
      return canvas;
    },
    'player_vanguard_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('player_vanguard');
      // Forward kinetic weapon muzzle flash & recoil shift
      drawRect(ctx, 23, 14, 5, 4, '#ff9900'); // muzzle flare
      drawRect(ctx, 24, 15, 3, 2, '#ffffaa');
      setPixel(ctx, 25, 15, '#ffffff');
      // Optical lock
      drawRect(ctx, 12, 9, 8, 2, '#ff3366');
      return canvas;
    },
    'player_bastion_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('player_bastion');
      // Heavy chassis sub-reactor hum & defensive barrier capacitor glow
      drawRect(ctx, 8, 14, 3, 8, '#3b82f6'); // left shield capacitor
      drawRect(ctx, 21, 14, 3, 8, '#3b82f6'); // right shield capacitor
      setPixel(ctx, 9, 17, '#93c5fd');
      setPixel(ctx, 22, 17, '#93c5fd');
      drawRect(ctx, 13, 12, 6, 2, '#60a5fa'); // visor hum
      return canvas;
    },
    'player_bastion_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('player_bastion');
      // Forward shield slam / barrier discharge surge
      drawRect(ctx, 6, 12, 4, 12, '#60a5fa');
      drawRect(ctx, 22, 12, 4, 12, '#60a5fa');
      drawRect(ctx, 10, 16, 12, 3, '#93c5fd'); // barrier arc
      drawRect(ctx, 12, 17, 8, 1, '#ffffff');
      return canvas;
    },
    'player_ghost_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('player_ghost');
      // Phase cloak shimmer & optical glint
      drawRect(ctx, 13, 10, 6, 2, '#a855f7'); // cloaking visor
      setPixel(ctx, 16, 10, '#ffffff');
      setPixel(ctx, 9, 14, '#c084fc');
      setPixel(ctx, 22, 18, '#c084fc');
      return canvas;
    },
    'player_ghost_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('player_ghost');
      // Neural strike / phase blade violet discharge
      drawRect(ctx, 20, 8, 7, 3, '#c084fc');
      drawRect(ctx, 22, 9, 5, 2, '#f3e8ff');
      setPixel(ctx, 23, 9, '#ffffff');
      drawRect(ctx, 13, 9, 6, 2, '#e879f9');
      return canvas;
    },
    'player_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('player');
      // Base player chassis breathe & visor pulse
      drawRect(ctx, 12, 10, 8, 2, '#00e5ff');
      setPixel(ctx, 15, 10, '#ffffff');
      drawRect(ctx, 14, 16, 4, 2, '#00b4d8');
      return canvas;
    },
    'player_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('player');
      // Base player weapon fire
      drawRect(ctx, 22, 14, 5, 4, '#ffaa00');
      drawRect(ctx, 23, 15, 3, 2, '#ffffff');
      return canvas;
    },

    // -------------------------------------------------------------
    // Enemies
    // -------------------------------------------------------------
    'enemy_null_pointer_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_null_pointer');
      // Glitch stalker phase jitter step 1 (red/cyan chromatic aberration)
      setPixel(ctx, 10, 8, '#ff0055');
      setPixel(ctx, 21, 8, '#00ffff');
      setPixel(ctx, 9, 14, '#ff0055');
      setPixel(ctx, 22, 14, '#00ffff');
      drawRect(ctx, 13, 12, 6, 2, '#ff0055');
      return canvas;
    },
    'enemy_null_pointer_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_null_pointer');
      // Phase lunge & glitch claw strike
      drawRect(ctx, 6, 10, 4, 8, '#ff0055');
      drawRect(ctx, 22, 10, 4, 8, '#ff0055');
      drawRect(ctx, 12, 10, 8, 4, '#ffffff');
      setPixel(ctx, 15, 12, '#ff0055');
      return canvas;
    },
    'enemy_buffer_overflow_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_buffer_overflow');
      // Core pulse expansion
      drawRect(ctx, 12, 12, 8, 8, '#ef4444');
      drawRect(ctx, 13, 13, 6, 6, '#f87171');
      setPixel(ctx, 15, 15, '#ffffff');
      return canvas;
    },
    'enemy_buffer_overflow_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_buffer_overflow');
      // Overflow discharge / explosive slam
      drawRect(ctx, 8, 8, 16, 16, '#dc2626');
      drawRect(ctx, 11, 11, 10, 10, '#fca5a5');
      drawRect(ctx, 13, 13, 6, 6, '#ffffff');
      return canvas;
    },
    'enemy_fragmenter_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_fragmenter');
      // Piston heave / chassis compression
      drawRect(ctx, 10, 6, 12, 3, '#f59e0b');
      setPixel(ctx, 15, 7, '#fef3c7');
      drawRect(ctx, 8, 20, 16, 2, '#b45309');
      return canvas;
    },
    'enemy_fragmenter_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_fragmenter');
      // Shrapnel burst & hydraulic hammer impact
      drawRect(ctx, 6, 14, 20, 6, '#f59e0b');
      drawRect(ctx, 10, 16, 12, 3, '#ffffff');
      setPixel(ctx, 4, 12, '#fbbf24');
      setPixel(ctx, 27, 12, '#fbbf24');
      return canvas;
    },
    'enemy_logic_leaker_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_logic_leaker');
      // Acid siphon drip & caustic bubble
      drawRect(ctx, 14, 22, 4, 3, '#84cc16');
      setPixel(ctx, 15, 23, '#bef264');
      setPixel(ctx, 16, 24, '#ffffff');
      return canvas;
    },
    'enemy_logic_leaker_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_logic_leaker');
      // Caustic spit / corrupted stream burst
      drawRect(ctx, 12, 18, 8, 6, '#84cc16');
      drawRect(ctx, 14, 23, 4, 5, '#bef264');
      setPixel(ctx, 15, 26, '#ffffff');
      return canvas;
    },
    'enemy_seed_eater_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_seed_eater');
      // Mandible twitch & biological pulse
      drawRect(ctx, 8, 12, 3, 5, '#ec4899');
      drawRect(ctx, 21, 12, 3, 5, '#ec4899');
      setPixel(ctx, 9, 14, '#f472b6');
      setPixel(ctx, 22, 14, '#f472b6');
      return canvas;
    },
    'enemy_seed_eater_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_seed_eater');
      // Mandible snap & lunge
      drawRect(ctx, 10, 14, 12, 6, '#db2777');
      drawRect(ctx, 12, 16, 8, 3, '#fbcfe8');
      setPixel(ctx, 15, 17, '#ffffff');
      return canvas;
    },
    'enemy_system_admin_idle_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_system_admin');
      // Sentinel optic sweep / core scan
      drawRect(ctx, 12, 10, 8, 3, '#e11d48');
      setPixel(ctx, 17, 11, '#ffffff'); // scanning eye glint
      drawRect(ctx, 14, 18, 4, 4, '#fb7185');
      return canvas;
    },
    'enemy_system_admin_atk_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('enemy_system_admin');
      // Eradication beam / purge core expansion
      drawRect(ctx, 8, 8, 16, 16, '#9f1239');
      drawRect(ctx, 11, 10, 10, 10, '#f43f5e');
      drawRect(ctx, 13, 12, 6, 6, '#ffffff');
      return canvas;
    },

    // -------------------------------------------------------------
    // Workstations (North / East / South / West)
    // -------------------------------------------------------------
    'prop_workstation_n_anim_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_workstation_n');
      // Scrolling terminal code lines & blinking cyan prompt
      drawRect(ctx, 9, 8, 14, 1, '#00e5ff');
      drawRect(ctx, 9, 11, 10, 1, '#00e5ff');
      setPixel(ctx, 20, 11, '#ffffff'); // blinking cursor
      return canvas;
    },
    'prop_workstation_e_anim_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_workstation_e');
      drawRect(ctx, 8, 10, 10, 1, '#00e5ff');
      setPixel(ctx, 19, 10, '#ffffff');
      return canvas;
    },
    'prop_workstation_s_anim_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_workstation_s');
      // Rear exhaust LED pulse
      drawRect(ctx, 10, 12, 12, 1, '#00ffff');
      return canvas;
    },
    'prop_workstation_w_anim_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_workstation_w');
      drawRect(ctx, 14, 10, 10, 1, '#00e5ff');
      setPixel(ctx, 14, 10, '#ffffff');
      return canvas;
    },

    // -------------------------------------------------------------
    // Cooling Vent
    // -------------------------------------------------------------
    'prop_cooling_vent_spin_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_cooling_vent_ready');
      // Turbine blades rotated 45 deg
      drawRect(ctx, 14, 10, 4, 12, '#38bdf8');
      drawRect(ctx, 10, 14, 12, 4, '#38bdf8');
      setPixel(ctx, 15, 15, '#ffffff');
      return canvas;
    },
    'prop_cooling_vent_spin_2.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_cooling_vent_ready');
      // Turbine blades rotated diagonal + cryo-mist puff
      drawRect(ctx, 11, 11, 10, 10, '#0284c7');
      drawRect(ctx, 13, 13, 6, 6, '#e0f2fe');
      setPixel(ctx, 15, 15, '#ffffff');
      // Cryo mist pixels
      setPixel(ctx, 15, 6, 'rgba(224, 242, 254, 0.75)');
      setPixel(ctx, 16, 5, 'rgba(224, 242, 254, 0.5)');
      return canvas;
    },

    // -------------------------------------------------------------
    // Reality Stabilizer
    // -------------------------------------------------------------
    'prop_stabilizer_pulse_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_stabilizer_active');
      // Gyroscopic ring flare step 1
      drawRect(ctx, 8, 12, 16, 8, '#06b6d4');
      drawRect(ctx, 11, 13, 10, 6, '#67e8f9');
      drawRect(ctx, 13, 14, 6, 4, '#ffffff');
      return canvas;
    },
    'prop_stabilizer_pulse_2.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_stabilizer_active');
      // Gyroscopic ring expansion step 2 (core flare)
      drawRect(ctx, 6, 10, 20, 12, '#0891b2');
      drawRect(ctx, 9, 12, 14, 8, '#a5f3fc');
      drawRect(ctx, 12, 13, 8, 6, '#ffffff');
      return canvas;
    },

    // -------------------------------------------------------------
    // Cryo-Vat & Capacitor
    // -------------------------------------------------------------
    'prop_cryo_vat_anim_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_cryo_vat');
      // Bioluminescent bubble 1 rising mid-tank
      setPixel(ctx, 14, 16, '#67e8f9');
      setPixel(ctx, 15, 16, '#ffffff');
      setPixel(ctx, 17, 19, '#22d3ee');
      return canvas;
    },
    'prop_cryo_vat_anim_2.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_cryo_vat');
      // Bioluminescent bubble 2 near meniscus
      setPixel(ctx, 15, 12, '#ffffff');
      setPixel(ctx, 16, 12, '#a5f3fc');
      setPixel(ctx, 13, 14, '#22d3ee');
      return canvas;
    },
    'prop_capacitor_bank_anim_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_capacitor_bank');
      // Electric arc jumping coil 1
      drawRect(ctx, 11, 10, 4, 1, '#fde047');
      drawRect(ctx, 13, 11, 4, 1, '#ffffff');
      setPixel(ctx, 16, 12, '#fde047');
      return canvas;
    },
    'prop_capacitor_bank_anim_2.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_capacitor_bank');
      // High-voltage discharge arc jumping coil 2
      drawRect(ctx, 12, 11, 8, 2, '#ffffff');
      drawRect(ctx, 10, 10, 12, 1, '#fef08a');
      setPixel(ctx, 21, 11, '#fde047');
      return canvas;
    },

    // -------------------------------------------------------------
    // Dead-Drop & Subnet Console
    // -------------------------------------------------------------
    'prop_dead_drop_anim_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_dead_drop');
      // Uplink beacon strobe diode
      drawRect(ctx, 14, 8, 4, 4, '#e11d48');
      setPixel(ctx, 15, 9, '#ffffff');
      setPixel(ctx, 16, 9, '#ffffff');
      return canvas;
    },
    'prop_subnet_console_anim_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_subnet_console');
      // Radar sweep line ping
      drawRect(ctx, 12, 10, 8, 1, '#10b981');
      drawRect(ctx, 15, 11, 4, 1, '#6ee7b7');
      setPixel(ctx, 18, 11, '#ffffff');
      return canvas;
    },

    // -------------------------------------------------------------
    // Safes & Lockers
    // -------------------------------------------------------------
    'prop_safe_locked_blink_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_safe_locked');
      // Amber security diode blink
      drawRect(ctx, 14, 12, 4, 2, '#f59e0b');
      setPixel(ctx, 15, 12, '#ffffff');
      return canvas;
    },
    'prop_locker_blink_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_locker_n');
      // Green locker status diode blink
      drawRect(ctx, 15, 10, 2, 2, '#22c55e');
      setPixel(ctx, 15, 10, '#ffffff');
      return canvas;
    },
    'prop_biocabinet_blink_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('prop_biocabinet_n');
      // Cyan biocabinet status diode blink
      drawRect(ctx, 15, 10, 2, 2, '#06b6d4');
      setPixel(ctx, 15, 10, '#ffffff');
      return canvas;
    },

    // -------------------------------------------------------------
    // World Fixtures (Anchor & Staircase)
    // -------------------------------------------------------------
    'anchor_pulse_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('anchor');
      // Anchor harmonic glow pulse step 1
      drawRect(ctx, 10, 10, 12, 12, '#06b6d4');
      drawRect(ctx, 12, 12, 8, 8, '#67e8f9');
      drawRect(ctx, 14, 14, 4, 4, '#ffffff');
      return canvas;
    },
    'anchor_pulse_2.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('anchor');
      // Anchor harmonic flare step 2
      drawRect(ctx, 8, 8, 16, 16, '#0891b2');
      drawRect(ctx, 11, 11, 10, 10, '#a5f3fc');
      drawRect(ctx, 13, 13, 6, 6, '#ffffff');
      return canvas;
    },
    'staircase_pulse_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('staircase');
      // Chevron chase beacon lit on descent steps
      drawRect(ctx, 12, 14, 8, 2, '#10b981');
      setPixel(ctx, 15, 14, '#ffffff');
      setPixel(ctx, 16, 14, '#ffffff');
      drawRect(ctx, 10, 18, 12, 2, '#34d399');
      return canvas;
    },

    // -------------------------------------------------------------
    // Key Loot Items (Specular Glints)
    // -------------------------------------------------------------
    'item_flux_glint_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('item_flux');
      // High contrast glint on crystalline facet
      drawRect(ctx, 16, 10, 3, 3, '#a5f3fc');
      setPixel(ctx, 17, 11, '#ffffff');
      return canvas;
    },
    'item_potion_glint_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('item_potion');
      // Bright glint on nanite flask
      drawRect(ctx, 13, 11, 3, 3, '#fed7aa');
      setPixel(ctx, 14, 12, '#ffffff');
      return canvas;
    },
    'item_blueprint_glint_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('item_blueprint');
      // Datapad specular highlight swipe
      drawRect(ctx, 14, 12, 4, 2, '#67e8f9');
      setPixel(ctx, 15, 12, '#ffffff');
      return canvas;
    },
    'item_access_key_glint_1.png': () => {
      const { canvas, ctx } = getBaseTileCanvas('item_access_key');
      // Keycard chip / diode glint
      drawRect(ctx, 18, 13, 3, 3, '#fef08a');
      setPixel(ctx, 19, 14, '#ffffff');
      return canvas;
    },
  };

  const fileNames = Object.keys(generators);
  console.log(`Generating ${fileNames.length} procedural animation delta frames...`);

  for (const [filename, genFn] of Object.entries(generators)) {
    const canvas = genFn();
    const outPath = path.join(outDir, filename);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buf);
  }

  console.log(`Successfully generated all ${fileNames.length} frames to ${outDir}`);
}

main().catch((err) => {
  console.error('Fatal error building animation frames:', err);
  process.exit(1);
});
