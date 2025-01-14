import { Light } from "./light/light.model";
import { Renderer } from "./renderer.model";

import shader from "./shaders/post/preview.wgsl?raw";

export class TexturePreview {

  protected shaderModule: GPUShaderModule = Object();
  protected pipeline: GPURenderPipeline = Object();
  protected uniformBuffer: GPUBuffer = Object();
  protected vertexBuffer: GPUBuffer;

  constructor(private renderer: Renderer) {

    this.shaderModule = device.createShaderModule({
      code: shader,
    });

    {

      this.vertexBuffer = device.createBuffer({
        size: Float32Array.BYTES_PER_ELEMENT * 2 * 6,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });

      new Float32Array(this.vertexBuffer.getMappedRange()).set([
        -1.0, -1.0,
         1.0, -1.0,
         1.0,  1.0,
         1.0,  1.0,
        -1.0,  1.0,
        -1.0, -1.0,
      ]);
  
      this.vertexBuffer.unmap();

    }

    {

      const scale = 0.2;
      const model = new DOMMatrix();

      this.uniformBuffer = window.device.createBuffer({
        size: Float32Array.BYTES_PER_ELEMENT * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      model.translateSelf(
        1 - scale,
        1 - scale,
        0
      );

      model.scaleSelf(scale, scale * (context.canvas.width / context.canvas.height));
  
      new Float32Array(this.uniformBuffer.getMappedRange()).set(model.toFloat32Array());
  
      this.uniformBuffer.unmap();

    }

    this.pipeline = window.device.createRenderPipeline({
      label: "blur pipeline",
      layout: "auto",
      vertex: {
        module: this.shaderModule,
        entryPoint: "vertexKernel",
        buffers: [
          {
            arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
            attributes: [
              { format: "float32x2", offset: 0, shaderLocation: 0 },
            ]
          }
        ]
      },
      fragment: {
        module: this.shaderModule,
        entryPoint: "fragmentKernel",
        constants: {
          0: Light.RESOLUTION,
          1: Light.RESOLUTION,
        },
        targets: [
          {
            format: "bgra8unorm",
          },
        ],
      },
    });

  }

  // @ts-ignore
  override show(on: GPUTexture, texture: GPUTexture): void {
    
    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      label: "depth preview pass",
      colorAttachments: [
        {
          view: on.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "load",
          storeOp: "store",
        },
      ]
    });

    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setBindGroup(0, window.device.createBindGroup({
      label: "blur pass bind group",
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView(),
        },
        {
          binding: 1,
          resource: {
            buffer: this.uniformBuffer
          }
        }
      ]
    }));

    pass.draw(6);
    pass.end();

    window.device.queue.submit([ encoder.finish() ]);

  }

}