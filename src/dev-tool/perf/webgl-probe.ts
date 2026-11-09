import { Application } from 'pixi.js';

export interface WebGLFrameStats {
  drawCalls: number;
  triangles: number;
  programSwitches: number;
  textureBinds: number;
}

export interface TextureMemoryBreakdown {
  totalTextures: number;
  atlasTextures: number;
  renderTextures: number;
  textOrCanvasTextures: number;
  estimatedVramBytes: number;
}

type InstancedDrawFn = (
  mode: number,
  firstOrCount: number,
  typeOrCount: number,
  offsetOrCount: number,
  instanceCount?: number,
) => void;

interface WebGLSpyContext {
  TRIANGLES: number;
  TRIANGLE_STRIP: number;
  TRIANGLE_FAN: number;
  drawElements: WebGLRenderingContext['drawElements'];
  drawArrays: WebGLRenderingContext['drawArrays'];
  drawElementsInstanced?: InstancedDrawFn;
  drawArraysInstanced?: InstancedDrawFn;
  useProgram: WebGLRenderingContext['useProgram'];
  bindTexture: WebGLRenderingContext['bindTexture'];
}

interface PixiManagedTexture {
  width?: number;
  height?: number;
  pixelWidth?: number;
  pixelHeight?: number;
  mipmaps?: boolean;
  autoGenerateMipmaps?: boolean;
  label?: string;
  isRenderTexture?: boolean;
  resource?: unknown;
  source?: {
    label?: string;
    resource?: unknown;
  };
}

export class WebGLProbe {
  private gl: WebGLSpyContext | null = null;
  private app: Application | null = null;
  private isAttached = false;

  // Frame Counters
  private drawCalls = 0;
  private triangles = 0;
  private programSwitches = 0;
  private textureBinds = 0;

  // Pre-allocated frame stats to avoid 60Hz heap allocations
  private cachedFrameStats: WebGLFrameStats = {
    drawCalls: 0,
    triangles: 0,
    programSwitches: 0,
    textureBinds: 0,
  };

  // Original Method Backups
  private origDrawElements: WebGLRenderingContext['drawElements'] | null = null;
  private origDrawArrays: WebGLRenderingContext['drawArrays'] | null = null;
  private origDrawElementsInstanced: InstancedDrawFn | null = null;
  private origDrawArraysInstanced: InstancedDrawFn | null = null;
  private origUseProgram: WebGLRenderingContext['useProgram'] | null = null;
  private origBindTexture: WebGLRenderingContext['bindTexture'] | null = null;

  constructor(app?: Application | null) {
    if (app) {
      this.setApplication(app);
    }
  }

  public setApplication(app: Application | null): void {
    if (this.isAttached) {
      this.detach();
    }
    this.app = app;
    if (app) {
      // PixiJS 8 WebGLRenderer exposes .gl, .context.gl, or via canvas context
      const renderer = app.renderer as unknown as {
        gl?: WebGLSpyContext;
        context?: { gl?: WebGLSpyContext };
        canvas?: HTMLCanvasElement;
        view?: { canvas?: HTMLCanvasElement };
      };

      const canvas =
        (app.canvas as HTMLCanvasElement | undefined) ??
        renderer?.canvas ??
        renderer?.view?.canvas;

      let canvasGl: WebGLSpyContext | null = null;
      if (canvas?.getContext) {
        canvasGl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as unknown as WebGLSpyContext;
      }

      const gl = renderer?.gl ?? renderer?.context?.gl ?? canvasGl;
      if (gl) {
        this.gl = gl;
      }
    }
  }

  public setGLContext(gl: WebGLRenderingContext | WebGL2RenderingContext | null): void {
    if (this.isAttached) {
      this.detach();
    }
    this.gl = gl as unknown as WebGLSpyContext | null;
  }

  public attach(): void {
    if (this.isAttached) return;
    if (!this.gl && this.app) {
      this.setApplication(this.app);
    }
    if (!this.gl) return;

    const gl = this.gl;

    this.origDrawElements = gl.drawElements;
    this.origDrawArrays = gl.drawArrays;
    this.origDrawElementsInstanced = gl.drawElementsInstanced ?? null;
    this.origDrawArraysInstanced = gl.drawArraysInstanced ?? null;
    this.origUseProgram = gl.useProgram;
    this.origBindTexture = gl.bindTexture;

    const onDraw = (mode: number, count: number, instanceCount = 1) => {
      this.drawCalls++;
      if (mode === gl.TRIANGLES) {
        this.triangles += (count / 3) * instanceCount;
      } else if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) {
        this.triangles += Math.max(0, count - 2) * instanceCount;
      }
    };

    const onProgram = () => {
      this.programSwitches++;
    };

    const onTexture = () => {
      this.textureBinds++;
    };

    const selfOrigDrawElements = this.origDrawElements;
    if (selfOrigDrawElements) {
      gl.drawElements = function (mode: number, count: number, type: number, offset: number) {
        onDraw(mode, count);
        return selfOrigDrawElements.call(this, mode, count, type, offset);
      };
    }

    const selfOrigDrawArrays = this.origDrawArrays;
    if (selfOrigDrawArrays) {
      gl.drawArrays = function (mode: number, first: number, count: number) {
        onDraw(mode, count);
        return selfOrigDrawArrays.call(this, mode, first, count);
      };
    }

    if (this.origDrawElementsInstanced) {
      const origInst = this.origDrawElementsInstanced;
      gl.drawElementsInstanced = function (
        mode: number,
        count: number,
        type: number,
        offset: number,
        instanceCount?: number,
      ) {
        onDraw(mode, count, instanceCount ?? 1);
        return origInst.call(this, mode, count, type, offset, instanceCount ?? 1);
      };
    }

    if (this.origDrawArraysInstanced) {
      const origInst = this.origDrawArraysInstanced;
      gl.drawArraysInstanced = function (
        mode: number,
        first: number,
        count: number,
        instanceCount?: number,
      ) {
        onDraw(mode, count, instanceCount ?? 1);
        return origInst.call(this, mode, first, count, instanceCount ?? 1);
      };
    }

    if (this.origUseProgram) {
      const origProg = this.origUseProgram;
      gl.useProgram = function (program: WebGLProgram | null) {
        onProgram();
        return origProg.call(this, program);
      };
    }

    if (this.origBindTexture) {
      const origTex = this.origBindTexture;
      gl.bindTexture = function (target: number, texture: WebGLTexture | null) {
        onTexture();
        return origTex.call(this, target, texture);
      };
    }

    this.isAttached = true;
  }

  public detach(): void {
    if (!this.isAttached || !this.gl) return;

    const gl = this.gl;

    if (this.origDrawElements) gl.drawElements = this.origDrawElements;
    if (this.origDrawArrays) gl.drawArrays = this.origDrawArrays;
    if (this.origDrawElementsInstanced) gl.drawElementsInstanced = this.origDrawElementsInstanced;
    if (this.origDrawArraysInstanced) gl.drawArraysInstanced = this.origDrawArraysInstanced;
    if (this.origUseProgram) gl.useProgram = this.origUseProgram;
    if (this.origBindTexture) gl.bindTexture = this.origBindTexture;

    this.isAttached = false;
  }

  public resetFrame(): void {
    this.drawCalls = 0;
    this.triangles = 0;
    this.programSwitches = 0;
    this.textureBinds = 0;
  }

  public getFrameStats(): WebGLFrameStats {
    this.cachedFrameStats.drawCalls = this.drawCalls;
    this.cachedFrameStats.triangles = Math.round(this.triangles);
    this.cachedFrameStats.programSwitches = this.programSwitches;
    this.cachedFrameStats.textureBinds = this.textureBinds;
    return this.cachedFrameStats;
  }

  public getTextureMemory(): TextureMemoryBreakdown {
    const result: TextureMemoryBreakdown = {
      totalTextures: 0,
      atlasTextures: 0,
      renderTextures: 0,
      textOrCanvasTextures: 0,
      estimatedVramBytes: 0,
    };

    if (!this.app) return result;

    try {
      const renderer = this.app.renderer as unknown as {
        texture?: {
          managedTextures?: PixiManagedTexture[];
          _managedTextures?: { items?: Record<string, PixiManagedTexture> };
        };
        textureGenerator?: { managedTextures?: PixiManagedTexture[] };
      };
      const rawManaged: PixiManagedTexture[] =
        (Array.isArray(renderer?.texture?.managedTextures) ? renderer?.texture?.managedTextures : null) ??
        (renderer?.texture?._managedTextures?.items ? Object.values(renderer.texture._managedTextures.items) : null) ??
        (renderer?.texture?.managedTextures ? Object.values(renderer.texture.managedTextures) : null) ??
        renderer?.textureGenerator?.managedTextures ??
        [];

      if (!Array.isArray(rawManaged)) return result;

      const validTextures = rawManaged.filter((t): t is PixiManagedTexture => Boolean(t && typeof t === 'object'));
      result.totalTextures = validTextures.length;

      for (const tex of validTextures) {
        const w = tex.width || tex.pixelWidth || 0;
        const h = tex.height || tex.pixelHeight || 0;
        const mipmapFactor = tex.mipmaps || tex.autoGenerateMipmaps ? 1.33 : 1.0;
        const bytes = Math.round(w * h * 4 * mipmapFactor);
        result.estimatedVramBytes += bytes;

        const label = String(tex.label || tex.source?.label || '').toLowerCase();
        const isCanvas =
          (typeof HTMLCanvasElement !== 'undefined' && tex.resource instanceof HTMLCanvasElement) ||
          (typeof HTMLCanvasElement !== 'undefined' && tex.source?.resource instanceof HTMLCanvasElement) ||
          label.includes('canvas') ||
          label.includes('text');
        const isFbo =
          Boolean(tex.isRenderTexture) ||
          label.includes('fbo') ||
          label.includes('render-texture') ||
          label.includes('filter');

        if (isCanvas) {
          result.textOrCanvasTextures++;
        } else if (isFbo) {
          result.renderTextures++;
        } else {
          result.atlasTextures++;
        }
      }
    } catch {
      // Gracefully return partial or zero metrics if texture system is GCing or context is lost
    }

    return result;
  }
}

