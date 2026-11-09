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
});
