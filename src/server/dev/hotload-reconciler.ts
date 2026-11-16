import type { ComponentDef, EntityId } from '@engine/ecs/types';
import type { RawTemplate } from '@engine/entity/types';
import { resolveMixins } from '@engine/entity/builder';
import { sessionManager, type WorldState } from '@server/session/session-manager';
import type { EngineEvents } from '@engine/events/types';
import type { SessionHotloadPatch } from '@dev-tool/hotload/types';
import {
  COMPONENTS_REGISTRY,
  TemplateId,
  Position,
  Health,
  Energy,
  Heat,
  Stability,
  AIState,
  Prop,
  SecurityLock,
  CorruptedNode,
  AbilityDef,
  Shell,
  Defense,
  PortConfig,
  SpriteComponent,
  LightSource,
  BlocksMovement,
} from '@shared/components';
import type { ShellTemplate } from '@/game/shells/server/types';
import { globalShellRegistry } from '@/game/shells/server';
import { resolveShellSpawnSprite } from '@shared/utils/shell-sprite-util';

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
      }
    }

    if (existing) {
      world.patchComponent(entityId, def, merged);
    } else {
      world.addComponent(entityId, def, merged);
    }

    const finalComp = (world.getComponent(entityId, def) as Record<string, unknown> | undefined) ?? merged;
    componentsSet[compKey] = redactComponentForClientPatch(compKey, finalComp, entityId, world);
  }

  // 2. Remove presentation or removable definition components that were deleted from the template
  for (const compKey of [...PRESENTATION_KEYS, 'blocksMovement']) {
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

export function reconcileEntityTemplateAcrossSessions(
  templateName: string,
  rawTemplate: RawTemplate,
): Record<string, SessionHotloadPatch> {
  const patches: Record<string, SessionHotloadPatch> = {};
  const targetNorm = normalizeKey(templateName);

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

  const nextShellData = {
    archetypeId: shellTemplate.id,
    speed: shellTemplate.baseStats.speed,
    stability: shellTemplate.baseStats.stability,
    armor: shellTemplate.baseStats.armor,
    maxHealth: shellTemplate.baseStats.maxHealth,
    directionalSprites: shellTemplate.directionalSprites,
    defaultDirection: shellTemplate.defaultDirection as
      | 'north'
      | 'east'
      | 'south'
      | 'west'
      | undefined,
  };
  if (world.hasComponent(playerId, Shell)) {
    world.patchComponent(playerId, Shell, nextShellData);
  } else {
    world.addComponent(playerId, Shell, nextShellData);
  }
  componentsSet.shell = { ...nextShellData };

  // Health (preserve damage taken)
  const oldHealth = world.getComponent(playerId, Health);
  const nextMaxHp = shellTemplate.baseStats.maxHealth;
  const damageTaken = oldHealth ? Math.max(0, oldHealth.max - oldHealth.current) : 0;
  const nextHealth = {
    current: Math.max(1, Math.min(nextMaxHp, nextMaxHp - damageTaken)),
    max: nextMaxHp,
    isAlive: oldHealth?.isAlive ?? true,
  };
  world.patchComponent(playerId, Health, nextHealth);
  componentsSet.health = { ...nextHealth };

  // Defense
  if (world.hasComponent(playerId, Defense)) {
    world.patchComponent(playerId, Defense, { armor: shellTemplate.baseStats.armor });
    componentsSet.defense = { armor: shellTemplate.baseStats.armor };
  }

  // Energy
  const oldEnergy = world.getComponent(playerId, Energy);
  if (oldEnergy) {
    const nextEnergy = {
      ...oldEnergy,
      speed: shellTemplate.baseStats.speed,
    };
    world.patchComponent(playerId, Energy, nextEnergy);
    componentsSet.energy = nextEnergy;
  }

  // PortConfig
  if (world.hasComponent(playerId, PortConfig)) {
    world.patchComponent(playerId, PortConfig, { ...shellTemplate.basePorts });
    componentsSet.portConfig = { ...shellTemplate.basePorts };
  }

  // Sprite (re-resolve directional sprite)
  const resolvedSpriteKey = resolveShellSpawnSprite(shellTemplate);
  if (world.hasComponent(playerId, SpriteComponent)) {
    world.patchComponent(playerId, SpriteComponent, { key: resolvedSpriteKey });
    componentsSet.sprite = {
      ...(world.getComponent(playerId, SpriteComponent) as Record<string, unknown>),
    };
  }

  // LightSource
  if (shellTemplate.lightSource) {
    const parsedLight = LightSource.schema.parse(shellTemplate.lightSource);
    if (world.hasComponent(playerId, LightSource)) {
      world.patchComponent(playerId, LightSource, parsedLight);
    } else {
      world.addComponent(playerId, LightSource, parsedLight);
    }
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
