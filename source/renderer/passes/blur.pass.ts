import { PostEffect } from "../../interfaces/postpass.interface";
import { Renderer } from "../renderer.model";

import shader from "../shaders/post/blur.wgsl?raw";
import { Downsampler } from "./attachable/downsampler.pass";

export class BlurPass extends PostEffect {

  private downsampler: Downsampler;
  
  // Brand identifier for this post effect
  readonly brand = Symbol("blur");

  constructor(
    private renderer: Renderer,
    private params: { iterations: number },
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
      magFilter: "linear"
    });

    this.uniformBuffer = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

  }

  public async pass(frame: GPUTexture) {

    const intencity = Math.sin(this.renderer.info.currentFrame / 60) * 0.5 + 0.5;

    device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      this.renderer.width,
      this.renderer.height,
      intencity,
      1,
    ]));

    const views = { 
      downsampled: this.downsampler.view,
      frame: frame.createView(),
    };

    const encoder = device.createCommandEncoder();
      
    for ( let i = 0; i < this.params.iterations; i++ ) {

      const pass = this.downsampler.attach(encoder, views.frame).beginRenderPass({
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
          { binding: 0, resource: views.downsampled },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: this.uniformBuffer }}
        ]
      }));
  
      pass.draw(6);
      pass.end();

    }

    device.queue.submit([ encoder.finish() ]);

  }

}