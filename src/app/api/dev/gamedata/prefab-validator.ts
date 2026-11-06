import type { RoomPrefabTemplate } from '@/game/generation/prefabs/types';

export interface PrefabValidationError {
  id: string;
  severity: 'error' | 'warn';
  message: string;
}

export function validatePrefabRules(prefab: RoomPrefabTemplate): {
  valid: boolean;
  errors: PrefabValidationError[];
  warnings: PrefabValidationError[];
} {
  const errors: PrefabValidationError[] = [];
  const warnings: PrefabValidationError[] = [];

  const { width, height, minFloor, maxFloor, layout, portals, propSpawns, isVaultRoom } = prefab;

  // VAL-PRF-01: Grid Matrix Uniformity
  if (!Array.isArray(layout) || layout.length !== height) {
    errors.push({
      id: 'VAL-PRF-01',
      severity: 'error',
      message: `Grid matrix height mismatch: layout has ${layout?.length ?? 0} rows, expected height=${height}`,
    });
  } else {
    for (let y = 0; y < layout.length; y++) {
      if (layout[y].length !== width) {
        errors.push({
          id: 'VAL-PRF-01',
          severity: 'error',
          message: `Grid matrix row length mismatch at y=${y}: row has ${layout[y].length} chars, expected width=${width}`,
        });
        break;
      }
    }
  }

  if (minFloor > maxFloor) {
    errors.push({
      id: 'VAL-PRF-01',
      severity: 'error',
      message: `Floor range invalid: minFloor (${minFloor}) cannot exceed maxFloor (${maxFloor})`,
    });
  }

  if (errors.length > 0) {
    // If matrix structure is fundamentally invalid, return early
    return { valid: false, errors, warnings };
  }

  // Helper to read tile safely
  const getTile = (x: number, y: number): string => {
    if (x < 0 || x >= width || y < 0 || y >= height) return '#';
    return layout[y]?.[x] ?? '#';
  };

  const isWalkable = (tile: string) => tile !== '#';

  // VAL-PRF-02: Perimeter Portal Alignment
  if (!portals || portals.length === 0) {
    errors.push({
      id: 'VAL-PRF-02',
      severity: 'error',
      message: 'Prefab must have at least one corridor attachment portal in portals[]',
    });
  } else {
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i];
      const isPerimeter = p.x === 0 || p.x === width - 1 || p.y === 0 || p.y === height - 1;
      if (!isPerimeter) {
        errors.push({
          id: 'VAL-PRF-02',
          severity: 'error',
          message: `Portal ${i} at (${p.x}, ${p.y}) is not on the outer perimeter`,
        });
      }

      // Check corners
      const isCorner =
        (p.x === 0 && p.y === 0) ||
        (p.x === width - 1 && p.y === 0) ||
        (p.x === 0 && p.y === height - 1) ||
        (p.x === width - 1 && p.y === height - 1);

      if (isCorner) {
        errors.push({
          id: 'VAL-PRF-02',
          severity: 'error',
          message: `Portal ${i} at (${p.x}, ${p.y}) cannot be positioned on a corner`,
        });
      }

      // Expected outward direction
      let expectedDir: 'north' | 'south' | 'east' | 'west' | null = null;
      let interiorX = p.x;
      let interiorY = p.y;
      if (p.y === 0) {
        expectedDir = 'north';
        interiorY = 1;
      } else if (p.y === height - 1) {
        expectedDir = 'south';
        interiorY = height - 2;
      } else if (p.x === 0) {
        expectedDir = 'west';
        interiorX = 1;
      } else if (p.x === width - 1) {
        expectedDir = 'east';
        interiorX = width - 2;
      }

      if (expectedDir && p.direction !== expectedDir) {
        errors.push({
          id: 'VAL-PRF-02',
          severity: 'error',
          message: `Portal ${i} at (${p.x}, ${p.y}) faces ${p.direction}, expected ${expectedDir}`,
        });
      }

      // Check if blocked by wall on both portal and interior
      if (getTile(p.x, p.y) === '#' && getTile(interiorX, interiorY) === '#') {
        errors.push({
          id: 'VAL-PRF-02',
          severity: 'error',
          message: `Portal ${i} at (${p.x}, ${p.y}) is blocked by solid walls (#) on both portal and interior cells`,
        });
      }
    }
  }

  // VAL-PRF-03: 100% Flood-Fill Reachability
  if (portals && portals.length > 0) {
    const visited = new Set<string>();
    const queue: [number, number][] = [];

    // Start flood from portal 0 (or its interior cell if portal tile is wall)
    const p0 = portals[0];
    let startX = p0.x;
    let startY = p0.y;
    if (getTile(startX, startY) === '#') {
      if (p0.y === 0) startY = 1;
      else if (p0.y === height - 1) startY = height - 2;
      else if (p0.x === 0) startX = 1;
      else if (p0.x === width - 1) startX = width - 2;
    }

    if (isWalkable(getTile(startX, startY))) {
      visited.add(`${startX},${startY}`);
      queue.push([startX, startY]);
    }

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      const neighbors: [number, number][] = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const key = `${nx},${ny}`;
          if (!visited.has(key) && isWalkable(getTile(nx, ny))) {
            visited.add(key);
            queue.push([nx, ny]);
          }
        }
      }
    }

    // Verify all portals reachable
    for (let i = 1; i < portals.length; i++) {
      const p = portals[i];
      let pReachX = p.x;
      let pReachY = p.y;
      if (getTile(p.x, p.y) === '#') {
        if (p.y === 0) pReachY = 1;
        else if (p.y === height - 1) pReachY = height - 2;
        else if (p.x === 0) pReachX = 1;
        else if (p.x === width - 1) pReachX = width - 2;
      }
      if (!visited.has(`${pReachX},${pReachY}`) && !visited.has(`${p.x},${p.y}`)) {
        errors.push({
          id: 'VAL-PRF-03',
          severity: 'error',
          message: `Portal ${i} at (${p.x}, ${p.y}) is disconnected from Portal 0 via walkable tiles`,
        });
      }
    }

    // Verify all interior walkable floor tiles are reached (no isolated pockets)
    let unvisitedWalkableCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = getTile(x, y);
        if (isWalkable(tile) && !visited.has(`${x},${y}`)) {
          unvisitedWalkableCount++;
        }
      }
    }
    if (unvisitedWalkableCount > 0) {
      errors.push({
        id: 'VAL-PRF-03',
        severity: 'error',
        message: `Found ${unvisitedWalkableCount} isolated walkable tile(s) unreachable from perimeter portals`,
      });
    }
  }

  // VAL-PRF-04: Prop Anchor & Front-Access Grounding
  if (Array.isArray(propSpawns)) {
    for (let i = 0; i < propSpawns.length; i++) {
      const p = propSpawns[i];
      if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) {
        errors.push({
          id: 'VAL-PRF-04',
          severity: 'error',
          message: `Prop spawn ${i} at (${p.x}, ${p.y}) is outside prefab bounds [0..${width - 1}, 0..${height - 1}]`,
        });
        continue;
      }

      const tile = getTile(p.x, p.y);
      if (tile === '#') {
        errors.push({
          id: 'VAL-PRF-04',
          severity: 'error',
          message: `Prop spawn ${i} at (${p.x}, ${p.y}) is placed on a solid wall tile (#)`,
        });
      }

      // Check front-facing interaction tile
      if (p.orientation) {
        let fdx = 0;
        let fdy = 0;
        if (p.orientation === 'NORTH') fdy = -1;
        else if (p.orientation === 'EAST') fdx = 1;
        else if (p.orientation === 'SOUTH') fdy = 1;
        else if (p.orientation === 'WEST') fdx = -1;

        const frontX = p.x + fdx;
        const frontY = p.y + fdy;
        if (frontX >= 0 && frontX < width && frontY >= 0 && frontY < height) {
          if (getTile(frontX, frontY) === '#') {
            errors.push({
              id: 'VAL-PRF-04',
              severity: 'error',
              message: `Prop spawn ${i} at (${p.x}, ${p.y}) facing ${p.orientation} has its front access tile (${frontX}, ${frontY}) blocked by a wall (#)`,
            });
          }
        }
      }
    }
  }

  // VAL-PRF-05: Vault Door & Rare Container Invariant
  if (isVaultRoom) {
    let hasVaultDoor = false;
    for (let y = 0; y < height; y++) {
      if (layout[y]?.includes('V')) {
        hasVaultDoor = true;
        break;
      }
    }
    if (!hasVaultDoor) {
      errors.push({
        id: 'VAL-PRF-05',
        severity: 'error',
        message: 'Vault room (isVaultRoom === true) must have at least one encrypted vault door tile ("V") in its layout',
      });
    }

    const hasRareContainer = (propSpawns || []).some(
      (p) => p.anchorType === 'CONTAINER_RARE' || p.guaranteedTemplate === 'prop-safe',
    );
    if (!hasRareContainer) {
      errors.push({
        id: 'VAL-PRF-05',
        severity: 'error',
        message: 'Vault room (isVaultRoom === true) must contain at least one CONTAINER_RARE anchor or prop-safe',
      });
    }
  }

  // VAL-PRF-06: Portal & Chokepoint Ergonomics (Warning)
  if (!isVaultRoom && portals && portals.length < 2) {
    warnings.push({
      id: 'VAL-PRF-06',
      severity: 'warn',
      message: 'Non-vault prefabs should have at least 2 perimeter portals for corridor connectivity',
    });
  }

  if (propSpawns && portals) {
    for (const p of propSpawns) {
      for (const portal of portals) {
        const manhattan = Math.abs(p.x - portal.x) + Math.abs(p.y - portal.y);
        if (manhattan <= 1) {
          warnings.push({
            id: 'VAL-PRF-06',
            severity: 'warn',
            message: `Prop anchor at (${p.x}, ${p.y}) is adjacent to portal (${portal.x}, ${portal.y}), which may impede navigation`,
          });
          break;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
