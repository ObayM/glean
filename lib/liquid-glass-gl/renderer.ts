import { MultiPassRenderer, createTextureFromSource, type UniformValue } from './gl';
import { BG_SHADER, HBLUR_SHADER, MAIN_SHADER, VBLUR_SHADER, VERTEX_SHADER } from './shaders';

export interface GlassLayout {
  canvasCssWidth: number;
  canvasCssHeight: number;
  shapeCssWidth: number;
  shapeCssHeight: number;
  radiusCss: number;
  dpr: number;
  bgOffset: [number, number];
  bgScale: [number, number];
}

function gaussianKernel(radius: number): number[] {
  const sigma = radius / 3.0;
  const kernel: number[] = [];
  let sum = 0;
  for (let i = 0; i <= radius; i++) {
    const weight = Math.exp((-0.5 * (i * i)) / (sigma * sigma));
    kernel.push(weight);
    sum += i === 0 ? weight : weight * 2;
  }
  return kernel.map((w) => w / sum);
}

const BLUR_RADIUS = 18;

const MAIN_DEFAULTS: Record<string, UniformValue> = {
  u_mergeRate: 0.05,
  u_shapeRoundness: 5,
  u_tint: [1, 1, 1, 0.55],
  u_refThickness: 20,
  u_refFactor: 1.4,
  u_refDispersion: 7,
  u_refFresnelRange: 30,
  u_refFresnelHardness: 0.2,
  u_refFresnelFactor: 0.2,
  u_glareRange: 30,
  u_glareHardness: 0.2,
  u_glareConvergence: 0.5,
  u_glareOppositeFactor: 0.8,
  u_glareFactor: 0.9,
  u_glareAngle: (-45 * Math.PI) / 180,
  u_shadowExpand: 25,
  u_shadowFactor: 0,
  u_shadowPosition: [0, 10],
  u_blurEdge: 1,
  u_showShape1: 0,
};

export class LiquidGlassRenderer {
  private gl: WebGL2RenderingContext;
  private renderer: MultiPassRenderer;
  private canvas: HTMLCanvasElement;
  private bgTexture: WebGLTexture | null = null;
  private bgReady = false;
  private blurWeights = gaussianKernel(BLUR_RADIUS);
  private layout: GlassLayout | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      depth: false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('EXT_color_buffer_float not supported');
    }
    this.gl = gl;
    this.canvas = canvas;
    this.renderer = new MultiPassRenderer(gl, [
      { name: 'bgPass', shader: { vertex: VERTEX_SHADER, fragment: BG_SHADER } },
      {
        name: 'vBlurPass',
        shader: { vertex: VERTEX_SHADER, fragment: VBLUR_SHADER },
        inputs: { u_prevPassTexture: 'bgPass' },
      },
      {
        name: 'hBlurPass',
        shader: { vertex: VERTEX_SHADER, fragment: HBLUR_SHADER },
        inputs: { u_prevPassTexture: 'vBlurPass' },
      },
      {
        name: 'mainPass',
        shader: { vertex: VERTEX_SHADER, fragment: MAIN_SHADER },
        inputs: { u_blurredBg: 'hBlurPass', u_bg: 'bgPass' },
        outputToScreen: true,
      },
    ]);
  }

  setBackdrop(source: TexImageSource): void {
    if (this.bgTexture) this.gl.deleteTexture(this.bgTexture);
    this.bgTexture = createTextureFromSource(this.gl, source).texture;
    this.bgReady = true;
  }

  setLayout(layout: GlassLayout): void {
    this.layout = layout;
    const w = Math.round(layout.canvasCssWidth * layout.dpr);
    const h = Math.round(layout.canvasCssHeight * layout.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.renderer.resize(w, h);
    }
  }

  render(): void {
    const layout = this.layout;
    if (!layout || !this.bgReady || !this.bgTexture) return;
    const gl = this.gl;
    const w = Math.round(layout.canvasCssWidth * layout.dpr);
    const h = Math.round(layout.canvasCssHeight * layout.dpr);

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.renderer.setUniforms({
      u_resolution: [w, h],
      u_dpr: layout.dpr,
    });

    this.renderer.render({
      bgPass: {
        u_bgTexture: this.bgTexture,
        u_bgTextureReady: 1,
        u_bgOffset: layout.bgOffset,
        u_bgScale: layout.bgScale,
      },
      vBlurPass: {
        u_blurRadius: BLUR_RADIUS,
        u_blurWeights: this.blurWeights,
      },
      hBlurPass: {
        u_blurRadius: BLUR_RADIUS,
        u_blurWeights: this.blurWeights,
      },
      mainPass: {
        ...MAIN_DEFAULTS,
        u_mouseSpring: [w / 2, h / 2],
        u_shapeWidth: layout.shapeCssWidth,
        u_shapeHeight: layout.shapeCssHeight,
        u_shapeRadius: layout.radiusCss,
      },
    });
  }

  dispose(): void {
    if (this.bgTexture) this.gl.deleteTexture(this.bgTexture);
    this.bgTexture = null;
    this.renderer.dispose();
    const lose = this.gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
  }
}
