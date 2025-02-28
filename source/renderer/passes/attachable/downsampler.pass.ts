import { Renderer } from "../../renderer.model";
import { Attachable } from "../../../interfaces/attachable.interface";

import downsamplerShader from "../../shaders/post/downsample.wgsl?raw";

const fetchTest = await fetch(new URL("../../shaders/post/downsample.wgsl", import.meta.url));

console.log(fetchTest);

export class Downsampler extends Attachable {

  public override module ;

  public override pipeline ;

  public override gbuffer: GPUTexture;

  public view: GPUTextureView;

  constructor(private renderer: Renderer) {

    super();

    this.module = device.createShaderModule({
      code: downsamplerShader
    });

    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        entryPoint: "vertexKernel",
        module: this.module,
      },
      fragment: {
        entryPoint: "fragmentKernel",
        module: this.module,
        targets: [ { format: Renderer.RENDER_FORMAT } ],
      },
    });

    this.gbuffer = device.createTexture({
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

    this.view = this.gbuffer.createView();

  }

  public override attach(encoder: GPUCommandEncoder, view: GPUTextureView) {

    const pass = encoder.beginRenderPass({
      colorAttachments: [{ loadOp: "load", storeOp: "store", view: this.view }]
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: view },
      ]
    }));

    pass.draw(6);
    pass.end();

    return encoder;

  }

}