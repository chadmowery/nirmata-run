import type { ComponentDef, EntityId } from '@engine/ecs/types';
import type { RawTemplate } from '@engine/entity/types';
import { resolveMixins } from '@engine/entity/builder';
import { sessionManager, type WorldState } from '@server/session/session-manager';
import type { EngineEvents } from '@engine/events/types';
import type { SessionHotloadPatch } from '@shared/hotload-types';
import {
  COMPONENTS_REGISTRY,
  TemplateId,
  Position,
  Health,
  Energy,
  CorruptedNode,
  Shell,
  Defense,
  PortConfig,
  Heat,
  SpriteComponent,
  LightSource,
  BlocksMovement,
} from '@shared/components';
import type { ShellTemplate, ShellRecord } from '@/game/shells/server/types';
import { globalShellRegistry, applyShellUpgradesToRecord } from '@/game/shells/server';
import { getDefaultEntityRegistry } from '@/game/entities';
import {
  inferShellFacingDirection,
  resolveShellSpriteForDirection,
} from '@shared/utils/shell-sprite-util';

const componentDefByKey = new Map<string, ComponentDef<unknown>>(
  COMPONENTS_REGISTRY.map((c) => [c.key, c as ComponentDef<unknown>]),
);

const IDENTITY_SPATIAL_KEYS = new Set([
  'position',
  'tileOrientation',
  'templateId',
  'parent',
  'children',
  'floorState',
  'dying',
  'actor',
]);

const PRESENTATION_KEYS = new Set([
  'sprite',
  'lightSource',
  'audioProfile',
  'ambientEmitter',
]);

const INTERACTIVE_ENV_KEYS = new Set([
  'prop',
  'interactiveSurface',
  'directionalProp',
  'securityLock',
  'corruptedNode',
  'blocksMovement',
  'fovAwareness',
]);

const VITALS_COMBAT_KEYS = new Set([
  'health',
  'energy',
  'attack',
  'defense',
  'heat',
  'stability',
]);

const AI_STATE_KEYS = new Set(['aiState', 'packMember']);

const ITEM_ABILITY_KEYS = new Set([
  'item',
  'rarityTier',
  'equipmentDef',
  'softwareDef',
  'abilityDef',
  'augmentData',
]);

const REMOVABLE_TEMPLATE_KEYS: readonly string[] = [
  ...PRESENTATION_KEYS,
  ...INTERACTIVE_ENV_KEYS,
  ...VITALS_COMBAT_KEYS,
  ...AI_STATE_KEYS,
  ...ITEM_ABILITY_KEYS,
  'hostile',
  'lootTable',
  'pickupEffect',
  'deadZone',
];

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\.(sh|exe|sys|arc)$/i, '')
    .replace(/[\s_\-.]/g, '');
}

function redactComponentForClientPatch(
  compKey: string,
  val: Record<string, unknown>,
  entityId: EntityId,
  world: WorldState<EngineEvents, unknown>['world'],
): Record<string, unknown> {
  const cloned = { ...val };
  if (compKey === 'container') {
    delete cloned.storedLoot;
    delete cloned.scrapYield;
    delete cloned.fluxYield;
    delete cloned.grantsAccessKey;
    delete cloned.blueprintId;
    delete cloned.blueprintType;
  } else if (compKey === 'corruptedNode') {
    const existing = world.getComponent(entityId, CorruptedNode);
    if (!existing?.revealed && !cloned.revealed) {
      delete cloned.trapType;
    }
  } else if (compKey === 'aiState') {
    delete cloned.cooldowns;
    delete cloned.remainingMemoryTurns;
    delete cloned.inlineTree;
  }
  return cloned;
}

function resolveTemplateComponents(
  template: RawTemplate,
  session: WorldState<EngineEvents, unknown>,
): Record<string, Record<string, unknown>> {
  if (session.entityRegistry) {
    try {
      return resolveMixins(template, session.entityRegistry) as Record<
        string,
        Record<string, unknown>
      >;
    } catch {
      // Fallback to raw components if mixin resolution encounters a partial edit
    }
  }
  return (template.components ?? {}) as Record<string, Record<string, unknown>>;
}

function reconcileEntityInSession(
  entityId: EntityId,
  resolvedComponents: Record<string, Record<string, unknown>>,
  session: WorldState<EngineEvents, unknown>,
  patch: SessionHotloadPatch,
): void {
  const { world, grid } = session;
  const componentsSet: Record<string, unknown> = {};
  const componentsRemoved: string[] = [];

  const wasBlocking = world.hasComponent(entityId, BlocksMovement);

  // 1. Update or add components present in resolved template
  for (const [compKey, nextRaw] of Object.entries(resolvedComponents)) {
    if (IDENTITY_SPATIAL_KEYS.has(compKey)) continue;
    const def = componentDefByKey.get(compKey);
    if (!def) continue;

    const existing = world.hasComponent(entityId, def)
      ? (world.getComponent(entityId, def) as Record<string, unknown> | undefined)
      : undefined;

    let merged: Record<string, unknown> = { ...nextRaw };

    if (PRESENTATION_KEYS.has(compKey)) {
      merged = { ...nextRaw };
    } else if (INTERACTIVE_ENV_KEYS.has(compKey)) {
      if (compKey === 'prop' && existing) {
        merged.isSearched = existing.isSearched ?? false;
      } else if (compKey === 'securityLock' && existing) {
        merged.isLocked = existing.isLocked ?? merged.isLocked;
        if (existing.faradayBounds !== undefined) {
          merged.faradayBounds = existing.faradayBounds;
        }
      } else if (compKey === 'corruptedNode' && existing) {
        merged.isDisarmed = existing.isDisarmed ?? false;
        merged.triggered = existing.triggered ?? false;
        merged.revealed = existing.revealed ?? false;
      }
    } else if (VITALS_COMBAT_KEYS.has(compKey)) {
      if (compKey === 'health' && existing) {
        const oldMax = Number(existing.max ?? merged.max ?? 1);
        const oldCur = Number(existing.current ?? oldMax);
        const nextMax = Math.max(1, Number(merged.max ?? oldMax));
        const damageTaken = Math.max(0, oldMax - oldCur);
        merged.max = nextMax;
        merged.current = Math.max(1, Math.min(nextMax, nextMax - damageTaken));
        merged.isAlive = existing.isAlive ?? true;
      } else if (compKey === 'energy' && existing) {
        merged.current = existing.current ?? 0;
      } else if (compKey === 'heat' && existing) {
        const nextMaxSafe = Number(merged.maxSafe ?? existing.maxSafe ?? 100);
        merged.current = Math.max(0, Math.min(nextMaxSafe * 2, Number(existing.current ?? 0)));
        merged.isVenting = existing.isVenting ?? false;
      } else if (compKey === 'stability' && existing) {
        const nextMax = Number(merged.max ?? existing.max ?? 100);
        merged.current = Math.max(0, Math.min(nextMax, Number(existing.current ?? nextMax)));
      }
    } else if (AI_STATE_KEYS.has(compKey)) {
      if (compKey === 'aiState' && existing) {
        merged.behavior = existing.behavior ?? merged.behavior;
        merged.cooldowns = existing.cooldowns ?? {};
        merged.remainingMemoryTurns = existing.remainingMemoryTurns ?? 0;
        if (existing.lastEvaluatedPath !== undefined) {
          merged.lastEvaluatedPath = existing.lastEvaluatedPath;
        }
      }
    } else if (ITEM_ABILITY_KEYS.has(compKey)) {
      if (compKey === 'abilityDef' && existing) {
        merged.isActive = existing.isActive ?? false;
        if (existing.isLegacy !== undefined) {
          merged.isLegacy = existing.isLegacy;
        }
      } else if (compKey === 'augmentData' && existing) {
        if (existing.isLegacy !== undefined) {
          merged.isLegacy = existing.isLegacy;
        }
      }
    }

    const parsed = def.schema.safeParse(merged);
    const nextCompData = (parsed.success ? parsed.data : merged) as Record<string, unknown>;
    world.addComponent(entityId, def, nextCompData);

    const finalComp =
      (world.getComponent(entityId, def) as Record<string, unknown> | undefined) ?? nextCompData;
    componentsSet[compKey] = redactComponentForClientPatch(compKey, finalComp, entityId, world);
  }

  // 2. Remove template-authored definition components that were deleted from the template
  for (const compKey of REMOVABLE_TEMPLATE_KEYS) {
    if (compKey in resolvedComponents) continue;
    const def = componentDefByKey.get(compKey);
    if (def && world.hasComponent(entityId, def)) {
      world.removeComponent(entityId, def);
      componentsRemoved.push(compKey);
    }
  }

  // 3. Synchronize Grid walkability if BlocksMovement changed on a positioned entity
  const isNowBlocking = world.hasComponent(entityId, BlocksMovement);
  if (wasBlocking !== isNowBlocking) {
    const pos = world.getComponent(entityId, Position);
    if (pos && grid.inBounds(pos.x, pos.y)) {
      const tile = grid.getTile(pos.x, pos.y);
      const walkable = !isNowBlocking && tile?.terrain !== 'wall';
      grid.setTile(pos.x, pos.y, { walkable });
      if (!patch.gridWalkabilityUpdates) patch.gridWalkabilityUpdates = [];
      patch.gridWalkabilityUpdates.push({ x: pos.x, y: pos.y, walkable });
    }
  }

  if (Object.keys(componentsSet).length > 0 || componentsRemoved.length > 0) {
    patch.updatedEntities.push({
      entityId,
      componentsSet,
      componentsRemoved,
    });
  }
}

export function upsertEntityTemplateInRegistries(rawTemplate: RawTemplate): void {
  getDefaultEntityRegistry().upsert(rawTemplate);
  for (const { state } of sessionManager.getAllSessionEntries()) {
    state.entityRegistry?.upsert(rawTemplate);
  }
}

export function upsertMixinInRegistries(mixinName: string, mixinTemplate: RawTemplate): void {
  getDefaultEntityRegistry().upsertMixin(mixinName, mixinTemplate);
  for (const { state } of sessionManager.getAllSessionEntries()) {
    state.entityRegistry?.upsertMixin(mixinName, mixinTemplate);
  }
}

export function reconcileEntityTemplateAcrossSessions(
  templateName: string,
  rawTemplate: RawTemplate,
): Record<string, SessionHotloadPatch> {
  const patches: Record<string, SessionHotloadPatch> = {};
  const targetNorm = normalizeKey(templateName);

  getDefaultEntityRegistry().upsert(rawTemplate);

  for (const { sessionId, state } of sessionManager.getAllSessionEntries()) {
    state.entityRegistry?.upsert(rawTemplate);
    const resolved = resolveTemplateComponents(rawTemplate, state);
    const patch: SessionHotloadPatch = { updatedEntities: [] };

    for (const eid of state.world.query(TemplateId)) {
      const tpl = state.world.getComponent(eid, TemplateId);
      if (!tpl) continue;
      if (tpl.id === templateName || normalizeKey(tpl.id) === targetNorm) {
        reconcileEntityInSession(eid, resolved, state, patch);
      }
    }

    if (patch.updatedEntities.length > 0 || (patch.gridWalkabilityUpdates?.length ?? 0) > 0) {
      patches[sessionId] = patch;
    }
  }

  return patches;
}

export function reconcileMixinAcrossSessions(
  mixinName: string,
  mixinTemplate: RawTemplate,
): Record<string, SessionHotloadPatch> {
  const patches: Record<string, SessionHotloadPatch> = {};

  getDefaultEntityRegistry().upsertMixin(mixinName, mixinTemplate);

  for (const { sessionId, state } of sessionManager.getAllSessionEntries()) {
    const registry = state.entityRegistry;
    if (!registry) continue;

    registry.upsertMixin(mixinName, mixinTemplate);
    const patch: SessionHotloadPatch = { updatedEntities: [] };

    const matchingTemplates = new Map<string, Record<string, Record<string, unknown>>>();
    for (const tpl of registry.getAll()) {
      if (tpl.mixins?.includes(mixinName)) {
        matchingTemplates.set(normalizeKey(tpl.name), resolveTemplateComponents(tpl, state));
      }
    }

    for (const eid of state.world.query(TemplateId)) {
      const tpl = state.world.getComponent(eid, TemplateId);
      if (!tpl) continue;
      const resolved = matchingTemplates.get(normalizeKey(tpl.id));
      if (resolved) {
        reconcileEntityInSession(eid, resolved, state, patch);
      }
    }

    if (patch.updatedEntities.length > 0 || (patch.gridWalkabilityUpdates?.length ?? 0) > 0) {
      patches[sessionId] = patch;
    }
  }

  return patches;
}

function applyShellTemplateToPlayer(
  state: WorldState<EngineEvents, unknown>,
  shellTemplate: ShellTemplate,
  isArchetypeSwitch: boolean,
): SessionHotloadPatch {
  const { world } = state;
  const playerId = state.playerId;
  const patch: SessionHotloadPatch = {
    updatedEntities: [],
    playerShellStatsChanged: true,
  };
  if (!world.entityExists(playerId)) return patch;

  const componentsSet: Record<string, unknown> = {};
  const componentsRemoved: string[] = [];

  // Preserve current facing direction from live SpriteComponent & previous Shell
  const prevShell = world.getComponent(playerId, Shell);
  const oldSprite = world.getComponent(playerId, SpriteComponent);
  const currentFacing = inferShellFacingDirection(
    oldSprite?.key,
    prevShell?.directionalSprites,
    prevShell?.defaultDirection ?? shellTemplate.defaultDirection,
  );

  // Recompute effective stats & port capacities with active profile upgrades
  let effectiveRecord: ShellRecord = {
    id: shellTemplate.id,
    archetypeId: shellTemplate.id,
    level: 1,
    currentStats: { ...shellTemplate.baseStats },
    portConfig: { ...shellTemplate.basePorts },
    starterLoadout: shellTemplate.starterLoadout ? [...shellTemplate.starterLoadout] : undefined,
    sprite: shellTemplate.sprite,
    directionalSprites: shellTemplate.directionalSprites
      ? { ...shellTemplate.directionalSprites }
      : undefined,
    defaultDirection: shellTemplate.defaultDirection,
    lightSource: shellTemplate.lightSource ? { ...shellTemplate.lightSource } : undefined,
  };
  const upgradeData = state.shellUpgrades?.[shellTemplate.id];
  if (upgradeData) {
    effectiveRecord = applyShellUpgradesToRecord(effectiveRecord, upgradeData);
  }
  const { currentStats, portConfig } = effectiveRecord;

  const rawShellData: Record<string, unknown> = {
    archetypeId: shellTemplate.id,
    speed: currentStats.speed,
    stability: currentStats.stability,
    armor: currentStats.armor,
    maxHealth: currentStats.maxHealth,
  };
  if (shellTemplate.directionalSprites !== undefined) {
    rawShellData.directionalSprites = { ...shellTemplate.directionalSprites };
  }
  if (shellTemplate.defaultDirection !== undefined) {
    rawShellData.defaultDirection = shellTemplate.defaultDirection;
  }
  const parsedShell = Shell.schema.safeParse(rawShellData);
  const nextShellData = parsedShell.success ? parsedShell.data : (rawShellData as never);
  world.addComponent(playerId, Shell, nextShellData);
  componentsSet.shell = { ...nextShellData };

  // Health (preserve damage taken)
  const oldHealth = world.getComponent(playerId, Health);
  const nextMaxHp = currentStats.maxHealth;
  const damageTaken = oldHealth ? Math.max(0, oldHealth.max - oldHealth.current) : 0;
  const nextHealth = {
    current: Math.max(1, Math.min(nextMaxHp, nextMaxHp - damageTaken)),
    max: nextMaxHp,
    isAlive: oldHealth?.isAlive ?? true,
  };
  world.addComponent(playerId, Health, nextHealth);
  componentsSet.health = { ...nextHealth };

  // Defense
  if (world.hasComponent(playerId, Defense)) {
    const nextDefense = { armor: currentStats.armor };
    world.addComponent(playerId, Defense, nextDefense);
    componentsSet.defense = nextDefense;
  }

  // Energy
  const oldEnergy = world.getComponent(playerId, Energy);
  if (oldEnergy) {
    const nextEnergy = {
      ...oldEnergy,
      speed: currentStats.speed,
    };
    world.addComponent(playerId, Energy, nextEnergy);
    componentsSet.energy = nextEnergy;
  }

  // PortConfig
  if (world.hasComponent(playerId, PortConfig)) {
    const nextPorts = { ...portConfig };
    world.addComponent(playerId, PortConfig, nextPorts);
    componentsSet.portConfig = nextPorts;
  }

  // Heat (sync baseDissipation with updated stability)
  const oldHeat = world.getComponent(playerId, Heat);
  if (oldHeat) {
    const nextHeat = {
      ...oldHeat,
      baseDissipation: 5 + currentStats.stability * 0.1,
    };
    world.addComponent(playerId, Heat, nextHeat);
    componentsSet.heat = nextHeat;
  }

  // Sprite (preserve current facing direction)
  const resolvedSpriteKey = resolveShellSpriteForDirection(shellTemplate, currentFacing);
  if (oldSprite) {
    const nextSprite = { ...oldSprite, key: resolvedSpriteKey };
    world.addComponent(playerId, SpriteComponent, nextSprite);
    componentsSet.sprite = nextSprite;
  }

  // LightSource
  if (shellTemplate.lightSource) {
    const parsedLight = LightSource.schema.parse(shellTemplate.lightSource);
    world.addComponent(playerId, LightSource, parsedLight);
    componentsSet.lightSource = { ...parsedLight };
  } else if (world.hasComponent(playerId, LightSource)) {
    world.removeComponent(playerId, LightSource);
    componentsRemoved.push('lightSource');
  }

  if (isArchetypeSwitch) {
    state.shellId = shellTemplate.id;
  }

  patch.updatedEntities.push({
    entityId: playerId,
    componentsSet,
    componentsRemoved,
  });
  return patch;
}

export function reconcileShellAcrossSessions(
  shellTemplate: ShellTemplate,
): Record<string, SessionHotloadPatch> {
  const patches: Record<string, SessionHotloadPatch> = {};
  globalShellRegistry.upsertTemplate(shellTemplate);

  for (const { sessionId, state } of sessionManager.getAllSessionEntries()) {
    if (!state.world.entityExists(state.playerId)) continue;
    const shell = state.world.getComponent(state.playerId, Shell);
    if (!shell || shell.archetypeId !== shellTemplate.id) continue;

    const patch = applyShellTemplateToPlayer(state, shellTemplate, false);
    if (patch.updatedEntities.length > 0) {
      patches[sessionId] = patch;
    }
  }

  return patches;
}

export function switchPlayerShellInSession(
  sessionId: string,
  shellId: string,
): SessionHotloadPatch | null {
  const state = sessionManager.getSession(sessionId);
  if (!state) return null;

  const tpl = globalShellRegistry.getTemplates().find((t) => t.id === shellId);
  if (!tpl) return null;

  return applyShellTemplateToPlayer(state, tpl, true);
}
