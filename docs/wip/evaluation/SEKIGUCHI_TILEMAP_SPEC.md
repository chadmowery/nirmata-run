# Sekiguchi Subterranean Cleanroom: Procedural Prefab Specification

This document details how the **Sekiguchi Subterranean Cleanroom** chamber is constructed as a bespoke room prefab and dynamically populated with tiles and interactive props across both **Perspective Candidate A (3/4 Oblique)** and **Perspective Candidate B (Strict 90° Top-Down)**.

---

## 1. ASCII Prefab Layout (`16 × 12` Grid)

Both perspective variants share the exact same underlying logical layout in the game engine:

```text
# # # # # # # # # # # # # # # #
# C . . . . . . . . . . . . C #
# . . . . . . . . . . . . . . #
# . . . . . . . . . . . S . . #
# . . . . . . . . . . . . . . #
# . . . . . R [X] A . . . M . #
# . . . . . . . . . . . . M . #
# . . . . . . . . . . . . . . #
# . . . . . . . . . . . . . . #
# C . . . . . . . . . . . . C #
# # # # # # # + + # # # # # # #
```

### Tile & Entity Legend:
- `#` = Structural Wall (`terrain: 'wall'`, non-walkable, blocks LOS)
- `.` = Walkable Cleanroom Floor (`terrain: 'floor'`, walkable, transparent)
- `+` = Decontamination Airlock Door (`terrain: 'door'`, walkable, transparent)
- `C` = Cylindrical Cryo-Containment Vat (`prop_cryo_vat`, volatile hazard, blocks movement, casts radial emerald glow)
- `A` = Central Quantum Tether Anchor (`anchor`, extraction terminal, casts radial cyan bloom)
- `[X]` = Low-Cover Cargo Crate (`prop_crate_cover`, 25% directional cover mitigation)
- `R` = Runner Operative (`player_vanguard`, white porcelain shell with acid chartreuse visor)
- `S` = Corrupted Stalker (`enemy_null_pointer`, gaunt cybernetic hound with crimson optic)
- `M` = Biomechanical Siege Construct (`enemy_fragmenter`, heavy armored mech with magenta hydraulics)

---

## 2. Perspective Candidate A: 3/4 Oblique View Assembly

In the **3/4 Oblique View**, vertical surfaces facing south are projected downward into adjacent pixel space:

- **North Wall Facade (`ry = 0` and `ry = 1`)**:
  - `ry = 0`: Flat dark slate roof cap (`wall_cap_s`) with bevel highlight.
  - `ry = 1`: Vertical porcelain bulkhead facade (`wall_front_tall`, 32×32px tall) bearing *Marathon 2026* red-and-white graphic hazard chevrons and Japanese corporate kanji.
- **Cryo-Vats (`C`)**:
  - 32px wide by 56px tall cylindrical sprites anchored at the bottom (`anchor.set(0.5, 1.0)`).
  - Translucent glass walls with glowing emerald fluid and vertical specular streaks, casting diagonal 2.5D shadows toward the southeast.
- **Umbilical Cables**:
  - Cascading downward from high wall conduits and sinuously coiling across the floor tiles toward the vats.
- **Entities**:
  - Spindly *Hyper Light Drifter* proportions (`32×48px` standing height with 1px–2px articulated limbs).

![3/4 Oblique View Tilemap](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/wip/evaluation/tilemap_sekiguchi_3_4_oblique.png)

---

## 3. Perspective Candidate B: Strict 90° Overhead Top-Down Assembly

In the **Strict 90° Top-Down View**, the camera looks directly down from above with zero perspective tilt:

- **Perimeter Wall Caps (`32×32`)**:
  - All walls are viewed directly on their top caps (`wall_cap_*`).
  - *Marathon* acid-chartreuse and signal-orange hazard chevrons are stamped directly onto the horizontal top surface.
- **Cryo-Vats (`C`)**:
  - Circular steel collar footprints with radial emerald fluid cores casting smooth circular light halos onto surrounding floor tiles.
- **Umbilical Cables**:
  - Run as dedicated 32×32 conduit strips along the north and west wall perimeters.
- **Entities**:
  - Overhead helmet crowns and shoulder pads with trailing neural ribbons and weapon barrels extending toward tile borders.

![Strict 90-Degree Top-Down Tilemap](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/wip/evaluation/tilemap_sekiguchi_90deg_topdown.png)

---

## 4. Architectural Comparison for Level Generation

| Feature | 3/4 Oblique Perspective (Candidate A) | Strict 90° Overhead (Candidate B) |
| :--- | :--- | :--- |
| **Prefab Vertical Footprint** | Prefab rooms require **+1 to +2 extra vertical tiles** to render the tall north wall facades and prevent sprites from overlapping ceiling geometry. | Prefab dimensions match the logical room footprint **1:1** without padding. |
| **Depth Sorting (Z-Index)** | Requires active Y-sorting (`zIndex = tileY * 10 + layer`) so actors standing in front of vats and crates occlude their bases correctly. | Simple layer stacking (`terrain` $\to$ `items` $\to$ `entities`); no intra-layer Y-sorting needed. |
| **Grid Ambiguity** | Items or small enemies behind tall north walls or 64px vats can be partially occluded, requiring highlight halos or alpha fading. | 100% visible and unambiguous across every single grid cell. |
| **Visual Immersion** | Exceptional sense of height, brutalist scale, and architectural presence. | Clean, operational tactical map aesthetic with strong retro roguelike readability. |
