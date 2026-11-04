import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const FactionThemeSchema = z.enum([
  'traxus',
  'cyberacme',
  'sekiguchi',
  'nucaloric',
  'system',
]);
export type FactionTheme = z.infer<typeof FactionThemeSchema>;

export const SectorConditionSchema = z.enum([
  'NOMINAL',
  'THERMAL_SURGE',
  'DARK_SUBNET',
  'OVERCLOCKED_GRID',
]);
export type SectorCondition = z.infer<typeof SectorConditionSchema>;

export const PropClassSchema = z.enum([
  'workstation',
  'locker',
  'cabinet',
  'surface_table',
  'encrypted_safe',
  'vault_door',
  'dead_drop_uplink',
  'reality_stabilizer',
  'cooling_vent',
  'subnet_console',
  'volatile_vat',
  'capacitor_bank',
]);
export type PropClass = z.infer<typeof PropClassSchema>;

export const Prop = defineComponent(
  'prop',
  z.object({
    propId: z.string(),
    faction: FactionThemeSchema,
    propClass: PropClassSchema,
    isSearched: z.boolean().default(false).optional(),
    heatCostOnAccess: z.number().default(0).optional(),
    ventAmount: z.number().default(0).optional(),
    stabilityRestoreAmount: z.number().default(0).optional(),
    deadDropFluxCost: z.number().int().min(0).default(25).optional(),
  }),
);
export type PropData = z.infer<typeof Prop.schema>;

export const SecurityLock = defineComponent(
  'securityLock',
  z.object({
    isLocked: z.boolean().default(true).optional(),
    keyIdRequired: z.string().default('access_key').optional(),
    overclockHeatCost: z.number().int().min(0).default(35).optional(),
    alertRadiusOnBypass: z.number().int().min(0).default(12).optional(),
    /** Optional bounding box of interior room tiles protected by Faraday shielding while locked */
    faradayBounds: z
      .object({
        x: z.number().int(),
        y: z.number().int(),
        width: z.number().int(),
        height: z.number().int(),
      })
      .optional(),
  }),
);
export type SecurityLockData = z.infer<typeof SecurityLock.schema>;

export const StoredLootItemSchema = z.object({
  templateId: z.string(),
  rarityTier: z.enum(['common', 'uncommon', 'rare', 'legendary']).optional(),
});
export type StoredLootItem = z.infer<typeof StoredLootItemSchema>;

export const Container = defineComponent(
  'container',
  z.object({
    containerId: z.string(),
    capacity: z.number().int().min(1).max(8).default(4).optional(),
    highestRarity: z.enum(['common', 'uncommon', 'rare', 'legendary']).optional(),
    /** Child entity IDs of spawned items stored inside this container (empty before opening) */
    itemEntityIds: z.array(z.number().int()).default([]).optional(),
    scrapYield: z.number().int().min(0).default(0).optional(),
    fluxYield: z.number().int().min(0).default(0).optional(),
    grantsAccessKey: z.boolean().default(false).optional(),
    blueprintId: z.string().optional(),
    blueprintType: z.enum(['firmware', 'augment']).optional(),
    /** Deterministically rolled items preserved server-side until searched */
    storedLoot: z.array(StoredLootItemSchema).optional(),
  }),
);
export type ContainerData = z.infer<typeof Container.schema>;

export const InteractiveSurface = defineComponent(
  'interactiveSurface',
  z.object({
    surfaceId: z.string(),
    providesCover: z.boolean().default(true).optional(),
    coverDamageReduction: z.number().min(0).max(1).default(0.25).optional(),
    destructible: z.boolean().default(true).optional(),
    hazardOnDestroy: z.enum(['none', 'cryo_spill', 'emp_arc', 'thermal_burst']).default('none').optional(),
    cascadeRadius: z.number().int().min(0).default(2).optional(),
  }),
);
export type InteractiveSurfaceData = z.infer<typeof InteractiveSurface.schema>;

export const CorruptedNode = defineComponent(
  'corruptedNode',
  z.object({
    corruptionLevel: z.number().int().min(1).max(3).default(1).optional(),
    trapType: z.enum(['hud_glitch', 'acoustic_alert', 'thermal_dump']).optional(),
    isDisarmed: z.boolean().default(false).optional(),
    triggered: z.boolean().default(false).optional(),
    revealed: z.boolean().default(false).optional(),
  }),
);
export type CorruptedNodeData = z.infer<typeof CorruptedNode.schema>;

export const InteractPropIntent = defineComponent(
  'interactPropIntent',
  z.object({
    targetPropId: z.number().int(),
    /** True when explicitly triggered via [E] key to bypass CorruptedNode or Overclock safeguards */
    forceOverride: z.boolean().default(false).optional(),
    /** Optional inventory item entity ID or blueprint ID when transmitting via a Dead-Drop Uplink */
    deadDropSelectionId: z.union([z.number().int(), z.string()]).optional(),
  }),
);
export type InteractPropIntentData = z.infer<typeof InteractPropIntent.schema>;

export const PropInteractedThisTurn = defineComponent(
  'propInteractedThisTurn',
  z.object({
    propEntityId: z.number().int(),
    propClass: z.string(),
    wasOverclockBypass: z.boolean().default(false).optional(),
    wasCorruptedTrap: z.boolean().default(false).optional(),
    interactedBy: z.number().int().optional(),
  }),
);
export type PropInteractedThisTurnData = z.infer<typeof PropInteractedThisTurn.schema>;
