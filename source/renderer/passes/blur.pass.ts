import { PostEffect } from "../../interfaces/postpass.interface";
import { Renderer } from "../renderer.model";

import shader from "../shaders/post/blur.wgsl?raw";
import { Downsampler } from "./attachable/downsampler.pass";

export class BlurPass extends PostEffect {

  private downsampler: Downsampler;
  private uniform: GPUBuffer;

  constructor(
    private renderer: Renderer,
    private params: { iterations: number },
  ) {

    super();

    this.shaderModule = device.createShaderModule({
      code: shader
    });

    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        entryPoint: "vertexKernel",
        module: this.shaderModule,
      },
      fragment: {
        entryPoint: "fragmentKernel",
        module: this.shaderModule,
        targets: [ { format: Renderer.RENDER_FORMAT } ],
      },
    });

    this.downsampler = new Downsampler(renderer);

    this.sampler = device.createSampler({
      magFilter: "linear"
    });

    this.uniform = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

  }

  public async pass(frame: GPUTexture) {

    const intencity = Math.sin(this.renderer.info.currentFrame / 60) * 0.5 + 0.5;

    device.queue.writeBuffer(this.uniform, 0, new Float32Array([
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
          { binding: 2, resource: { buffer: this.uniform }}
        ]
      }));
  
      pass.draw(6);
      pass.end();

    }

    device.queue.submit([ encoder.finish() ]);

  }

}