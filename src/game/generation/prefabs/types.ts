export type PropAnchorTag =
  | 'PROP_DESK_CORNER'
  | 'PROP_LOCKER_WALL'
  | 'SURFACE_TABLE_TOP'
  | 'CONTAINER_RARE';

export interface RoomPrefabTemplate {
  id: string;
  name: string;
  faction: 'traxus' | 'cyberacme' | 'sekiguchi' | 'nucaloric';
  isVaultRoom?: boolean;
  /** When true, interior tiles block Phase_Shift.sh teleportation and wall-penetrating FOV while SecurityLock.isLocked is true */
  faradayShielded?: boolean;
  minFloor: number;
  maxFloor: number;
  width: number; // 10 to 16 tiles
  height: number; // 10 to 16 tiles
  /** ASCII rows: '#' = wall, '.' = floor, '+' = door, 'V' = encrypted vault door, '~' = dead-zone hazard */
  layout: string[];
  /** Explicit corridor attachment portals on the room perimeter */
  portals: Array<{ x: number; y: number; direction: 'north' | 'south' | 'east' | 'west' }>;
  /** Authored prop spawn coordinates */
  propSpawns: Array<{ x: number; y: number; anchorType: PropAnchorTag; guaranteedTemplate?: string }>;
}
