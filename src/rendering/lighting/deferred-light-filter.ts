import * as PIXI from 'pixi.js';
import type {
  BufferImageSource,
  Filter,
  Texture,
  UniformGroup,
} from 'pixi.js';
import {
  GBUFFER_HEIGHT,
  GBUFFER_WIDTH,
  MAX_MICRO_LIGHTS,
  MAX_PRIMARY_LIGHTS,
  MicroLightDescriptor,
  RenderLightDescriptor,
  resolvePixiFilterBase,
} from './types';

const BaseFilter = resolvePixiFilterBase<typeof Filter>(PIXI);

const DEFERRED_LIGHT_FRAG = /* glsl */ `precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uNormalSpecTex;
uniform sampler2D uMaterialHeightTex;
uniform sampler2D uFovMaskTex;
uniform sampler2D uLightDataTex;
uniform sampler2D uMicroLightDataTex;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;

uniform vec2 uViewportSize;
uniform vec2 uCameraPos;
uniform float uCameraZoom;
uniform vec2 uGridSize;
uniform float uTime;

uniform int uPrimaryLightCount;
uniform int uMicroLightCount;

uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform vec3 uShadowTint;
uniform vec3 uConditionTint;
uniform float uFloorPulseAmp;
uniform vec3 uFloorPulseColor;

float interleavedGradientNoise(vec2 px) {
  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(px, magic.xy)));
}

float computeHeightShadow(
  vec2 startPx,
  vec2 lightPx,
  float pixelZ,
  float lightZ,
  float jitter
) {
  vec2 delta = lightPx - startPx;
  float dist = length(delta);
  if (dist <= 3.0 * uCameraZoom) {
    return 1.0;
  }

  float visibility = 1.0;
  const int STEPS = 16;
  for (int i = 1; i <= STEPS; i++) {
    float t = (float(i) - 0.5 + jitter * 0.55) / float(STEPS);
    if (t >= 0.98) break;
    // Skip samples inside the emitter entity's own 32x32 tile so an actor/prop never shadows its own light
    if (dist * (1.0 - t) <= 18.0 * uCameraZoom) break;
    vec2 samplePx = startPx + delta * t;
    vec2 sampleUv = samplePx / uViewportSize;
    if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
      continue;
    }

    vec4 sMat = texture(uMaterialHeightTex, sampleUv);
    float occluderZ = sMat.a * 32.0;
    float occluderOpacity = sMat.g;
    if (occluderOpacity < 0.05) continue;

    float rayZ = mix(pixelZ, lightZ, t);
    // Step away slightly from current surface pixel height so flat surfaces never self-occlude
    if (occluderZ > rayZ + 0.65 && occluderZ > pixelZ + 0.85) {
      visibility -= occluderOpacity * 0.62;
      if (visibility <= 0.08) {
        return 0.08;
      }
    }
  }
  return clamp(visibility, 0.08, 1.0);
}

void main(void) {
  vec4 albedoSample = texture(uTexture, vTextureCoord);
  vec2 screenPx = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  vec2 gbufUv = clamp(screenPx / uViewportSize, vec2(0.0005), vec2(0.9995));

  vec4 normSpec = texture(uNormalSpecTex, gbufUv);
  vec4 matHeight = texture(uMaterialHeightTex, gbufUv);

  vec3 N = normalize(normSpec.rgb * 2.0 - 1.0);
  float specularStrength = normSpec.a;
  float emissive = matHeight.r;
  float roughness = clamp(matHeight.b, 0.08, 1.0);
  float pixelZ = matHeight.a * 32.0;

  // Map fragment screen pixel to dungeon tile FOV mask UV (80x45 bilinear)
  vec2 worldPx = (screenPx - uCameraPos) / max(0.05, uCameraZoom);
  vec2 fovUv = worldPx / (uGridSize * 32.0);
  float fovMask = (fovUv.x >= 0.0 && fovUv.x <= 1.0 && fovUv.y >= 0.0 && fovUv.y <= 1.0)
    ? texture(uFovMaskTex, fovUv).r
    : 0.0;

  float lightFovGate = smoothstep(0.25, 0.60, fovMask);
  float jitter = interleavedGradientNoise(screenPx);

  vec3 diffuseAccum = uAmbientColor * uAmbientIntensity * uConditionTint;
  vec3 specularAccum = vec3(0.0);
  vec3 beaconAccum = vec3(0.0);

  vec3 V = vec3(0.0, 0.0, 1.0);
  float shininess = mix(48.0, 6.0, roughness);

  // 1. Primary Entity / Fixture / Dynamic Lights (2.5D raymarched shadows)
  for (int i = 0; i < ${MAX_PRIMARY_LIGHTS}; i++) {
    if (i >= uPrimaryLightCount) break;

    float lu = (float(i) + 0.5) / ${MAX_PRIMARY_LIGHTS}.0;
    vec4 p0 = texture(uLightDataTex, vec2(lu, 0.5 / 3.0)); // x, y, radiusPx, intensity
    vec4 p1 = texture(uLightDataTex, vec2(lu, 1.5 / 3.0)); // r, g, b, heightPx
    vec4 p2 = texture(uLightDataTex, vec2(lu, 2.5 / 3.0)); // falloff, castsShadows, isBeaconPing, _

    vec2 lightPx = p0.xy;
    float radiusPx = p0.z * uCameraZoom;
    float intensity = p0.w;
    if (radiusPx <= 1.0 || intensity <= 0.001) continue;

    vec2 delta = lightPx - screenPx;
    float dist = length(delta);
    if (dist >= radiusPx) continue;

    float dWorld = dist / max(0.05, uCameraZoom);
    float rWorld = p0.z;
    float dNorm = dWorld / max(1.0, rWorld);
    float window = clamp(1.0 - dNorm * dNorm, 0.0, 1.0);
    window *= window;
    float atten = (window / (dNorm * dNorm * max(0.2, p2.x) * 4.0 + 1.0)) * intensity;

    vec3 lightCol = p1.rgb;
    float isBeacon = p2.z;

    if (isBeacon > 0.5 && fovMask < 0.25) {
      // DARK_SUBNET unsearched prop radar ping visible through unexplored fog (Spec §4.1)
      float pingRing = smoothstep(0.45, 0.0, abs(dNorm - 0.55));
      beaconAccum += lightCol * atten * (0.5 + pingRing * 0.75);
      continue;
    }

    if (lightFovGate <= 0.001) continue;

    vec3 L = normalize(vec3(delta / max(0.05, uCameraZoom), max(6.0, p1.w - pixelZ)));
    float nDotL = max(dot(N, L), 0.0);

    float shadow = 1.0;
    if (p2.y > 0.5) {
      shadow = computeHeightShadow(screenPx, lightPx, pixelZ, p1.w, jitter);
    }

    vec3 contrib = lightCol * atten * shadow * lightFovGate;
    diffuseAccum += contrib * nDotL;

    if (specularStrength > 0.01 && nDotL > 0.0) {
      vec3 H = normalize(L + V);
      float specTerm = pow(max(dot(N, H), 0.0001), shininess) * specularStrength * 0.85;
      specularAccum += contrib * specTerm;
    }
  }

  // 2. High-Frequency Particle Micro-Lights (fast unshadowed diffuse BRDF)
  if (lightFovGate > 0.001) {
    for (int i = 0; i < ${MAX_MICRO_LIGHTS}; i++) {
      if (i >= uMicroLightCount) break;

      float mu = (float(i) + 0.5) / ${MAX_MICRO_LIGHTS}.0;
      vec4 m0 = texture(uMicroLightDataTex, vec2(mu, 0.25)); // x, y, radiusPx, intensity
      vec4 m1 = texture(uMicroLightDataTex, vec2(mu, 0.75)); // r, g, b, _
      float radiusPx = m0.z * uCameraZoom;
      if (radiusPx <= 1.0 || m0.w <= 0.001) continue;

      vec2 delta = m0.xy - screenPx;
      float dist = length(delta);
      if (dist >= radiusPx) continue;

      float dNorm = (dist / max(0.05, uCameraZoom)) / max(1.0, m0.z);
      float window = clamp(1.0 - dNorm * dNorm, 0.0, 1.0);
      window *= window;
      vec3 L = normalize(vec3(delta / max(0.05, uCameraZoom), 10.0));
      float nDotL = max(dot(N, L), 0.15);

      diffuseAccum += m1.rgb * (window * m0.w * nDotL * lightFovGate);
    }
  }

  // Subtle colored bounce into shadowed pockets
  vec3 ambientFloor = max(diffuseAccum, uShadowTint * 0.35 * lightFovGate);

  vec3 litRgb = albedoSample.rgb * ambientFloor + specularAccum;

  // Emissive self-illumination bypasses shadows
  vec3 emissiveRgb = albedoSample.rgb * emissive * mix(0.28, 1.35, lightFovGate);
  litRgb += emissiveRgb;

  // THERMAL_SURGE 0.8 Hz floor thermal vein pulse (Spec §4.2)
  if (uFloorPulseAmp > 0.001 && pixelZ < 2.0) {
    float wave = 0.5 + 0.5 * sin(uTime * 0.8 * 6.2831853 + (worldPx.x + worldPx.y) * 0.025);
    litRgb += uFloorPulseColor * (wave * uFloorPulseAmp * lightFovGate);
  }

  // Explored Memory state: 65% desaturated memory navy wash (#0b1324)
  if (fovMask > 0.02 && fovMask < 0.92) {
    float lum = dot(albedoSample.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 desaturated = mix(albedoSample.rgb, vec3(lum), 0.65);
    vec3 memoryColor = desaturated * vec3(0.22, 0.30, 0.46) + vec3(0.015, 0.026, 0.052) + albedoSample.rgb * emissive * 0.28;
    float blendActive = smoothstep(0.25, 0.72, fovMask);
    float revealMask = smoothstep(0.01, 0.18, fovMask);
    litRgb = mix(memoryColor * revealMask, litRgb, blendActive);
  } else if (fovMask <= 0.02) {
    litRgb = vec3(0.0);
  }

  // Add unsearched DARK_SUBNET prop beacon pulses above shroud
  litRgb += beaconAccum;

  finalColor = vec4(max(litRgb, vec3(0.0)), albedoSample.a);
}
`;

export class DeferredLightFilter extends BaseFilter {
  private readonly lightDataBuffer: Float32Array;
  private readonly lightDataSource: BufferImageSource;
  private readonly microLightDataBuffer: Float32Array;
  private readonly microLightDataSource: BufferImageSource;
  private readonly lightingUniforms: UniformGroup;
  private readonly uCameraPosBuf = new Float32Array([0, 0]);
  private readonly uGridSizeBuf = new Float32Array([80, 45]);
  private readonly uAmbientColorBuf = new Float32Array([0.051, 0.082, 0.157]);
  private readonly uShadowTintBuf = new Float32Array([0.05, 0.08, 0.16]);
  private readonly uConditionTintBuf = new Float32Array([1, 1, 1]);
  private readonly uFloorPulseColorBuf = new Float32Array([1.0, 0.3, 0.0]);

  constructor(
    normalSpecTex: Texture,
    materialHeightTex: Texture,
    fovMaskTex: Texture,
  ) {
    const lightBuf = new Float32Array(MAX_PRIMARY_LIGHTS * 3 * 4);
    const lightSrc = new PIXI.BufferImageSource({
      resource: lightBuf,
      width: MAX_PRIMARY_LIGHTS,
      height: 3,
      format: 'rgba32float',
      scaleMode: 'nearest',
      addressMode: 'clamp-to-edge',
    });

    const microBuf = new Float32Array(MAX_MICRO_LIGHTS * 2 * 4);
    const microSrc = new PIXI.BufferImageSource({
      resource: microBuf,
      width: MAX_MICRO_LIGHTS,
      height: 2,
      format: 'rgba32float',
      scaleMode: 'nearest',
      addressMode: 'clamp-to-edge',
    });

    const uCameraPosBuf = new Float32Array([0, 0]);
    const uGridSizeBuf = new Float32Array([80, 45]);
    const uAmbientColorBuf = new Float32Array([0.051, 0.082, 0.157]);
    const uShadowTintBuf = new Float32Array([0.05, 0.08, 0.16]);
    const uConditionTintBuf = new Float32Array([1, 1, 1]);
    const uFloorPulseColorBuf = new Float32Array([1.0, 0.3, 0.0]);

    const lightingUniforms = new PIXI.UniformGroup({
      uViewportSize: { value: [GBUFFER_WIDTH, GBUFFER_HEIGHT], type: 'vec2<f32>' },
      uCameraPos: { value: uCameraPosBuf, type: 'vec2<f32>' },
      uCameraZoom: { value: 1.0, type: 'f32' },
      uGridSize: { value: uGridSizeBuf, type: 'vec2<f32>' },
      uTime: { value: 0.0, type: 'f32' },
      uPrimaryLightCount: { value: 0, type: 'i32' },
      uMicroLightCount: { value: 0, type: 'i32' },
      uAmbientColor: { value: uAmbientColorBuf, type: 'vec3<f32>' },
      uAmbientIntensity: { value: 0.24, type: 'f32' },
      uShadowTint: { value: uShadowTintBuf, type: 'vec3<f32>' },
      uConditionTint: { value: uConditionTintBuf, type: 'vec3<f32>' },
      uFloorPulseAmp: { value: 0.0, type: 'f32' },
      uFloorPulseColor: { value: uFloorPulseColorBuf, type: 'vec3<f32>' },
    });

    const glProgram = PIXI.GlProgram.from({
      vertex: PIXI.defaultFilterVert,
      fragment: DEFERRED_LIGHT_FRAG,
      name: 'deferred-light-filter',
      preferredFragmentPrecision: 'highp',
    });

    super({
      glProgram,
      clipToViewport: true,
      resources: {
        lightingUniforms,
        uNormalSpecTex: normalSpecTex.source,
        uMaterialHeightTex: materialHeightTex.source,
        uFovMaskTex: fovMaskTex.source,
        uLightDataTex: lightSrc,
        uMicroLightDataTex: microSrc,
      },
    });

    this.lightDataBuffer = lightBuf;
    this.lightDataSource = lightSrc;
    this.microLightDataBuffer = microBuf;
    this.microLightDataSource = microSrc;
    this.lightingUniforms = lightingUniforms;
    this.uCameraPosBuf = uCameraPosBuf;
    this.uGridSizeBuf = uGridSizeBuf;
    this.uAmbientColorBuf = uAmbientColorBuf;
    this.uShadowTintBuf = uShadowTintBuf;
    this.uConditionTintBuf = uConditionTintBuf;
    this.uFloorPulseColorBuf = uFloorPulseColorBuf;
  }

  public updateTextures(
    normalSpecTex: Texture,
    materialHeightTex: Texture,
    fovMaskTex: Texture,
  ): void {
    this.resources.uNormalSpecTex = normalSpecTex.source;
    this.resources.uMaterialHeightTex = materialHeightTex.source;
    this.resources.uFovMaskTex = fovMaskTex.source;
  }

  public uploadUniforms(params: {
    cameraX: number;
    cameraY: number;
    cameraZoom: number;
    gridWidth: number;
    gridHeight: number;
    timeSec: number;
    ambientRgb: [number, number, number];
    ambientIntensity: number;
    shadowTintRgb: [number, number, number];
    conditionTintRgb: [number, number, number];
    floorPulseAmp: number;
    floorPulseRgb: [number, number, number];
    primaryLights: RenderLightDescriptor[];
    microLights: MicroLightDescriptor[];
  }): void {
    const u = this.lightingUniforms.uniforms;
    this.uCameraPosBuf[0] = params.cameraX;
    this.uCameraPosBuf[1] = params.cameraY;
    u.uCameraZoom = params.cameraZoom;
    this.uGridSizeBuf[0] = Math.max(1, params.gridWidth);
    this.uGridSizeBuf[1] = Math.max(1, params.gridHeight);
    u.uTime = params.timeSec;

    this.uAmbientColorBuf[0] = params.ambientRgb[0];
    this.uAmbientColorBuf[1] = params.ambientRgb[1];
    this.uAmbientColorBuf[2] = params.ambientRgb[2];
    u.uAmbientIntensity = params.ambientIntensity;

    this.uShadowTintBuf[0] = params.shadowTintRgb[0];
    this.uShadowTintBuf[1] = params.shadowTintRgb[1];
    this.uShadowTintBuf[2] = params.shadowTintRgb[2];

    this.uConditionTintBuf[0] = params.conditionTintRgb[0];
    this.uConditionTintBuf[1] = params.conditionTintRgb[1];
    this.uConditionTintBuf[2] = params.conditionTintRgb[2];

    u.uFloorPulseAmp = params.floorPulseAmp;
    this.uFloorPulseColorBuf[0] = params.floorPulseRgb[0];
    this.uFloorPulseColorBuf[1] = params.floorPulseRgb[1];
    this.uFloorPulseColorBuf[2] = params.floorPulseRgb[2];

    const primaryCount = Math.min(MAX_PRIMARY_LIGHTS, params.primaryLights.length);
    u.uPrimaryLightCount = primaryCount;

    const lb = this.lightDataBuffer;
    const rowStride = MAX_PRIMARY_LIGHTS * 4;
    for (let i = 0; i < primaryCount; i++) {
      const l = params.primaryLights[i];
      const o0 = i * 4;
      const o1 = rowStride + i * 4;
      const o2 = rowStride * 2 + i * 4;

      lb[o0] = l.screenX;
      lb[o0 + 1] = l.screenY;
      lb[o0 + 2] = l.radiusPx;
      lb[o0 + 3] = l.intensity;

      lb[o1] = l.colorRgb[0];
      lb[o1 + 1] = l.colorRgb[1];
      lb[o1 + 2] = l.colorRgb[2];
      lb[o1 + 3] = l.heightPx;

      lb[o2] = l.falloff;
      lb[o2 + 1] = l.castsShadows ? 1.0 : 0.0;
      lb[o2 + 2] = l.isBeaconPing ? 1.0 : 0.0;
      lb[o2 + 3] = 0.0;
    }
    this.lightDataSource.update();

    const microCount = Math.min(MAX_MICRO_LIGHTS, params.microLights.length);
    u.uMicroLightCount = microCount;
    const mb = this.microLightDataBuffer;
    const mStride = MAX_MICRO_LIGHTS * 4;
    for (let i = 0; i < microCount; i++) {
      const m = params.microLights[i];
      const o0 = i * 4;
      const o1 = mStride + i * 4;
      mb[o0] = m.screenX;
      mb[o0 + 1] = m.screenY;
      mb[o0 + 2] = m.radiusPx;
      mb[o0 + 3] = m.intensity;

      mb[o1] = m.colorRgb[0];
      mb[o1 + 1] = m.colorRgb[1];
      mb[o1 + 2] = m.colorRgb[2];
      mb[o1 + 3] = 0.0;
    }
    this.microLightDataSource.update();
  }

  public override destroy(options?: boolean): void {
    this.lightDataSource.destroy();
    this.microLightDataSource.destroy();
    super.destroy(options);
  }
}
