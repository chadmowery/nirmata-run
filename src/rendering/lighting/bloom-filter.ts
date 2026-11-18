import * as PIXI from 'pixi.js';
import type {
  Filter,
  FilterSystem,
  RenderSurface,
  Texture,
  UniformGroup,
} from 'pixi.js';
import { GBUFFER_HEIGHT, GBUFFER_WIDTH, resolvePixiFilterBase } from './types';

const BaseFilter = resolvePixiFilterBase<typeof Filter>(PIXI);

const BLOOM_EXTRACT_FRAG = /* glsl */ `precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uMaterialHeightTex;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec2 uViewportSize;
uniform float uThreshold;

void main(void) {
  vec4 sceneCol = texture(uTexture, vTextureCoord);
  vec2 screenPx = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  vec2 gbufUv = clamp(screenPx / uViewportSize, vec2(0.0005), vec2(0.9995));
  float emissive = texture(uMaterialHeightTex, gbufUv).r;

  float lum = dot(sceneCol.rgb, vec3(0.2126, 0.7152, 0.0722));
  float hdrMask = max(emissive, smoothstep(uThreshold, uThreshold + 0.25, lum));
  finalColor = vec4(sceneCol.rgb * hdrMask, 1.0);
}
`;

const KAWASE_DOWN_FRAG = /* glsl */ `precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;

void main(void) {
  vec2 hp = uInputPixel.zw * 1.5;
  vec2 lo = uInputClamp.xy;
  vec2 hi = uInputClamp.zw;

  vec4 sum = texture(uTexture, clamp(vTextureCoord, lo, hi)) * 4.0;
  sum += texture(uTexture, clamp(vTextureCoord - hp, lo, hi));
  sum += texture(uTexture, clamp(vTextureCoord + hp, lo, hi));
  sum += texture(uTexture, clamp(vTextureCoord + vec2(hp.x, -hp.y), lo, hi));
  sum += texture(uTexture, clamp(vTextureCoord + vec2(-hp.x, hp.y), lo, hi));

  finalColor = vec4(sum.rgb / 8.0, 1.0);
}
`;

const KAWASE_UP_FRAG = /* glsl */ `precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;

void main(void) {
  vec2 hp = uInputPixel.zw * 2.0;
  vec2 lo = uInputClamp.xy;
  vec2 hi = uInputClamp.zw;

  vec4 sum = texture(uTexture, clamp(vTextureCoord + vec2(-hp.x * 2.0, 0.0), lo, hi));
  sum += texture(uTexture, clamp(vTextureCoord + vec2(-hp.x, hp.y), lo, hi)) * 2.0;
  sum += texture(uTexture, clamp(vTextureCoord + vec2(0.0, hp.y * 2.0), lo, hi));
  sum += texture(uTexture, clamp(vTextureCoord + vec2(hp.x, hp.y), lo, hi)) * 2.0;
  sum += texture(uTexture, clamp(vTextureCoord + vec2(hp.x * 2.0, 0.0), lo, hi));
  sum += texture(uTexture, clamp(vTextureCoord + vec2(hp.x, -hp.y), lo, hi)) * 2.0;
  sum += texture(uTexture, clamp(vTextureCoord + vec2(0.0, -hp.y * 2.0), lo, hi));
  sum += texture(uTexture, clamp(vTextureCoord + vec2(-hp.x, -hp.y), lo, hi)) * 2.0;

  finalColor = vec4(sum.rgb / 12.0, 1.0);
}
`;

const BLOOM_COMPOSITE_FRAG = /* glsl */ `precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uBloomTex;
uniform float uIntensity;
uniform vec2 uBloomUvScale;

void main(void) {
  vec4 base = texture(uTexture, vTextureCoord);
  vec3 bloom = texture(uBloomTex, vTextureCoord * uBloomUvScale).rgb;
  finalColor = vec4(base.rgb + bloom * uIntensity, base.a);
}
`;

/**
 * Dual-Kawase Selective HDR Bloom pass (Spec §3.4).
 * Isolates emissive pixels (`rtMaterialHeight.r > 0`) & bright specular glints,
 * blurs via Kawase down/up passes, and composites back additively.
 */
export class SelectiveBloomFilter extends BaseFilter {
  private readonly extractFilter: Filter;
  private readonly kawaseDownFilter: Filter;
  private readonly kawaseUpFilter: Filter;
  private readonly compositeFilter: Filter;
  private readonly extractUniforms: UniformGroup;
  private readonly compositeUniforms: UniformGroup;

  constructor(materialHeightTex: Texture, intensity: number = 0.72, threshold: number = 0.88) {
    super({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: `precision highp float;\nin vec2 vTextureCoord; out vec4 finalColor; uniform sampler2D uTexture; void main() { finalColor = texture(uTexture, vTextureCoord); }`,
        name: 'selective-bloom-host',
        preferredFragmentPrecision: 'highp',
      }),
      clipToViewport: true,
      resources: {},
    });

    this.extractUniforms = new PIXI.UniformGroup({
      uViewportSize: { value: [GBUFFER_WIDTH, GBUFFER_HEIGHT], type: 'vec2<f32>' },
      uThreshold: { value: threshold, type: 'f32' },
    });

    this.compositeUniforms = new PIXI.UniformGroup({
      uIntensity: { value: intensity, type: 'f32' },
      uBloomUvScale: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    });

    this.extractFilter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: BLOOM_EXTRACT_FRAG,
        name: 'bloom-extract',
        preferredFragmentPrecision: 'highp',
      }),
      resources: {
        extractUniforms: this.extractUniforms,
        uMaterialHeightTex: materialHeightTex.source,
      },
    });

    this.kawaseDownFilter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: KAWASE_DOWN_FRAG,
        name: 'kawase-down',
        preferredFragmentPrecision: 'highp',
      }),
      resources: {},
    });

    this.kawaseUpFilter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: KAWASE_UP_FRAG,
        name: 'kawase-up',
        preferredFragmentPrecision: 'highp',
      }),
      resources: {},
    });

    this.compositeFilter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: BLOOM_COMPOSITE_FRAG,
        name: 'bloom-composite',
        preferredFragmentPrecision: 'highp',
      }),
      clipToViewport: true,
      resources: {
        compositeUniforms: this.compositeUniforms,
        uBloomTex: PIXI.Texture.EMPTY.source,
      },
    });
  }

  public setMaterialTexture(materialHeightTex: Texture): void {
    this.extractFilter.resources.uMaterialHeightTex = materialHeightTex.source;
  }

  public setIntensity(intensity: number): void {
    this.compositeUniforms.uniforms.uIntensity = intensity;
  }

  public getIntensity(): number {
    return Number(this.compositeUniforms.uniforms.uIntensity ?? 0);
  }

  public setThreshold(threshold: number): void {
    this.extractUniforms.uniforms.uThreshold = threshold;
  }

  public getThreshold(): number {
    return Number(this.extractUniforms.uniforms.uThreshold ?? 0.88);
  }

  public override apply(
    filterManager: FilterSystem,
    input: Texture,
    output: RenderSurface,
    clearMode: boolean,
  ): void {
    // Dual-Kawase pyramid: 1/2 (480x320) -> 1/4 (240x160) -> 1/2 (480x320) using PixiJS resolution scaling
    // so logical frame bounds (uOutputFrame / uInputSize) remain aligned with worldContainer.filterArea.
    const halfTex = PIXI.TexturePool.getOptimalTexture(input.width, input.height, 0.5, false);
    const quarterTex = PIXI.TexturePool.getOptimalTexture(input.width, input.height, 0.25, false);

    try {
      this.extractFilter.apply(filterManager, input, halfTex, true);
      this.kawaseDownFilter.apply(filterManager, halfTex, quarterTex, true);
      this.kawaseUpFilter.apply(filterManager, quarterTex, halfTex, true);

      const scaleBuf = this.compositeUniforms.uniforms.uBloomUvScale as Float32Array | undefined;
      if (scaleBuf) {
        scaleBuf[0] = input.source.width / Math.max(1, halfTex.source.width);
        scaleBuf[1] = input.source.height / Math.max(1, halfTex.source.height);
      }
      this.compositeFilter.resources.uBloomTex = halfTex.source;

      filterManager.applyFilter(this.compositeFilter, input, output, clearMode);
    } finally {
      PIXI.TexturePool.returnTexture(halfTex);
      PIXI.TexturePool.returnTexture(quarterTex);
    }
  }

  public override destroy(options?: boolean): void {
    this.extractFilter.destroy(options);
    this.kawaseDownFilter.destroy(options);
    this.kawaseUpFilter.destroy(options);
    this.compositeFilter.destroy(options);
    super.destroy(options);
  }
}
