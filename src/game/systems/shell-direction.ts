import { World } from '@engine/ecs/world';
import { EntityId, Phase } from '@engine/ecs/types';
import { EngineEvents } from '@engine/events/types';
import { GameplayEvents } from '@shared/events/types';
import {
  Position,
  Shell,
  SpriteComponent,
  MoveIntent,
  AttackIntent,
  FirmwareIntent,
  InteractPropIntent,
} from '@shared/components';
import { resolveDirectionalShellSpriteFromDelta } from '@shared/utils/shell-sprite-util';

/**
 * Updates an entity's SpriteComponent key to match a cardinal direction derived from (dx, dy)
 * when the entity uses a directional shell (e.g. Bastion -> bastion-v1-north/east/south/west).
 */
export function applyDirectionalShellFacing<T extends EngineEvents>(
  world: World<T>,
  entityId: EntityId,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  if (!world.entityExists(entityId)) return;

  const sprite = world.getComponent(entityId, SpriteComponent);
  if (!sprite) return;

  const shell = world.getComponent(entityId, Shell);
  const nextSpriteKey =
    (shell
      ? resolveDirectionalShellSpriteFromDelta(
          {
            archetypeId: shell.archetypeId,
            sprite: sprite.key,
            directionalSprites: shell.directionalSprites,
            defaultDirection: shell.defaultDirection,
          },
          dx,
          dy,
        )
      : undefined) ?? resolveDirectionalShellSpriteFromDelta(sprite.key, dx, dy);

  if (nextSpriteKey && nextSpriteKey !== sprite.key) {
    world.patchComponent(entityId, SpriteComponent, { key: nextSpriteKey });
  }
}

/**
 * Updates directional shell sprites before movement/action systems consume intents
 * so the runner faces the selected cardinal direction even when bumping walls or targets.
 */
export function createShellDirectionSystem<T extends GameplayEvents>(world: World<T>) {
  const update = (w: World<T>) => {
    for (const entityId of w.query(MoveIntent, SpriteComponent)) {
      const move = w.getComponent(entityId, MoveIntent)!;
      applyDirectionalShellFacing(w, entityId, move.dx, move.dy);
    }

    for (const entityId of w.query(AttackIntent, Position, SpriteComponent)) {
      const attack = w.getComponent(entityId, AttackIntent)!;
      const pos = w.getComponent(entityId, Position)!;
      const targetPos = w.entityExists(attack.targetId)
        ? w.getComponent(attack.targetId, Position)
        : undefined;
      if (targetPos) {
        applyDirectionalShellFacing(w, entityId, targetPos.x - pos.x, targetPos.y - pos.y);
      }
    }

    for (const entityId of w.query(InteractPropIntent, Position, SpriteComponent)) {
      const interact = w.getComponent(entityId, InteractPropIntent)!;
      const pos = w.getComponent(entityId, Position)!;
      const propPos = w.entityExists(interact.targetPropId)
        ? w.getComponent(interact.targetPropId, Position)
        : undefined;
      if (propPos) {
        applyDirectionalShellFacing(w, entityId, propPos.x - pos.x, propPos.y - pos.y);
      }
    }

    for (const entityId of w.query(FirmwareIntent, Position, SpriteComponent)) {
      const fw = w.getComponent(entityId, FirmwareIntent)!;
      if (fw.targetX !== undefined && fw.targetY !== undefined) {
        const pos = w.getComponent(entityId, Position)!;
        applyDirectionalShellFacing(w, entityId, fw.targetX - pos.x, fw.targetY - pos.y);
      }
    }
  };

  return {
    init() {
      world.registerSystem(Phase.ACTION, update, 'ShellDirectionSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.ACTION, update);
    },
    update,
  };
}

export type ShellDirectionSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createShellDirectionSystem<T>
>;
