import { Camera } from "./camera/camera.model";
import { Actor } from "../entity/actor.entity";
import { Drawable } from "../interfaces/drawable.interface";
import { SceneInterface } from "../interfaces/scene.interface";
import { Mesh } from "../mesh/mesh.model";
import { MSAA, Renderer } from "./renderer.model";
import { ProceduredMaterial } from "../mesh/mesh.material";
import { ShaderBuilder } from "../mesh/builders/shader.builder";

// Light
import { LightSources } from "./light/light.model"

import * as utils from "./renderer.utils";

export class Scene extends SceneInterface {


  pipeline: GPURenderPipeline;
  bingGroupLayout: GPUBindGroupLayout;
  
  private passDescriptor = Scene.baseColorAttacment();
  private bindgroupMap = new WeakMap<Drawable, GPUBindGroup>();

  public actor: Actor;
  public drawQueue: Drawable[] = Array();
  public onpass: Set<Function> = new Set();
  public meshes = new Map<any, Mesh>();
  public lightSources: LightSources;

  constructor(
    public renderer: Renderer,
    public materials: Array<ProceduredMaterial> = [],
    public resourses: Record<string, URL> = {},
  ) {

    super();

    const aspect = window.innerWidth / window.innerHeight;

    this.actor = new Actor(new Camera(aspect));
    this.lightSources = new LightSources();

    this.renderer.shaderBuilder.applyMaterials(
      this.materials.map(x => this.renderer.materials.register(x))
    );

    this.pipeline = utils.createBasePipeline(renderer.device, ShaderBuilder.compile(
      this.renderer.shaderBuilder,
      window.device
    ), { multisample: { count: this.renderer.msaa } });

    this.bingGroupLayout = this.pipeline!.getBindGroupLayout(0);
    this.renderer.onResizeHooks.add(() => this.onScreenChange());

  }

  static baseColorAttacment(): GPURenderPassDescriptor {
    return {
      label: "render",
      depthStencilAttachment: {
        view: Object(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1,
      },
      colorAttachments: [
        {
          view: Object(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: [ 1,1,1,1 ],
        }
      ]
    };
  }

  // protected async makePlane(customMaterial ?: ProceduredMaterial) {

  //   const plane = new Mesh({
  //     id: Symbol("plane mesh"),
  //     material: customMaterial ?? null,
  //     vertexes: new Float32Array(planeVertexes),
  //     texture: utils.createBaseTexture(window.device),
  //     uv: new Float32Array([
  //       1, 0,
  //       0, 0,
  //       0, 1,
  //       1, 1,
  //       1, 0,
  //       0, 1,
  //     ]),
  //     normals: null,
  //   });

  //   const model = DOMMatrix.fromFloat32Array(new Float32Array(plane.model));

  //   model.rotateAxisAngleSelf(1, 0, 0, 90);
  //   model.scaleSelf(Camera.FAR_POINT);
  //   model.translateSelf(0, 0, -0.5);

  //   plane.writeModel = model.toFloat32Array();

  //   this.drawQueue.push(plane);

  // }

  public updatePassDescriptor(query?: GPUQuerySet) {

    this.passDescriptor.depthStencilAttachment!.view = this.renderer.viewsMap.get(this.renderer.depthBuffer)!;

    if (query) {
      this.passDescriptor.timestampWrites = {
        querySet: query,
        beginningOfPassWriteIndex: 0,
        endOfPassWriteIndex: 1,
      }
    }

    for (const x of this.passDescriptor.colorAttachments) {

      const view = window.context.getCurrentTexture().createView();

      if (this.renderer.msaa >= MSAA.X4) {
        x!.view = this.renderer.viewsMap.get(this.renderer.frameBuffer)!;
        x!.resolveTarget = view;
      } 
      
      else x!.view = view;

    }

    return this.passDescriptor;

  }

  public async setupScene(): Promise<void> {
    throw Error("Setup is not implemented in your scene");
  }

  onScreenChange(): void {
    // ? По какой-то причине я меняю блядский буффер камеры из под сцены, что вызывает много вопросов к моей адекватности...
    { // Update camera
      this.actor.camera.aspect = window.context.canvas.width / window.context.canvas.height;
      this.actor.camera.updatePerspective(this.actor.camera.fov);
    }
  }

  createRenderBundle(x: Drawable, bindgroup: GPUBindGroup) {

    const bundle = window.device.createRenderBundleEncoder({
      colorFormats: [ Renderer.RENDER_FORMAT ],
      depthStencilFormat: 'depth24plus',
    });

    bundle.setPipeline(this.pipeline);
    bundle.setBindGroup(0, bindgroup);
    bundle.setVertexBuffer(0, x.vertexBuffer);
    bundle.draw(
      x.vertexBuffer.size / Float32Array.BYTES_PER_ELEMENT / Mesh.VERTEX_SIZE,
      x.instances
    );

    return bundle.finish();

  }

  pass(encoder: GPUCommandEncoder, qs?: GPUQuerySet): void {

    if (!this.pipeline) throw Error();

    this.actor.update();

    for (const cb of this.onpass) cb();

    { // TODO: Предварительный проход для карты глубины и нормалей

    }

    { // TODO: Проход карт теней
      this.lightSources.pass(encoder, this.drawQueue);
    }

    { // Render pass

      const passDescriptor = this.updatePassDescriptor(qs);

      const pass = encoder.beginRenderPass(passDescriptor);

      pass.setPipeline(this.pipeline);
      
      for (const x of this.drawQueue) {

        if (x.drop) continue;

        if ( this.bindgroupMap.has(x) ) {
          pass.setBindGroup(0, this.bindgroupMap.get(x)!);
        } else {

          const [ first ] =  this.lightSources.lights;

          const bindgroup = device.createBindGroup({
            label: "Scene Bindgroup",
            layout: this.bingGroupLayout,
            entries: [
              { binding: 999, resource: { buffer: this.renderer.baseUniformBuffer } },
              { binding: 998, resource: { buffer: this.actor.camera.buffer } },
              { binding: 997, resource: { buffer: x.tranformationBuffer } },
              { binding: 996, resource: this.renderer.sampler },
              { binding: 995, resource: x.texture.createView() },
              { binding: 994, resource: { buffer: this.lightSources.lightsBuffer } },
              { binding: 993, resource: this.lightSources.views.get(first.texture)! },
              { binding: 992, resource: this.renderer.compSampler }
            ]
          });

          pass.setBindGroup(0, this.bindgroupMap
            .set(x, bindgroup)
            .get(x)!
          );

        }

        pass.setVertexBuffer(0, x.vertexBuffer);

        const vertexCount = x.vertexBuffer.size
          / Float32Array.BYTES_PER_ELEMENT
          / Mesh.VERTEX_SIZE
          ;

        pass.draw(vertexCount, x.instances);

      }

      pass.end();

    }

  }

}