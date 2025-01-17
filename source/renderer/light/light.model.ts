import * as utils from "../renderer.utils";

import { Renderer } from "../renderer.model";
import { Observer } from "../camera/camera.model";
import { Drawable } from "../../interfaces/drawable.interface";
import { Mesh } from "../../mesh/mesh.model";

// Shader modules 
import shader from "../shaders/light.wgsl?raw";
import { mat4, vec3 } from "gl-matrix";
import { SceneInterface } from "../../interfaces/scene.interface";

// TODO: Начать делать каскадные теневые карты.
export class Light {

  static readonly defaultOrthoParams = {
    left    : -50 * 6,
    right   :  50 * 6,
    bottom  : -50 * 6,
    top     :  50 * 6,
    near    : -1000,
    far     :  300,
  };

  // ! DirectX12 частенько любит выставлять ResourceBarrier между проходами, 
  // ! и если не повезёт, то он может отъесть значительную часть кадра при больших объёмах текстур.
  // ! Скорее всего, не смотря на моё желание обойтись одной картой теней в 4-8к расширением для всего окружения,
  // ! Direct заставит меня делать каскадную карту теней.
  // ? Как вариант делать проходы с тенями асинхронными, но это нужно проверять на итог по визуалу.
  static readonly RESOLUTION = 1024 * 4;
  static readonly shadowMapResolution = {
    width: Light.RESOLUTION,
    height: Light.RESOLUTION
  };

  public texture: GPUTexture;

  constructor(public observer: Observer, ortho = Light.defaultOrthoParams) {

    this.texture = device.createTexture({
      format: Renderer.DEPTH_FORMAT,
      size: Light.shadowMapResolution,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    mat4.ortho(this.observer.projection,
      ortho.left, ortho.right,
      ortho.bottom, ortho.top,
      ortho.near, ortho.far
    );

    observer.update();

  }
}

export class LightSources {

  public lights = new Set<Light>();
  public lightsBuffer: GPUBuffer;
  public views = new WeakMap<GPUTexture, GPUTextureView>();
  public bindgroup: Nullable<GPUBindGroup> = null;
  private pipeline: GPURenderPipeline;
  private temporalTexture: GPUTexture;
  private temporalView: GPUTextureView;
  private bindgroupMap: WeakMap<Light, WeakMap<Drawable, GPUBindGroup>> = new WeakMap();
  private lightDirectionBuffer: GPUBuffer;

  constructor(private scene: SceneInterface) {

    const module = device.createShaderModule({
      code: shader
    });

    this.pipeline = utils.createBasePipeline(device, {
      fragment: module,
      vertex: module,
    });

    this.temporalTexture = device.createTexture({
      label: "TEMP TEXTURE",
      format: Renderer.RENDER_FORMAT,
      size: Light.shadowMapResolution,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.temporalView = this.temporalTexture.createView();

    this.lightsBuffer = device.createBuffer({
      // 2 of 4x4 f32 matrix
      size: Math.max(this.lights.size, 1) * Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.lightDirectionBuffer = device.createBuffer({
      size: 3 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

  }

  public add(source: Light) {

    this.views.set(source.texture, source.texture.createView());

    this.lights.add(source);

    source.observer.update();

    this.bindgroup = device.createBindGroup({
      label: "Scene Lighting Bindgroup",
      layout: this.scene.pipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: { buffer: this.lightsBuffer } },
        { binding: 1, resource: this.views.get(source.texture)! },
        { binding: 2, resource: { buffer: this.lightDirectionBuffer } },
      ]
    });

  }

  public pass(
    encoder: GPUCommandEncoder,
    drawQueue: Array<Drawable>,
  ) {

    let layout = this.pipeline.getBindGroupLayout(0);
    let index = 0;

    for (const light of this.lights) {

      if ( index === 0 ) device.queue.writeBuffer(
        this.lightDirectionBuffer, 0, 
        new Float32Array(vec3.normalize([0,0,0], vec3.sub([0,0,0], light.observer.position, light.observer.target)))
      );

      encoder.copyBufferToBuffer(
        light.observer.buffer, 0,
        this.lightsBuffer, Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE * index++,
        light.observer.buffer.size
      );

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            loadOp: "clear",
            storeOp: "discard",
            clearValue: [ 1, 1, 1, 1 ],
            view: this.temporalView,
          }
        ],
        depthStencilAttachment: {
          view: this.views.get(light.texture)!,
          depthLoadOp: "clear",
          depthStoreOp: "store",
          depthClearValue: 1,
        },
      });

      pass.setPipeline(this.pipeline);

      for (const x of drawQueue) {

        if (x.shadowCast === false) continue;

        const vertexCount = x.vertexBuffer.size / Float32Array.BYTES_PER_ELEMENT / Mesh.VERTEX_SIZE;

        pass.setVertexBuffer(0, x.vertexBuffer);

        let map = this.bindgroupMap.get(light);

        if ( !map ) this.bindgroupMap.set(light, map = new WeakMap());

        if ( map?.has(x) ) {

          pass.setBindGroup(0, map.get(x)!);

        } else {

          const bindgroup = device.createBindGroup({
            layout: layout,
            label: "Scene Bindgroup",
            entries: [
              { binding: 0, resource: { buffer: light.observer.buffer } },
              { binding: 1, resource: { buffer: x.tranformationBuffer } },
            ]
          });

          map!.set(x, bindgroup);

          pass.setBindGroup(0, bindgroup);

        }
        
        pass.draw(vertexCount, x.instances);

      }

      pass.end();


    }
  }
}