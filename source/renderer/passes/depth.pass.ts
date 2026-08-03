import { SceneInterface } from "../../interfaces/scene.interface";

import { Drawable } from "../../interfaces/drawable.interface";
import { Renderer } from "../renderer.model";
import { InstancedMesh, Mesh } from "../../mesh/mesh.model";

import shader from "../shaders/depth.wgsl?raw";

export class DepthPass {

  private pipeline: GPURenderPipeline;
  private bindgroupLayout: GPUBindGroupLayout;
  private bindgroupMap = new WeakMap<Drawable, GPUBindGroup>();
  private bundles = new Set<GPURenderBundle>();
  private depthTexture: GPUTexture;
  private frameTexture: GPUTexture;
  public views = new WeakMap<GPUTexture, GPUTextureView>();

  public sampler: GPUSampler;
  private readonly compareType: GPUCompareFunction = "less-equal";

  constructor(private scene: SceneInterface) {

    const module = device.createShaderModule({
      label: "Depth pre pass shader",
      code: shader
    });

    this.bindgroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      ]
    })

    const pipelineLayout = device.createPipelineLayout({
      label: "Depth Pass Pipeline Layout",
      bindGroupLayouts: [
        this.bindgroupLayout,
      ]
    })

    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      depthStencil: {
        format: Renderer.DEPTH_FORMAT,
        depthWriteEnabled: true,
        depthCompare: this.compareType,
      },
      vertex: {
        module,
        buffers: [ Mesh.getVertexLayout(true) ],
      },
      fragment: {
        module,
        targets: [
          { format: Renderer.RENDER_FORMAT },
        ]
      }
    });

    this.sampler = device.createSampler({
      compare: this.compareType,
    });

    const { frame, depth } = this.updateTextures();

    this.depthTexture = depth;
    this.frameTexture = frame;

  }

  async [ Symbol.asyncDispose ]() {
    throw Error("TODO: THE RESOURCE CLEAN IMPL")
  }

  /**
    * Get already constructed depth texture view, or if not, create it
    * @returns {GPUTextureView} - The depth texture view
  */
  get depthView(): GPUTextureView { 
    return this.views.get(this.depthTexture) || this.depthTexture.createView(); 
  }

  private updateTextures() {

    const size = {
      width: this.scene.renderer.width,
      height: this.scene.renderer.height,
    } as const;

    const frame = device.createTexture({
      label: "Depth Pass Frame Texture",
      format: Renderer.RENDER_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size
    });

    const depth = device.createTexture({
      label: "Depth Pass Depth Texture",
      format: Renderer.DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      size
    });

    this.views.set(frame, frame.createView());
    this.views.set(depth, depth.createView());

    return {
      frame,
      depth
    };

  }

  private createBundle(x: Drawable): GPURenderBundle {

    const encoder = device.createRenderBundleEncoder({
      label: "DEPTH PRE-PASS BUNDLE",
      colorFormats: [ Renderer.RENDER_FORMAT ],
      depthStencilFormat: Renderer.DEPTH_FORMAT,
    });

    encoder.setPipeline(this.pipeline);

    const { buffer, pointer } = Mesh.arenas.reduced.get(x.id);

    encoder.setVertexBuffer(0, buffer, pointer.address, pointer.size);

    {

      let bindgroup = this.bindgroupMap.get(x);

      if ( !bindgroup ) this.bindgroupMap.set(x, bindgroup = device.createBindGroup({
        label: "Drawable Instance Bindgroup",
        layout: this.bindgroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.scene.camera.gbuffer! } },
          { binding: 1, resource: { buffer: x.buffers.tranformation } },
        ]
      }));
  
      encoder.setBindGroup(0, bindgroup);

    }

    x instanceof InstancedMesh
      ? encoder.draw(x.vertexCount, x.updateVisibilityBuffer())
      : encoder.draw(x.vertexCount);

    return encoder.finish();

  }

  public pass(encoder: GPUCommandEncoder, drawQueue: Set<Drawable>) {

    const frameView = this.views.get(this.frameTexture);
    const depthView = this.views.get(this.depthTexture);

    if ( !frameView || !depthView ) {

      if ( import.meta.env.DEV ) throw Error("Missing depth or frame texture");

      return;

    }

    if ( drawQueue.size !== this.bundles.size ) for ( const x of drawQueue ) {
      if ( this.bindgroupMap.has(x) === false ) {
        this.bundles.add(this.createBundle(x))
      }
    }

    const pass = encoder.beginRenderPass({
      depthStencilAttachment: {
        view: depthView,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 0,
      },
      colorAttachments: [
        {
          view: frameView,
          loadOp: "clear",
          storeOp: "discard",
        }
      ]
    });

    pass.executeBundles(this.bundles);
    pass.end();

  }

}