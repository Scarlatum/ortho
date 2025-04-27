import { PostEffect } from "../../interfaces/postpass.interface";
import { Renderer } from "../renderer.model";

import shader from "../shaders/post/ssao.wgsl?raw";

export class SSAOPass extends PostEffect {

  // Brand identifier for this post effect
  readonly brand = Symbol("ssao");

  constructor(
    private renderer: Renderer,
    private params: { 
      radius: number,
      bias: number,
      power: number
    },
  ) {
    super();

    this.module = device.createShaderModule({
      code: shader
    });

    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: this.module,
      },
      fragment: {
        module: this.module,
        targets: [ { format: Renderer.RENDER_FORMAT } ],
      },
    });

    this.sampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear"
    });

    this.uniformBuffer = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 10,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

  }

  public async pass(frame: GPUTexture) {
    // TODO: Implement SSAO pass
  }

} 