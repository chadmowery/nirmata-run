import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebGLProbe } from '../webgl-probe';

describe('WebGLProbe', () => {
  let mockGL: any;
  let probe: WebGLProbe;

  beforeEach(() => {
    mockGL = {
      TRIANGLES: 4,
      TRIANGLE_STRIP: 5,
      TRIANGLE_FAN: 6,
      drawElements: vi.fn(),
      drawArrays: vi.fn(),
      useProgram: vi.fn(),
      bindTexture: vi.fn(),
    };

    probe = new WebGLProbe();
    probe.setGLContext(mockGL);
  });

  it('instruments draw calls, triangles, program switches, and texture binds', () => {
    probe.attach();

    mockGL.drawElements(mockGL.TRIANGLES, 6, 0, 0); // 2 triangles
    mockGL.drawArrays(mockGL.TRIANGLES, 0, 3); // 1 triangle
    mockGL.useProgram({} as any);
    mockGL.bindTexture(0, {} as any);

    const stats = probe.getFrameStats();
    expect(stats.drawCalls).toBe(2);
    expect(stats.triangles).toBe(3);
    expect(stats.programSwitches).toBe(1);
    expect(stats.textureBinds).toBe(1);

    probe.resetFrame();
    expect(probe.getFrameStats().drawCalls).toBe(0);
  });

  it('restores original methods cleanly on detach()', () => {
    const originalDrawElements = mockGL.drawElements;
    probe.attach();
    expect(mockGL.drawElements).not.toBe(originalDrawElements);

    probe.detach();
    expect(mockGL.drawElements).toBe(originalDrawElements);
  });

  it('calculates VRAM estimation from PixiJS managedTextures', () => {
    const mockApp = {
      renderer: {
        texture: {
          managedTextures: [
            { width: 512, height: 512, label: 'tileset', isRenderTexture: false }, // 512*512*4 = 1,048,576
            { width: 256, height: 256, label: 'fbo-outline', isRenderTexture: true }, // 256*256*4 = 262,144
          ],
        },
      },
    };

    probe.setApplication(mockApp as any);
    const mem = probe.getTextureMemory();

    expect(mem.totalTextures).toBe(2);
    expect(mem.atlasTextures).toBe(1);
    expect(mem.renderTextures).toBe(1);
    expect(mem.estimatedVramBytes).toBe(1048576 + 262144);
  });

  it('handles null or sparse entries in managedTextures without throwing', () => {
    const mockApp = {
      renderer: {
        texture: {
          managedTextures: [
            null,
            { width: 512, height: 512, label: 'tileset' },
            undefined,
          ],
        },
      },
    };

    probe.setApplication(mockApp as any);
    const mem = probe.getTextureMemory();

    expect(mem.totalTextures).toBe(1);
    expect(mem.atlasTextures).toBe(1);
    expect(mem.estimatedVramBytes).toBe(512 * 512 * 4);
  });

  it('wraps renderer.render to measure renderPassMs and restores on detach()', () => {
    const origRender = vi.fn();
    const mockApp = {
      renderer: {
        render: origRender,
      },
    };

    probe.setApplication(mockApp as any);
    probe.attach();

    expect(mockApp.renderer.render).not.toBe(origRender);
    mockApp.renderer.render();
    expect(origRender).toHaveBeenCalledTimes(1);

    const stats = probe.getFrameStats();
    expect(stats.renderPassMs).toBeGreaterThanOrEqual(0);

    probe.detach();
    expect(mockApp.renderer.render).toBe(origRender);
  });

  it('correctly classifies PixiJS 8 filter FBOs with resource null and handles Retina high-DPI resolution', () => {
    const mockApp = {
      renderer: {
        texture: {
          managedTextures: [
            // PixiJS 8 Filter FBO TextureSource (resource is null, uploadMethodId unknown)
            { pixelWidth: 400, pixelHeight: 300, resource: null, uploadMethodId: 'unknown' },
            // High-DPI canvas (width: 100, height: 100, resolution: 2 -> pixelWidth: 200, pixelHeight: 200)
            { width: 100, height: 100, resolution: 2, label: 'text-damage', resource: {} },
            // Static atlas
            { width: 512, height: 512, label: 'theme-atlas', resource: {} },
          ],
        },
      },
    };

    probe.setApplication(mockApp as any);
    const mem = probe.getTextureMemory();

    expect(mem.totalTextures).toBe(3);
    expect(mem.renderTextures).toBe(1);
    expect(mem.textOrCanvasTextures).toBe(1);
    expect(mem.atlasTextures).toBe(1);
    // VRAM: (400*300*4) + (200*200*4) + (512*512*4)
    expect(mem.estimatedVramBytes).toBe(400 * 300 * 4 + 200 * 200 * 4 + 512 * 512 * 4);
  });
});
