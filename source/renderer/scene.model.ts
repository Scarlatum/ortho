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
  
  private passDescriptor = Scene.baseColorAttacment();
  private bindgroupMap = new WeakMap<Drawable, GPUBindGroup>();
  
  public actor: Actor;
  public drawQueue: Drawable[] = Array();
  public onpass: Set<Function> = new Set();
  public meshes = new Map<any, Mesh>();
  public lightSources: LightSources;
  public setupBindgroup: GPUBindGroup;

  constructor(
    public renderer: Renderer,
    public materials: Array<ProceduredMaterial> = [],
    public resourses: Record<string, URL> = {},
  ) {

    super();

    const aspect = window.innerWidth / window.innerHeight;

    this.actor = new Actor(new Camera(aspect));
    this.lightSources = new LightSources(this);

    this.renderer.shaderBuilder.applyMaterials(
      this.materials.map(x => this.renderer.materials.register(x))
    );

    this.pipeline = utils.createBasePipeline(renderer.device, ShaderBuilder.compile(
      this.renderer.shaderBuilder,
      window.device
    ), { multisample: { count: this.renderer.msaa }, label: "Scene Pipiline Test", layout: device.createPipelineLayout({
      bindGroupLayouts: [
        device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
              buffer: { type: "uniform" }
            },
            {
              binding: 1,
              visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
              buffer: { type: "uniform" }
            },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              sampler: { type: "filtering" }
            },
            {
              binding: 3,
              visibility: GPUShaderStage.FRAGMENT,
              sampler: { type: "comparison" }
            },
          ]
        }),
        device.createBindGroupLayout({
          label: "Scene Lighting Layout",
          entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d", sampleType: "float" } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
          ]
        }),
        device.createBindGroupLayout({
          label: `Scene Layout`,
           entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d", sampleType: "depth" } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
          ]
        })
      ]
    }) });

    this.setupBindgroup = device.createBindGroup({
      label: "Scene Setup Bindgroup",
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.renderer.baseUniformBuffer } },
        { binding: 1, resource: { buffer: this.actor.camera.buffer } },
        { binding: 2, resource: this.renderer.sampler },
        { binding: 3, resource: this.renderer.compSampler }
      ]
    });

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

  // createRenderBundle(x: Drawable, bindgroup: GPUBindGroup) {

  //   const bundle = window.device.createRenderBundleEncoder({
  //     colorFormats: [ Renderer.RENDER_FORMAT ],
  //     depthStencilFormat: 'depth24plus',
  //   });

  //   bundle.setPipeline(this.pipeline);
  //   bundle.setBindGroup(0, bindgroup);
  //   bundle.setVertexBuffer(0, x.vertexBuffer);
  //   bundle.draw(
  //     x.vertexBuffer.size / Float32Array.BYTES_PER_ELEMENT / Mesh.VERTEX_SIZE,
  //     x.instances
  //   );

  //   return bundle.finish();

  // }

  pass(encoder: GPUCommandEncoder, qs?: GPUQuerySet): void {

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

        pass.setBindGroup(0, this.setupBindgroup);
        pass.setBindGroup(2, this.lightSources.bindgroup);

        if ( this.bindgroupMap.has(x) ) {
          pass.setBindGroup(1, this.bindgroupMap.get(x)!);
        } else {

          const uuid = crypto.randomUUID();

          const bindgroup = device.createBindGroup({
            label: `Scene Bindgroup :: ${ uuid }`,
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [
              { binding: 0, resource: { buffer: x.tranformationBuffer } },
              { binding: 1, resource: x.texture.createView() },
              { binding: 2, resource: { buffer: x.instanceParamBuffer } },
            ]
          });

          pass.setBindGroup(1, this.bindgroupMap
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