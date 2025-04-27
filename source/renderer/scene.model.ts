import utils from "./renderer.utils";
import { Renderer } from "./renderer.model";

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
    // maxAnisotropy: 16,
    magFilter: "nearest",
    minFilter: "linear",
    mipmapFilter: "linear"
  };

  private static readonly depthSamplerDescriptor: GPUSamplerDescriptor = {
    compare: "less",
    maxAnisotropy: 16,
    minFilter: "linear",
    magFilter: "linear",
    mipmapFilter: "linear",
  };

  public pipeline: GPURenderPipeline;

  private passDescriptor = Scene.baseColorAttacment();
  private bindgroupMap = new WeakMap<Drawable, GPUBindGroup>();
  private shadowPass: ShadowPass;
  private setupBindgroup: GPUBindGroup;

  public override actor: Actor;
  public override sun: DirectionLight;
  public override onpass = new Set<Function>();
  public override meshes = new Map<any, Mesh | InstancedMesh>();
  public override pointLightSource: PointLightRepository;

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
      primitive: {
        cullMode: "back",
      },
      multisample: { count: this.renderer.msaa },
      layout: this.renderer.bindgroupLayout
    });

    this.updateQueue.add(this.sun = new DirectionLight(this));
    this.updateQueue.add(this.actor = new Actor(this));

    this.shadowPass = new ShadowPass(this);
    this.pointLightSource = new PointLightRepository(this);

    if ( Scene.LIGHT_PASS ) {
      this.updateQueue.add(this.pointLightSource);
    }

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

  }

  /**
   * Creates a base color attachment configuration for render passes
   * @returns {GPURenderPassDescriptor} A configured render pass descriptor with color and depth attachments
   */
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
        },
        {
          view: Object(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: [ 0,0,0,0 ]
        }
      ]
    };
  }

  /**
   * Sets up a texture from buffer data
   * @param {ArrayBuffer} res - The raw texture data
   * @param {TextureContainer} container - The container to store the texture in
   * @param {keyof TextureContainer} as - The key to store the texture under in the container
   * @param {number} [mip=0] - The mipmap level to set
   * @param {boolean} [raw=false] - Whether the input data is raw texture data
   * @throws {Error} If texture creation fails
   */
  static async setTexture(
    res: ArrayBuffer, 
    container: TextureContainer, 
    as: keyof TextureContainer,
    mip: number = 0,
    raw: boolean = false,
  ) {

    const textures = Array(Texture.mipsQuantity);

    const tex = raw
      ? Texture.fromRaw(res)
      : await Texture.fromBuffer(res)
      ;

    if (tex instanceof Error) throw tex;

    textures[mip] = tex

    container[as] = textures;

  }

  /**
   * Creates a render bundle for a drawable object
   * @param {Drawable} x - The drawable object to create a bundle for
   * @returns {GPURenderBundle} The created render bundle
   */
  private createBundle(x: Drawable): GPURenderBundle {

    const encoder = device.createRenderBundleEncoder({
      label: "SCENE BUNDLE",
      colorFormats: [ Renderer.RENDER_FORMAT, Renderer.NORMAL_FORMAT ],
      depthStencilFormat: Renderer.DEPTH_FORMAT,
      sampleCount: this.renderer.msaa,
    });

    encoder.setPipeline(this.pipeline);

    const { buffer, pointer } = Mesh.arenas.full.get(x.id);

    encoder.setVertexBuffer(0, buffer, pointer.address, pointer.size);

    {

      let bindgroup = this.bindgroupMap.get(x);

      if ( !bindgroup ) this.bindgroupMap.set(x, bindgroup = device.createBindGroup({
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

    return encoder.finish();

  }

  /**
   * Abstract method to be implemented by derived scenes for scene-specific setup
   * @returns {Promise<Scene>} The configured scene instance
   * @throws {Error} Always throws as this is an abstract method
   */
  public async setupScene(): Promise<Scene> {
    throw Error("Setup is not implemented in your scene");
  }

  /**
   * Adds a drawable object to the scene
   * @param {Drawable} x - The drawable object to add
   */
  public add(x: Drawable) {

    this.bundles.add(this.createBundle(x));
    this.drawQueue.add(x);

  }

  /**
   * Executes the main render pass for the scene
   * @param {GPUCommandEncoder} encoder - The command encoder to record rendering commands
   */
  public pass(encoder: GPUCommandEncoder) {

    for ( const x of this.updateQueue ) x.update();

    for ( const x of this.onpass ) x();

    if ( Scene.SHADOW_PASS ) this.shadowPass.pass(encoder, this.drawQueue);
    
    { // Render pass

      const desc = this.renderer.updatePassDescriptor(this.passDescriptor);
      const pass = encoder.beginRenderPass(desc);

      pass.executeBundles(this.bundles);
      pass.end();

    }

  }

}
