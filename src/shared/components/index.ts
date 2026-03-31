import { Position } from './position';
import { Health } from './health';
import { Energy } from './energy';
import { Actor } from './actor';
import { SpriteComponent } from './sprite';
import { Hostile } from './hostile';
import { Attack } from './attack';
import { Defense } from './defense';
import { LootTable } from './loot-table';
import { AIState } from './ai-state';
import { FovAwareness } from './fov-awareness';
import { BlocksMovement } from './blocks-movement';
import { Item } from './item';
import { PickupEffect } from './pickup-effect';
import { Progression } from './progression';
import { Shell } from './shell';
import { PortConfig } from './port-config';
import { FirmwareSlots } from './firmware-slots';
import { AugmentSlots } from './augment-slots';
import { SoftwareSlots } from './software-slots';
import { Heat } from './heat';
import { AbilityDef } from './ability-def';
import { StatusEffects } from './status-effects';
import { AugmentData } from './augment-data';
import { AugmentState } from './augment-state';
import { SoftwareDef } from './software-def';
import { BurnedSoftware } from './burned-software';
import { RarityTier } from './rarity-tier';
import { PackMember } from './pack-member';
import { DeadZone } from './dead-zone';
import { CorruptionState } from './corruption-state';
import { Stability } from './stability';
import { Scrap } from './scrap';
import { FloorState } from './floor-state';
import { StaircaseMarker } from './staircase-marker';
import { AnchorMarker } from './anchor-marker';

export const COMPONENTS_REGISTRY = [
  Position,
  Health,
  Energy,
  Actor,
  SpriteComponent,
  Hostile,
  Attack,
  Defense,
  LootTable,
  AIState,
  FovAwareness,
  BlocksMovement,
  Item,
  PickupEffect,
  Progression,
  Shell,
  PortConfig,
  FirmwareSlots,
  AugmentSlots,
  SoftwareSlots,
  Heat,
  AbilityDef,
  StatusEffects,
  AugmentData,
  AugmentState,
  SoftwareDef,
  BurnedSoftware,
  RarityTier,
  PackMember,
  DeadZone,
  CorruptionState,
  Stability,
  Scrap,
  FloorState,
  StaircaseMarker,
  AnchorMarker,
] as const;

export * from './position';
export * from './health';
export * from './energy';
export * from './actor';
export * from './sprite';
export * from './hostile';
export * from './attack';
export * from './defense';
export * from './loot-table';
export * from './ai-state';
export * from './fov-awareness';
export * from './blocks-movement';
export * from './item';
export * from './pickup-effect';
export * from './progression';
export * from './shell';
export * from './port-config';
export * from './firmware-slots';
export * from './augment-slots';
export * from './software-slots';
export * from './heat';
export * from './ability-def';
export * from './status-effects';
export * from './augment-data';
export * from './augment-state';
export * from './software-def';
export * from './burned-software';
export * from './rarity-tier';
export * from './pack-member';
export * from './dead-zone';
export * from './corruption-state';
export * from './stability';
export * from './scrap';
export * from './floor-state';
export * from './staircase-marker';
export * from './anchor-marker';
