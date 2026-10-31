export interface ItemSpec {
  label: string;
  value: string;
  color?: string;
}

export type ItemType = 'firmware' | 'augment' | 'software' | 'equipment' | 'item';

export type StampVariant = 'danger' | 'cyan' | 'secured' | 'amber';

export interface ItemMetadata {
  id: string;
  name: string;
  kanjiSub: string;
  type: ItemType;
  typeLabel: string;
  rarityTier: string;
  rarityLabel: string;
  description: string;
  statusBadge: string;
  statusVariant: StampVariant;
  specs: ItemSpec[];
  footerText?: string;
}

export interface ResolveItemParams {
  templateId: string;
  type?: string;
  rarity?: string;
  cost?: number;
  costCurrency?: 'CR' | 'FLX';
  floor?: number;
  entityId?: number;
  status?: string;
  statusVariant?: StampVariant;
  coord?: string;
  compiledAt?: number;
}

interface KnownTemplateDefinition {
  name: string;
  kanjiSub: string;
  type: ItemType;
  typeLabel: string;
  defaultRarity: string;
  description: string;
  specs: ItemSpec[];
}

const KNOWN_TEMPLATES: Record<string, KnownTemplateDefinition> = {
  // --- FIRMWARES ---
  'phase-shift': {
    name: 'Phase_Shift.sh',
    kanjiSub: '位相転移 // PHASE SHIFT',
    type: 'firmware',
    typeLabel: 'FIRMWARE // SYSTEM PROGRAM',
    defaultRarity: 'common',
    description: 'High-velocity quantum displacement drive. Instantly dashes runner forward 5 grid tiles through open coordinates.',
    specs: [
      { label: 'THERMAL GENERATION', value: '+25 HEAT', color: 'var(--c-warning)' },
      { label: 'DISPLACEMENT RANGE', value: '5 TILES', color: 'var(--c-accent)' },
      { label: 'EXECUTION TARGET', value: 'SELF // DASH' },
      { label: 'TACTICAL ROLE', value: 'RAPID EVASION' },
    ],
  },
  'neural-spike': {
    name: 'Neural_Spike.exe',
    kanjiSub: '神経撃針 // NEURAL SPIKE',
    type: 'firmware',
    typeLabel: 'FIRMWARE // SYSTEM PROGRAM',
    defaultRarity: 'common',
    description: 'Direct wireless logic spike focused on remote cybernetic targets. Pierces electronic armor countermeasures.',
    specs: [
      { label: 'THERMAL GENERATION', value: '+40 HEAT', color: 'var(--c-warning)' },
      { label: 'EFFECTIVE RANGE', value: '6 TILES', color: 'var(--c-accent)' },
      { label: 'BASE DISRUPTION', value: '15 DAMAGE', color: 'var(--c-danger)' },
      { label: 'EXECUTION TARGET', value: 'RANGED ATTACK' },
    ],
  },
  'extended-sight': {
    name: 'Extended_Sight.sys',
    kanjiSub: '広域視覚 // EXTENDED SIGHT',
    type: 'firmware',
    typeLabel: 'FIRMWARE // SYSTEM PROGRAM',
    defaultRarity: 'uncommon',
    description: 'Overclocks optical arrays to drastically expand field of view, dissipating extra heat per active cycle.',
    specs: [
      { label: 'ACTIVATION SURGE', value: '+10 HEAT', color: 'var(--c-warning)' },
      { label: 'MAINTENANCE DRAIN', value: '10 HEAT / TURN', color: 'var(--c-warning)' },
      { label: 'OPTICAL RADIUS', value: '12 TILES', color: 'var(--c-accent)' },
      { label: 'OPERATIONAL MODE', value: 'CONTINUOUS TOGGLE' },
    ],
  },
  'basic-strike': {
    name: 'BASIC_STRIKE.exe',
    kanjiSub: '基本打撃 // BASIC STRIKE',
    type: 'firmware',
    typeLabel: 'FIRMWARE // SYSTEM PROGRAM',
    defaultRarity: 'common',
    description: 'Close-quarters hydraulic punch delivered to an adjacent hostile target.',
    specs: [
      { label: 'THERMAL GENERATION', value: '+15 HEAT', color: 'var(--c-warning)' },
      { label: 'ENGAGEMENT RANGE', value: '1 TILE [MELEE]', color: 'var(--c-accent)' },
      { label: 'BASE DISRUPTION', value: '8 DAMAGE', color: 'var(--c-danger)' },
      { label: 'TACTICAL ROLE', value: 'STANDARD MELEE' },
    ],
  },
  'kinetic-link': {
    name: 'KINETIC_LINK.exe',
    kanjiSub: '運動連動 // KINETIC LINK',
    type: 'firmware',
    typeLabel: 'FIRMWARE // SYSTEM PROGRAM',
    defaultRarity: 'uncommon',
    description: 'Tethered kinetic pulse pulling runner 3 tiles into engagement distance, delivering an impact blow.',
    specs: [
      { label: 'THERMAL GENERATION', value: '+25 HEAT', color: 'var(--c-warning)' },
      { label: 'PULL TRAJECTORY', value: '3 TILES DASH', color: 'var(--c-accent)' },
      { label: 'IMPACT DAMAGE', value: '5 DAMAGE', color: 'var(--c-danger)' },
      { label: 'ENGAGEMENT RANGE', value: '4 TILES' },
    ],
  },
  'ghost-pulse': {
    name: 'GHOST_PULSE.exe',
    kanjiSub: '幽体波動 // GHOST PULSE',
    type: 'firmware',
    typeLabel: 'FIRMWARE // SYSTEM PROGRAM',
    defaultRarity: 'rare',
    description: 'Emits an electromagnetic pulse wave that highlights all hostile signatures within 10 tiles through obstacles.',
    specs: [
      { label: 'THERMAL GENERATION', value: '+30 HEAT', color: 'var(--c-warning)' },
      { label: 'RADAR RADIUS', value: '10 TILES', color: 'var(--c-accent)' },
      { label: 'PULSE RANGE', value: '5 TILES' },
      { label: 'TACTICAL ROLE', value: 'RECONNAISSANCE' },
    ],
  },
  'logic-jam': {
    name: 'LOGIC_JAM.exe',
    kanjiSub: '論理妨害 // LOGIC JAM',
    type: 'firmware',
    typeLabel: 'FIRMWARE // SYSTEM PROGRAM',
    defaultRarity: 'rare',
    description: 'Overwhelms target CPU with recursive memory allocation cycles, freezing entity action for 1 turn.',
    specs: [
      { label: 'THERMAL GENERATION', value: '+20 HEAT', color: 'var(--c-warning)' },
      { label: 'DISRUPTION RANGE', value: '3 TILES', color: 'var(--c-accent)' },
      { label: 'TARGET STATUS', value: 'STUN // 1 TURN', color: 'var(--c-danger)' },
      { label: 'TACTICAL ROLE', value: 'CROWD CONTROL' },
    ],
  },
  'phased-overdrive': {
    name: 'PHASED_OVERDRIVE.exe',
    kanjiSub: '超越位相 // PHASED OVERDRIVE',
    type: 'firmware',
    typeLabel: 'FIRMWARE // ARCHITECT PROGRAM',
    defaultRarity: 'legendary',
    description: 'Architected winner firmware. Long-range hyper-velocity dash attack delivering crushing impact damage.',
    specs: [
      { label: 'THERMAL GENERATION', value: '+35 HEAT', color: 'var(--c-warning)' },
      { label: 'DASH TRAJECTORY', value: '6 TILES', color: 'var(--c-accent)' },
      { label: 'LETHAL DISRUPTION', value: '20 DAMAGE', color: 'var(--c-danger)' },
      { label: 'CLASSIFICATION', value: 'ARCHITECT TIER' },
    ],
  },

  // --- AUGMENTS ---
  'displacement-venting': {
    name: 'Displacement_Venting.arc',
    kanjiSub: '変位排熱 // DISPLACEMENT VENTING',
    type: 'augment',
    typeLabel: 'AUGMENT // PASSIVE CIRCUIT',
    defaultRarity: 'common',
    description: 'Emergency heat dissipation valve. Automatically purges internal thermal buildup whenever any firmware executes.',
    specs: [
      { label: 'TRIGGER CONDITION', value: 'ON ACTIVATION', color: 'var(--c-accent)' },
      { label: 'THERMAL PURGE', value: '-15 HEAT', color: 'var(--c-accent-secondary)' },
      { label: 'COOLDOWN PERIOD', value: '0 TURNS' },
      { label: 'TRIGGER CEILING', value: '1 / TURN' },
    ],
  },
  'static-siphon': {
    name: 'Static_Siphon.arc',
    kanjiSub: '静電吸収 // STATIC SIPHON',
    type: 'augment',
    typeLabel: 'AUGMENT // PASSIVE CIRCUIT',
    defaultRarity: 'uncommon',
    description: 'Harvests electromagnetic discharge from simultaneous firmware execution and enemy termination to deploy a barrier.',
    specs: [
      { label: 'TRIGGER CONDITION', value: 'ACTIVATION & KILL', color: 'var(--c-accent)' },
      { label: 'BARRIER RECHARGE', value: '+5 SHIELD', color: 'var(--c-accent-secondary)' },
      { label: 'COOLDOWN PERIOD', value: '0 TURNS' },
      { label: 'TRIGGER CEILING', value: '1 / TURN' },
    ],
  },
  'neural-feedback': {
    name: 'Neural_Feedback.arc',
    kanjiSub: '神経帰還 // NEURAL FEEDBACK',
    type: 'augment',
    typeLabel: 'AUGMENT // PASSIVE CIRCUIT',
    defaultRarity: 'rare',
    description: 'Adrenaline routing subroutine. Grants a potent damage amplification boost for 1 turn following enemy termination.',
    specs: [
      { label: 'TRIGGER CONDITION', value: 'ON KILL', color: 'var(--c-accent)' },
      { label: 'COMBAT MODIFIER', value: '+25% DAMAGE', color: 'var(--c-danger)' },
      { label: 'EFFECT DURATION', value: '1 TURN' },
      { label: 'TRIGGER CEILING', value: '1 / TURN' },
    ],
  },
  'neural-recursion': {
    name: 'NEURAL_RECURSION.arc',
    kanjiSub: '神経再帰 // NEURAL RECURSION',
    type: 'augment',
    typeLabel: 'AUGMENT // ARCHITECT CIRCUIT',
    defaultRarity: 'legendary',
    description: 'Architected winner augment. Grants +30% damage boost and purges 10 heat upon firmware activation.',
    specs: [
      { label: 'TRIGGER CONDITION', value: 'ON ACTIVATION', color: 'var(--c-accent)' },
      { label: 'COMBAT MODIFIER', value: '+30% DAMAGE', color: 'var(--c-danger)' },
      { label: 'THERMAL PURGE', value: '-10 HEAT', color: 'var(--c-accent-secondary)' },
      { label: 'COOLDOWN PERIOD', value: '1 TURN' },
    ],
  },
  'static-collapse': {
    name: 'STATIC_COLLAPSE.arc',
    kanjiSub: '静電崩壊 // STATIC COLLAPSE',
    type: 'augment',
    typeLabel: 'AUGMENT // ARCHITECT CIRCUIT',
    defaultRarity: 'legendary',
    description: 'Architected winner augment. Deploys reinforced shields and violently vents heat upon enemy termination.',
    specs: [
      { label: 'TRIGGER CONDITION', value: 'ON KILL', color: 'var(--c-accent)' },
      { label: 'BARRIER RECHARGE', value: '+15 SHIELD (2 TURNS)', color: 'var(--c-accent-secondary)' },
      { label: 'THERMAL PURGE', value: '-20 HEAT', color: 'var(--c-accent)' },
      { label: 'COOLDOWN PERIOD', value: '2 TURNS' },
    ],
  },

  // --- SOFTWARE ---
  'bleed-v0': {
    name: 'Bleed.exe v0',
    kanjiSub: '出血損耗 // BLEED DRIVER',
    type: 'software',
    typeLabel: 'SOFTWARE // KERNEL DRIVER',
    defaultRarity: 'common',
    description: 'Injects corrupted binary packets into weapon strikes, inflicting a bleeding damage-over-time condition.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'DISRUPTION TYPE', value: 'DoT [2 DMG / TICK]', color: 'var(--c-danger)' },
      { label: 'DEBUFF DURATION', value: '3 TURNS' },
      { label: 'BASE MAGNITUDE', value: 'TIER 0' },
    ],
  },
  'bleed-v1': {
    name: 'Bleed.exe v1',
    kanjiSub: '出血損耗 // BLEED DRIVER',
    type: 'software',
    typeLabel: 'SOFTWARE // KERNEL DRIVER',
    defaultRarity: 'uncommon',
    description: 'Refined combat driver. Deals heightened bleeding damage-over-time on all weapon attacks.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'DISRUPTION TYPE', value: 'DoT [3 DMG / TICK]', color: 'var(--c-danger)' },
      { label: 'DEBUFF DURATION', value: '3 TURNS' },
      { label: 'BASE MAGNITUDE', value: 'TIER 1' },
    ],
  },
  'bleed-v2': {
    name: 'Bleed.exe v2',
    kanjiSub: '出血損耗 // BLEED DRIVER',
    type: 'software',
    typeLabel: 'SOFTWARE // KERNEL DRIVER',
    defaultRarity: 'rare',
    description: 'High-yield military driver causing severe vascular tearing and accelerated bleeding damage.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'DISRUPTION TYPE', value: 'DoT [5 DMG / TICK]', color: 'var(--c-danger)' },
      { label: 'DEBUFF DURATION', value: '3 TURNS' },
      { label: 'BASE MAGNITUDE', value: 'TIER 2' },
    ],
  },
  'bleed-v3': {
    name: 'Bleed.exe v3',
    kanjiSub: '出血損耗 // BLEED DRIVER',
    type: 'software',
    typeLabel: 'SOFTWARE // KERNEL DRIVER',
    defaultRarity: 'legendary',
    description: 'Apex bleeding payload designed to rapidly dismantle cybernetic hostiles under heavy bleeding debuffs.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'DISRUPTION TYPE', value: 'DoT [8 DMG / TICK]', color: 'var(--c-danger)' },
      { label: 'DEBUFF DURATION', value: '4 TURNS' },
      { label: 'BASE MAGNITUDE', value: 'TIER 3' },
    ],
  },
  'auto-loader-v0': {
    name: 'Auto-Loader.msi v0',
    kanjiSub: '自動装填 // AUTO LOADER',
    type: 'software',
    typeLabel: 'SOFTWARE // ACTION ECONOMY',
    defaultRarity: 'common',
    description: 'Decouples locomotion servos from firmware sequencing. Move and execute Firmware in the same turn.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'ACTION ECONOMY', value: 'MOVE + FIRMWARE', color: 'var(--c-accent-secondary)' },
      { label: 'VENT EXCLUSION', value: 'DOES NOT APPLY TO VENT' },
      { label: 'BUS OVERRIDE', value: 'NOMINAL' },
    ],
  },
  'auto-loader-v1': {
    name: 'Auto-Loader.msi v1',
    kanjiSub: '自動装填 // AUTO LOADER',
    type: 'software',
    typeLabel: 'SOFTWARE // ACTION ECONOMY',
    defaultRarity: 'uncommon',
    description: 'Upgraded servo scheduler allowing smooth repositioning and simultaneous firmware deployment.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'ACTION ECONOMY', value: 'MOVE + FIRMWARE', color: 'var(--c-accent-secondary)' },
      { label: 'FIRMWARE DELAY', value: 'ZERO OVERHEAD' },
      { label: 'BUS OVERRIDE', value: 'SYNCHRONIZED' },
    ],
  },
  'auto-loader-v2': {
    name: 'Auto-Loader.msi v2',
    kanjiSub: '自動装填 // AUTO LOADER',
    type: 'software',
    typeLabel: 'SOFTWARE // ACTION ECONOMY',
    defaultRarity: 'rare',
    description: 'Advanced parallel thread scheduler optimizing action point expenditure for high-speed engagement.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'ACTION ECONOMY', value: 'MOVE + FIRMWARE', color: 'var(--c-accent-secondary)' },
      { label: 'LATENCY REDUCTION', value: '-15%' },
      { label: 'BUS OVERRIDE', value: 'HYPER-THREADED' },
    ],
  },
  'auto-loader-v3': {
    name: 'Auto-Loader.msi v3',
    kanjiSub: '自動装填 // AUTO LOADER',
    type: 'software',
    typeLabel: 'SOFTWARE // ACTION ECONOMY',
    defaultRarity: 'legendary',
    description: 'Masterwork combat scheduler granting flawless concurrent motion and combat subroutine execution.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'ACTION ECONOMY', value: 'MOVE + FIRMWARE', color: 'var(--c-accent-secondary)' },
      { label: 'HEAT RETENTION', value: 'STABLE DISSIPATION' },
      { label: 'BUS OVERRIDE', value: 'ZERO LATENCY' },
    ],
  },
  'vampire-v0': {
    name: 'Vampire.exe v0',
    kanjiSub: '生体吸収 // VAMPIRE ROUTINE',
    type: 'software',
    typeLabel: 'SOFTWARE // REPAIR ROUTINE',
    defaultRarity: 'common',
    description: 'Extracts nanite remnants from defeated enemies to immediately patch runner chassis armor and health.',
    specs: [
      { label: 'SOCKET TARGET', value: 'ARMOR SLOT', color: 'var(--c-accent)' },
      { label: 'CHASSIS REPAIR', value: '+5 HP ON ANY KILL', color: 'var(--c-accent-secondary)' },
      { label: 'REPAIR LATENCY', value: 'INSTANT PATCH' },
      { label: 'EFFICIENCY', value: 'BASIC CONVERSION' },
    ],
  },
  'vampire-v1': {
    name: 'Vampire.exe v1',
    kanjiSub: '生体吸収 // VAMPIRE ROUTINE',
    type: 'software',
    typeLabel: 'SOFTWARE // REPAIR ROUTINE',
    defaultRarity: 'uncommon',
    description: 'Optimized nanite harvester improving organic and synthetic salvage yield from neutralized foes.',
    specs: [
      { label: 'SOCKET TARGET', value: 'ARMOR SLOT', color: 'var(--c-accent)' },
      { label: 'CHASSIS REPAIR', value: '+8 HP ON ANY KILL', color: 'var(--c-accent-secondary)' },
      { label: 'REPAIR LATENCY', value: 'INSTANT PATCH' },
      { label: 'EFFICIENCY', value: 'HIGH PURITY' },
    ],
  },
  'vampire-v2': {
    name: 'Vampire.exe v2',
    kanjiSub: '生体吸収 // VAMPIRE ROUTINE',
    type: 'software',
    typeLabel: 'SOFTWARE // REPAIR ROUTINE',
    defaultRarity: 'rare',
    description: 'High-density siphon module channeling massive vitality return upon each confirmed hostile elimination.',
    specs: [
      { label: 'SOCKET TARGET', value: 'ARMOR SLOT', color: 'var(--c-accent)' },
      { label: 'CHASSIS REPAIR', value: '+12 HP ON ANY KILL', color: 'var(--c-accent-secondary)' },
      { label: 'REPAIR LATENCY', value: 'INSTANT PATCH' },
      { label: 'EFFICIENCY', value: 'TACTICAL OVERCHARGE' },
    ],
  },
  'vampire-v3': {
    name: 'Vampire.exe v3',
    kanjiSub: '生体吸収 // VAMPIRE ROUTINE',
    type: 'software',
    typeLabel: 'SOFTWARE // REPAIR ROUTINE',
    defaultRarity: 'legendary',
    description: 'Autonomous reconstitution engine reconstructing damaged superstructure with every elimination.',
    specs: [
      { label: 'SOCKET TARGET', value: 'ARMOR SLOT', color: 'var(--c-accent)' },
      { label: 'CHASSIS REPAIR', value: '+18 HP ON ANY KILL', color: 'var(--c-accent-secondary)' },
      { label: 'REPAIR LATENCY', value: 'INSTANT PATCH' },
      { label: 'EFFICIENCY', value: 'TOTAL RECONSTITUTION' },
    ],
  },
  'void-echo': {
    name: 'Void_Echo.exe',
    kanjiSub: '虚無木霊 // VOID ECHO',
    type: 'software',
    typeLabel: 'SOFTWARE // ARCHITECT DRIVER',
    defaultRarity: 'legendary',
    description: 'Architected winner software program. Inflicts lethal resonant bleeding DoT on target systems.',
    specs: [
      { label: 'SOCKET TARGET', value: 'WEAPON SLOT', color: 'var(--c-accent)' },
      { label: 'DISRUPTION TYPE', value: 'DoT [4 DMG / TICK]', color: 'var(--c-danger)' },
      { label: 'PURCHASE COST', value: '500 CR', color: 'var(--c-scrap)' },
      { label: 'CLASSIFICATION', value: 'ARCHITECT TIER' },
    ],
  },

  // --- EQUIPMENT ---
  'armor-v1': {
    name: 'Standard Plating',
    kanjiSub: '基本装甲 // ARMOR PLATING',
    type: 'equipment',
    typeLabel: 'EQUIPMENT // CHASSIS PLATING',
    defaultRarity: 'common',
    description: 'Standard kinetic armor plating forged to deflect basic projectiles and energy shockwaves.',
    specs: [
      { label: 'DEFENSIVE RATING', value: '+2 ARMOR', color: 'var(--c-accent)' },
      { label: 'CHASSIS SLOT', value: 'ARMOR BUS' },
      { label: 'SOCKET PORTS', value: '1 SOFTWARE BAY' },
      { label: 'STRUCTURAL GRADE', value: 'MIL-SPEC COMPOSITE' },
    ],
  },
  'armor-v2': {
    name: 'Refined Plating',
    kanjiSub: '精密装甲 // REFINED PLATING',
    type: 'equipment',
    typeLabel: 'EQUIPMENT // CHASSIS PLATING',
    defaultRarity: 'uncommon',
    description: 'Multi-layered ceramic-titanium composite offering substantial kinetic and thermal absorption.',
    specs: [
      { label: 'DEFENSIVE RATING', value: '+4 ARMOR', color: 'var(--c-accent)' },
      { label: 'CHASSIS SLOT', value: 'ARMOR BUS' },
      { label: 'SOCKET PORTS', value: '2 SOFTWARE BAYS' },
      { label: 'STRUCTURAL GRADE', value: 'REINFORCED CERAMIC' },
    ],
  },
  'armor-v3': {
    name: 'Masterwork Plating',
    kanjiSub: '極致装甲 // MASTERWORK PLATING',
    type: 'equipment',
    typeLabel: 'EQUIPMENT // CHASSIS PLATING',
    defaultRarity: 'rare',
    description: 'Super-dense carbon-nanotube lattice capable of neutralizing direct artillery strikes.',
    specs: [
      { label: 'DEFENSIVE RATING', value: '+6 ARMOR', color: 'var(--c-accent)' },
      { label: 'CHASSIS SLOT', value: 'ARMOR BUS' },
      { label: 'SOCKET PORTS', value: '3 SOFTWARE BAYS' },
      { label: 'STRUCTURAL GRADE', value: 'CARBON NANOTUBE' },
    ],
  },
  'rifle-v1': {
    name: 'Standard Kinetic Rifle',
    kanjiSub: '実体小銃 // KINETIC RIFLE',
    type: 'equipment',
    typeLabel: 'EQUIPMENT // PRIMARY WEAPON',
    defaultRarity: 'common',
    description: 'Standard magnetic acceleration firearm firing solid armor-piercing kinetic penetrators.',
    specs: [
      { label: 'WEAPON CLASS', value: 'KINETIC ACCELERATOR', color: 'var(--c-accent)' },
      { label: 'CHASSIS SLOT', value: 'WEAPON BUS' },
      { label: 'DEFAULT ATTACK', value: 'BASIC STRIKE INTEGRATION' },
      { label: 'MUZZLE VELOCITY', value: 'MACH 4.2' },
    ],
  },
  'rifle-v2': {
    name: 'Refined Kinetic Rifle',
    kanjiSub: '精密小銃 // REFINED RIFLE',
    type: 'equipment',
    typeLabel: 'EQUIPMENT // PRIMARY WEAPON',
    defaultRarity: 'uncommon',
    description: 'Enhanced barrel harmonics and liquid nitrogen cooling for sustained armor-penetrating volleys.',
    specs: [
      { label: 'WEAPON CLASS', value: 'KINETIC ACCELERATOR', color: 'var(--c-accent)' },
      { label: 'CHASSIS SLOT', value: 'WEAPON BUS' },
      { label: 'MUZZLE VELOCITY', value: 'MACH 5.8' },
      { label: 'CYCLIC HARMONICS', value: 'OPTIMIZED' },
    ],
  },
  'rifle-v3': {
    name: 'Masterwork Kinetic Rifle',
    kanjiSub: '極致小銃 // MASTERWORK RIFLE',
    type: 'equipment',
    typeLabel: 'EQUIPMENT // PRIMARY WEAPON',
    defaultRarity: 'rare',
    description: 'Top-tier rail-accelerated linear cannon delivering catastrophic armor shatter upon impact.',
    specs: [
      { label: 'WEAPON CLASS', value: 'RAIL ACCELERATOR', color: 'var(--c-accent)' },
      { label: 'CHASSIS SLOT', value: 'WEAPON BUS' },
      { label: 'MUZZLE VELOCITY', value: 'HYPERSONIC' },
      { label: 'SHATTER PROBABILITY', value: 'HIGH' },
    ],
  },

  // --- CONSUMABLES & MISC ---
  'health-potion': {
    name: 'Health Injector',
    kanjiSub: '修復注入 // REPAIR INJECTOR',
    type: 'item',
    typeLabel: 'CONSUMABLE // REPAIR CANISTER',
    defaultRarity: 'common',
    description: 'Single-use pressurized aerosol canister filled with rapid-coagulating bio-repair nanites.',
    specs: [
      { label: 'REPAIR VOLUME', value: '+50 HP RESTORATION', color: 'var(--c-accent-secondary)' },
      { label: 'ADMINISTRATION', value: 'INSTANT USE' },
      { label: 'DISPOSAL STATE', value: 'EXPENDABLE' },
    ],
  },
  'blueprint-locked': {
    name: 'Encrypted Data Core',
    kanjiSub: '未解読核 // ENCRYPTED CORE',
    type: 'item',
    typeLabel: 'ARCHIVE // RAW INTEL',
    defaultRarity: 'rare',
    description: 'Sealed cryptographic memory storage containing unknown firmware or augment schematic data.',
    specs: [
      { label: 'ENCRYPTION', value: 'TAIKOKU 4096-BIT' },
      { label: 'WORKSHOP ACTION', value: 'QUANTUM COMPILATION' },
      { label: 'SECURITY CLEARANCE', value: 'RESTRICTED' },
    ],
  },
};

/**
 * Cleanly formats unknown template IDs into human-readable titles.
 */
function formatGenericName(templateId: string): string {
  return templateId
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Infer ItemType from template string or explicit type.
 */
function inferItemType(templateId: string, explicitType?: string): ItemType {
  const normType = explicitType?.toLowerCase();
  if (normType === 'firmware') return 'firmware';
  if (normType === 'augment') return 'augment';
  if (normType === 'software') return 'software';
  if (normType === 'equipment' || normType === 'weapon' || normType === 'armor') return 'equipment';

  const lowerId = templateId.toLowerCase();
  if (lowerId.endsWith('.sh') || lowerId.includes('spike') || lowerId.includes('strike') || lowerId.includes('pulse')) {
    return 'firmware';
  }
  if (lowerId.endsWith('.arc') || lowerId.includes('siphon') || lowerId.includes('venting') || lowerId.includes('feedback')) {
    return 'augment';
  }
  if (lowerId.endsWith('.exe') || lowerId.endsWith('.msi') || lowerId.includes('bleed') || lowerId.includes('vampire') || lowerId.includes('loader')) {
    return 'software';
  }
  if (lowerId.includes('armor') || lowerId.includes('rifle') || lowerId.includes('plating')) {
    return 'equipment';
  }
  return 'item';
}

/**
 * Resolves full constructivist metadata and specifications for any item in the game.
 */
export function resolveItemMetadata(params: ResolveItemParams): ItemMetadata {
  const {
    templateId,
    type: explicitType,
    rarity: explicitRarity,
    cost,
    costCurrency = 'FLX',
    floor,
    entityId,
    status: explicitStatus,
    statusVariant: explicitStatusVariant,
    coord,
    compiledAt,
  } = params;

  const known = KNOWN_TEMPLATES[templateId.toLowerCase()] || KNOWN_TEMPLATES[templateId];

  const type = inferItemType(templateId, explicitType || known?.type);
  const rarityTier = (explicitRarity || known?.defaultRarity || 'common').toLowerCase();
  const name = known?.name || formatGenericName(templateId);
  const kanjiSub = known?.kanjiSub || `${type.toUpperCase()} // TA-VEC-${templateId.substring(0, 4).toUpperCase()}`;
  const typeLabel = known?.typeLabel || `${type.toUpperCase()} // HARDWARE ASSET`;
  const description =
    known?.description ||
    `Specialized tactical asset cataloged in the Taikoku Vector database [${templateId}].`;

  const specs: ItemSpec[] = known ? [...known.specs] : [];

  // If generic/fallback, generate default telemetry specs
  if (!known) {
    specs.push({ label: 'SYSTEM CLASSIFICATION', value: type.toUpperCase() });
    specs.push({ label: 'ASSET IDENTIFIER', value: templateId.toUpperCase() });
    specs.push({ label: 'COMPATIBILITY BUS', value: 'VEC-OS 1.0.4' });
  }

  // Add operational context specs
  if (coord) {
    specs.unshift({ label: 'CARGO BAY LOCATION', value: coord, color: 'var(--c-accent)' });
  }
  if (floor !== undefined && floor >= 0) {
    specs.push({ label: 'HARVEST SUB-LEVEL', value: `FLOOR ${floor}` });
  }
  if (cost !== undefined) {
    specs.push({
      label: costCurrency === 'FLX' ? 'COMPILATION COST' : 'REQUISITION COST',
      value: `${cost} ${costCurrency}`,
      color: costCurrency === 'FLX' ? 'var(--c-accent-secondary)' : 'var(--c-scrap)',
    });
  }
  if (compiledAt) {
    specs.push({
      label: 'COMPILATION DATE',
      value: new Date(compiledAt).toLocaleDateString(),
    });
  }
  if (entityId !== undefined) {
    specs.push({
      label: 'SERIAL NUMBER',
      value: `TK-VLT-${entityId.toString().slice(-6)}`,
      color: 'var(--c-text-dim)',
    });
  }

  // Derive status badge & variant
  let statusBadge = explicitStatus || 'VERIFIED';
  let statusVariant: StampVariant = explicitStatusVariant || 'cyan';

  if (!explicitStatus) {
    if (compiledAt) {
      statusBadge = 'COMPILED // READY';
      statusVariant = 'secured';
    } else if (cost !== undefined && costCurrency === 'FLX') {
      statusBadge = 'RAW DATA CORE';
      statusVariant = 'amber';
    } else if (coord) {
      statusBadge = `BAY ${coord} // SECURED`;
      statusVariant = 'secured';
    } else {
      statusBadge = rarityTier.toUpperCase();
      statusVariant =
        rarityTier === 'legendary' ? 'amber' : rarityTier === 'rare' ? 'danger' : 'cyan';
    }
  }

  return {
    id: templateId,
    name,
    kanjiSub,
    type,
    typeLabel,
    rarityTier,
    rarityLabel: rarityTier.toUpperCase(),
    description,
    statusBadge,
    statusVariant,
    specs,
    footerText: 'TAIKOKU LOGISTICS // TELEMETRY LINK ACTIVE',
  };
}
