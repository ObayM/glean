

type GL = WebGL2RenderingContext;

export type UniformValue = number | number[] | Float32Array | WebGLTexture;

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

interface UniformInfo {
  location: WebGLUniformLocation;
  type: number;
  isArray: boolean;
}

export interface RenderPassConfig {
  name: string;
  shader: ShaderSource;
  inputs?: Record<string, string>;
  outputToScreen?: boolean;
}

class ShaderProgram {
  private gl: GL;
  private program: WebGLProgram;
  private uniforms = new Map<string, UniformInfo>();
  private attributes = new Map<string, number>();

  constructor(gl: GL, source: ShaderSource) {
    this.gl = gl;
    this.program = this.createProgram(source);
    this.detectAttributes();
    this.detectUniforms();
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(source: ShaderSource): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    const vertexShader = this.createShader(gl.VERTEX_SHADER, source.vertex);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, source.fragment);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${info}`);
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
  }

  private detectAttributes(): void {
    const gl = this.gl;
    const count = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveAttrib(this.program, i);
      if (!info) continue;
      this.attributes.set(info.name, gl.getAttribLocation(this.program, info.name));
    }
  }

  private detectUniforms(): void {
    const gl = this.gl;
    const count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS) as number;
    const arrayRegex = /\[\d+\]$/;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(this.program, i);
      if (!info) continue;
      const location = gl.getUniformLocation(this.program, info.name);
      if (!location) continue;
      const isArray = arrayRegex.test(info.name);
      const baseName = isArray ? info.name.replace(arrayRegex, '') : info.name;
      this.uniforms.set(baseName, { location, type: info.type, isArray });
    }
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  setUniform(name: string, value: UniformValue): void {
    const gl = this.gl;
    const info = this.uniforms.get(name);
    if (!info) return;
    const loc = info.location;

    if (info.isArray && (Array.isArray(value) || value instanceof Float32Array)) {
      switch (info.type) {
        case gl.FLOAT:
          gl.uniform1fv(loc, value);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2fv(loc, value);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(loc, value);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(loc, value);
          break;
      }
      return;
    }

    if (Array.isArray(value) || value instanceof Float32Array) {
      switch (info.type) {
        case gl.FLOAT_VEC2:
          gl.uniform2fv(loc, value);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(loc, value);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(loc, value);
          break;
      }
      return;
    }

    if (typeof value === 'number') {
      switch (info.type) {
        case gl.FLOAT:
          gl.uniform1f(loc, value);
          break;
        case gl.INT:
        case gl.SAMPLER_2D:
          gl.uniform1i(loc, value);
          break;
      }
    }
  }

  getAttributeLocation(name: string): number {
    return this.attributes.get(name) ?? -1;
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.uniforms.clear();
    this.attributes.clear();
  }
}

class FrameBuffer {
  private gl: GL;
  private fbo: WebGLFramebuffer;
  private texture: WebGLTexture;
  private width: number;
  private height: number;

  constructor(gl: GL, width: number, height: number) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    const { fbo, texture } = this.create();
    this.fbo = fbo;
    this.texture = texture;
  }

  private create() {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create fbo texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${status}`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { fbo, texture };
  }

  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
  }

  getTexture(): WebGLTexture {
    return this.texture;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.fbo);
    this.gl.deleteTexture(this.texture);
  }
}

class RenderPass {
  private gl: GL;
  private program: ShaderProgram;
  private frameBuffer: FrameBuffer | null;
  private vao: WebGLVertexArrayObject;
  config: RenderPassConfig;

  constructor(gl: GL, config: RenderPassConfig) {
    this.gl = gl;
    this.config = config;
    this.program = new ShaderProgram(gl, config.shader);
    this.frameBuffer = config.outputToScreen
      ? null
      : new FrameBuffer(gl, gl.canvas.width, gl.canvas.height);
    this.vao = this.createVAO();
  }

  private createVAO(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const loc = this.program.getAttributeLocation('a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vao;
  }

  render(uniforms: Record<string, UniformValue>): void {
    const gl = this.gl;
    if (this.frameBuffer) this.frameBuffer.bind();
    else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.program.use();

    let textureUnit = 0;
    for (const [name, value] of Object.entries(uniforms)) {
      if (value instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, value);
        this.program.setUniform(name, textureUnit);
        textureUnit += 1;
      } else {
        this.program.setUniform(name, value);
      }
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  getOutputTexture(): WebGLTexture | null {
    return this.frameBuffer ? this.frameBuffer.getTexture() : null;
  }

  resize(width: number, height: number): void {
    this.frameBuffer?.resize(width, height);
  }

  dispose(): void {
    this.frameBuffer?.dispose();
    this.program.dispose();
    this.gl.deleteVertexArray(this.vao);
  }
}

export class MultiPassRenderer {
  private gl: GL;
  private passes = new Map<string, RenderPass>();
  private order: RenderPass[] = [];
  private globalUniforms: Record<string, UniformValue> = {};

  constructor(gl: GL, configs: RenderPassConfig[]) {
    this.gl = gl;
    for (const cfg of configs) {
      const pass = new RenderPass(gl, cfg);
      this.passes.set(cfg.name, pass);
      this.order.push(pass);
    }
  }

  resize(width: number, height: number): void {
    for (const pass of this.order) pass.resize(width, height);
  }

  setUniforms(uniforms: Record<string, UniformValue>): void {
    Object.assign(this.globalUniforms, uniforms);
  }

  render(passUniforms: Record<string, Record<string, UniformValue>>): void {
    for (const pass of this.order) {
      const uniforms: Record<string, UniformValue> = { ...this.globalUniforms };
      Object.assign(uniforms, passUniforms[pass.config.name] ?? {});
      if (pass.config.inputs) {
        for (const [uniformName, fromPass] of Object.entries(pass.config.inputs)) {
          const tex = this.passes.get(fromPass)?.getOutputTexture();
          if (tex) uniforms[uniformName] = tex;
        }
      }
      pass.render(uniforms);
    }
  }

  dispose(): void {
    for (const pass of this.passes.values()) pass.dispose();
    this.passes.clear();
    this.order = [];
    this.globalUniforms = {};
  }
}

export function createTextureFromSource(
  gl: GL,
  source: TexImageSource
): { texture: WebGLTexture; ratio: number } {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const width = 'width' in source ? (source.width as number) : 1;
  const height = 'height' in source ? (source.height as number) : 1;
  return { texture, ratio: width / height };
}
