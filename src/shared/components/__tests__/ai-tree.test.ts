import { describe, it, expect } from 'vitest';
import {
  AIConditionSchema,
  AIActionSchema,
  UtilityConsiderationSchema,
  BehaviorTreeNodeSchema,
} from '../ai-tree';
import { AIState, AIBehavior, AIBehaviorType } from '../ai-state';
import { SpawnEntityIntent } from '../intents';

describe('Shared AI Schemas & Components', () => {
  describe('AIConditionSchema', () => {
    it('validates all condition variants', () => {
      expect(AIConditionSchema.parse({ check: 'CAN_SEE_TARGET' })).toEqual({
        check: 'CAN_SEE_TARGET',
      });
      expect(AIConditionSchema.parse({ check: 'HAS_LAST_KNOWN_TARGET_POS' })).toEqual({
        check: 'HAS_LAST_KNOWN_TARGET_POS',
      });
      expect(AIConditionSchema.parse({ check: 'IS_ALERTED' })).toEqual({
        check: 'IS_ALERTED',
      });
      expect(
        AIConditionSchema.parse({ check: 'TARGET_DISTANCE_LTE', distance: 3 }),
      ).toEqual({
        check: 'TARGET_DISTANCE_LTE',
        distance: 3,
        metric: 'manhattan',
      });
      expect(
        AIConditionSchema.parse({
          check: 'TARGET_DISTANCE_BETWEEN',
          min: 2,
          max: 5,
        }),
      ).toEqual({
        check: 'TARGET_DISTANCE_BETWEEN',
        min: 2,
        max: 5,
        metric: 'manhattan',
      });
      expect(
        AIConditionSchema.parse({ check: 'SELF_HP_BELOW_PERCENT', percent: 30 }),
      ).toEqual({
        check: 'SELF_HP_BELOW_PERCENT',
        percent: 30,
      });
      expect(
        AIConditionSchema.parse({ check: 'HAS_STATUS_EFFECT', statusName: 'DISRUPT' }),
      ).toEqual({
        check: 'HAS_STATUS_EFFECT',
        statusName: 'DISRUPT',
        target: 'self',
      });
      expect(AIConditionSchema.parse({ check: 'IS_PACK_LEADER' })).toEqual({
        check: 'IS_PACK_LEADER',
      });
      expect(
        AIConditionSchema.parse({ check: 'PACK_MEMBERS_ADJACENT_GTE', count: 2 }),
      ).toEqual({
        check: 'PACK_MEMBERS_ADJACENT_GTE',
        count: 2,
      });
      expect(
        AIConditionSchema.parse({ check: 'IN_DIRECTIONAL_COVER_FROM_TARGET' }),
      ).toEqual({
        check: 'IN_DIRECTIONAL_COVER_FROM_TARGET',
      });
      expect(
        AIConditionSchema.parse({ check: 'HAS_VALID_TELEPORT_AMBUSH_TILE' }),
      ).toEqual({
        check: 'HAS_VALID_TELEPORT_AMBUSH_TILE',
        minRange: 2,
        maxRange: 8,
      });
    });
  });

  describe('AIActionSchema', () => {
    it('validates action variants', () => {
      expect(AIActionSchema.parse({ action: 'WAIT' })).toEqual({ action: 'WAIT' });
      expect(AIActionSchema.parse({ action: 'MELEE_BUMP_TARGET' })).toEqual({
        action: 'MELEE_BUMP_TARGET',
      });
      expect(
        AIActionSchema.parse({
          action: 'RANGED_ATTACK_TARGET',
          statusEffect: { name: 'FIRMWARE_LOCK', duration: 3, magnitude: 1 },
          combatMessage: 'Firmware locked!',
        }),
      ).toEqual({
        action: 'RANGED_ATTACK_TARGET',
        statusEffect: { name: 'FIRMWARE_LOCK', duration: 3, magnitude: 1 },
        combatMessage: 'Firmware locked!',
      });
      expect(
        AIActionSchema.parse({
          action: 'MOVE_DIJKSTRA',
          mapType: 'approach_target',
          avoidHazards: true,
          canCrushProps: true,
        }),
      ).toEqual({
        action: 'MOVE_DIJKSTRA',
        mapType: 'approach_target',
        avoidHazards: true,
        canCrushProps: true,
      });
      expect(
        AIActionSchema.parse({
          action: 'TELEPORT_AMBUSH_BEHIND_TARGET',
          minRange: 2,
          maxRange: 8,
          searchRadius: 2,
          combatMessage: 'Blink!',
        }),
      ).toEqual({
        action: 'TELEPORT_AMBUSH_BEHIND_TARGET',
        minRange: 2,
        maxRange: 8,
        searchRadius: 2,
        combatMessage: 'Blink!',
      });
      expect(
        AIActionSchema.parse({
          action: 'SPAWN_ENTITIES_AROUND_SELF',
          templateName: 'dead-zone',
          pattern: 'cardinal_4',
          count: 4,
          deadZoneConfig: { remainingTurns: 6, damagePerTick: 2 },
        }),
      ).toEqual({
        action: 'SPAWN_ENTITIES_AROUND_SELF',
        templateName: 'dead-zone',
        pattern: 'cardinal_4',
        count: 4,
        deadZoneConfig: { remainingTurns: 6, damagePerTick: 2 },
      });
    });
  });

  describe('UtilityConsiderationSchema', () => {
    it('validates considerations with default curve settings', () => {
      const parsed = UtilityConsiderationSchema.parse({
        metric: 'self_hp_ratio',
      });
      expect(parsed).toEqual({
        metric: 'self_hp_ratio',
        curve: 'linear',
        slope: 1,
        invert: false,
        minInput: 0,
        maxInput: 1,
      });
    });
  });

  describe('BehaviorTreeNodeSchema', () => {
    it('validates full recursive Behavior Tree ASTs', () => {
      const tree = {
        type: 'SELECTOR' as const,
        children: [
          {
            type: 'SEQUENCE' as const,
            children: [
              { type: 'CONDITION' as const, condition: { check: 'CAN_SEE_TARGET' as const } },
              {
                type: 'DECORATOR_COOLDOWN' as const,
                cooldownId: 'teleport_cd',
                turns: 2,
                child: {
                  type: 'ACTION' as const,
                  task: {
                    action: 'TELEPORT_AMBUSH_BEHIND_TARGET' as const,
                  },
                },
              },
            ],
          },
          {
            type: 'UTILITY_SELECTOR' as const,
            branches: [
              {
                name: 'retreat',
                weight: 1.5,
                considerations: [
                  {
                    metric: 'self_hp_ratio' as const,
                    curve: 'linear' as const,
                    invert: true,
                  },
                ],
                child: {
                  type: 'ACTION' as const,
                  task: {
                    action: 'MOVE_DIJKSTRA' as const,
                    mapType: 'flee_from_target' as const,
                  },
                },
              },
            ],
          },
          {
            type: 'SUBTREE' as const,
            ref: 'investigate-last-known-pos',
          },
          {
            type: 'ACTION' as const,
            task: {
              action: 'WAIT' as const,
            },
          },
        ],
      };

      const parsed = BehaviorTreeNodeSchema.parse(tree);
      expect(parsed).toBeDefined();
    });
  });

  describe('AIState Component', () => {
    it('validates AIState with treeId, inlineTree, cooldowns, and remainingMemoryTurns', () => {
      const state = AIState.schema.parse({
        behavior: AIBehavior.CHASING,
        behaviorType: AIBehaviorType.NULL_POINTER,
        treeId: 'null_pointer',
        cooldowns: { phase_ambush: 2 },
        memoryTurns: 6,
        remainingMemoryTurns: 3,
        inlineTree: {
          type: 'ACTION',
          task: { action: 'WAIT' },
        },
      });

      expect(state.treeId).toBe('null_pointer');
      expect(state.cooldowns).toEqual({ phase_ambush: 2 });
      expect(state.remainingMemoryTurns).toBe(3);
      expect(state.inlineTree?.type).toBe('ACTION');
    });
  });

  describe('SpawnEntityIntent Component', () => {
    it('validates SpawnEntityIntent structure', () => {
      const intent = SpawnEntityIntent.schema.parse({
        spawnerId: 10,
        spawns: [
          {
            templateName: 'dead-zone',
            x: 5,
            y: 6,
            overrides: {
              deadZone: { remainingTurns: 6, damagePerTick: 2 },
            },
          },
        ],
      });

      expect(intent.spawnerId).toBe(10);
      expect(intent.spawns).toHaveLength(1);
      expect(intent.spawns[0].templateName).toBe('dead-zone');
    });
  });
});
