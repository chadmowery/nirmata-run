import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const LightAnimationTypeSchema = z.enum([
  'STATIC', // Constant steady illumination
  'PULSE', // Smooth sinusoidal breathing: intensity * (1 + amp * sin(t * speed))
  'FLICKER', // Pseudo-random multi-octave electrical arc / faulty neon noise
  'STROBE', // Sharp square/sawtooth warning flash (alternates primary & secondaryColor)
  'RADAR_SWEEP', // Rotating angular beam modulation around the entity's center
]);

export type LightAnimationType = z.infer<typeof LightAnimationTypeSchema>;

export const LightAnimationSchema = z.object({
  type: LightAnimationTypeSchema.default('STATIC'),
  /** Animation frequency in cycles/radians per second */
  speed: z.number().min(0).max(20).default(2.0),
  /** Modulation depth (0 = no modulation, 1 = full 0..200% swing) */
  amplitude: z.number().min(0).max(1).default(0.2),
  /** Optional alternate hex color blended at waveform troughs/peaks (e.g. STROBE red/orange) */
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export type LightAnimationData = z.infer<typeof LightAnimationSchema>;

export const LightSourceSchema = z.object({
  /** Whether the light source is currently active */
  enabled: z.boolean().default(true),
  /** Primary RGB hex color string (e.g. '#00f0ff') */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#00f0ff'),
  /** Peak light intensity multiplier (HDR range 0.0 to 5.0) */
  intensity: z.number().min(0).max(5).default(1.2),
  /** Maximum illumination radius in world pixels (1 tile = 32px; e.g. 128 = 4 tiles) */
  radius: z.number().min(8).max(512).default(128),
  /** 2.5D Z-elevation above the floor in pixels (0..64px) for normal & shadow raymarching */
  height: z.number().min(1).max(64).default(18),
  /** Quadratic falloff steepness exponent */
  falloff: z.number().min(0.5).max(4).default(1.8),
  /** Whether this light performs 2.5D height-field shadow raymarching */
  castsShadows: z.boolean().default(true),
  /** Sub-tile X offset from sprite center in pixels (-32..+32) */
  offsetX: z.number().min(-32).max(32).default(0),
  /** Sub-tile Y offset from sprite center in pixels (-32..+32) */
  offsetY: z.number().min(-32).max(32).default(0),
  /** Procedural animation waveform configuration */
  animation: LightAnimationSchema.default({
    type: 'STATIC',
    speed: 2.0,
    amplitude: 0.0,
  }),
});

export const LightSource = defineComponent('lightSource', LightSourceSchema);

export type LightSourceData = z.infer<typeof LightSource.schema>;
