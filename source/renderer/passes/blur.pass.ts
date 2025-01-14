import { Camera } from "../camera/camera.model";
import { PostEffect } from "../../interfaces/postpass.interface";
import { Renderer } from "../renderer.model";

import shader from "../shaders/post/blur.wgsl?raw";
import downsamplerShader from "../shaders/post/downsample.wgsl?raw";

interface PassPayload {
  camera: Camera;
}

export class BlurPass extends PostEffect {

  private shaderModuleH: GPUShaderModule;
  private pipelineH: GPURenderPipeline;

  private HFrame: GPUTexture;
  private params: GPUBuffer;

  constructor(
    private renderer: Renderer,
    private camera: Camera,
  ) {

    super();

    this.shaderModule = window.device.createShaderModule({
      code: shader
    });

    this.shaderModuleH = device.createShaderModule({
      code: downsamplerShader
    });

    this.pipeline = window.device.createRenderPipeline({
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

    this.HFrame = device.createTexture({
      label: "blur storage texture",
      format: Renderer.RENDER_FORMAT,
      size: {
        width: this.renderer.context.canvas.width / 1.0,
        height: this.renderer.context.canvas.height / 1.0,
      },
      sampleCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.sampler = device.createSampler({
      magFilter: "linear"
    });

    this.params = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });

  }

  public async pass(frame: GPUTexture) {

    device.queue.writeBuffer(this.params, 0, new Float32Array([
      this.renderer.context.canvas.width,
      this.renderer.context.canvas.height,
      0,
      1,
    ]));

    const encoder = window.device.createCommandEncoder();

    const downscalepass = encoder.beginRenderPass({
      colorAttachments: [{ loadOp: "load", storeOp: "store", view: this.HFrame.createView() }]
    });

    downscalepass.setPipeline(this.pipelineH);
    downscalepass.setBindGroup(0, device.createBindGroup({
      layout: this.pipelineH.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: frame.createView() },
      ]
    }));

    downscalepass.draw(6);
    downscalepass.end();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{ loadOp: "load", storeOp: "store", view: frame.createView() }]
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.HFrame.createView() },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: this.params }}
      ]
    }));

    pass.draw(6);
    pass.end();

    window.device.queue.submit([ encoder.finish() ]);

  }

  public static create(renderer: Renderer, payload: PassPayload): BlurPass {
    return new BlurPass(renderer, payload.camera);
  }

}