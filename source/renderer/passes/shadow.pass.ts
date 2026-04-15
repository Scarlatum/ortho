import { vec3 } from "gl-matrix";

import { Mesh } from "../../mesh/mesh.model";
import { Drawable } from "../../interfaces/drawable.interface";
import { SceneInterface } from "../../interfaces/scene.interface";
import { DirectionLight } from "../light/light.model";

import { Renderer } from "../renderer.model";

import shader from "../shaders/light.wgsl?raw";
import { BindgroupLabels } from "../renderer.contants";

export class ShadowPass {

  public lightDir = new Float32Array(3);
  // public lightsBuffer: GPUBuffer;
  public bindgroup: GPUBindGroup;
  private pipeline: GPURenderPipeline;
  private bundles = new WeakMap<Drawable, Array<GPURenderBundle>>();
  private lightDirectionBuffer: GPUBuffer;
  private sunViews = Array<GPUTextureView>();

  constructor(private scene: SceneInterface) {

    const module = device.createShaderModule({
      label: "shadow pass shader",
      code: shader
    });

    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: module,
        buffers: [ Mesh.getVertexLayout(true) ],
      },
      fragment: {
        module: module,
        targets: [ null ],
      },
      depthStencil: {
        format: Renderer.DEPTH_FORMAT,
        depthWriteEnabled: true,
        depthCompare: "less",
      },
      primitive: {
        cullMode: "front",
      }
    });

    // this.lightsBuffer = device.createBuffer({
    //   size: 4 * Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE,
    //   usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    // });

    this.lightDirectionBuffer = device.createBuffer({
      size: this.lightDir.buffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bindgroup = device.createBindGroup({
      label: "Scene Lighting Bindgroup",
      layout: this.scene.pipeline.getBindGroupLayout(BindgroupLabels.ShadowMappingGroup),
      entries: [
        { binding: 0, resource: { buffer: scene.sun.sharedBuffer } },
        { binding: 1, resource: { buffer: this.lightDirectionBuffer } },
        { binding: 2, resource: this.scene.sun.texture.createView() }
      ],
    });

    for ( let i = 0; i < DirectionLight.LEVELS; i++ ) {
      this.sunViews[i] = scene.sun.texture.createView({ 
        arrayLayerCount : 1,
        baseArrayLayer  : DirectionLight.LEVELS - i - 1,
      });
    }

  }

  async [ Symbol.asyncDispose ]() {
    throw Error("TODO: THE RESOURCE CLEAN IMPL")
  }

  private createBundle(x: Drawable) {

    const bundles   = Array<GPURenderBundle>(DirectionLight.LEVELS);
    const aligment  = Math.max(device.limits.minStorageBufferOffsetAlignment, 256);

    for ( let i = 0; i < DirectionLight.LEVELS; i++ ) {

      const encoder = device.createRenderBundleEncoder({
        label: "SHADOW PASS ENCODER",
        colorFormats: [ null ],
        depthStencilFormat: Renderer.DEPTH_FORMAT,
        sampleCount: 1,
      });

      const { buffer, pointer } = Mesh.arenas.reduced.get(x.id);

      encoder.setPipeline(this.pipeline);
      encoder.setVertexBuffer(0, buffer, pointer.address, pointer.size);
      encoder.setBindGroup(0, device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        label: "Scene Bindgroup",
        entries: [
          { binding: 0, resource: { buffer: this.scene.sun.sharedBuffer, offset: aligment * i } },
          { binding: 1, resource: { buffer: x.buffers.tranformation } },
        ]
      }));

      encoder.draw(x.vertexCount, x.instances);
      
      bundles[i] = encoder.finish()

    }

    this.bundles.set(x, bundles)

    return bundles;

  }

  // TODO: I should implement one-pass cascade shadow map, bc it takes a lot of a time just to begin render pass by alone. 
  // TODO: It should help a lot with render time, and, maybe, reduce a Barrier calls that also not cheap...
  public pass(
    encoder: GPUCommandEncoder,
    drawQueue: Iterable<Drawable>,
  ) {

    vec3.negate(this.lightDir, this.scene.sun.head.direction);

    device.queue.writeBuffer(
      this.lightDirectionBuffer, 0, 
      this.lightDir
    );

    for ( let i = DirectionLight.CASCADE_OFFSET; i < DirectionLight.LEVELS; i++ ) {
      
      if ( import.meta.env.DEV ) encoder.pushDebugGroup(`Shadow pass: Cascade ${ i }`);
         
      const pass = encoder.beginRenderPass({
        colorAttachments: [ null ],
        depthStencilAttachment: {
          view: this.sunViews[i],
          depthLoadOp: "clear",
          depthStoreOp: "store",
          depthClearValue: 1,
        },
      });

      const bundleQueue = new Set<GPURenderBundle>();

      // TODO: Frustrum culling
      for (const x of drawQueue) {

        if ( x.shadowParams.cast === false ) continue;

        const onCascadeGroup = x.shadowParams.cascade & DirectionLight.layout[i];

        if ( onCascadeGroup === 0 ) continue;

        let bundles = this.bundles.get(x);

        if ( !bundles ) this.bundles.set(x, bundles = this.createBundle(x));

        bundleQueue.add(bundles[i]);

      }

      pass.executeBundles(bundleQueue);
      pass.end();

      if ( import.meta.env.DEV ) encoder.popDebugGroup();

    }

  }
}