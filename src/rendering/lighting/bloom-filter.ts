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

const BLOOM_EXTRACT_FRAG = /* glsl */ `
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

const KAWASE_DOWN_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;

void main(void) {
  vec2 hp = uInputSize.zw * 1.5;
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

const KAWASE_UP_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;

void main(void) {
  vec2 hp = uInputSize.zw * 2.0;
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

const BLOOM_COMPOSITE_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uBloomTex;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec2 uViewportSize;
uniform vec2 uBloomUvScale;
uniform float uIntensity;

void main(void) {
  vec4 base = texture(uTexture, vTextureCoord);
  vec2 screenPx = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  vec2 screenUv = clamp(screenPx / uViewportSize, vec2(0.0), vec2(1.0));
  vec2 bloomUv = clamp(screenUv * uBloomUvScale, vec2(0.001), max(vec2(0.001), uBloomUvScale - vec2(0.002)));
  vec3 bloom = texture(uBloomTex, bloomUv).rgb;
  finalColor = vec4(base.rgb + bloom * uIntensity, base.a);
}
`;

/**
 * Dual-Kawase Selective HDR Bloom pass (Spec §3.4).
 * Isolates emissive pixels (`rtMaterialHeight.r > 0`) & bright specular glints,
 * downsamples through 1/2 -> 1/4 resolution, upsamples smoothly, and composites back.
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
        fragment: `in vec2 vTextureCoord; out vec4 finalColor; uniform sampler2D uTexture; void main() { finalColor = texture(uTexture, vTextureCoord); }`,
        name: 'selective-bloom-host',
      }),
      clipToViewport: true,
      resources: {},
    });

    this.extractUniforms = new PIXI.UniformGroup({
      uViewportSize: { value: [GBUFFER_WIDTH, GBUFFER_HEIGHT], type: 'vec2<f32>' },
      uThreshold: { value: threshold, type: 'f32' },
    });

    this.compositeUniforms = new PIXI.UniformGroup({
      uViewportSize: { value: [GBUFFER_WIDTH, GBUFFER_HEIGHT], type: 'vec2<f32>' },
      uBloomUvScale: { value: [1.0, 1.0], type: 'vec2<f32>' },
      uIntensity: { value: intensity, type: 'f32' },
    });

    this.extractFilter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: BLOOM_EXTRACT_FRAG,
        name: 'bloom-extract',
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
      }),
      resources: {},
    });

    this.kawaseUpFilter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: KAWASE_UP_FRAG,
        name: 'kawase-up',
      }),
      resources: {},
    });

    this.compositeFilter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: BLOOM_COMPOSITE_FRAG,
        name: 'bloom-composite',
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

  public override apply(
    filterManager: FilterSystem,
    input: Texture,
    output: RenderSurface,
    clearMode: boolean,
  ): void {
    const halfW = Math.max(1, Math.floor(input.frame.width * 0.5));
    const halfH = Math.max(1, Math.floor(input.frame.height * 0.5));
    const quarterW = Math.max(1, Math.floor(halfW * 0.5));
    const quarterH = Math.max(1, Math.floor(halfH * 0.5));

    const halfTex = PIXI.TexturePool.getOptimalTexture(halfW, halfH, 1, false);
    const quarterTex = PIXI.TexturePool.getOptimalTexture(quarterW, quarterH, 1, false);

    try {
      this.extractFilter.apply(filterManager, input, halfTex, true);
      this.kawaseDownFilter.apply(filterManager, halfTex, quarterTex, true);
      this.kawaseUpFilter.apply(filterManager, quarterTex, halfTex, true);

      const bloomUvScale = this.compositeUniforms.uniforms.uBloomUvScale as number[];
      bloomUvScale[0] = halfTex.frame.width / Math.max(1, halfTex.source.width);
      bloomUvScale[1] = halfTex.frame.height / Math.max(1, halfTex.source.height);
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
