import { MSAA, Renderer } from "./renderer.model";

import { Camera } from "./camera/camera.model";
import { Actor } from "../entity/actor.entity";

import { Drawable } from "../interfaces/drawable.interface";
import { SceneInterface } from "../interfaces/scene.interface";

import { InstancesMesh, Mesh } from "../mesh/mesh.model";
import { ProceduredMaterial } from "../mesh/mesh.material";
import { Preprocessor } from "../utils/preprocessor.utils";

// Light
import { ShadowPass } from "./passes/shadow.pass"

import * as utils from "./renderer.utils";
import { PointLightRepository } from "./light/point.model";
import { DirectionLight } from "./light/light.model";

const enum BindgroupLabels {
  BaseGroup,
  InstanceGroup,
  ShadowMappingGroup,
  PointLightGroup
}

export class Scene extends SceneInterface {

  static SHADOW_PASS  = true;
  static LIGHT_PASS   = false;

  pipeline: GPURenderPipeline;
  
  private passDescriptor = Scene.baseColorAttacment();
  private bindgroupMap = new WeakMap<Drawable, GPUBindGroup>();
  private bundles = new WeakMap<Drawable, GPURenderBundle>();
  
  public actor: Actor;
  public sun = new DirectionLight();
  public drawQueue = new Set<Drawable>();
  public onpass = new Set<Function>();
  public meshes = new Map<any, Mesh>();
  public shadowPass: ShadowPass;
  public pointLightSource: PointLightRepository;
  public setupBindgroup: GPUBindGroup;

  constructor(
    public renderer: Renderer,
    public materials: Array<ProceduredMaterial> = [],
  ) {

    super();

    const aspect = window.innerWidth / window.innerHeight;

    this.actor = new Actor(new Camera(aspect));

    this.renderer.preprocessor.applyMaterials(
      this.materials.map(x => this.renderer.materials.register(x))
    );

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [
        device.createBindGroupLayout({
          label: BindgroupLabels.BaseGroup.toString(),
          entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } },
          ]
        }),
        device.createBindGroupLayout({
          label: BindgroupLabels.InstanceGroup.toString(),
          entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
            { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d", sampleType: "float" } },
          ]
        }),
        device.createBindGroupLayout({
          label: BindgroupLabels.ShadowMappingGroup.toString(),
           entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d-array", sampleType: "depth" } },
          ]
        }),
        device.createBindGroupLayout({
          label: BindgroupLabels.PointLightGroup.toString(),
          entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } }
          ]
        })
      ]
    });

    this.pipeline = utils.createBasePipeline(Preprocessor.setup(
      "Scene shader",
      this.renderer.preprocessor, 
    ), { multisample: { count: this.renderer.msaa }, label: "Scene Pipiline Test", layout });

    this.setupBindgroup = device.createBindGroup({
      label: "Scene Setup Bindgroup",
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.renderer.baseUniformBuffer } },
        { binding: 1, resource: { buffer: this.actor.camera.gbuffer } },
        { binding: 2, resource: this.renderer.sampler },
        { binding: 3, resource: this.renderer.compSampler }
      ]
    });

    this.shadowPass = new ShadowPass(this);
    this.pointLightSource = new PointLightRepository(this);

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

  pass(encoder: GPUCommandEncoder, qs?: GPUQuerySet): void {

    this.actor.update();

    for (const cb of this.onpass) cb();

    { // TODO: Предварительный проход для карты глубины и нормалей

    }

    if ( Scene.SHADOW_PASS ) {
      this.shadowPass.pass(encoder, this.drawQueue);
    }

    if ( Scene.LIGHT_PASS ) { // Point lights
      this.pointLightSource.update();
    }

    { // Render pass

      const desc = this.updatePassDescriptor(qs);
      const pass    = encoder.beginRenderPass(desc);

      const queue      = Array<GPURenderBundle>();

      for (const x of this.drawQueue) {
        if ( x.drop === false ) queue.push(this.bundles.get(x) || this.createBundle(x));
      }

      pass.executeBundles(queue);
      pass.end();

    }

  }

  private createBundle(x: Drawable) {

    let bundle: GPURenderBundle;

    const encoder = device.createRenderBundleEncoder({
      colorFormats        : [ Renderer.RENDER_FORMAT ],
      depthStencilFormat  : Renderer.DEPTH_FORMAT,
      sampleCount         : this.renderer.msaa,
    });

    encoder.setPipeline(this.pipeline);
    encoder.setBindGroup(0, this.setupBindgroup);
    encoder.setBindGroup(2, this.shadowPass.bindgroup!);
    encoder.setBindGroup(3, this.pointLightSource.bindgroup);

    let bindgroup = this.bindgroupMap.get(x);

    if (bindgroup) encoder.setBindGroup(1, bindgroup);

    else this.bindgroupMap.set(x, bindgroup = device.createBindGroup({
      label: "Drawable Instance Bindgroup",
      layout: this.pipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: x.buffers.tranformation } },
        { binding: 1, resource: { buffer: x.buffers.visibility } },
        { binding: 2, resource: { buffer: x.buffers.params } },
        { binding: 3, resource: x.data.texture.createView() },
      ]
    }));

    encoder.setVertexBuffer(0, x.buffers.vertex);
    encoder.setBindGroup(1, bindgroup);

    x instanceof InstancesMesh
      ? encoder.draw(x.vertexCount, x.updateVisibilityBuffer())
      : encoder.draw(x.vertexCount);

    this.bundles.set(x, bundle = encoder.finish());

    return bundle;

  }
}
