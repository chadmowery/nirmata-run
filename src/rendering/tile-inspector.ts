import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EntityId } from '../engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState } from '@shared/components/ai-state';
import { Health } from '@shared/components/health';
import { Heat } from '@shared/components/heat';
import { Stability } from '@shared/components/stability';
import { StatusEffects } from '@shared/components/status-effects';
import { SpriteComponent } from '@shared/components/sprite';
import {
  Prop,
  SecurityLock,
  Container,
  CorruptedNode,
  InteractiveSurface,
  FactionTheme,
} from '@shared/components/environment';
import { StaircaseMarker } from '@shared/components/staircase-marker';
import { AnchorMarker } from '@shared/components/anchor-marker';
import { Item } from '@shared/components/item';
import { CurrencyItem } from '@shared/components/currency-item';
import { EquipmentDef } from '@shared/components/equipment-def';
import { SoftwareDef } from '@shared/components/software-def';
import { RarityTier } from '@shared/components/rarity-tier';
import { TemplateId } from '@shared/components/template-id';
import { DeadZone } from '@shared/components/dead-zone';
import { Dying } from '@shared/components/dying';
import { GameEvents } from '../game/events/types';
import { gameStore, HoveredEntityInfo } from '../game/ui/store';

const ENEMY_LORE: Record<
  string,
  { name: string; kanjiSub: string; subTitle: string; flavorText: string }
> = {
  null_pointer: {
    name: 'NULL-POINTER SPECTER',
    kanjiSub: '虚無ポインタ',
    subTitle: 'CORRUPTED MEMORY SPECTER',
    flavorText:
      'Unresolved memory reference manifested as an entropic phantom. Glitches optical feeds and directly executes predatory memory dumps on proximate chassis.',
  },
  seed_eater: {
    name: 'SEED-EATER REAPER',
    kanjiSub: '乱数捕食機',
    subTitle: 'ENTROPIC PROCESS HARVESTER',
    flavorText:
      'Aggressive garbage-collection construct that hunts active process threads and devours procedural seed keys, causing severe dimensional collapse.',
  },
  scavenger_siphon: {
    name: 'SCAVENGER SIPHON',
    kanjiSub: '残骸吸引機',
    subTitle: 'AUTONOMOUS SALVAGE DRONE',
    flavorText:
      'Autonomous maintenance unit reprogrammed to aggressively leech raw scrap, energy reserves, and uninstalled hardware from downed chassis.',
  },
  system_admin: {
    name: 'SYSTEM ADMINISTRATOR',
    kanjiSub: '統括執行機',
    subTitle: 'HEAVY SECTOR ENFORCER',
    flavorText:
      'Heavily armored security unit wielding corporate administrative termination protocols. Employs root-level priority overrides to crush intrusion attempts.',
  },
  void_echo: {
    name: 'VOID ECHO',
    kanjiSub: '虚空反響体',
    subTitle: 'ENTROPIC THERMAL ANOMALY',
    flavorText:
      'Residual thermal distortion from an uncontained reactor core failure. Radiates intense logic corruption and accelerates chassis overheating.',
  },
  fragmenter: {
    name: 'FRAGMENTER DRONE',
    kanjiSub: '爆砕子機',
    subTitle: 'AREA-DENIAL PROXIMITY UNIT',
    flavorText:
      'Self-replicating explosive drone deployed for sector lockdown. Detonates upon terminal structural failure to fracture corridor choke points.',
  },
  static_siphon: {
    name: 'STATIC SIPHON',
    kanjiSub: '静止吸熱機',
    subTitle: 'DIMENSIONAL COHERENCE DRAIN',
    flavorText:
      'Siphons reality stabilization fields directly into high-density storage cells, rapidly accelerating the environmental stability bleed.',
  },
  logic_leaker: {
    name: 'LOGIC LEAKER',
    kanjiSub: '論理漏洩機',
    subTitle: 'CASCADE MALWARE TRANSMITTER',
    flavorText:
      'Infectious malware router that broadcasts recursive runtime exceptions, degrading remote targeting solutions and telemetry accuracy.',
  },
  buffer_overflow: {
    name: 'BUFFER OVERFLOW',
    kanjiSub: '過負荷巨体',
    subTitle: 'KINETIC MEMORY MONSTROSITY',
    flavorText:
      'High-mass kinetic abomination generated when sector memory buffers exceed maximum safe thresholds. Smashes physical defenses with devastating force.',
  },
};

export const FACTION_LORE: Record<
  FactionTheme,
  { fullName: string; shortName: string; descriptor: string }
> = {
  traxus: {
    fullName: 'Traxus Heavy Industries',
    shortName: 'TRAXUS',
    descriptor: 'heavy industrial',
  },
  cyberacme: {
    fullName: 'CyberAcme Systems',
    shortName: 'CYBERACME',
    descriptor: 'computational network',
  },
  sekiguchi: {
    fullName: 'Sekiguchi Genetics',
    shortName: 'SEKIGUCHI',
    descriptor: 'biomedical synthesis',
  },
  nucaloric: {
    fullName: 'NuCaloric Energy Corp',
    shortName: 'NUCALORIC',
    descriptor: 'thermal power',
  },
  system: {
    fullName: 'System Infrastructure',
    shortName: 'SYSTEM',
    descriptor: 'automated facility',
  },
};

export function resolvePropLore(
  propClass: string,
  factionTheme: FactionTheme = 'system',
  hasFaradayBounds: boolean = false,
): { name: string; kanjiSub: string; subTitle: string; description: string; flavorText: string } {
  const faction = FACTION_LORE[factionTheme] || FACTION_LORE.system;

  switch (propClass) {
    case 'workstation':
      return {
        name: `${faction.shortName} TERMINAL WORKSTATION`,
        kanjiSub: '端末操作盤',
        subTitle: 'SUBNET ACCESS CONSOLE',
        description: 'Industrial mainframe terminal connected to sub-deck fiber lines.',
        flavorText: `Displays flickering administrative logs and encrypted memory registers maintained by ${faction.fullName}. May yield valuable software binaries or corporate telemetry.`,
      };
    case 'locker':
      return {
        name: 'REINFORCED CARGO LOCKER',
        kanjiSub: '補給金庫',
        subTitle: 'HEAVY STORAGE RECEPTACLE',
        description: 'Heavy-gauge corporate utility locker sealed against corrosion.',
        flavorText: `Standard-issue ${faction.fullName} freight storage constructed from reinforced plasteel. Contains physical weapon components and modular armor plates.`,
      };
    case 'cabinet':
      return {
        name: 'BIO-CONTAINMENT CABINET',
        kanjiSub: '医療格納庫',
        subTitle: 'STERILIZED MEDICAL VAULT',
        description: 'Hermetically sealed pharmaceutical refrigeration unit.',
        flavorText: `Pressurized containment chamber designed by ${faction.fullName}. Houses concentrated nanite repair serums and biological stabilizers.`,
      };
    case 'surface_table':
      return {
        name: 'LOW-COVER WORKTABLE',
        kanjiSub: '作業遮蔽台',
        subTitle: 'TACTICAL CARBON COVER',
        description: 'Hardened composite industrial workbench.',
        flavorText: `Dense carbon-fiber workbench reinforced to absorb ballistic impact and projectile ricochets. Manufactured for ${faction.fullName} facility operations.`,
      };
    case 'encrypted_safe':
      return {
        name: 'SECURE HARDWARE VAULT',
        kanjiSub: '暗号保管庫',
        subTitle: 'CIPHER-LOCKED CONTAINER',
        description: 'Hardened alloy safe secured by multi-factor biometric locks.',
        flavorText: `High-security ${faction.fullName} vault shielded against unauthorized electromagnetic probes. Contains military-grade scrap reserves and rare tech.`,
      };
    case 'vault_door':
      if (hasFaradayBounds) {
        return {
          name: `${faction.shortName} REINFORCED AIRLOCK`,
          kanjiSub: '遮蔽気密扉',
          subTitle: 'FARADAY PERIMETER BULKHEAD',
          description: 'Heavy blast-door isolating high-priority corporate data chambers.',
          flavorText: `Dense lead-lined Faraday perimeter bulkhead installed by ${faction.fullName}. Prevents remote sensor scans and phased teleportation until the primary lock is overridden.`,
        };
      }
      return {
        name: `${faction.shortName} SECURITY AIRLOCK`,
        kanjiSub: '遮蔽気密扉',
        subTitle: 'REINFORCED BLAST BULKHEAD',
        description: 'Heavy blast-door isolating high-priority facility sectors.',
        flavorText: `Dense perimeter security blast bulkhead installed by ${faction.fullName}. Isolates high-value chambers and prevents unauthorized physical passage until the primary lock is overridden.`,
      };
    case 'dead_drop_uplink':
      return {
        name: 'DEAD-DROP TRANSMISSION NODE',
        kanjiSub: '暗号中継機',
        subTitle: 'QUANTUM VAULT TRANSCEIVER',
        description: 'Direct quantum uplink to the operator surface vault.',
        flavorText:
          'One-way secure quantum transceiver capable of offloading salvaged software and equipment directly to your persistent vault before extraction.',
      };
    case 'reality_stabilizer':
      return {
        name: 'REALITY STABILIZER NODE',
        kanjiSub: '現実固定装置',
        subTitle: 'MICRO-SINGULARITY HARMONIC UNIT',
        description: 'Micro-singularity field generator that counters dimensional decay.',
        flavorText:
          'Projects a localized dimensional harmonic wave that temporarily recalibrates Reality Stability, offsetting the entropic sector bleed.',
      };
    case 'cooling_vent':
      return {
        name: 'CRYOGENIC BYPASS VENT',
        kanjiSub: '冷媒排出弁',
        subTitle: 'HIGH-PRESSURE FREON VENT',
        description: 'Pressurized exhaust vent connected to cryogenic fluid pipes.',
        flavorText: `Purges extreme thermal buildup directly from chassis heatsinks when accessed, resetting dangerous accumulated thermal heat across ${faction.fullName} sectors.`,
      };
    case 'subnet_console':
      return {
        name: 'DISTRIBUTED SUBNET CONSOLE',
        kanjiSub: '回線中継盤',
        subTitle: 'SECTOR NETWORK ROUTER',
        description: 'Central telemetric router governing sector surveillance grids.',
        flavorText: `Interfacing with this ${faction.fullName} terminal allows operators to trigger sector overclock routines or download full facility architecture schematics.`,
      };
    case 'volatile_vat':
      return {
        name: 'PRESSURIZED CHEMICAL RESERVOIR',
        kanjiSub: '化学貯蔵槽',
        subTitle: 'REACTIVE FLUID TANK',
        description: 'Fragile industrial vat holding pressurized reactive compounds.',
        flavorText: `Structural integrity is critically compromised. Extreme ballistic or thermal shocks will trigger a catastrophic chemical hazard spill across ${faction.fullName} workspaces.`,
      };
    case 'capacitor_bank':
      return {
        name: 'HIGH-VOLTAGE CAPACITOR BANK',
        kanjiSub: '高圧蓄電体',
        subTitle: 'MEGAWATT POWER CONDUIT',
        description: 'Heavy power transformer storing high-yield electromagnetic potential.',
        flavorText: `Contains volatile electrical reserves maintained by ${faction.fullName}. Breaching or overloading this unit discharges a devastating kinetic EMP arc into adjacent tiles.`,
      };
    default:
      return {
        name: `${propClass.toUpperCase().replace(/_/g, ' ')} UNIT`,
        kanjiSub: '設備端末',
        subTitle: 'INTERACTIVE PROP NODE',
        description: 'Corporate infrastructure fixture.',
        flavorText: `An environmental fixture installed within the ${faction.fullName} corporate facility.`,
      };
  }
}

export const PROP_CLASS_LORE: Record<
  string,
  { name: string; kanjiSub: string; subTitle: string; description: string; flavorText: string }
> = new Proxy(
  {},
  {
    get: (_, propClass: string) => resolvePropLore(propClass, 'system'),
  },
);

export interface RememberedPropState {
  isSearched: boolean;
  isLocked?: boolean;
  corruptedRevealed?: boolean;
  corruptedDisarmed?: boolean;
  corruptedTriggered?: boolean;
  corruptionLevel?: number;
}

export interface ResolveTileInspectionParams {
  world: World<GameEvents>;
  grid: Grid;
  gx: number;
  gy: number;
  screenX: number;
  screenY: number;
  isVisibleInFov: boolean;
  isExplored: boolean;
  playerEntity: EntityId;
  detailedFlavorTextEnabled: boolean;
  rememberedProps?: ReadonlyMap<EntityId, RememberedPropState>;
  rememberedTileItems?: ReadonlyMap<string, ReadonlySet<EntityId>>;
}

export function resolveTileInspection(
  params: ResolveTileInspectionParams,
): HoveredEntityInfo | null {
  const {
    world,
    grid,
    gx,
    gy,
    screenX,
    screenY,
    isVisibleInFov,
    isExplored,
    playerEntity,
    detailedFlavorTextEnabled,
    rememberedProps,
    rememberedTileItems,
  } = params;

  if (!grid.inBounds(gx, gy)) {
    return null;
  }

  // Do not inspect unexplored tiles in fog of war
  if (!isExplored && !isVisibleInFov) {
    return null;
  }

  const entitiesAtTile: EntityId[] = [];
  const seenEntities = new Set<EntityId>();

  if (typeof grid.getEntitiesAt === 'function') {
    for (const id of grid.getEntitiesAt(gx, gy)) {
      if (!seenEntities.has(id) && !world.hasComponent(id, Dying)) {
        seenEntities.add(id);
        entitiesAtTile.push(id);
      }
    }
  }

  if (typeof grid.getItemsAt === 'function') {
    for (const id of grid.getItemsAt(gx, gy)) {
      if (!seenEntities.has(id) && !world.hasComponent(id, Dying)) {
        seenEntities.add(id);
        entitiesAtTile.push(id);
      }
    }
  }

  // Fallback for test fixtures or unindexed entities
  if (entitiesAtTile.length === 0) {
    const posEntities = world.query(Position);
    for (const id of posEntities) {
      const pos = world.getComponent(id, Position);
      if (pos && pos.x === gx && pos.y === gy && !world.hasComponent(id, Dying)) {
        entitiesAtTile.push(id);
      }
    }
  }

  // 1. Hostile / Enemy Check (Takes top priority in combat situations)
  const enemyEntityId = entitiesAtTile.find((id) => {
    const actor = world.getComponent(id, Actor);
    return actor && !actor.isPlayer;
  });

  if (enemyEntityId !== undefined && isVisibleInFov) {
    const aiState = world.getComponent(enemyEntityId, AIState);
    const spriteComp = world.getComponent(enemyEntityId, SpriteComponent);
    const templateId = world.getComponent(enemyEntityId, TemplateId);
    const health = world.getComponent(enemyEntityId, Health);
    const statusEffects = world.getComponent(enemyEntityId, StatusEffects);

    const behaviorKey =
      aiState?.behaviorType ||
      templateId?.id?.replace(/-/g, '_') ||
      spriteComp?.key?.replace(/^enemy_/, '') ||
      '';

    const lore = ENEMY_LORE[behaviorKey] || {
      name:
        templateId?.id?.toUpperCase().replace(/-/g, ' ') ||
        spriteComp?.key?.toUpperCase().replace(/_/g, ' ') ||
        'HOSTILE ENTITY',
      kanjiSub: '異常体',
      subTitle: 'UNIDENTIFIED HOSTILE CONSTRUCT',
      flavorText:
        'A rogue cybernetic entity corrupted by systemic memory leaks. Hostile to all unauthorized operator chassis.',
    };

    const effectsList = statusEffects?.effects?.map((e) => e.name.toUpperCase()) || [];

    return {
      type: 'enemy',
      entityId: enemyEntityId,
      name: lore.name,
      kanjiSub: lore.kanjiSub,
      subTitle: lore.subTitle,
      badge: 'HOSTILE TARGET',
      badgeVariant: 'danger',
      description: 'Hostile machine construct actively pursuing chassis termination.',
      flavorText: detailedFlavorTextEnabled ? lore.flavorText : undefined,
      hp: health?.current,
      maxHp: health?.max,
      threatLevel: 'ACTIVE THREAT',
      behavior: aiState?.lastEvaluatedPath
        ? `BT: ${aiState.lastEvaluatedPath}`
        : aiState?.behaviorType
          ? `ARCHETYPE: ${aiState.behaviorType.toUpperCase()}`
          : undefined,
      statusEffects: effectsList.length > 0 ? effectsList : undefined,
      interactionHint: '[BUMP] to execute melee attack',
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
    };
  }

  // 2. Player Chassis Check
  const isPlayerTile =
    entitiesAtTile.includes(playerEntity) ||
    entitiesAtTile.some((id) => world.getComponent(id, Actor)?.isPlayer);

  if (isPlayerTile) {
    const store = gameStore.getState();
    const pHealth = world.getComponent(playerEntity, Health);
    const pHeat = world.getComponent(playerEntity, Heat);
    const pStability = world.getComponent(playerEntity, Stability);

    const shellName = store.player.shellName !== 'None' ? store.player.shellName : 'RONIN-01 CHASSIS';

    return {
      type: 'player',
      entityId: playerEntity,
      name: shellName.toUpperCase(),
      kanjiSub: '生体接続',
      subTitle: 'DEPLOYED OPERATOR CHASSIS',
      badge: 'ALLIED CHASSIS',
      badgeVariant: 'cyan',
      description: 'Authoritative operator interface chassis deployed in sector.',
      flavorText: detailedFlavorTextEnabled
        ? 'Heavily modified cybernetic rig connected via quantum neuro-link to the surface command deck. Any structural loss triggers an emergency BSOD core dump.'
        : undefined,
      hp: pHealth?.current ?? store.player.hp,
      maxHp: pHealth?.max ?? store.player.maxHp,
      heat: pHeat?.current ?? store.player.heat,
      maxHeat: pHeat?.maxSafe ?? store.player.maxHeat,
      stability: pStability?.current ?? store.stability,
      interactionHint: '[WASD] to locomote | [SPACE] to wait | [V] to vent heat',
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
    };
  }

  // 3. Staircase Check
  const staircaseId = entitiesAtTile.find((id) => world.hasComponent(id, StaircaseMarker));
  if (staircaseId !== undefined) {
    const marker = world.getComponent(staircaseId, StaircaseMarker)!;
    return {
      type: 'prop',
      entityId: staircaseId,
      name: 'SUB-LEVEL ELEVATOR SHAFT',
      kanjiSub: '昇降機構',
      subTitle: `SECTOR DESCENT CHUTE (FLOOR ${marker.targetFloor})`,
      badge: 'DESCENT CONDUIT',
      badgeVariant: 'cyan',
      description: `Gravity-assisted transit shaft connecting to Sector Floor ${marker.targetFloor}.`,
      flavorText: detailedFlavorTextEnabled
        ? 'Heavy industrial lift shaft plunging deeper into the corporate complex. Sub-levels exhibit amplified dimensional decoherence and elite corporate security units.'
        : undefined,
      interactionHint: '[SHIFT + .] or [>] to descend to next floor',
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
    };
  }

  // 4. Extraction Stability Anchor Check
  const anchorId = entitiesAtTile.find((id) => world.hasComponent(id, AnchorMarker));
  if (anchorId !== undefined) {
    const marker = world.getComponent(anchorId, AnchorMarker)!;
    return {
      type: 'prop',
      entityId: anchorId,
      name: 'EXTRACTION STABILITY ANCHOR',
      kanjiSub: '抽出中継機',
      subTitle: marker.used ? 'DEPLETED HARMONIC RELAY' : 'QUANTUM EXTRACTION BEACON',
      badge: marker.used ? 'BEACON OFFLINE' : 'EXTRACTION READY',
      badgeVariant: 'cyan',
      description: 'Fixed-point quantum telemetry beacon anchored to the surface command mothership.',
      flavorText: detailedFlavorTextEnabled
        ? 'Emits a high-frequency harmonic carrier wave that anchors the local simulation bubble. Allows secure extraction with all vaulted cargo or deep descent.'
        : undefined,
      interactionHint: marker.used
        ? 'Beacon energy depleted for this sector'
        : '[E] to engage extraction anchor console',
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
    };
  }

  // 5. Interactive Props Check (Workstations, Lockers, Safes, Vents, Cabinets, etc.)
  const propEntityId = entitiesAtTile.find((id) => world.hasComponent(id, Prop));
  if (propEntityId !== undefined) {
    const prop = world.getComponent(propEntityId, Prop)!;
    const lock = world.getComponent(propEntityId, SecurityLock);
    const corrupted = world.getComponent(propEntityId, CorruptedNode);
    const container = world.getComponent(propEntityId, Container);
    const surface = world.getComponent(propEntityId, InteractiveSurface);

    const lore = resolvePropLore(
      prop.propClass,
      prop.faction,
      Boolean(lock?.faradayBounds),
    );

    // Determine effective client-visible state (live when in FOV, remembered when explored out of FOV)
    let isSearched = false;
    let isLocked = false;
    let isCorruptedVisible = false;
    let corruptionLevel = 1;

    if (isVisibleInFov) {
      isSearched = Boolean(prop.isSearched);
      isLocked = Boolean(lock?.isLocked);
      isCorruptedVisible = Boolean(
        corrupted &&
          !corrupted.isDisarmed &&
          !corrupted.triggered &&
          (corrupted.revealed || corrupted.triggered),
      );
      corruptionLevel = corrupted?.corruptionLevel || 1;
    } else {
      const remembered = rememberedProps?.get(propEntityId);
      if (remembered) {
        isSearched = remembered.isSearched;
        isLocked = Boolean(remembered.isLocked);
        isCorruptedVisible = Boolean(
          remembered.corruptedRevealed &&
            !remembered.corruptedDisarmed &&
            !remembered.corruptedTriggered,
        );
        corruptionLevel = remembered.corruptionLevel || 1;
      } else {
        // Default remembered state when explored before any out-of-sight state change
        isSearched = false;
        isLocked = Boolean(lock);
        isCorruptedVisible = false;
      }
    }

    let badge = 'INTERACTIVE PROP';
    let badgeVariant: 'cyan' | 'orange' | 'danger' | 'yellow' = 'cyan';
    let hint = '[BUMP] to inspect or interact';

    if (isSearched) {
      badge = 'SEARCHED / DEPLETED';
      badgeVariant = 'cyan';
      hint = 'Salvage already recovered';
    } else if (isCorruptedVisible) {
      badge = `CORRUPTED NODE [LVL ${corruptionLevel}]`;
      badgeVariant = 'danger';
      hint = '[E] to force bypass (Hazardous trap payload active) | Bump blocked by trap safeguard';
    } else if (isLocked) {
      badge = 'ENCRYPTED / LOCKED';
      badgeVariant = 'orange';
      hint = '[BUMP] to attempt bypass with Keycard | [E] to overclock (Bump halts without key)';
    } else if (container) {
      badge = 'UNOPENED SALVAGE';
      badgeVariant = 'cyan';
      hint = '[BUMP] to open and scavenge loot';
    } else if (prop.propClass === 'cooling_vent') {
      badge = 'COOLING SYSTEM';
      badgeVariant = 'cyan';
      hint = '[BUMP] to vent chassis thermal heat';
    } else if (prop.propClass === 'reality_stabilizer') {
      badge = 'STABILIZER ACTIVE';
      badgeVariant = 'cyan';
      hint = '[BUMP] to recalibrate sector reality';
    } else if (prop.propClass === 'dead_drop_uplink') {
      badge = 'VAULT TRANSMITTER';
      badgeVariant = 'cyan';
      hint = '[E] to offload cargo to vault';
    }

    let description = lore.description;
    if (surface?.providesCover) {
      description += ` Provides ${Math.round((surface.coverDamageReduction || 0.25) * 100)}% cover damage reduction.`;
    }

    return {
      type: 'prop',
      entityId: propEntityId,
      name: lore.name,
      kanjiSub: lore.kanjiSub,
      subTitle: lore.subTitle,
      badge,
      badgeVariant,
      description,
      flavorText: detailedFlavorTextEnabled ? lore.flavorText : undefined,
      interactionHint: hint,
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
    };
  }

  // 6. Ground Items & Currency Check (Live when visible in FOV; remembered only when out of FOV)
  const itemId = entitiesAtTile.find((id) => {
    const isItemEntity = world.hasComponent(id, Item) || world.hasComponent(id, CurrencyItem);
    if (!isItemEntity) return false;
    if (isVisibleInFov) return true;
    return Boolean(rememberedTileItems?.get(`${gx},${gy}`)?.has(id));
  });
  if (itemId !== undefined) {
    const itemComp = world.getComponent(itemId, Item);
    const currencyComp = world.getComponent(itemId, CurrencyItem);
    const rarity = world.getComponent(itemId, RarityTier);
    const sw = world.getComponent(itemId, SoftwareDef);
    const eq = world.getComponent(itemId, EquipmentDef);
    const tmpl = world.getComponent(itemId, TemplateId);

    let name = itemComp?.name || tmpl?.id || `Item #${itemId}`;
    let subTitle = 'GROUND OBJECT';
    let badge = rarity?.tier ? `${rarity.tier.toUpperCase()} TIER` : 'FIELD LOOT';
    let badgeVariant: 'cyan' | 'orange' | 'danger' | 'yellow' = 'cyan';

    if (currencyComp) {
      name = `${currencyComp.currencyType.toUpperCase()} CACHE`;
      subTitle = 'FIELD CURRENCY';
      badge = `${currencyComp.amount} ${currencyComp.currencyType.toUpperCase()}`;
      badgeVariant = 'yellow';
    } else if (sw) {
      name = sw.name;
      subTitle = 'SOFTWARE MODULE';
      badge = `${sw.targetSlot.toUpperCase()} SOFTWARE`;
      badgeVariant = 'cyan';
    } else if (eq) {
      name = eq.name;
      subTitle = `${eq.slotType.toUpperCase()} HARDWARE`;
      badge = eq.slotType.toUpperCase();
      badgeVariant = 'cyan';
    }

    return {
      type: 'item',
      entityId: itemId,
      name,
      kanjiSub: '投下物資',
      subTitle,
      badge,
      badgeVariant,
      description: 'Salvageable cargo container resting on deck flooring.',
      flavorText: detailedFlavorTextEnabled
        ? 'Unclaimed material salvage left behind during rapid sector abandonment. Can be gathered into chassis backpack.'
        : undefined,
      interactionHint: currencyComp ? 'Auto-gathered upon stepping over' : '[G] to pick up or transfer',
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
    };
  }

  // 7. Plain Tiles (Walls, Floors, Doors, Hazards)
  // Non-interactive tiles are ONLY inspected when detailedFlavorTextEnabled is active!
  if (!detailedFlavorTextEnabled) {
    return null;
  }

  // Check if tile is a DeadZone hazard (only when visible in FOV)
  const deadZoneId = isVisibleInFov
    ? entitiesAtTile.find((id) => world.hasComponent(id, DeadZone))
    : undefined;
  if (deadZoneId !== undefined) {
    const dz = world.getComponent(deadZoneId, DeadZone)!;
    return {
      type: 'tile',
      name: 'CORRUPTED LOGIC LEAK [DEAD ZONE]',
      kanjiSub: '次元断層',
      subTitle: 'HAZARDOUS REALITY ANOMALY',
      badge: 'ENVIRONMENTAL HAZARD',
      badgeVariant: 'danger',
      description: `Entropic reality rupture inflicting ${dz.damagePerTick || 2} structural damage per elapsed turn tick.`,
      flavorText:
        'A severe quantum tear in the simulation framework. Any cybernetic chassis lingering within this space experiences rapid integrity decoherence.',
      interactionHint: 'Hazardous terrain — avoid lingering',
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
      isDetailedOnly: true,
    };
  }

  const tile = grid.getTile(gx, gy);
  if (!tile) return null;

  if (tile.terrain === 'wall') {
    return {
      type: 'tile',
      name: 'REINFORCED PLASTEEL BULKHEAD',
      kanjiSub: '耐圧隔壁',
      subTitle: 'STRUCTURAL BLAST BARRIER',
      badge: 'IMPASSABLE',
      badgeVariant: 'cyan',
      description: 'High-density composite blast partition with internal shock dampening.',
      flavorText:
        'Constructed during the Megacorp expansion era to survive explosive decompressions and military munitions. Impassable without demolition charges; fully occludes optical sightlines.',
      interactionHint: 'Structural obstacle (Blocks movement & LOS)',
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
      isDetailedOnly: true,
    };
  }

  if (tile.terrain === 'door') {
    return {
      type: 'tile',
      name: 'PNEUMATIC PRESSURE HATCH',
      kanjiSub: '気密隔扉',
      subTitle: 'AUTOMATED SECTOR APERTURE',
      badge: 'PRESSURE DOOR',
      badgeVariant: 'cyan',
      description: 'Automated sliding pneumatic partition dividing sector rooms.',
      flavorText:
        'Hermetically sealed partition engineered to contain bio-chemical spills and unauthorized incursions. Cycles open automatically upon operator approach.',
      interactionHint: 'Step onto tile to cycle open',
      screenX,
      screenY,
      gridX: gx,
      gridY: gy,
      isDetailedOnly: true,
    };
  }

  // Default floor tile
  return {
    type: 'tile',
    name: 'SUB-DECK CONDUIT FLOORING',
    kanjiSub: '配線基盤床',
    subTitle: 'PRIMARY ACCESS DECKING',
    badge: 'TRAVERSABLE',
    badgeVariant: 'cyan',
    description: 'Heavy industrial grating suspended over infrastructure conduits.',
    flavorText:
      'Perforated titanium-mesh decking mounted over high-voltage fiber-optic trunks and cryogenic fluid lines. Provides optimal acoustic dampening and wheel/tread traction.',
    interactionHint: 'Traversable terrain [1 Turn per step]',
    screenX,
    screenY,
    gridX: gx,
    gridY: gy,
    isDetailedOnly: true,
  };
}
