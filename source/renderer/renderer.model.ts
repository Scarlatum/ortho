import { type SceneInterface } from "../interfaces/scene.interface";
import { type PostEffect } from "../interfaces/postpass.interface";

import { MaterialRepository } from "./renderer.material";
import { Preprocessor } from "../utils/preprocessor.utils";
import { DefaultShader } from "./renderer.utils"

import { MSAA, GBufferType, layouts } from "./renderer.contants";
import { Mesh, VertexLayoutSize } from "../mesh/mesh.model";

export class VertexArena {

  private layout = new WeakMap<Symbol, Pointer>();
  private offset = 0;

  constructor(private buffer: GPUBuffer) {

  }

  public add(id: Symbol, data: Float32Array) {

    device.queue.writeBuffer(this.buffer, this.offset, data.buffer);

    const ptr: Pointer = {
      address: this.offset,
      size: data.byteLength
    } 

    this.layout.set(id, ptr);

    this.offset += data.byteLength;
    
    return ptr;

  }

  public get(id: Symbol) {
    return { buffer: this.buffer, pointer: this.layout.get(id)! }
  }

}

export class Renderer {

  static dec = new TextDecoder();
  static defaultTexture: GPUTexture;

  static readonly DEPTH_FORMAT: GPUTextureFormat = "depth24plus";
  static readonly RENDER_FORMAT: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
  static readonly NORMAL_FORMAT: GPUTextureFormat = "rgba8unorm";

  public materials = new MaterialRepository();
  private postEffectMap = new Map<symbol, PostEffect>();

  public info = {
    currentFrame  : 0,
    frameRate     : 0,
    delta         : 0,
    timestampPrev : 0,
  };

  protected scenes = Array<SceneInterface>();
  protected postPasses = new Set<PostEffect>();
  protected onResizeHooks: Set<(...args: any) => any> = new Set([
    () => this.onScreenResize()
  ]);

  public pipelineLayout: GPUPipelineLayout;
  public preprocessor = new Preprocessor(DefaultShader);
  public gbuffers = Array<GPUTexture>(3);
  public msaa = MSAA.X4;
  public drop = false;
  public currentScene: Nullable<SceneInterface> = null;
  public uniformBuffer: GPUBuffer;
  public viewMap = new WeakMap<GPUTexture, GPUTextureView>();

  constructor(
    public device: GPUDevice,
    public context: GPUCanvasContext,
    public vertexArenaSize: number = 80_000,
  ) {

    context.configure({
      device,
      format: Renderer.RENDER_FORMAT,
      alphaMode: "premultiplied",
      usage: GPUTextureUsage.RENDER_ATTACHMENT 
        | GPUTextureUsage.COPY_SRC
        | GPUTextureUsage.TEXTURE_BINDING
    });

    Renderer.defaultTexture = device.createTexture({
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING
        | GPUTextureUsage.COPY_DST
        | GPUTextureUsage.RENDER_ATTACHMENT,
      size: { width: 16, height: 16, depthOrArrayLayers: 1 },
      dimension: "2d",
    });

    device.queue.writeTexture(
      {
        texture: Renderer.defaultTexture
      },
      new Float32Array(16 * 16),
      {
        bytesPerRow: 16 * Float32Array.BYTES_PER_ELEMENT,
        rowsPerImage: 16,
      },
      {
        width: Renderer.defaultTexture.width,
        height: Renderer.defaultTexture.height,
      },
    );

    this.uniformBuffer = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    { // Setup Shared Pipeline Layout
      this.pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: layouts.map(x => device.createBindGroupLayout(x))
      })
    }

    { // Setup static mesh properties

      Mesh.arenas.full = new VertexArena(device.createBuffer({
        label: "Vertex Arena :: Full",
        size: vertexArenaSize * VertexLayoutSize.FULL * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      }));

      Mesh.arenas.reduced = new VertexArena(device.createBuffer({
        label: "Vertex Arena :: Reduced",
        size: vertexArenaSize * VertexLayoutSize.REDUCED * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      }));

    }

    this.updateBuffers();

    window.addEventListener("resize", () => {
      for ( const cb of this.onResizeHooks ) cb();
    });

  }

  /**
   * Gets the width of the canvas
   * @returns {number} The width of the canvas in pixels
   */
  get width(): number {
    return this.context.canvas.width;
  }

  /**
   * Gets the height of the canvas
   * @returns {number} The height of the canvas in pixels
   */
  get height(): number {
    return this.context.canvas.height; 
  }

  /**
   * Initializes WebGPU setup for a given canvas element
   * @param {HTMLCanvasElement} view - The canvas element to initialize WebGPU for
   * @returns {Promise<[GPUDevice, GPUAdapter, GPUCanvasContext]>} A tuple containing the GPU device, adapter, and canvas context
   * @throws {Error} If WebGPU initialization fails
   */
  static async getSetup(view: HTMLCanvasElement): Promise<[ GPUDevice, GPUAdapter, GPUCanvasContext ]> {

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) throw Error();

    const device = await adapter.requestDevice();

    if (!device) throw Error();

    device.lost.then(info => {
      console.info(info, device, adapter);
    });

    const context = view.getContext("webgpu");

    if (!context) throw Error();

    return [
      globalThis.device   = device,
      globalThis.adapter  = adapter,
      globalThis.context  = context,
    ] as const;

  }

  /**
   * Updates the render pass descriptor with current texture views
   * @param {GPURenderPassDescriptor} descriptor - The render pass descriptor to update
   * @returns {GPURenderPassDescriptor} The updated render pass descriptor
   * @throws {Error} If color attachments are missing
   */
  public updatePassDescriptor(descriptor: GPURenderPassDescriptor): GPURenderPassDescriptor {

    descriptor.depthStencilAttachment!.view = this.viewMap.get(this.gbuffers[ GBufferType.Depth ])!;

    const [ surface, normals ] = descriptor.colorAttachments;

    if ( !surface || !normals ) throw Error();

    const currentTextureView = context.getCurrentTexture().createView();

    normals.view = this.viewMap.get(this.gbuffers[ GBufferType.Normal ])!;

    if (this.msaa !== MSAA.NONE) {
      surface.view = this.viewMap.get(this.gbuffers[ GBufferType.Frame ])!;
      surface.resolveTarget = currentTextureView;
    }

    else surface.view = currentTextureView;

    return descriptor;

  }

  /**
   * Updates all G-buffer textures based on current canvas dimensions
   */
  private updateBuffers() {
    for (let type = GBufferType.Frame; type <= GBufferType.Normal; type++) {
      this.gbuffers[ type ] = this.updateTexture(type);
    }
  }

  /**
   * Handles canvas resize events and updates internal buffers
   */
  private onScreenResize() {

    const { height, width } = getComputedStyle(this.context.canvas as HTMLCanvasElement);

    this.context.canvas.width = parseInt(width);
    this.context.canvas.height = parseInt(height);

    this.updateBuffers();

  }

  /**
   * Updates a specific G-buffer texture
   * @param {GBufferType} type - The type of G-buffer to update
   * @returns {GPUTexture} The newly created texture
   */
  private updateTexture(type: GBufferType): GPUTexture {

    const previous = this.gbuffers[type];

    const sharedDescriptor = {
      sampleCount: this.msaa,
      dimension: "2d",
      size: {
        width: this.width,
        height: this.height,
      },
    } as const satisfies Partial<GPUTextureDescriptor>;

    const overrides: Omit<GPUTextureDescriptor, keyof typeof sharedDescriptor> = Object();

    switch (type) {
      case GBufferType.Frame:

        overrides.label   = "Frame Buffer"
        overrides.format  = Renderer.RENDER_FORMAT;
        overrides.usage   = GPUTextureUsage.RENDER_ATTACHMENT
          | GPUTextureUsage.TEXTURE_BINDING
          | GPUTextureUsage.COPY_DST
        break;
      case GBufferType.Depth:

        overrides.label   = "Depth Texture"
        overrides.format  = Renderer.DEPTH_FORMAT;
        overrides.usage   = GPUTextureUsage.RENDER_ATTACHMENT
          | GPUTextureUsage.TEXTURE_BINDING
        break;
      case GBufferType.Normal:

        overrides.label   = "Normal Buffer"
        overrides.format  = Renderer.NORMAL_FORMAT;
        overrides.usage   = GPUTextureUsage.RENDER_ATTACHMENT
          | GPUTextureUsage.TEXTURE_BINDING
          | GPUTextureUsage.COPY_DST
        break;
    }

    if ( previous ) previous.destroy();

    const texture = device.createTexture(Object.assign(sharedDescriptor, overrides))

    this.viewMap.set(texture, texture.createView({
      label: `${ overrides.label } view`
    }));

    return texture;

  }

  /**
   * Adds a scene to the renderer
   * @param {SceneInterface} scene - The scene to add
   * @returns {Renderer} The renderer instance for method chaining
   */
  public addScene(scene: SceneInterface): Renderer {

    this.onResizeHooks.add(() => {
      scene.camera.aspect = this.width / this.height;
    });

    this.scenes.push(this.currentScene = scene);

    // scene.actor.applyListeners(this.context.canvas as HTMLCanvasElement);

    return this;

  }

  /**
   * Adds a post-processing effect to the renderer
   * @param {PostEffect} pass - The post-processing effect to add
   */
  public addPostPass(pass: PostEffect) {
    // Check if we already have an instance of this post effect type
    if (!this.postEffectMap.has(pass.brand)) {
      this.postEffectMap.set(pass.brand, pass);
      this.postPasses.add(pass);
    }
  }

  /**
   * Main rendering loop that handles scene rendering and post-processing
   * @param {DOMHighResTimeStamp} time - The current timestamp
   */
  public render(time: DOMHighResTimeStamp = 0) {

    if ( this.currentScene === null ) return;

    this.info.timestampPrev = time;

    const cam = this.currentScene.camera;

		device.queue.writeBuffer(
      this.uniformBuffer, 
      0, 
      new Float32Array([
        this.width,
        this.height,	
        this.info.currentFrame++,
        Number(this.currentScene.sun.debugCascade),
        ...cam.position,
        ...cam.direction,
      ]),
    );

    if (this.drop === false) {

      { // Основной проход

        const encoder = this.device.createCommandEncoder({
          label: "main pass encoder"
        });

        this.currentScene.pass(encoder);
        this.device.queue.submit([ encoder.finish() ]);

      }

      { // Пост-процессинг

        for (const post of this.postPasses) {
          post.pass(this.context.getCurrentTexture());
        }
        
      }

    }

    requestAnimationFrame(x => this.render(x));

    this.info.delta = Math.max(time - this.info.timestampPrev, 0);

  }

}
