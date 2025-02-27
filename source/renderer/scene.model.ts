import utils from "./renderer.utils";
import { Renderer } from "./renderer.model";
import { layouts, MSAA, GBufferType } from "./renderer.contants";

import { Actor } from "../entity/actor.entity";

import { Drawable } from "../interfaces/drawable.interface";
import { SceneInterface } from "../interfaces/scene.interface";

import { InstancedMesh, Mesh } from "../mesh/mesh.model";
import { ProceduredMaterial } from "../mesh/mesh.material";
import { Preprocessor } from "../utils/preprocessor.utils";

// Light
import { ShadowPass } from "./passes/shadow.pass";

import { PointLightRepository } from "./light/point.model";
import { DirectionLight } from "./light/light.model";
import { Texture } from "./texture.model";
import { TextureContainer } from "../entity/creation.entity";

export class Scene extends SceneInterface {

  static SHADOW_PASS = true;
  static LIGHT_PASS = true;

  private static readonly textureSamplerDescriptor: GPUSamplerDescriptor = {
    magFilter: "nearest",
    minFilter: "linear",
    mipmapFilter: "linear"
  };

  private static readonly depthSamplerDescriptor: GPUSamplerDescriptor = {
    compare: "less",
    minFilter: "nearest",
    magFilter: "nearest"
  };

  public pipeline: GPURenderPipeline;

  private passDescriptor = Scene.baseColorAttacment();
  private bindgroupMap = new WeakMap<Drawable, GPUBindGroup>();
  private bundles = new WeakMap<Drawable, GPURenderBundle>();
  private shadowPass: ShadowPass;
  private setupBindgroup: GPUBindGroup;

  public actor: Actor;
  public sun = new DirectionLight();
  public drawQueue = new Set<Drawable>();
  public onpass = new Set<Function>();
  public meshes = new Map<any, Mesh | InstancedMesh>();
  public pointLightSource: PointLightRepository;

  constructor(
    public renderer: Renderer,
    materials: Array<ProceduredMaterial> = [],
    fragments: Array<string> = [],
  ) {

    super();

    this.renderer.preprocessor.applyMaterials(
      materials.map(x => this.renderer.materials.register(x))
    );

    fragments.forEach(x => renderer.preprocessor.applyFragment(x));

    this.pipeline = utils.createBasePipeline(Preprocessor.setup(
      "Scene shader",
      this.renderer.preprocessor,
    ), {
      label: "Scene Pipiline Test",
      multisample: { count: this.renderer.msaa },
      layout: device.createPipelineLayout({
        bindGroupLayouts: layouts.map(x => device.createBindGroupLayout(x))
      })
    });

    this.shadowPass         = new ShadowPass(this);
    this.pointLightSource   = new PointLightRepository(this);
    this.actor              = new Actor(this);

    this.setupBindgroup = device.createBindGroup({
      label: "Scene Setup Bindgroup",
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.renderer.uniformBuffer } },
        { binding: 1, resource: { buffer: this.actor.camera.gbuffer } },
        { binding: 2, resource: device.createSampler(Scene.textureSamplerDescriptor) },
        { binding: 3, resource: device.createSampler(Scene.depthSamplerDescriptor) }
      ]
    });

    this.renderer.onResizeHooks.add(() => this.onScreenResize());

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
          clearValue: [ 1, 1, 1, 1 ],
        }
      ]
    };
  }

  static async setTexture(res: ArrayBuffer, container: TextureContainer, as: keyof TextureContainer) {

    const tex = await Texture.fromBuffer(res);

    if (tex instanceof Texture) {
      container[as] = [ tex ];
    }

  }

  private createBundle(x: Drawable) {

    let bundle: GPURenderBundle;

    const encoder = device.createRenderBundleEncoder({
      colorFormats: [ Renderer.RENDER_FORMAT ],
      depthStencilFormat: Renderer.DEPTH_FORMAT,
      sampleCount: this.renderer.msaa,
    });

    encoder.setPipeline(this.pipeline);

    const { buffer, pointer } = Mesh.arenas.full.get(x.id);

    encoder.setVertexBuffer(0, buffer, pointer.address, pointer.size);

    {

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
  
      encoder.setBindGroup(0, this.setupBindgroup);
      encoder.setBindGroup(1, bindgroup);
      encoder.setBindGroup(2, this.shadowPass.bindgroup);
      encoder.setBindGroup(3, this.pointLightSource.bindgroup);

    }

    x instanceof InstancedMesh
      ? encoder.draw(x.vertexCount, x.updateVisibilityBuffer())
      : encoder.draw(x.vertexCount);

    this.bundles.set(x, bundle = encoder.finish());

    return bundle;

  }

  private updatePassDescriptor(query?: GPUQuerySet) {

    const framebuffer = this.renderer.gbuffers[ GBufferType.Frame ];
    const depthbuffer = this.renderer.gbuffers[ GBufferType.Depth ];

    this.passDescriptor.depthStencilAttachment!.view = this.renderer.viewMap.get(depthbuffer)!;

    if (query) {
      this.passDescriptor.timestampWrites = {
        querySet: query,
        beginningOfPassWriteIndex: 0,
        endOfPassWriteIndex: 1,
      };
    }

    for (const x of this.passDescriptor.colorAttachments) {

      if (!x) continue;

      const view = context.getCurrentTexture().createView();

      if (this.renderer.msaa !== MSAA.NONE) {
        x.view = this.renderer.viewMap.get(framebuffer)!;
        x.resolveTarget = view;
      }

      else x.view = view;

    }

    return this.passDescriptor;

  }

  public async setupScene(): Promise<Scene> {
    throw Error("Setup is not implemented in your scene");
  }

  public onScreenResize(): void {

    this.actor.camera.aspect = this.renderer.width / this.renderer.height;
    this.actor.camera.updatePerspective(this.actor.camera.fov);

  }

  public pass(encoder: GPUCommandEncoder, qs?: GPUQuerySet): void {

    this.actor.update();

    for (const cb of this.onpass) cb();

    { // TODO: Предварительный проход для карты глубины и нормалей

    }

    if (Scene.SHADOW_PASS) {
      this.shadowPass.pass(encoder, this.drawQueue);
    }

    if (Scene.LIGHT_PASS) { // Point lights
      this.pointLightSource.update();
    }

    { // Render pass

      const desc = this.updatePassDescriptor(qs);
      const pass = encoder.beginRenderPass(desc);

      const queue = new Set<GPURenderBundle>();

      for (const x of this.drawQueue) {
        if (x.drop === false) queue.add(this.bundles.get(x) || this.createBundle(x));
      }

      pass.executeBundles(queue);
      pass.end();

    }

  }


}
