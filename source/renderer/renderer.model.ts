import { type SceneInterface } from "../interfaces/scene.interface";
import { type PostEffect } from "../interfaces/postpass.interface";

import { MaterialRepository } from "./renderer.material";
import { Preprocessor } from "../utils/preprocessor.utils";
import { DefaultShader } from "./renderer.utils"

import { MSAA, GBufferType } from "./renderer.contants";
import { Mesh, VertexLayoutSize } from "../mesh/mesh.model";

export class VertexArena {

  private layout = new WeakMap<Symbol, Pointer>();
  private offset = 0;

  constructor(private buffer: GPUBuffer) {

  }

  public add(id: Symbol, data: Float32Array) {

    device.queue.writeBuffer(this.buffer, this.offset, data);

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

  static readonly DEPTH_FORMAT: GPUTextureFormat = "depth24plus";
  static readonly RENDER_FORMAT: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
  static readonly TIME_MEASURE = import.meta.env.DEV;

  public materials = new MaterialRepository();

  public info = {
    currentFrame  : 0,
    frameRate     : 0,
    delta         : 0,
    timestampPrev : 0,
  };

  protected scenes = Array<SceneInterface>();
  protected postPasses = new Set<PostEffect>();

  public preprocessor = new Preprocessor(DefaultShader);
  public gbuffers = Array<GPUTexture>(3);
  public msaa = MSAA.X4;
  public onResizeHooks: Set<(...args: any) => any> = new Set();
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
        | GPUTextureUsage.COPY_DST
        | GPUTextureUsage.COPY_SRC
        | GPUTextureUsage.TEXTURE_BINDING
    });

    this.uniformBuffer = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

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

    this.onResizeHooks.add(() => this.onScreenResize());

    this.updateBuffers();

    window.addEventListener("resize", () => {
      for ( const cb of this.onResizeHooks ) cb();
    });

  }

  get width() {
    return this.context.canvas.width;
  }

  get height() {
    return this.context.canvas.height; 
  }

  static async getSetup(view: HTMLCanvasElement) {

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

  private updateBuffers() {
    for (let type = GBufferType.Frame; type <= GBufferType.Normal; type++) {
      this.gbuffers[ type ] = this.updateTexture(type);
    }
  }

  private onScreenResize() {

    const { height, width } = getComputedStyle(this.context.canvas as HTMLCanvasElement);

    this.context.canvas.width = parseInt(width);
    this.context.canvas.height = parseInt(height);

    this.updateBuffers();

  }

  private updateTexture(type: GBufferType) {

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
        overrides.format  = Renderer.RENDER_FORMAT;
        overrides.usage   = GPUTextureUsage.RENDER_ATTACHMENT
          | GPUTextureUsage.TEXTURE_BINDING
          | GPUTextureUsage.COPY_DST
        break;
    }

    if ( previous ) previous.destroy();

    const texture = device.createTexture(Object.assign(sharedDescriptor, overrides))

    this.viewMap.set(texture, texture.createView())

    return texture;

  }

  public addScene(scene: SceneInterface) {

    this.onResizeHooks.add(() => scene.onScreenResize());

    this.scenes.push(this.currentScene = scene);

    scene.actor.applyListeners(this.context.canvas as HTMLCanvasElement);

    return this;

  }

  public addPostPass(pass: PostEffect) {
    this.postPasses.add(pass);
  }

  public render(time: DOMHighResTimeStamp = 0) {

    if ( this.currentScene === null ) return;

    this.info.timestampPrev = time;

    const cam = this.currentScene.actor.camera;

		device.queue.writeBuffer(
      this.uniformBuffer, 
      0, 
      new Float32Array([
        this.info.currentFrame++,
        0, // byte for align
        this.width,
        this.height,
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

    requestAnimationFrame(timestamp => this.render(timestamp));

    this.info.delta = Math.max(time - this.info.timestampPrev, 0);

  }

}
