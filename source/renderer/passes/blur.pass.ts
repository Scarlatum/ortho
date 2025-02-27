import { PostEffect } from "../../interfaces/postpass.interface";
import { GBufferType } from "../renderer.contants";
import { Renderer } from "../renderer.model";

import shader from "../shaders/post/blur.wgsl?raw";
import downsamplerShader from "../shaders/post/downsample.wgsl?raw";

export class BlurPass extends PostEffect {

  private shaderModuleH: GPUShaderModule;
  private pipelineH: GPURenderPipeline;

  private downsampled: GPUTexture;
  private uniform: GPUBuffer;

  constructor(
    private renderer: Renderer,
    private params: { iterations: number },
  ) {

    super();

    this.shaderModule = device.createShaderModule({
      code: shader
    });

    this.shaderModuleH = device.createShaderModule({
      code: downsamplerShader
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

    this.pipelineH = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        entryPoint: "vertexKernel",
        module: this.shaderModuleH,
      },
      fragment: {
        entryPoint: "fragmentKernel",
        module: this.shaderModuleH,
        targets: [ { format: Renderer.RENDER_FORMAT } ],
      },
    });

    this.downsampled = device.createTexture({
      label: "blur storage texture",
      format: Renderer.RENDER_FORMAT,
      size: {
        width: this.renderer.width / 1.0,
        height: this.renderer.height / 1.0,
      },
      sampleCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT 
        | GPUTextureUsage.TEXTURE_BINDING 
        | GPUTextureUsage.COPY_DST,
    });

    this.renderer.viewMap.set(this.downsampled , this.downsampled.createView())

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

    if ( intencity === 0.0 ) return;

    const encoder = device.createCommandEncoder();

    const views = { 
      downsampled: this.renderer.viewMap.get(this.downsampled)!,
      frame: frame.createView(),
    };

    { // Downscale pass

      const pass = encoder.beginRenderPass({
        colorAttachments: [{ loadOp: "load", storeOp: "store", view: views.downsampled }]
      });
  
      pass.setPipeline(this.pipelineH);
      pass.setBindGroup(0, device.createBindGroup({
        layout: this.pipelineH.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: views.frame },
        ]
      }));
  
      pass.draw(6);
      pass.end();

    }

    { // Blur pass
      for ( let i = 0; i < this.params.iterations; i++ ) {

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
            { binding: 0, resource: views.downsampled },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: { buffer: this.uniform }}
          ]
        }));
    
        pass.draw(6);
        pass.end();

        // encoder.copyTextureToTexture({
        //   texture: frame
        // }, {
        //   texture: this.downsampled
        // }, {
        //   width: frame.width,
        //   height: frame.height
        // });

      }
    }

    device.queue.submit([ encoder.finish() ]);

  }

}