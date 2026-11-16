import { Orientation, vectorToOrientation } from '../components/environment';

export type CardinalDirectionSuffix = 'north' | 'east' | 'south' | 'west';

export const CARDINAL_DIRECTIONS: readonly CardinalDirectionSuffix[] = [
  'north',
  'east',
  'south',
  'west',
];

export type ShellDirectionalSprites = Partial<Record<CardinalDirectionSuffix, string>>;

export interface DirectionalShellConfig {
  archetypeId?: string;
  id?: string;
  sprite?: string;
  directionalSprites?: ShellDirectionalSprites;
  defaultDirection?: CardinalDirectionSuffix | string;
}

export function normalizeCardinalDirection(
  direction?: string,
): CardinalDirectionSuffix | undefined {
  if (!direction) return undefined;
  const lower = direction.toLowerCase();
  return (CARDINAL_DIRECTIONS as readonly string[]).includes(lower)
    ? (lower as CardinalDirectionSuffix)
    : undefined;
}

export const ORIENTATION_TO_DIRECTION_SUFFIX: Record<Orientation, CardinalDirectionSuffix> = {
  NORTH: 'north',
  EAST: 'east',
  SOUTH: 'south',
  WEST: 'west',
};

interface DirectionalShellEntry {
  match: string;
  prefix: string;
  defaultDirection: CardinalDirectionSuffix;
}

/**
 * Registry of fallback shell prefixes that use `<prefix>-<north|east|south|west>` tiles
 * when explicit `directionalSprites` are not defined on the shell config.
 */
const DIRECTIONAL_SHELL_PREFIXES: readonly DirectionalShellEntry[] = [
  { match: 'bastion', prefix: 'bastion-v1', defaultDirection: 'south' },
];

function findDirectionalShellEntry(shellKeyOrSprite: string): DirectionalShellEntry | undefined {
  const lower = shellKeyOrSprite.toLowerCase();
  return DIRECTIONAL_SHELL_PREFIXES.find((entry) => lower.includes(entry.match));
}

function nonEmptySprite(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function hasConfiguredDirectionalSprites(
  directionalSprites?: ShellDirectionalSprites,
): boolean {
  if (!directionalSprites) return false;
  return CARDINAL_DIRECTIONS.some((dir) => Boolean(nonEmptySprite(directionalSprites[dir])));
}

/**
 * Normalizes a directional sprite map by trimming keys and omitting empty entries.
 */
export function normalizeDirectionalSprites(
  directionalSprites?: ShellDirectionalSprites,
): ShellDirectionalSprites | undefined {
  if (!directionalSprites) return undefined;
  const cleaned: ShellDirectionalSprites = {};
  for (const dir of CARDINAL_DIRECTIONS) {
    const val = nonEmptySprite(directionalSprites[dir]);
    if (val) cleaned[dir] = val;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Resolves the initial default sprite key for a directional shell (e.g. 'bastion-v1-south'),
 * preferring explicit `directionalSprites` / `defaultDirection` over legacy prefix matches.
 */
export function resolveDirectionalShellBaseSprite(
  shellConfigOrKey: string | DirectionalShellConfig,
): string | undefined {
  if (typeof shellConfigOrKey === 'object') {
    const { directionalSprites } = shellConfigOrKey;
    const defaultDirection = normalizeCardinalDirection(shellConfigOrKey.defaultDirection);
    if (hasConfiguredDirectionalSprites(directionalSprites)) {
      if (defaultDirection) {
        const preferred = nonEmptySprite(directionalSprites?.[defaultDirection]);
        if (preferred) return preferred;
      }
      for (const dir of ['south', 'north', 'east', 'west'] as const) {
        const candidate = nonEmptySprite(directionalSprites?.[dir]);
        if (candidate) return candidate;
      }
    }
    const key = shellConfigOrKey.sprite || shellConfigOrKey.archetypeId || shellConfigOrKey.id || '';
    const entry = key ? findDirectionalShellEntry(key) : undefined;
    return entry ? `${entry.prefix}-${defaultDirection ?? entry.defaultDirection}` : undefined;
  }

  const entry = findDirectionalShellEntry(shellConfigOrKey);
  return entry ? `${entry.prefix}-${entry.defaultDirection}` : undefined;
}

/**
 * Resolves the directional sprite key for a shell and cardinal orientation,
 * preferring explicit `directionalSprites` over legacy prefix matches.
 */
export function resolveDirectionalShellSprite(
  shellConfigOrKey: string | DirectionalShellConfig,
  orientation: Orientation,
): string | undefined {
  const suffix = ORIENTATION_TO_DIRECTION_SUFFIX[orientation];
  if (typeof shellConfigOrKey === 'object') {
    if (hasConfiguredDirectionalSprites(shellConfigOrKey.directionalSprites)) {
      return nonEmptySprite(shellConfigOrKey.directionalSprites?.[suffix]);
    }
    const key = shellConfigOrKey.sprite || shellConfigOrKey.archetypeId || shellConfigOrKey.id || '';
    const entry = key ? findDirectionalShellEntry(key) : undefined;
    return entry ? `${entry.prefix}-${suffix}` : undefined;
  }

  const entry = findDirectionalShellEntry(shellConfigOrKey);
  return entry ? `${entry.prefix}-${suffix}` : undefined;
}

/**
 * Resolves the directional sprite key from a grid displacement (dx, dy),
 * returning undefined if (dx, dy) is (0, 0) or the shell is not directional.
 */
export function resolveDirectionalShellSpriteFromDelta(
  shellConfigOrKey: string | DirectionalShellConfig,
  dx: number,
  dy: number,
): string | undefined {
  if (dx === 0 && dy === 0) return undefined;
  return resolveDirectionalShellSprite(shellConfigOrKey, vectorToOrientation(dx, dy));
}

/**
 * Resolves the initial spawn sprite key for a player entity from a Shell record.
 */
export function resolveShellSpawnSprite(shellRecord: DirectionalShellConfig): string {
  const directionalBase = resolveDirectionalShellBaseSprite(shellRecord);
  if (directionalBase) {
    return directionalBase;
  }

  const shellKey = (
    shellRecord.sprite ||
    shellRecord.archetypeId ||
    shellRecord.id ||
    ''
  ).toLowerCase();

  if (shellKey.includes('ghost')) return 'player_ghost';
  if (shellKey.includes('vanguard')) return 'player_vanguard';
  if (shellRecord.sprite) return shellRecord.sprite;
  return 'player_vanguard';
}
