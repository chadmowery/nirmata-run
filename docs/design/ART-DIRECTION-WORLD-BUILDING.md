# Art Direction, Visual Style & World-Building Specification: "Graphic Brutalism & Nocturnal Chiaroscuro"

> **Status:** Canonical Art Direction & World-Building Specification (v1.0)  
> **Companion Specs:** [`DESIGN-BRIEF.md`](./DESIGN-BRIEF.md) | [`UI-DESIGN-SYSTEM.md`](./UI-DESIGN-SYSTEM.md) | [`DEFERRED-LIGHTING-RENDERING.md`](./DEFERRED-LIGHTING-RENDERING.md) | [`DIRECTIONAL-TILEMAPS.md`](./DIRECTIONAL-TILEMAPS.md) | [`INTERACTIVE-ENVIRONMENTS.md`](./INTERACTIVE-ENVIRONMENTS.md)  
> **Core Creative References:**
> - **Story Scale, Synthetic Materials & Graphic Color Blocking:** Bungie's [*Marathon* (2026)](https://store.steampowered.com/app/3065800/Marathon/?l=polish) & Art Director Joseph Cross's ["Graphic Realism"](https://80.lv/articles/marathon-art-director-shares-the-team-s-creative-influences) ([Behance Reference](https://www.behance.net/gallery/205038723/MARATHON))
> - **Top-Down Perspective, Spindly Proportions & Architectural Scale:** Heart Machine's [*Hyper Light Drifter*](https://store.steampowered.com/app/257850/Hyper_Light_Drifter/) ([Boss & Organic-Tech Design Analysis](https://monitor2.institutoedison.com.br/proceedings/tVwLJ83AD102/Hyper-Light-Drifter_Boss_Concept_Art))
> - **2.5D Pixel Lighting, Volumetric Fog & Specular Atmosphere:** Sad Cat Studios' [*REPLACED*](https://store.steampowered.com/app/1663850/REPLACED/) ([2.5D Lighting Breakdown](https://www.allkeyshop.com/blog/replaced-visual-masterclass-pixel-art-news-l/)) & Odd Tales' [*The Last Night*](https://store.steampowered.com/app/612400/The_Last_Night/)
> - **Megastructure Brutalism & Biomechanical Horror:** Tsutomu Nihei's [*BLAME!*](https://en.wikipedia.org/wiki/Blame!) ([Architectural Scale Analysis](https://www.yokogaomag.com/editorial/infinite-world-of-blame-manga)) & Katsuhiro Otomo's [*Akira*](https://en.wikipedia.org/wiki/Akira_(1988_film)) ([Neo-Tokyo Layered Urbanscape](https://www.thisiscolossal.com/2022/06/akira-architecture-neo-tokyo/))

---

## 1. Executive Summary & Visual Thesis

*Nirmata Runner* transitions from an abstract "cyberspace/system-error" metaphor into a **tactile, physical megastructure scavenging thriller**. Players are disembodied human operators ("Runners") orbiting or stationed in the upper strata of a colossal, self-expanding planetary industrial chasm—**The Nirmata Spindle**—who sleeve their consciousness via high-powered microwave carrier beams into expendable, biomorphic synthetic bodies (**Shells**) to raid its abandoned corporate sub-levels.

Visually, the game synthesizes two seemingly opposite poles into a unified **"Graphic Chiaroscuro"** aesthetic:

1. **Surface & Silhouette DNA ([*Marathon* (2026)](https://store.steampowered.com/app/3065800/Marathon/?l=polish) × [*BLAME!*](https://en.wikipedia.org/wiki/Blame!) × [*Hyper Light Drifter*](https://store.steampowered.com/app/257850/Hyper_Light_Drifter/))**:
   - **Spindly Minimalist Proportions**: Characters and biomechanical threats break out of the squat `32×32` box into tall, long-limbed `32×48` and `48×64` sprites with `1px–2px` articulated limbs, elongated silhouettes, and trailing umbilical/neural cables inspired by [*Hyper Light Drifter*](https://store.steampowered.com/app/257850/Hyper_Light_Drifter/) and Tsutomu Nihei's [*BLAME!*](https://rehnwriter.com/books-and-media/manga/blame-review/).
   - **Graphic Realism Materiality**: Rather than noisy grunge, physical surfaces use clean, high-contrast color blocking, matte ceramic armor plates, translucent PVC tubing, carbon-fiber weave, and bold Swiss-Japanese industrial supergraphics (acid chartreuse `#d8ff00`, signal orange `#ff5500`, chalk ivory `#f4f4f0`, and laser cyan `#00f0ff`).
2. **Atmosphere & Lighting DNA ([*REPLACED*](https://store.steampowered.com/app/1663850/REPLACED/) × [*The Last Night*](https://store.steampowered.com/app/612400/The_Last_Night/))**:
   - **Nocturnal Volumetric Chiaroscuro**: Those bold graphic surfaces do not sit under flat daylight; they emerge from deep, shadowy megastructure gloom through **2.5D normal-mapped rim lighting, Dual-Kawase HDR emissive bloom, wet specular floor reflections, and low-lying volumetric mist**.
   - **Multi-Plane Abyssal Depth**: Instead of surrounding rooms with flat black `#000000` tiles, walkways and chambers are suspended over bottomless [*BLAME!*](https://www.yokogaomag.com/editorial/infinite-world-of-blame-manga)-scale architectural shafts with multi-layer background parallax fading into dense atmospheric fog and foreground overhead gantry trusses passing across the camera.

---

## 2. World-Building: The Nirmata Spindle & Physicalized Lore

### 2.1 The Setting: The Nirmata Spindle ("The Stratosphere Pit")

In the late 22nd century, four hyper-corporations—**Traxus Heavy Foundry**, **Sekiguchi Gene-Labs**, **CyberAcme Systems**, and **NuCaloric Bio-Logistics** (operating under the joint **Taikoku Vector** charter)—excavated and constructed **The Nirmata Spindle**: a 15-stratum vertical industrial megastructure bored miles into a planetary crust to harvest geothermal flux and synthesize autonomous biosynthetic labor.

Like the runaway automated builders of Tsutomu Nihei's [*BLAME!*](https://en.wikipedia.org/wiki/Blame!), the Spindle's automated fabrication arrays and biomechanical custodians continued expanding and sealing sectors long after a catastrophic containment cascade forced human executives to evacuate. Today, the Spindle is a silent, self-modifying vertical tomb of miles-deep concrete shafts, molten slag foundries, flooded cryo-cleanrooms, and humming server canyons.

### 2.2 Consciousness Casting & The Physical Shell Loop

Human bodies cannot survive the radiation, atmospheric pressure, and autonomous security interdiction of the Spindle's lower strata.
* **The Neural Deck (Upper Orbit / Surface Bunker)**: The player's biological body remains sealed in an interface pod inside the **Neural Deck**.
* **Biomorphic Shells (`VANGUARD`, `BASTION`, `GHOST`)**: Using [Bungie's *Marathon*](https://store.steampowered.com/app/3065800/Marathon/?l=polish) paradigm of synthetic vessels, the Runner's consciousness is transmitted downward via a high-frequency quantum carrier beam into a physical, mass-produced synthetic **Shell** assembled from ballistic ceramic, synthetic white muscle fiber, titanium bone-lace, and optical polymer.
* **Why the "Weekly One-Shot" Exists in Lore**: Once a week, the Spindle's upper orbital aperture aligns directly over the **Primary Extraction Shaft** (the `WEEKLY` seed), allowing a single fully-licensed, high-bandwidth physical Shell drop into the unmapped deep vaults. `SIMULATION` runs represent low-priority salvage drops into peripheral industrial shafts using surplus chassis stock.

### 2.3 Narrative-to-Mechanics Mapping (Re-Grounding Existing ECS Systems)

To keep 100% compatibility with your existing codebase, schemas, and file names while shifting the world firmly into **physical megastructure scavenging**, all existing mechanics map to physical phenomena inside the Spindle:

| Existing Mechanic / Code ID | Physical Megastructure Reality (In-World Lore) | Visual & Atmospheric Expression |
| :--- | :--- | :--- |
| **Reality Stability** (`Stability` component) | **Carrier Tether Coherence**: The signal integrity of the microwave/quantum beam locking the Runner's mind into the physical Shell through miles of reinforced concrete and Faraday interference. At `0%`, the signal drops (**Link Severed**) and the physical Shell goes catatonic. | As Coherence drops below `50%`, the Shell's optical sensor feed experiences tracking jitter, chromatic edge bleed, and narrowing peripheral vision radius. |
| **Stability Anchor** (`anchor.json`, Floors 5/10/15) | **Hardline Tether Pylon & Freight Drop-Pod**: A physical laser-comm relay and pneumatic cargo elevator bored into the megastructure shaft. Allows the Runner to either **Flush Cargo & Sever Link** (extracting physical loot via the high-speed freight tube) or **Boost Carrier Signal** to descend another 5 strata. | A towering octahedral cyan crystal/laser spire wired into the ceiling shaft with thick black umbilical cables, casting a `224px` pulsing cyan volumetric glow across the floor. |
| **Neural Heat & Kernel Panic** (`Heat` component) | **Cortex Thermal Load**: Running high-voltage combat **Firmware** (`Phase_Shift.sh`, `Neural_Spike.exe`) through a synthetic Shell's wetware brain generates extreme physical heat. Above `100%`, the synthetic brain suffers thermal seizure (`HUD_GLITCH`, `FIRMWARE_LOCK`, `CRITICAL_REBOOT`), venting superheated orange steam from neck/spine louvers. | The Shell's personal omnidirectional light shifts from cool optical white (`#e0f7ff`) to furnace amber (`#ff9500`) and violent magenta (`#ff0055`), while physical steam and embers vent from the sprite's dorsal ports. |
| **Firmware, Augments & Software** | **Combat Cortex Drivers & Hardware Interlocks**: Physical solid-state ROM cartridges, hydraulic reflex bridges (`.arc`), and ballistic targeting coprocessors slotted directly into the Shell's cranial and spinal sockets. | Represented as physical industrial cassette cartridges, gold-pinned PCBs, and fiber-optic splice modules in the *Taikoku Vector Manifest* UI. |
| **Corrupted Nodes & Dead Zones** (`CorruptedNode`, `DeadZone`) | **Booby-Trapped Salvage & Slag/Radiation Leaks**: Overloaded capacitor terminals, ruptured cryo-lines, and electrified floor grates left behind by feral maintenance rigs. | Cracked floor plating leaking glowing magenta coolant, arcing high-voltage sparks, and volumetric toxic vapor plumes. |

### 2.4 Re-Imagining the Bestiary: From "Software Bugs" to Physical Biomechanical Horrors

The ECS template keys (`null-pointer`, `buffer-overflow`, `fragmenter`, `logic-leaker`, `seed-eater`, `system-admin`) remain unchanged in code, but in the world of *Nirmata Runner*, they are **terrifying physical constructs**—autonomous security frames, spliced bio-synthetic lab horrors, and rogue industrial machinery named after the diagnostic fault codes they trigger on a Runner's HUD:

| ECS Template ID | Tier | Physical Megastructure Identity | Silhouette, Proportions & Lighting Signature |
| :--- | :---: | :--- | :--- |
| **`null-pointer`**<br>*(Phase-Stalker)* | **T1** | **Severed-Spine Recon Hound**: A gaunt, feral infiltration chassis stripped down to an exposed carbon-fiber ribcage, articulated digitigrade legs, a cracked white porcelain skull plate, and whipping dorsal optical cables. | `32×48` hunched spindly silhouette; three flickering `#00f0ff` cyan optical lenses; leaves brief phase-displacement afterimages when executing its backstab teleport. |
| **`buffer-overflow`**<br>*(Volatile Drone Pack)* | **T1** | **Overpressurized Munitions / Coolant Tick**: Bipedal, long-legged walking thermal canisters originally built to haul volatile plasma fuel across Traxus catwalks. | `32×36` insectoid frame with a bloated, glowing `#ff6600` / `#ff0055` pressurized glass thorax that strobes faster as 3+ units surround the player to detonate. |
| **`fragmenter`**<br>*(Heavy Siege Rig)* | **T2** | **Autonomous Pile-Driver & Demolition Frame**: A towering, broad-shouldered industrial exosuit fused with swollen synthetic muscle bundles and twin pneumatic demolition rams that shatter floor plating on impact. | `48×64` hulking silhouette with a tiny sunken sensor head, heavy graphite armor plates, and `#ff0055` molten hydraulic slag dripping from its forearms onto adjacent tiles (`DeadZone`). |
| **`logic-leaker`**<br>*(EMP/Neuro-Spitter)* | **T2** | **Sekiguchi Spliced Bio-Artillery Specimen**: An elongated, mantis-like biomechanical hybrid with four spindly stilt-legs, a translucent neon-green/magenta dorsal sac, and a cranial microwave emitter that jams Shell wetware (`FIRMWARE_LOCK`). | `32×52` tall, razor-thin silhouette; glowing bioluminescent sac (`Emissive = 0.9`); fires concentrated arcs of neural-scrambling static from behind low cover. |
| **`seed-eater`**<br>*(Tectonic Harvester)* | **T3** | **Runaway Megastructure Builder / Excavator**: Inspired directly by the rogue Builders of [*BLAME!*](https://en.wikipedia.org/wiki/Blame/), a multi-limbed biomechanical earth-shaper that chews up floor plating and extrudes rapid-setting brutalist concrete walls (`TileCorruptionSystem`). | `48×64` arachnid/industrial amalgam trailing dozens of black feeder hoses; glowing ultraviolet/crimson furnace core that illuminates the walls it extrudes. |
| **`system-admin`**<br>*(The Inquisitor)* | **T3** | **Taikoku High-Stratum Custodian**: An invulnerable, hovering monolithic executioner unit draped in hundreds of trailing black umbilical cables, crowned by a blinding white-hot gravimetric halo core (`#ffffff`) and angular ivory ceramic plates. | `48×72` levitating vertical monolith (`Height Z = 28px`); casts a massive, stark `#ffffff` / `#ff0055` spotlight that sweeps across rooms and crushes cover crates in its path. |

---

## 3. Top-Down Perspective & Spatial Architecture: Breaking the `32×32` Box

To achieve the breathtaking environmental scale of [*Hyper Light Drifter*](https://store.steampowered.com/app/257850/Hyper_Light_Drifter/) and the cinematic depth of [*REPLACED*](https://store.steampowered.com/app/1663850/REPLACED/) and [*The Last Night*](https://store.steampowered.com/app/612400/The_Last_Night/) inside a turn-based grid roguelike, *Nirmata Runner* adopts a **3/4 Oblique Orthographic Top-Down Projection** with **Decoupled Sprite Footprints** and **4 Depth Planes**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PLANE +1: FOREGROUND OCCLUDER PARALLAX (Scroll: 1.18x, Z-Height > 32px) │
│   • Dark silhouetted overhead gantry beams, swaying umbilical cables    │
├─────────────────────────────────────────────────────────────────────────┤
│ PLANE 0: PLAYABLE TACTICAL DECK (Scroll: 1.00x, 32×32 Logical Grid)     │
│   • Multi-tile vertical walls (64px–96px tall front faces)              │
│   • Y-sorted tall spindly entities (32×48 / 48×64 anchored at feet)     │
│   • Normal-mapped floor tiles, wet specular puddles, low-lying cryo fog │
├─────────────────────────────────────────────────────────────────────────┤
│ PLANE -1: SUB-WALKWAY STRUCTURAL STRUTS (Scroll: 0.92x)                 │
│   • Concrete bridge piers, hanging pipes, under-floor maintenance leds  │
├─────────────────────────────────────────────────────────────────────────┤
│ PLANE -2 / -3: ABYSSAL MEGASTRUCTURE CHASM (Scroll: 0.75x–0.85x)        │
│   • Endless vertical shafts, distant lit windows, volumetric chasm mist │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Decoupling Logical Grid (`32×32`) from Visual Sprite Height (`32×48` to `48×96`)

In the ECS engine ([`src/engine/grid/grid.ts`](../../src/engine/grid/grid.ts)), every walkable tile, cover crate, and actor continues to occupy a clean **`32×32` logical collision tile**. However, in [`src/rendering/`](../../src/rendering/):
1. **Bottom-Center Sprite Anchoring (`anchor.set(0.5, 1.0)`)**:
   - Character, enemy, and tall prop sprites use `anchor.set(0.5, 1.0)` positioned at the bottom-center of their `32×32` logical tile (`x = tileX * 32 + 16`, `y = (tileY + 1) * 32 - 2`).
   - A Runner sprite measuring **`32×48` px** (or a tall Cryo-Vat measuring **`32×64` px**) stands upright on its `32×32` floor tile while its upper torso and head extend `16–32px` upward into the visual space of the tile to the North (`tileY - 1`).
2. **Strict Y-Sorting (`zIndex = tileY * 10 + layerOffset`)**:
   - Enabling `sortableChildren = true` on `entityLayer` and `itemLayer` ensures that an operative standing at `y = 10` naturally overlaps the base of a wall or vat at `y = 9`, while walking behind a crate or pillar at `y = 11` gets cleanly occluded from the knees down.

### 3.2 Multi-Tile Verticality: `2-Tile` and `3-Tile` Tall Bulkheads

Flat `32×32` top-down walls look like board-game blocks. In a 3/4 oblique view inspired by [*Hyper Light Drifter*](https://store.steampowered.com/app/257850/Hyper_Light_Drifter/) and [*Marathon* (2026)](https://store.steampowered.com/app/3065800/Marathon/?l=polish):
* **South-Facing Wall Fronts (`wall_front_tall`)**: Whenever a wall tile has walkable floor to its South (`y + 1`), its visual facade renders as a **`2-tile` (`32×64` px) or `3-tile` (`32×96` px) vertical bulkhead face** capped by a crisp dark roof lip at the top.
* **Constructivist Supergraphics on Tall Walls**: That `64px–96px` vertical wall face provides the canvas for [*Marathon*](https://www.behance.net/gallery/205038723/MARATHON)-style graphic realism—massive diagonal hazard stripes (`#d8ff00` / `#ff5500`), oversized stenciled sector numbers (`04`, `B-12`), vertical Japanese industrial kanji (`対空`, `危険`), recessed ventilation louvers, and vertical cable trunks that cast normal-mapped relief shadows.

### 3.3 Abyssal Walkways & Multi-Layer Chasm Parallax

Instead of filling non-walkable void areas outside rooms and corridors with flat `#000000`, the Spindle's floors are framed as **suspended brutalist platforms and narrow catwalks spanning a bottomless chasm**:
* **Walkway Edge Aprons (`floor_edge_s`, `floor_edge_e`, `floor_edge_w`)**: Walkable tiles bordering empty void tiles automatically receive a `32×48` concrete/steel edge skirt and yellow safety-line trim (`#ffd600`), showing the thick structural slab supporting the floor.
* **Sub-Structure Pylons & Chasm Fog (Planes `-1` to `-3`)**:
  - Beneath the walkway edge, concrete support columns descend into the dark, gradually obscured by a **vertical depth-fog gradient** (`#040609` $\to$ `#0d1829`) and drifting procedural volumetric mist clouds.
  - Distant background megastructure shafts scroll at `0.80x` camera speed, dotted with tiny flickering amber/cyan maintenance diodes miles below to sell the dizzying vertical scale of [*BLAME!*](https://www.yokogaomag.com/editorial/infinite-world-of-blame-manga).
* **Foreground Gantry Parallax (Plane `+1`)**:
  - Out-of-focus, pure-black (`#020305` with subtle rim-lit edges) structural I-beams, overhead crane rails, and swaying umbilical cable bundles sit in a foreground container scrolling at **`1.18x` camera speed** across the top/corners of the viewport (`alpha = 0.85`, auto-fading to `0.2` if they overlap the player's tile). This single technique from [*REPLACED*](https://store.steampowered.com/app/1663850/REPLACED/) and [*The Last Night*](https://store.steampowered.com/app/612400/The_Last_Night/) immediately makes the camera feel like it is peering *down through* a dense 3D industrial space rather than looking at a flat 2D board.

---

## 4. Character & Biomechanical Design Language

### 4.1 The Spindly Minimalist Pixel Standard (`32×48` Base Canvas)

Characters in *Nirmata Runner* reject chibi/bobblehead pixel-art proportions in favor of **anatomical elongation and stark graphic minimalism**:

* **Head-to-Body Ratio (`1 : 6.5` in `42–46px` standing height)**:
  - **Head (`5×6` px)**: Featureless, geometric helmet visor or synthetic porcelain skull plate. No facial pixels—identity is communicated entirely through helmet geometry, visor color, and trailing cranial cables.
  - **Torso (`8×12` px)**: Broad, angular collarbone/shoulder pads tapering sharply into a narrow, exposed carbon-fiber waist (`3–4px` wide).
  - **Limbs (`1px–2px` wide, elongated)**: Arms and legs are drawn as crisp `1px` or `2px` kinematic lines with high-contrast knee/elbow joint pixels (`#ffffff` or `#d8ff00` specular dots). This allows fluid, expressive poses (wide tactical stances, sword/rifle bracing, hunched stalking) with minimal pixel noise.
  - **Secondary Motion Appendages**: Every Shell and elite construct features a trailing physical element—synthetic neural ribbon cables (`VANGUARD`), heavy articulated blast-pauldron vents (`BASTION`), or a split optical-fiber mantle (`GHOST`)—that lags 1–2 pixels behind movement direction.

### 4.2 Runner Shell Visual Profiles

1. **`VANGUARD-v1` (High-Mobility Strike Shell)**:
   - **Materials**: Matte chalk-ivory (`#f4f4f0`) biomorphic ceramic breastplate and thigh guards over a jet-black (`#0a0e15`) synthetic muscle bodysuit.
   - **Graphic Accent**: Full-face convex visor and knee/shoulder trim in **Taikoku Acid Chartreuse (`#d8ff00`)** (`Emissive = 1.0`).
   - **Manga / Biomechanical Detail**: Four long, whip-like chartreuse/black neural cooling ribbons (`1px` wide) streaming from the base of the occiput.
2. **`BASTION-v1` (Heavy Breach & Fortification Shell)**:
   - **Materials**: Broad, brutalist gunmetal graphite (`#262c36`) composite armor plates with exposed hydraulic piston struts along the forearms and calves.
   - **Graphic Accent**: Oversized, high-collared **Signal Orange (`#ff5500`)** blast shield framing a narrow horizontal crimson/amber optic slit.
   - **Manga / Biomechanical Detail**: Top-heavy [*Akira*](https://en.wikipedia.org/wiki/Akira_(1988_film)) / industrial hardsuit silhouette (`36×48` px) with dual dorsal exhaust stacks that vent normal-mapped steam plumes.
3. **`GHOST-v1` (Stealth & Wetware Infiltrator Shell)**:
   - **Materials**: Exposed dark carbon-fiber skeletal ribcage and spine paired with a gaunt, articulated **porcelain-white skull faceplate** (`#f4f4f0`).
   - **Graphic Accent**: **Solaris Laser Cyan (`#00f0ff`)** synaptic fluid veins running down the clavicles, ribs, and `1px` femurs.
   - **Manga / Biomechanical Detail**: Pure Tsutomu Nihei [*BLAME!*](https://rehnwriter.com/books-and-media/manga/blame-review/) / [*Ghost in the Shell*](https://www.stirworld.com/think-books-and-movies-stefan-riekeles-on-anime-architecture-and-neo-tokyo-s-layered-dystopian-urbanscape) aesthetic—an eerily skeletal, almost fragile synthetic frame that moves with unnatural surgical precision.

---

## 5. Lighting, Atmosphere & Corporate Sector Biomes

### 5.1 The "Graphic Chiaroscuro" Lighting Formula

How do we combine [*Marathon* (2026)](https://store.steampowered.com/app/3065800/Marathon/?l=polish)'s vibrant, saturated graphic colors with [*REPLACED*](https://store.steampowered.com/app/1663850/REPLACED/) and [*The Last Night*](https://store.steampowered.com/app/612400/The_Last_Night/)'s moody nocturnal lighting without turning the screen into muddy brown or flat neon cartoons?

The answer is **Strict Separation of Albedo Saturation and Ambient Darkness**:
1. **Dark, Moody Ambient Base (`Intensity: 0.12–0.18`)**: Rooms are never uniformly lit. Unlit corners drop into deep, cool slate-black or warm soot-black shadow.
2. **Uncompromised Graphic Albedo Under Direct Light**: When a point light, volumetric shaft, or Shell aura hits a wall or prop, the underlying diffuse texture reveals **100%-saturated *Marathon* graphic color blocks** (chalk white `#f4f4f0`, acid lime `#d8ff00`, signal orange `#ff5500`, magenta `#ff0055`).
3. **Strong Grazing Rim Lights**: Because wall faces, props, and character sprites carry tangent-space normal maps (`_n.png` with strong bevel normals at silhouette edges), lights positioned across the room carve out razor-sharp **1px–2px specular rim highlights** along the shoulders of spindly enemies and the edges of concrete pillars.
4. **Wet Specular Floor Reflections (`Specular = 0.70–0.90`, `Roughness = 0.15–0.35`)**:
   - Floor tiles feature selective high-specularity masks (condensation puddles on Traxus steel, polished ceramic glaze in Sekiguchi labs, glass floor buses in CyberAcme).
   - Emissive props (Cryo-Vats, Tether Anchors, neon hazard strips) and enemy cores cast vertically stretched, rippled specular reflections onto the floor tiles directly in front of them.
5. **Low-Lying Volumetric Mist & Light Shafts**:
   - Diagonal volumetric light beams (god-rays) angle down from high megastructure vents at `65°`, illuminating drifting dust motes and normal-mapped ground fog that pools around character ankles (`Height Z = 0..8px`).

### 5.2 Corporate Sector Biome Matrix

Each of the four corporate factions transforms the visual mood, architectural geometry, surface specularity, and volumetric atmosphere of the Spindle:

| Biome Dimension | 1. Traxus Heavy Foundry<br>*(Industrial Smelting & Freight)* | 2. Sekiguchi Gene-Labs<br>*(Biomorphic Cleanroom & Cryo)* | 3. CyberAcme Mainframe<br>*(Quantum Server Canyon)* | 4. NuCaloric Bio-Storage<br>*(Synthetic Nutrient Vats)* |
| :--- | :--- | :--- | :--- | :--- |
| **Architectural Archetype** | Brutalist cast-iron catwalks, riveted blast bulkheads, open grating suspended over rivers of molten slag. | Sterile modular porcelain cleanrooms, seamless frosted-glass partitions, tall cylindrical bio-vats. | Monolithic black-glass server towers, narrow 1-tile maintenance bridges over bottomless cooling shafts. | Massive cylindrical polymer silos, tangled overhead nutrient pipes, refrigerated airlocks. |
| **Base Shadow / Ambient** | Smoky Foundry Soot (`#160d08`, `Intensity: 0.14`) | Surgical Deep Teal (`#061a1e`, `Intensity: 0.18`) | Carbon Abyssal Navy (`#050a18`, `Intensity: 0.12`) | Cold Violet-Slate (`#14091a`, `Intensity: 0.16`) |
| **Graphic Albedo Blocks** | weathered gunmetal `#2b303a`, signal orange `#ff5500`, caution yellow `#ffd600`. | Stark surgical ivory `#f4f4f0`, slate grey `#334155`, crimson hazard bands `#ff2a4b`. | Matte obsidian `#0f172a`, chalk white `#f4f4f0` serial stencils, cobalt blue `#0066ff`. | Bone-white PVC `#f0ece1`, acid chartreuse `#d8ff00`, hyper-magenta `#ff0055`. |
| **Dominant Emissive & Bloom** | Molten slag channels (`#ff5500` / `#ffaa00`), sodium-vapor overhead floodlights. | Bioluminescent emerald (`#10b981`) and cyan (`#00f0ff`) cryo-fluid columns. | Laser cyan (`#00f0ff`) fiber-optic floor traces, violet (`#818cf8`) capacitor arcs. | Pulsing magenta (`#ff0055`) and chartreuse (`#d8ff00`) translucent nutrient tubes. |
| **Floor Specularity & Reflections** | Oily puddles (`S = 0.85`) amidst matte rusted diamond-tread steel (`S = 0.25`). | Mirror-like wet surgical ceramic tiles (`S = 0.90, Rg = 0.12`) reflecting vats and characters. | Tempered glass floor channels (`S = 0.95`) over glowing data buses. | Frosted polymer decking (`S = 0.55`) with slick condensation trails. |
| **Volumetric Atmosphere** | Rising orange embers, heat distortion shimmer, thick dark-grey exhaust steam plumes. | Low-lying cold emerald/white cryo-mist pooling across the floor and swirling when stepped through. | Crisp diagonal cyan spotlight shafts cutting through dark, dust-flecked air. | Dense refrigerated white/magenta vapor pouring from ceiling cooling vents. |

---

## 6. Concept Visuals & Art Direction Plates

The following four concept plates illustrate how *Nirmata Runner*'s world-building, 3/4 oblique perspective, spindly character scale, and volumetric lighting come together in practice.

### 6.1 Concept Plate 1: Abyssal Megastructure Catwalk & Tactical Breach
*Demonstrates the 3/4 oblique top-down camera, multi-tile tall bulkheads with **Marathon (2026)** acid-chartreuse/orange graphic markings, foreground parallax gantry beams/cables, bottomless **BLAME!** chasm mist, wet floor reflections, and **Hyper Light Drifter**-scale spindly Runner vs. Null-Pointer stalkers.*

![Abyssal Megastructure Catwalk Mockup](watermarked_img_2590727502806577676.jpg)

### 6.2 Concept Plate 2: Sekiguchi Gene-Labs Cleanroom & Tether Anchor
*Demonstrates how sterile surgical-white architecture interacts with **REPLACED / The Last Night** nocturnal lighting, mirror-like specular floor reflections, normal-mapped ground cryo-mist, an octahedral cyan Tether Anchor (`anchor.json`), and a towering biomechanical `Fragmenter` construct lurking in the shadows.*

![Sekiguchi Gene-Labs Cleanroom Mockup](watermarked_img_9594035196980791450.jpg)

### 6.3 Concept Plate 3: Corporate Sector Biome & Lighting Moodboard
*Compares the dramatic shift in color script, volumetric fog, emissive bloom, and megastructure architecture across all four corporate factions (**Traxus Heavy Foundry**, **Sekiguchi Gene-Labs**, **CyberAcme Mainframe**, and **NuCaloric Bio-Storage**).*

![4-Faction Corporate Biome Moodboard](watermarked_img_13875928006620938260.jpg)

### 6.4 Concept Plate 4: Spindly Biomechanical Shell & Enemy Silhouette Sheet
*Establishes the elongated `1px–2px` limb proportions, synthetic ceramic/PVC color blocking, exposed carbon-fiber ribcages, and trailing umbilical cables for the three Runner Shells (`VANGUARD`, `BASTION`, `GHOST`) and three physicalized Megastructure Threats (`Stalker / Null-Pointer`, `Siege Construct / Fragmenter`, `Custodian / System-Admin`).*

![Spindly Biomechanical Character & Enemy Sheet](watermarked_img_12240624312266687342.jpg)

---

## 7. Technical Rendering & Asset Pipeline Evolution (PixiJS 8)

To realize this art direction inside the existing PixiJS 8 WebGL2 architecture ([`DEFERRED-LIGHTING-RENDERING.md`](./DEFERRED-LIGHTING-RENDERING.md) & [`DIRECTIONAL-TILEMAPS.md`](./DIRECTIONAL-TILEMAPS.md)), we extend the rendering pipeline with five targeted upgrades:

### 7.1 Variable-Height Atlas Frames (`32×48` & `32×64` Support)
* **Current State**: [`TILEMAP_GUIDE.md`](../TILEMAP_GUIDE.md) assumes every frame in `tileset.json` is strictly `32×32`.
* **Upgrade**:
  - Keep the **logical grid cell** at `TILE_SIZE = 32` (`80×45` grid).
  - Allow `FrameDefSchema` in `tileset.json` to specify `h: 48` or `h: 64` for tall sprites (`player_*`, `enemy_*`, `prop_cryo_vat`, `prop_locker`, `anchor`, and `wall_front_tall`).
  - Set `sprite.anchor.set(0.5, 1.0)` and position sprites at the bottom-center of their logical tile (`x = gridX * 32 + 16`, `y = (gridY + 1) * 32`) with `sortableChildren = true` (`zIndex = gridY * 10 + subLayer`).

### 7.2 Multi-Plane Parallax Containers (`src/rendering/layers.ts`)
Expand the scene graph in [`src/rendering/layers.ts`](../../src/rendering/layers.ts) from 4 flat layers to include abyssal and foreground depth planes:
1. **`abyssalVoidLayer` (Plane `-2`)**: Renders behind `terrainLayer` where `grid.getTile(x, y)` is empty void. Uses a scrolling tiling sprite + procedural chasm shafts at `0.80x` camera offset, shaded with vertical depth fog.
2. **`subStructureLayer` (Plane `-1`)**: Renders concrete bridge piers and under-walkway skirts (`floor_edge_s`) directly beneath walkable floor edges.
3. **`terrainLayer` / `itemLayer` / `entityLayer` (Plane `0`)**: The core G-Buffer lit playable deck (`1.00x` camera offset).
4. **`groundFogLayer` (Plane `0.5`)**: Low-lying dual-scroll noise/particle vapor layer (`Height Z = 4px`) that samples `uLightData` in the deferred lighting shader so cryo-mist and foundry steam glow in the exact color of nearby vats, anchors, and shells.
5. **`foregroundParallaxLayer` (Plane `+1`)**: Renders after the lighting pass at `1.18x` camera offset. Draws silhouetted overhead steel trusses and hanging cable bundles (`#030508` with subtle ambient rim tint) that automatically fade their alpha when overlapping the player's screen-space radius.

### 7.3 Wet Specular Floor Reflections & Grazing Rim Term
In the single-pass Deferred Uber-Lighting Shader ([`DEFERRED-LIGHTING-RENDERING.md`](./DEFERRED-LIGHTING-RENDERING.md) Section 3.2):
1. **Screen-Space Vertical Emissive Reflection**: For floor pixels (`Height Z <= 2px`) with high specularity (`S > 0.6`), sample `albedoTexture` and `materialHeightTexture.r` (`Emissive`) at vertically mirrored screen offsets `(uv.x + rippleNoise, uv.y - offset)` to render soft, wet vertical reflections of glowing Cryo-Vats, Tether Anchors, and Runner visors on the floor tiles in front of them.
2. **Fresnel Rim-Light Boost**: Add a grazing-angle rim term $I_{\text{rim}} = (1.0 - N_z)^2 \cdot \max(0.0, \vec{N}_{xy} \cdot \vec{L}_{xy})$ weighted by light intensity so tall character silhouettes and multi-tile walls catch dramatic [*REPLACED*](https://store.steampowered.com/app/1663850/REPLACED/)-style edge highlights against dark backgrounds.
