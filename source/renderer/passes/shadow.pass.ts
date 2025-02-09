import { vec3 } from "gl-matrix";
import * as utils from "../renderer.utils";

import { Drawable } from "../../interfaces/drawable.interface";
import { SceneInterface } from "../../interfaces/scene.interface";
import { DirectionLight, LightCascade } from "../light/light.model";

import { Renderer } from "../renderer.model";
import { Observer } from "../camera/camera.model";

import shader from "../shaders/light.wgsl?raw";

export class ShadowPass {

  public lightDir = new Float32Array(3) as vec3;
  public lightsBuffer: GPUBuffer;
  public views = new WeakMap<GPUTexture, GPUTextureView>();
  public bindgroup: Nullable<GPUBindGroup> = null;
  private pipeline: GPURenderPipeline;
  private temporalTexture: GPUTexture;
  private bindgroupMap = new WeakMap<Drawable, Array<GPUBindGroup>>();
  private lightDirectionBuffer: GPUBuffer;

  private readonly colorAttachment : GPURenderPassColorAttachment;

  constructor(private scene: SceneInterface) {

    const module = device.createShaderModule({
      label: "shadow pass shader",
      code: shader
    });

    this.pipeline = utils.createBasePipeline({
      fragment: module,
      vertex: module,
    });

    this.temporalTexture = device.createTexture({
      label: "TEMP TEXTURE",
      format: Renderer.RENDER_FORMAT,
      size: DirectionLight.shadowMapResolution,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.lightsBuffer = device.createBuffer({
      size: 4 * Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.lightDirectionBuffer = device.createBuffer({
      size: 3 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.bindgroup = device.createBindGroup({
      label: "Scene Lighting Bindgroup",
      layout: this.scene.pipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: { buffer: this.lightsBuffer } },
        { binding: 1, resource: { buffer: this.lightDirectionBuffer } },
        { binding: 2, resource: this.scene.sun.texture.createView() }
      ],
    });

    this.colorAttachment = { 
      loadOp: "clear", 
      storeOp: "discard", 
      clearValue: [ 1, 1, 1, 1 ], 
      view: this.temporalTexture.createView()
    };

  }

  private static constructBindgroup(
    pipeline: GPURenderPipeline,
    light: DirectionLight,
    x: Drawable, 
    map: WeakMap<Drawable, Array<GPUBindGroup>>,
  ) {

    const bindgroups: Array<GPUBindGroup> = [];

    for ( let i = LightCascade.Distant; i <= LightCascade.Close; i++ ) {
      bindgroups[i] = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        label: "Scene Bindgroup",
        entries: [
          { binding: 0, resource: { buffer: light.observers[i].gbuffer } },
          { binding: 1, resource: { buffer: x.buffers.tranformation } },
        ]
      })
    }

    map.set(x, bindgroups);

    return bindgroups;

  }

  public pass(
    encoder: GPUCommandEncoder,
    drawQueue: Set<Drawable>,
  ) {

    const sun = this.scene.sun;

    vec3.sub(this.lightDir, 
      sun.observers[LightCascade.Distant].position, 
      sun.observers[LightCascade.Distant].target
    );

    device.queue.writeBuffer(
      this.lightDirectionBuffer, 0, 
      vec3.normalize(this.lightDir, this.lightDir) as Float32Array
    );

    for ( let i = 0; i <= LightCascade.Close; i++ ) {

      const observer = sun.observers[i];

      encoder.copyBufferToBuffer(
        observer.gbuffer, 0,
        this.lightsBuffer, Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE * i,
        observer.gbuffer.size
      );
    
      const pass = encoder.beginRenderPass({
        colorAttachments: [this.colorAttachment],
        depthStencilAttachment: {
          view: sun.texture.createView({ 
            arrayLayerCount : 1,
            baseArrayLayer  : LightCascade.Close - i,
          }),
          depthLoadOp: "clear",
          depthStoreOp: "store",
          depthClearValue: 1,
        },
      });

      pass.setPipeline(this.pipeline);

      for (const x of drawQueue) {

        if ( x.shadowParams.cast === false ) continue;

        let bindgroup = this.bindgroupMap.get(x)?.[i];

        bindgroup ||= ShadowPass.constructBindgroup(this.pipeline, sun, x, this.bindgroupMap)[i];

        pass.setVertexBuffer(0, x.buffers.vertex);
        pass.setBindGroup(0, bindgroup);
        pass.draw(x.vertexCount, x.instances);

      }

      pass.end();

    }

  }
}