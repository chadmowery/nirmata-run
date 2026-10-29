# Nirmata Runner — Visual Style Mockups & Architectural Paradigms

A self-contained design showcase demonstrating **35 distinct visual styles and layout architectures** for *Nirmata Runner*, covering both the **In-Game HUD** and the **Out-of-Game Workshop**.

> [!TIP]
> For instructions on building 2D tilesets and spritesheets matching these mockup themes, see the [Tilemap & Tileset Creation Guide](../TILEMAP_GUIDE.md).

---

## 1. Quick Start

### Viewing the Mockups
Open [`index.html`](./index.html) directly in any web browser:
```bash
# macOS
open docs/mocks/index.html

# Linux
xdg-open docs/mocks/index.html

# Windows
start docs/mocks/index.html
```

Or view via the local Next.js dev server if running:
```bash
http://localhost:3000/docs/mocks/index.html
```

---

## 2. Directory Structure

Everything needed for the visual mockups is self-contained within this directory:

```
docs/mocks/
├── index.html            # Standalone single-file interactive viewer (all 35 styles)
├── build.cjs             # Standalone compiler script (rebuilds index.html)
├── README.md             # This document
├── src/                  # Modular source components used by build.cjs
│   ├── themes-data.cjs              # 35 themes metadata registry
│   ├── styles-base.cjs              # Shared CSS, typography, base tokens (Styles 1-25)
│   ├── styles-bespoke.cjs           # Bespoke layout CSS & rules (Styles 26-35)
│   ├── shared-hud.html              # Shared HUD HTML template (Styles 1-25)
│   ├── shared-workshop.html         # Shared Workshop HTML template (Styles 1-25)
│   ├── templates-bespoke-hud.cjs    # 10 Bespoke HUD HTML templates (Styles 26-35)
│   ├── templates-bespoke-workshop.cjs # 10 Bespoke Workshop HTML templates (Styles 26-35)
│   └── client-script.cjs            # Client-side state & interactive simulation engine
└── screenshots/          # Exported visual screenshots
```

---

## 3. Rebuilding the Showcase

If you modify any of the source modules in [`src/`](./src/), recompile [`index.html`](./index.html) by running:

```bash
node docs/mocks/build.cjs
```

---

## 4. The 35 Styles Overview

The collection is organized into three distinct series accessible via the top filter tabs:

### ★ Series 3: Bespoke Megacorp, Manga & AI Cyborg (Styles 26–35)
Each style in Series 3 features a **completely custom HTML DOM layout and wireframe** for both HUD and Workshop:
- **26. Taikoku Industrial Manifest**: Asymmetric L-frame constructivist packaging, vertical barcode ladder, inspection placards, bilingual kanji (*Marathon* / Antireal).
- **27. Ghost-Dive Cyber-Brain**: Center anatomical cyborg wireframe, 4-jack spinal cable bus, real-time EEG brainwave header (*Ghost in the Shell*).
- **28. Seinen Manga Action Panels**: 5° angled non-orthogonal comic gutters, halftone screentones, radiating speedlines, floating katakana SFX (*Akira* / *BLAME!*).
- **29. Zaibatsu Biotech Clinical Lab**: Animated SVG EKG cardiac wave, vertical glass IV ampoules, circular microscope petri reticle (Cleanroom / ICU).
- **30. Chiba Back-Alley Ripperdoc**: Crooked bolted sheet-metal plates, rivets, duct-tape patches, buzzing neon kanji (*Neuromancer* / Cyberpunk).
- **31. Neo-Tokyo Metro Transit**: Top subway station route tracker, Suica IC contactless tap gate, platform LED departure boards (Tokyo Metro).
- **32. NERV Hex-Canopy HUD**: Interlocking hexagonal honeycomb canopy, MAGI supercomputer tri-core consensus matrix (*Evangelion*).
- **33. Megacorp High-Frequency Trading**: Continuous perforated tractor-feed computer paper margins, live scrolling stock ticker ribbons, L2 order book (Bloomberg / Wall St).
- **34. 3D Volumetric Holo-Podium**: Perspective-tilted 3D holographic tactical map hovering over a brushed titanium emitter disc (*Prometheus*).
- **35. DEFCON Orbital Drone Recon**: Full-screen military sniper / drone gunship optics, orbital ephemeris coordinates, flashing DEFCON 2 badge (Space Force / NORAD).

### Series 2: Experimental UI Paradigms (Styles 16–25)
- **16. Orbital Radial Cockpit**: Concentric circular meters and curved polar dials.
- **17. Mech Dashboard Console**: 60% windshield / 40% armored physical mech dashboard.
- **18. Floating Diegetic AR**: Minimalist, zero-border holographic glass projection.
- **19. CCTV Security Matrix**: Multi-monitor CRT surveillance camera feeds with timecodes.
- **20. 90s Bottom Status Bar**: Classic 1993 Doom/Quake monolithic bottom bar with animated runner face.
- **21. Vertical Data-Sleeve**: Wrist-mounted cyberdeck tactical PDA column.
- **22. Hex Disassembler IDE**: Wireshark / Ghidra reverse-engineering memory dumps.
- **23. Swiss Asymmetric Zine**: David Carson / *Ray Gun* avant-garde experimental typography.
- **24. Modular Eurorack Synth**: 19-inch aluminum audio rack with potentiometer knobs and VU meters.
- **25. Handheld Cyber-Console**: Ruggedized dot-matrix LCD handheld cyberdeck casing with D-pad.

### Series 1: Foundations (Styles 1–15)
- **1. Marathon Protocol**: Swiss Brutalism, high-contrast acid chartreuse (#D8FF00) & surgical cyan.
- **2. Cogmind CRT**: Pure monospace ASCII double-line box frames & phosphor glow.
- **3. Clinical Void**: High-fashion titanium whiteout framing on obsidian void.
- **4. Overheat Glitch**: Chromatic aberration, fractured headers & RGB shift.
- **5. Cassette Mil-Spec**: 1970s analog tactile hardware, 7-segment LED counters & amber lamps.
- **6. Solaris Vector**: 1px oscilloscope laser wireframe line art.
- **7. Acid Safety**: Heavy machinery freight loader gantry with hazard yellow caution stripes.
- **8. Solar Flare**: Thermal infrared FLIR false-color spectrometry.
- **9. Tokyo Cyber-Market**: Akihabara dense hacker TTY terminal.
- **10. Avionics Cockpit**: F-35 5th-gen fighter collimated panoramic HUD.
- **11. Neo-Brutalist**: Bauhaus Swiss Grid 2.0 with bold typography and heavy borders.
- **12. Biomechanical**: H.R. Giger alien chitin bone plates and acid xenomorph blood.
- **13. Apollo Control**: 1969 NASA mission control annunciator split-flap banks.
- **14. Synthwave Grid**: Outrun neon magenta and cyan plasma horizon glow.
- **15. Classified Dossier**: Manila military intelligence dossier with red rubber stamps.

---

## 5. Interactive Simulation Controls

- **Step Turn (`Z`)**: Advances the turn clock, vents passive heat, and simulates Reality Anchor stability bleed.
- **Phase Shift (`1`)**: Simulates mobility evasion (+25 Neural Heat).
- **Neural Spike (`2`)**: Simulates direct kinetic attack (+35 Neural Heat).
- **Vent Heat (`W`)**: Simulates core displacement cooling (-30 Neural Heat).
- **Take Damage**: Simulates incoming hostile damage (-4 HP).
- **View Toggle**: Switch between `🎮 HUD`, `🛠️ Workshop`, and `📑 Split` view.
- **Specs Modal**: Full design tokens, color swatches, font pairings, and layout specifications for all 35 styles.
