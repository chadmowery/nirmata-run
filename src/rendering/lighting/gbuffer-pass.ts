import * as PIXI from 'pixi.js';
import type {
  Buffer,
  BufferImageSource,
  Container,
  Filter,
  Geometry,
  Mesh,
  RenderTexture,
  Renderer,
  Shader,
  Sprite,
  Texture,
} from 'pixi.js';
import { getMaterialAtlasTexture, getNormalAtlasTexture } from '../assets';
import { TILE_SIZE } from '../constants';
import {
  GBUFFER_HEIGHT,
  GBUFFER_WIDTH,
  MAX_GBUFFER_QUADS,
  ParticleGbufferDescriptor,
  safeGetPixiExport,
} from './types';

// Floats per vertex:
// aPosition (2) + aUV (2) + aCosSin (2) + aMeta (4: [outline, mode, heightNorm, shadowOp]) + aColor (4)
const FLOATS_PER_VERTEX = 14;
const VERTICES_PER_QUAD = 4;
const INDICES_PER_QUAD = 6;

const GBUFFER_VERT = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in vec2 aCosSin;
in vec4 aMeta;
in vec4 aColor;

out vec2 vUV;
out vec2 vCosSin;
out vec4 vMeta;
out vec4 vColor;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main(void) {
  vUV = aUV;
  vCosSin = aCosSin;
  vMeta = aMeta;
  vColor = aColor;

  mat3 m = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  vec3 pos = m * vec3(aPosition, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
}
`;

const GBUFFER_NORMAL_FRAG = /* glsl */ `
in vec2 vUV;
in vec2 vCosSin;
in vec4 vMeta;
in vec4 vColor;

out vec4 finalColor;

uniform sampler2D uDiffuseAtlas;
uniform sampler2D uNormalAtlas;
uniform vec2 uTexelSize;

void main(void) {
  float mode = vMeta.y;

  // Mode 1: Emissive plasma/spark particle (flat facing normal, zero spec)
  if (mode > 0.5 && mode < 1.5) {
    vec2 centered = (vUV - 0.5) * 2.0;
    float d = length(centered);
    if (d > 1.0) discard;
    finalColor = vec4(0.5, 0.5, 1.0, 0.0);
    return;
  }

  // Mode 2: Volumetric puff / cryo mist (hemispherical dome normal)
  if (mode >= 1.5) {
    vec2 centered = (vUV - 0.5) * 2.0;
    float dist2 = dot(centered, centered);
    if (dist2 > 1.0) discard;
    float nz = sqrt(max(0.08, 1.0 - dist2));
    vec3 n = normalize(vec3(centered.x, centered.y, nz));
    finalColor = vec4(n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5, 0.10);
    return;
  }

  // Mode 0: Sprite from atlas
  vec4 diff = texture(uDiffuseAtlas, vUV);
  if (diff.a < 0.08) {
    if (vMeta.x > 0.5) {
      // Outline halo pixel for props with OutlineFilter
      float maxNeighbor = 0.0;
      maxNeighbor = max(maxNeighbor, texture(uDiffuseAtlas, vUV + vec2(uTexelSize.x, 0.0)).a);
      maxNeighbor = max(maxNeighbor, texture(uDiffuseAtlas, vUV - vec2(uTexelSize.x, 0.0)).a);
      maxNeighbor = max(maxNeighbor, texture(uDiffuseAtlas, vUV + vec2(0.0, uTexelSize.y)).a);
      maxNeighbor = max(maxNeighbor, texture(uDiffuseAtlas, vUV - vec2(0.0, uTexelSize.y)).a);
      if (maxNeighbor >= 0.08) {
        finalColor = vec4(0.5, 0.5, 1.0, 0.3);
        return;
      }
    }
    discard;
  }

  vec4 packed = texture(uNormalAtlas, vUV);
  // Decode tangent normal [-1, 1] and rotate XY by sprite.rotation (cos, sin)
  vec3 n = vec3(packed.rg * 2.0 - 1.0, max(0.05, packed.b * 2.0 - 1.0));
  float c = vCosSin.x;
  float s = vCosSin.y;
  vec2 rotXY = vec2(n.x * c - n.y * s, n.x * s + n.y * c);
  n = normalize(vec3(rotXY, n.z));

  finalColor = vec4(n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5, packed.a);
}
`;

const GBUFFER_MATERIAL_FRAG = /* glsl */ `
in vec2 vUV;
in vec2 vCosSin;
in vec4 vMeta;
in vec4 vColor;

out vec4 finalColor;

uniform sampler2D uDiffuseAtlas;
uniform sampler2D uMaterialAtlas;
uniform vec2 uTexelSize;

void main(void) {
  float mode = vMeta.y;

  // Mode 1: Emissive particle
  if (mode > 0.5 && mode < 1.5) {
    vec2 centered = (vUV - 0.5) * 2.0;
    float d = length(centered);
    if (d > 1.0) discard;
    float core = smoothstep(1.0, 0.1, d) * vColor.a;
    if (core < 0.04) discard;
    finalColor = vec4(clamp(core * 1.15, 0.0, 1.0), 0.0, 0.15, vMeta.z);
    return;
  }

  // Mode 2: Volumetric puff / cryo mist
  if (mode >= 1.5) {
    vec2 centered = (vUV - 0.5) * 2.0;
    float dist2 = dot(centered, centered);
    if (dist2 > 1.0) discard;
    float nz = sqrt(max(0.08, 1.0 - dist2));
    float puffAlpha = nz * vColor.a;
    if (puffAlpha < 0.06) discard;
    finalColor = vec4(0.0, vMeta.w * puffAlpha, 0.85, vMeta.z * nz);
    return;
  }

  // Mode 0: Sprite from atlas
  vec4 diff = texture(uDiffuseAtlas, vUV);
  if (diff.a < 0.08) {
    if (vMeta.x > 0.5) {
      float maxNeighbor = 0.0;
      maxNeighbor = max(maxNeighbor, texture(uDiffuseAtlas, vUV + vec2(uTexelSize.x, 0.0)).a);
      maxNeighbor = max(maxNeighbor, texture(uDiffuseAtlas, vUV - vec2(uTexelSize.x, 0.0)).a);
      maxNeighbor = max(maxNeighbor, texture(uDiffuseAtlas, vUV + vec2(0.0, uTexelSize.y)).a);
      maxNeighbor = max(maxNeighbor, texture(uDiffuseAtlas, vUV - vec2(0.0, uTexelSize.y)).a);
      if (maxNeighbor >= 0.08) {
        // Spec §2.3: Prop OutlineFilter border tagged Emissive = 1.0
        finalColor = vec4(1.0, 0.0, 0.2, 0.45);
        return;
      }
    }
    discard;
  }

  vec4 mat = texture(uMaterialAtlas, vUV);
  finalColor = mat;
}
`;

export interface LayerCollectionInput {
  terrainLayer: Container;
  itemLayer: Container;
  entityLayer: Container;
  particles?: ParticleGbufferDescriptor[];
}

/**
 * Manages the 3x 960x640 G-Buffer RenderTextures (`albedo`, `normalSpec`, `materialHeight`),
 * the linear 80x45 (or grid.width x grid.height) FOV visibility mask texture, and batched
 * companion G-Buffer geometry extraction.
 */
export class GBufferPass {
  public readonly rtAlbedo: RenderTexture | null = null;
  public readonly rtNormalSpec: RenderTexture | null = null;
  public readonly rtMaterialHeight: RenderTexture | null = null;

  public fovMaskTexture: Texture;
  private fovMaskSource: BufferImageSource | null = null;
  private fovMaskData: Uint8Array;
  private fovWidth: number;
  private fovHeight: number;

  private readonly vertexData: Float32Array;
  private readonly vertexBuffer: Buffer | null = null;
  private readonly indexBuffer: Buffer | null = null;
  private readonly geometry: Geometry | null = null;
  private readonly normalShader: Shader | null = null;
  private readonly materialShader: Shader | null = null;
  private readonly normalMesh: Mesh<Geometry, Shader> | null = null;
  private readonly materialMesh: Mesh<Geometry, Shader> | null = null;
  private readonly normalContainer: Container | null = null;
  private readonly materialContainer: Container | null = null;
  private readonly texelSizeN = new Float32Array([1 / 512, 1 / 512]);
  private readonly texelSizeM = new Float32Array([1 / 512, 1 / 512]);

  private readonly gpuReady: boolean;
  private lastQuadCount = 0;
  private prevQuadCount = 0;

  constructor(gridWidth: number = 80, gridHeight: number = 45) {
    this.fovWidth = Math.max(1, gridWidth);
    this.fovHeight = Math.max(1, gridHeight);
    this.fovMaskData = new Uint8Array(this.fovWidth * this.fovHeight * 4);
    this.vertexData = new Float32Array(
      MAX_GBUFFER_QUADS * VERTICES_PER_QUAD * FLOATS_PER_VERTEX,
    );

    // Initialize FOV mask to unexplored (R=0, A=255)
    for (let i = 0; i < this.fovMaskData.length; i += 4) {
      this.fovMaskData[i] = 0;
      this.fovMaskData[i + 1] = 0;
      this.fovMaskData[i + 2] = 0;
      this.fovMaskData[i + 3] = 255;
    }

    let initializedGpu = false;
    try {
      if (
        typeof PIXI.BufferImageSource !== 'function' ||
        typeof PIXI.RenderTexture?.create !== 'function' ||
        typeof PIXI.Mesh !== 'function'
      ) {
        throw new Error('PixiJS WebGL classes unavailable in headless test mock');
      }

      this.fovMaskSource = new PIXI.BufferImageSource({
        resource: this.fovMaskData,
        width: this.fovWidth,
        height: this.fovHeight,
        format: 'rgba8unorm',
        scaleMode: 'linear',
        alphaMode: 'no-premultiply-alpha',
        addressMode: 'clamp-to-edge',
      });
      this.fovMaskTexture = new PIXI.Texture({ source: this.fovMaskSource });

      this.rtAlbedo = PIXI.RenderTexture.create({
        width: GBUFFER_WIDTH,
        height: GBUFFER_HEIGHT,
        scaleMode: 'nearest',
        resolution: 1,
        antialias: false,
      });
      this.rtNormalSpec = PIXI.RenderTexture.create({
        width: GBUFFER_WIDTH,
        height: GBUFFER_HEIGHT,
        scaleMode: 'nearest',
        resolution: 1,
        antialias: false,
      });
      this.rtMaterialHeight = PIXI.RenderTexture.create({
        width: GBUFFER_WIDTH,
        height: GBUFFER_HEIGHT,
        scaleMode: 'nearest',
        resolution: 1,
        antialias: false,
      });

      // Build static index buffer for quads
      const indices = new Uint16Array(MAX_GBUFFER_QUADS * INDICES_PER_QUAD);
      for (let q = 0; q < MAX_GBUFFER_QUADS; q++) {
        const vi = q * 4;
        const ii = q * 6;
        indices[ii] = vi;
        indices[ii + 1] = vi + 1;
        indices[ii + 2] = vi + 2;
        indices[ii + 3] = vi;
        indices[ii + 4] = vi + 2;
        indices[ii + 5] = vi + 3;
      }

      this.vertexBuffer = new PIXI.Buffer({
        data: this.vertexData,
        usage: PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST,
      });
      this.indexBuffer = new PIXI.Buffer({
        data: indices,
        usage: PIXI.BufferUsage.INDEX,
      });

      const stride = FLOATS_PER_VERTEX * 4;
      this.geometry = new PIXI.Geometry({
        attributes: {
          aPosition: { buffer: this.vertexBuffer, format: 'float32x2', stride, offset: 0 },
          aUV: { buffer: this.vertexBuffer, format: 'float32x2', stride, offset: 8 },
          aCosSin: { buffer: this.vertexBuffer, format: 'float32x2', stride, offset: 16 },
          aMeta: { buffer: this.vertexBuffer, format: 'float32x4', stride, offset: 24 },
          aColor: { buffer: this.vertexBuffer, format: 'float32x4', stride, offset: 40 },
        },
        indexBuffer: this.indexBuffer,
      });

      const emptySrc = PIXI.Texture.EMPTY.source;
      const gbufUniformsN = new PIXI.UniformGroup({
        uTexelSize: { value: this.texelSizeN, type: 'vec2<f32>' },
      });
      const gbufUniformsM = new PIXI.UniformGroup({
        uTexelSize: { value: this.texelSizeM, type: 'vec2<f32>' },
      });

      this.normalShader = new PIXI.Shader({
        glProgram: PIXI.GlProgram.from({
          vertex: GBUFFER_VERT,
          fragment: GBUFFER_NORMAL_FRAG,
          name: 'gbuffer-normal-shader',
        }),
        resources: {
          gbufUniforms: gbufUniformsN,
          uDiffuseAtlas: emptySrc,
          uNormalAtlas: emptySrc,
        },
      });

      this.materialShader = new PIXI.Shader({
        glProgram: PIXI.GlProgram.from({
          vertex: GBUFFER_VERT,
          fragment: GBUFFER_MATERIAL_FRAG,
          name: 'gbuffer-material-shader',
        }),
        resources: {
          gbufUniforms: gbufUniformsM,
          uDiffuseAtlas: emptySrc,
          uMaterialAtlas: emptySrc,
        },
      });

      const opaqueState = PIXI.State.for2d();
      opaqueState.blend = false;

      this.normalMesh = new PIXI.Mesh<Geometry, Shader>({
        geometry: this.geometry,
        shader: this.normalShader,
        state: opaqueState,
      });
      this.materialMesh = new PIXI.Mesh<Geometry, Shader>({
        geometry: this.geometry,
        shader: this.materialShader,
        state: opaqueState,
      });

      this.normalContainer = new PIXI.Container();
      this.normalContainer.addChild(this.normalMesh);

      this.materialContainer = new PIXI.Container();
      this.materialContainer.addChild(this.materialMesh);

      initializedGpu = true;
    } catch {
      // Headless / mocked unit test environment without full PixiJS Geometry/RenderTexture
      const texNs = safeGetPixiExport<typeof PIXI.Texture>(PIXI, 'Texture');
      this.fovMaskTexture = texNs?.EMPTY ?? ({} as Texture);
    }

    this.gpuReady = initializedGpu;
  }

  public get quadCount(): number {
    return this.lastQuadCount;
  }

  public get fovDimensions(): { width: number; height: number } {
    return { width: this.fovWidth, height: this.fovHeight };
  }

  /**
   * Encodes FOV & Exploration visibility into the linear `fovMaskTexture`:
   * - Active FOV (`fovSet`): R = 255 (`1.0`)
   * - Explored Memory (`exploredSet`): R = 64 (`0.25`)
   * - Unexplored Void: R = 0 (`0.0`)
   */
  public updateFovMask(
    gridWidth: number,
    gridHeight: number,
    fovSet?: Set<string>,
    exploredSet?: Set<string>,
  ): void {
    const w = Math.max(1, gridWidth);
    const h = Math.max(1, gridHeight);

    if (w !== this.fovWidth || h !== this.fovHeight) {
      this.fovWidth = w;
      this.fovHeight = h;
      this.fovMaskData = new Uint8Array(w * h * 4);
      if (this.fovMaskSource && this.gpuReady) {
        this.fovMaskSource.destroy();
        this.fovMaskSource = new PIXI.BufferImageSource({
          resource: this.fovMaskData,
          width: w,
          height: h,
          format: 'rgba8unorm',
          scaleMode: 'linear',
          alphaMode: 'no-premultiply-alpha',
          addressMode: 'clamp-to-edge',
        });
        this.fovMaskTexture = new PIXI.Texture({ source: this.fovMaskSource });
      }
    }

    const data = this.fovMaskData;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const key = `${x},${y}`;
        let r = 0;
        if (!fovSet && !exploredSet) {
          r = 255;
        } else if (fovSet?.has(key)) {
          r = 255;
        } else if (exploredSet?.has(key)) {
          r = 64;
        }
        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }

    this.fovMaskSource?.update();
  }

  /**
   * Captures all 3 G-Buffer targets (`rtAlbedo`, `rtNormalSpec`, `rtMaterialHeight`)
   * from the live scene layers and optional particle descriptors.
   */
  public capture(
    renderer: Renderer | undefined,
    worldContainer: Container,
    layers: LayerCollectionInput,
  ): void {
    const { quadCount, diffuseSource } = this.packQuads(layers);
    this.lastQuadCount = quadCount;

    if (!this.gpuReady || !renderer || typeof renderer.render !== 'function') {
      return;
    }

    if (!this.rtAlbedo || !this.rtNormalSpec || !this.rtMaterialHeight) {
      return;
    }

    // 1. Render Albedo pass directly from worldContainer (preserving filters temporarily stripped outside)
    const savedFilters = worldContainer.filters;
    worldContainer.filters = null;
    try {
      renderer.render({
        container: worldContainer,
        target: this.rtAlbedo,
        clear: true,
        clearColor: [0, 0, 0, 1],
      });
    } finally {
      worldContainer.filters = savedFilters ? ([...savedFilters] as Filter[]) : null;
    }

    if (
      !this.geometry ||
      !this.vertexBuffer ||
      !this.normalMesh ||
      !this.materialMesh ||
      !this.normalContainer ||
      !this.materialContainer ||
      !this.normalShader ||
      !this.materialShader ||
      quadCount === 0
    ) {
      return;
    }

    // Upload active quad batch
    this.zeroUnusedTailVertices(quadCount);
    this.prevQuadCount = quadCount;
    this.vertexBuffer.update();
    this.geometry.indexBuffer.update();

    const normalTex = getNormalAtlasTexture();
    const materialTex = getMaterialAtlasTexture();
    const emptySrc = safeGetPixiExport<typeof PIXI.Texture>(PIXI, 'Texture')?.EMPTY?.source;
    const diffSrc = diffuseSource ?? emptySrc;
    const normSrc = normalTex?.source ?? diffSrc;
    const matSrc = materialTex?.source ?? diffSrc;

    const invW = 1 / Math.max(1, diffSrc?.width || 512);
    const invH = 1 / Math.max(1, diffSrc?.height || 512);

    this.normalShader.resources.uDiffuseAtlas = diffSrc;
    this.normalShader.resources.uNormalAtlas = normSrc;
    this.texelSizeN[0] = invW;
    this.texelSizeN[1] = invH;

    this.materialShader.resources.uDiffuseAtlas = diffSrc;
    this.materialShader.resources.uMaterialAtlas = matSrc;
    this.texelSizeM[0] = invW;
    this.texelSizeM[1] = invH;

    // Sync world camera transform onto G-Buffer mesh containers
    const syncTransform = (c: Container) => {
      c.position.set(worldContainer.x, worldContainer.y);
      c.scale.set(worldContainer.scale.x, worldContainer.scale.y);
      c.pivot.set(worldContainer.pivot.x, worldContainer.pivot.y);
      c.rotation = worldContainer.rotation;
    };
    syncTransform(this.normalContainer);
    syncTransform(this.materialContainer);

    this.geometry.topology = 'triangle-list';

    renderer.render({
      container: this.normalContainer,
      target: this.rtNormalSpec,
      clear: true,
      clearColor: [0.5, 0.5, 1.0, 0.0],
    });

    renderer.render({
      container: this.materialContainer,
      target: this.rtMaterialHeight,
      clear: true,
      clearColor: [0.0, 0.0, 0.86, 0.0],
    });
  }

  private zeroUnusedTailVertices(activeQuads: number): void {
    const startFloat = activeQuads * VERTICES_PER_QUAD * FLOATS_PER_VERTEX;
    const endFloat = Math.min(
      this.vertexData.length,
      Math.max(activeQuads, this.prevQuadCount) * VERTICES_PER_QUAD * FLOATS_PER_VERTEX,
    );
    for (let i = startFloat; i < endFloat; i += FLOATS_PER_VERTEX) {
      this.vertexData[i] = 0;
      this.vertexData[i + 1] = 0;
    }
  }

  private packQuads(layers: LayerCollectionInput): {
    quadCount: number;
    diffuseSource: Texture['source'] | null;
  } {
    let quadCount = 0;
    let primaryDiffuseSource: Texture['source'] | null = null;

    const emptyTex = safeGetPixiExport<typeof PIXI.Texture>(PIXI, 'Texture')?.EMPTY;
    const pushSprite = (sprite: Sprite) => {
      if (quadCount >= MAX_GBUFFER_QUADS) return;
      if (!sprite || !sprite.visible || sprite.alpha <= 0.01) return;
      const tex = sprite.texture;
      if (!tex || (emptyTex && tex === emptyTex)) return;

      if (!primaryDiffuseSource && tex.source && (tex.source.width ?? 0) >= 64) {
        primaryDiffuseSource = tex.source;
      }

      const frameW = tex.frame?.width ?? tex.width ?? TILE_SIZE;
      const frameH = tex.frame?.height ?? tex.height ?? TILE_SIZE;
      const sx = sprite.scale?.x ?? 1;
      const sy = sprite.scale?.y ?? 1;
      const anchorX = (sprite as { anchor?: { x: number; y: number } }).anchor?.x ?? 0;
      const anchorY = (sprite as { anchor?: { x: number; y: number } }).anchor?.y ?? 0;
      const pivotX = sprite.pivot?.x ?? 0;
      const pivotY = sprite.pivot?.y ?? 0;

      const lx0 = (-anchorX * frameW - pivotX) * sx;
      const ly0 = (-anchorY * frameH - pivotY) * sy;
      const lx1 = lx0 + frameW * sx;
      const ly1 = ly0 + frameH * sy;

      const rot = sprite.rotation ?? 0;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const tx = sprite.x ?? 0;
      const ty = sprite.y ?? 0;

      // Corners: TL, TR, BR, BL
      const x0 = tx + lx0 * cosR - ly0 * sinR;
      const y0 = ty + lx0 * sinR + ly0 * cosR;
      const x1 = tx + lx1 * cosR - ly0 * sinR;
      const y1 = ty + lx1 * sinR + ly0 * cosR;
      const x2 = tx + lx1 * cosR - ly1 * sinR;
      const y2 = ty + lx1 * sinR + ly1 * cosR;
      const x3 = tx + lx0 * cosR - ly1 * sinR;
      const y3 = ty + lx0 * sinR + ly1 * cosR;

      const uvs = (tex as unknown as {
        uvs?: { x0: number; y0: number; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number };
      }).uvs;
      const srcW = Math.max(1, tex.source?.width || 512);
      const srcH = Math.max(1, tex.source?.height || 512);
      const u0 = uvs ? uvs.x0 : (tex.frame?.x ?? 0) / srcW;
      const v0 = uvs ? uvs.y0 : (tex.frame?.y ?? 0) / srcH;
      const u1 = uvs ? uvs.x1 : ((tex.frame?.x ?? 0) + frameW) / srcW;
      const v1 = uvs ? uvs.y1 : (tex.frame?.y ?? 0) / srcH;
      const u2 = uvs ? uvs.x2 : ((tex.frame?.x ?? 0) + frameW) / srcW;
      const v2 = uvs ? uvs.y2 : ((tex.frame?.y ?? 0) + frameH) / srcH;
      const u3 = uvs ? uvs.x3 : (tex.frame?.x ?? 0) / srcW;
      const v3 = uvs ? uvs.y3 : ((tex.frame?.y ?? 0) + frameH) / srcH;

      const hasOutline = Array.isArray(sprite.filters)
        ? sprite.filters.some(
            (f) =>
              f &&
              (f.constructor?.name?.includes('Outline') ||
                typeof (f as { thickness?: number }).thickness === 'number'),
          )
          ? 1.0
          : 0.0
        : 0.0;

      this.writeQuad(
        quadCount,
        x0,
        y0,
        x1,
        y1,
        x2,
        y2,
        x3,
        y3,
        u0,
        v0,
        u1,
        v1,
        u2,
        v2,
        u3,
        v3,
        cosR,
        sinR,
        hasOutline,
        0,
        0,
        0,
        1,
        1,
        1,
        sprite.alpha ?? 1,
      );
      quadCount++;
    };

    const collectContainer = (container: Container | undefined) => {
      if (!container || !container.visible) return;
      const children = container.children as Sprite[];
      for (let i = 0; i < children.length; i++) {
        pushSprite(children[i]);
      }
    };

    collectContainer(layers.terrainLayer);
    collectContainer(layers.itemLayer);
    collectContainer(layers.entityLayer);

    // Collect procedural LIT & EMISSIVE particles (LIGHT-05)
    if (layers.particles) {
      for (let i = 0; i < layers.particles.length && quadCount < MAX_GBUFFER_QUADS; i++) {
        const p = layers.particles[i];
        if (p.alpha <= 0.02 || p.size <= 0) continue;
        const half = p.size * 0.5;
        const modeFlag = p.mode === 'emissive' ? 1.0 : 2.0;
        const hNorm = Math.max(0, Math.min(1, p.heightPx / 32));
        this.writeQuad(
          quadCount,
          p.worldX - half,
          p.worldY - half,
          p.worldX + half,
          p.worldY - half,
          p.worldX + half,
          p.worldY + half,
          p.worldX - half,
          p.worldY + half,
          0,
          0,
          1,
          0,
          1,
          1,
          0,
          1,
          1,
          0,
          0,
          modeFlag,
          hNorm,
          p.shadowOpacity,
          p.colorRgb[0],
          p.colorRgb[1],
          p.colorRgb[2],
          p.alpha,
        );
        quadCount++;
      }
    }

    return { quadCount, diffuseSource: primaryDiffuseSource };
  }

  private writeQuad(
    q: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    u2: number,
    v2: number,
    u3: number,
    v3: number,
    cosR: number,
    sinR: number,
    outline: number,
    mode: number,
    heightNorm: number,
    shadowOp: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    const v = this.vertexData;
    const base = q * VERTICES_PER_QUAD * FLOATS_PER_VERTEX;
    const coords = [
      x0, y0, u0, v0,
      x1, y1, u1, v1,
      x2, y2, u2, v2,
      x3, y3, u3, v3,
    ];
    for (let k = 0; k < 4; k++) {
      const o = base + k * FLOATS_PER_VERTEX;
      v[o] = coords[k * 4];
      v[o + 1] = coords[k * 4 + 1];
      v[o + 2] = coords[k * 4 + 2];
      v[o + 3] = coords[k * 4 + 3];
      v[o + 4] = cosR;
      v[o + 5] = sinR;
      v[o + 6] = outline;
      v[o + 7] = mode;
      v[o + 8] = heightNorm;
      v[o + 9] = shadowOp;
      v[o + 10] = r;
      v[o + 11] = g;
      v[o + 12] = b;
      v[o + 13] = a;
    }
  }

  public destroy(): void {
    this.rtAlbedo?.destroy(true);
    this.rtNormalSpec?.destroy(true);
    this.rtMaterialHeight?.destroy(true);
    this.fovMaskSource?.destroy();
    this.normalShader?.destroy(true);
    this.materialShader?.destroy(true);
    this.normalMesh?.destroy();
    this.materialMesh?.destroy();
    this.normalContainer?.destroy({ children: false });
    this.materialContainer?.destroy({ children: false });
    this.geometry?.destroy(true);
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
  }
}
