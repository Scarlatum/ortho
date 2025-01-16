import * as utils from "../renderer.utils";

import { Renderer } from "../renderer.model";
import { Observer } from "../camera/camera.model";
import { Drawable } from "../../interfaces/drawable.interface";
import { Mesh } from "../../mesh/mesh.model";

// Shader modules 
import shader from "../shaders/light.wgsl?raw";
import { mat4 } from "gl-matrix";
import { SceneInterface } from "../../interfaces/scene.interface";

export class Light {

  static readonly defaultOrthoParams = {
    left    : -50 * 5,
    right   :  50 * 5,
    bottom  : -50 * 5,
    top     :  50 * 5,
    near    : -800,
    far     :  300,
  };

  static RESOLUTION = 1024 * 3;
  static readonly shadowMapResolution = {
    width: Light.RESOLUTION,
    height: Light.RESOLUTION
  };

  public texture: GPUTexture;
  public static: boolean = false;

  constructor(
    public observer: Observer, 
    ortho = Light.defaultOrthoParams
  ) {

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

  public static_queue = new Set<Light>();
  public lights = new Set<Light>();
  public lightsBuffer: GPUBuffer;
  public views = new WeakMap<GPUTexture, GPUTextureView>();
  public bindgroup: Nullable<GPUBindGroup> = null;
  private pipeline: GPURenderPipeline;
  private temporalTexture: GPUTexture;
  private temporalView: GPUTextureView;
  private bindgroupMap: WeakMap<Light, WeakMap<Drawable, GPUBindGroup>> = new WeakMap();

  constructor(private scene: SceneInterface) {

    const module = device.createShaderModule({
      code: shader
    });

    const format: GPUTextureFormat = "r8unorm";

    this.pipeline = utils.createBasePipeline(device, {
      fragment: module,
      vertex: module,
    }, { label: "Light Sourses Pipeline" }, undefined, format);

    this.temporalTexture = device.createTexture({
      label: "TEMP TEXTURE",
      format: format,
      size: Light.shadowMapResolution,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.temporalView = this.temporalTexture.createView();

    this.lightsBuffer = device.createBuffer({
      size: Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE * 2,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

  }

  public add(source: Light) {

    this.views.set(source.texture, source.texture.createView());
    this.lights.add(source);

    if ( this.lights.size < 2 ) return;

    let dynamic_light: Nullable<Light> = null;
    let static_light: Nullable<Light> = null;

    for ( const x of this.lights ) {

      if (dynamic_light && static_light) break;

      if ( x.static === false ) dynamic_light = x;
      
      if ( x.static === true ) this.static_queue.add(static_light = x);
      
    }

    if ( dynamic_light && static_light ) this.bindgroup = device.createBindGroup({
      label: "Scene Lighting Bindgroup",
      layout: this.scene.pipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: { buffer: this.lightsBuffer } },
        { binding: 1, resource: this.views.get(dynamic_light.texture)! },
        { binding: 2, resource: this.views.get(static_light.texture)! }
      ]
    });

    else throw Error();

  }

  public pass(
    encoder: GPUCommandEncoder,
    drawQueue: Array<Drawable>,
  ) {

    if ( drawQueue.length === 0 ) return;

    let layout = this.pipeline.getBindGroupLayout(0);
    let index = 0;

    for (const light of this.lights) {

      if ( light.static ) {

        if ( this.static_queue.has(light) === false ) continue;
        
        this.static_queue.delete(light);

      }

      encoder.copyBufferToBuffer(
        light.observer.buffer, 0,
        this.lightsBuffer, Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE * index,
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

      const q = drawQueue.filter(draw => draw.static === light.static);

      for (const x of q) {

        if ( x.shadowCast === false ) continue;

        const vertexCount = x.vertexBuffer.size / Float32Array.BYTES_PER_ELEMENT / Mesh.VERTEX_SIZE;

        pass.setVertexBuffer(0, x.vertexBuffer);

        let map = this.bindgroupMap.get(light);

        if ( !map ) this.bindgroupMap.set(light, map = new WeakMap());

        if ( map.has(x) ) {

          pass.setBindGroup(0, map.get(x)!);

        } else {

          const bindgroup = device.createBindGroup({
            layout: layout,
            label: "Scene Bindgroup",
            entries: [
              { binding: 0, resource: { 
                buffer: light.observer.buffer, 
              } },
              { binding: 1, resource: { buffer: x.tranformationBuffer } },
            ]
          });


          map.set(x, bindgroup);

          pass.setBindGroup(0, bindgroup);

        }
        

        pass.draw(vertexCount, x.instances);

      }

      pass.end();

      index += 1;

    }
  }
}