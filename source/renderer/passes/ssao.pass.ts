import { PostEffect } from "../../interfaces/postpass.interface";
import { GBufferType } from "../renderer.contants";
import { Renderer } from "../renderer.model";

import shader from "../shaders/post/ssao.wgsl?raw";
import { Downsampler } from "./attachable/downsampler.pass";

export class SSAOPass extends PostEffect {

  // Brand identifier for this post effect
  readonly brand = Symbol("ssao");

  private downsampler: Downsampler;

  constructor(
    private renderer: Renderer,
  ) {
    
    super();

    this.downsampler = new Downsampler(renderer);

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

    const encoder = device.createCommandEncoder();

    const views = { 
      downsampled: this.downsampler.view,
      frame: frame.createView(),
    };

    const pass = encoder.beginRenderPass({
      colorAttachments: [{ 
        view: views.frame, 
        loadOp: "load", 
        storeOp: "store"
      }]
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.renderer.gbuffers[ GBufferType.Depth ].createView() },
        { binding: 1, resource: this.renderer.gbuffers[ GBufferType.Normal ].createView() },
      ]
    }))

    pass.draw(6);
    pass.end();

    device.queue.submit([ encoder.finish() ]);

  }

} 