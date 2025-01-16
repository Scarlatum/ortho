import { MaterialRepository } from "./renderer.material";

import { ShaderBuilder } from "../mesh/builders/shader.builder";

import { SceneInterface } from "../interfaces/scene.interface";
import { PostEffect } from "../interfaces/postpass.interface";

// Shader modules 
import s_utils from "./shaders/utils.wgsl?raw";
import s_constants from "./shaders/base/constants.wgsl?raw";
import s_structs from "./shaders/base/structs.wgsl?raw";
import s_bindings from "./shaders/base/bindings.wgsl?raw";
import s_vertex from "./shaders/base/vertex.wgsl?raw";
import s_fragment from "./shaders/base/fragment.wgsl?raw";

// Previews
import { TexturePreview } from "../renderer/preview";

interface RendererInfo {
  currentFrame: number;
  frameRate: number;
}

export const enum MSAA { NONE = 1, X4 = 4, X8 = 8, X16 = 16 };

export class Renderer {

  static readonly DEPTH_FORMAT: GPUTextureFormat = "depth24plus";
  static readonly RENDER_FORMAT: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
  static readonly TIME_MEASURE = import.meta.env.DEV;

  private preview: TexturePreview;
  public materials = new MaterialRepository();

  public info: RendererInfo = {
    currentFrame: 0,
    frameRate: 0,
  };

  public msaa: MSAA = MSAA.X4;
  public onResizeHooks: Set<(...args: any) => any> = new Set();
  public framedrop: boolean = false;
  public scenes = Array<SceneInterface>();
  public currentSceneIndex = 0;
  public sampler: GPUSampler;
  public depthBuffer: GPUTexture;
  public frameBuffer: GPUTexture;
  public normalBuffer: GPUTexture;
  public baseUniformBuffer: GPUBuffer;
  public shaderBuilder: ShaderBuilder;
  public postPasses = new Set<PostEffect>();
  public compSampler: GPUSampler;

  public viewsMap = new WeakMap<GPUTexture, GPUTextureView>();

  constructor(
    public device: GPUDevice,
    public context: GPUCanvasContext,
  ) {

    this.sampler = device.createSampler({
      magFilter: "nearest",
			minFilter: "linear",
    });

    this.compSampler = device.createSampler({
      compare: "less",
      minFilter: "linear",
      magFilter: "linear",
    });

    context.configure({
      device: device,
      format: Renderer.RENDER_FORMAT,
      alphaMode: "premultiplied",
      usage: GPUTextureUsage.RENDER_ATTACHMENT 
        | GPUTextureUsage.COPY_DST
        | GPUTextureUsage.TEXTURE_BINDING
        ,
    });

    this.shaderBuilder = new ShaderBuilder({
      bindings: s_bindings,
      constants: s_constants,
      structs: s_structs,
      utils: s_utils,
      kernel: {
        fragment: s_fragment,
        vertex: s_vertex,
      }
    });

    this.depthBuffer = this.updateDepthTexture();
    this.frameBuffer = this.updateFrameBuffer();
    this.normalBuffer = this.updateNormalBuffer();

    this.baseUniformBuffer = device.createBuffer({
      size: Float32Array.BYTES_PER_ELEMENT * 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.preview = new TexturePreview(this);

    this.onResizeHooks.add(() => this.onResize());

    window.addEventListener("resize", () => {
      for ( const cb of this.onResizeHooks ) cb();
    });

  }
  

  get currentScene() {
    return this.scenes[ this.currentSceneIndex ];
  }

  static async getSetup(view: HTMLCanvasElement) {

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) throw Error();

    const device = await adapter.requestDevice({
      requiredFeatures: [
        "bgra8unorm-storage",
        "timestamp-query",
      ]
    });

    if (!device) throw Error();

    device.lost.then(info => {
      console.info(info, device, adapter);
    });

    const context = view.getContext("webgpu");

    if (!context) throw Error();

    globalThis.device = device;
    globalThis.adapter = adapter;
    globalThis.context = context;

    return [ adapter, device, context ] as const;

  }

  private onResize() {

    const { height, width } = getComputedStyle(this.context.canvas as HTMLCanvasElement);

    this.context.canvas.width = parseInt(width);
    this.context.canvas.height = parseInt(height);

    this.depthBuffer = this.updateDepthTexture();
    this.frameBuffer = this.updateFrameBuffer();
    this.normalBuffer = this.updateNormalBuffer();

  }

  private updateNormalBuffer(): any {

    const prev = this.normalBuffer;

    const texture = this.device.createTexture({
      label: "Normal Texture",
      sampleCount: this.msaa,
      size: {
        width: this.context.canvas.width,
        height: this.context.canvas.height,
        depthOrArrayLayers: 1,
      },
      format: Renderer.RENDER_FORMAT,
      dimension: "2d",
      usage: GPUTextureUsage.RENDER_ATTACHMENT
        | GPUTextureUsage.TEXTURE_BINDING
      ,
    });

    if (prev instanceof GPUTexture) prev.destroy();

    this.viewsMap.set(texture, texture.createView())

    return texture;

  }

  private updateDepthTexture() {

    const prev = this.depthBuffer;
    const texture = this.device.createTexture({
      label: "Depth Texture",
      sampleCount: this.msaa,
      size: {
        width: this.context.canvas.width,
        height: this.context.canvas.height,
        depthOrArrayLayers: 1,
      },
      format: Renderer.DEPTH_FORMAT,
      dimension: "2d",
      usage: GPUTextureUsage.RENDER_ATTACHMENT
        | GPUTextureUsage.TEXTURE_BINDING
      ,
    });

    if (prev instanceof GPUTexture) prev.destroy();

    this.viewsMap.set(texture, texture.createView())

    return texture;

  }

  private updateFrameBuffer() {

    const prev = this.frameBuffer;

    const texture = this.device.createTexture({
      label: "Frame Buffer",
      format: Renderer.RENDER_FORMAT,
      sampleCount: this.msaa,
      size: {
        width: this.context.canvas.width,
        height: this.context.canvas.height,
      },
      usage: GPUTextureUsage.RENDER_ATTACHMENT
        | GPUTextureUsage.COPY_DST
        | GPUTextureUsage.TEXTURE_BINDING
    });

    if (prev instanceof GPUTexture) prev.destroy();

    this.viewsMap.set(texture, texture.createView());

    return texture;

  }

  public addScene(scene: SceneInterface) {

    this.onResizeHooks.add(() => scene.onScreenChange());

    this.scenes.push(scene);

    this.currentScene.actor.applyListeners(this.context.canvas as HTMLCanvasElement);

  }

  public render(frameCallback: Nullable<(info: RendererInfo) => void>) {

    this.info.currentFrame++;
    
		window.device.queue.writeBuffer(
      this.baseUniformBuffer, 
      0, 
      new Float32Array([
        this.info.currentFrame++,
        0, // byte for align
        this.context.canvas.width,
        this.context.canvas.height,
        ...this.currentScene.actor.camera.position
      ]),
    );

    if (this.framedrop === false) {

      if (frameCallback) frameCallback(this.info);

      { // TODO: Проход карт теней

        const encoder = this.device.createCommandEncoder({
          label: "shadow pass encoder"
        });

        this.currentScene.lightSources.pass(encoder, this.currentScene.drawQueue);

        this.device.queue.submit([ encoder.finish() ]);

      }

      { // Основной проход

        const encoder = this.device.createCommandEncoder({
          label: "main pass encoder"
        });

        this.currentScene.pass(encoder);

        this.device.queue.submit([ encoder.finish() ]);

      }

      { // Пост-процессинг

        // ? Тут начинается второй проход отрисовщика для пост-эффектов разного толка.
        // ? Честно, я не совсем ещё уверен как мне работать с MSAA в данном контексте...      
        for (const post of this.postPasses) {
          post.pass(this.context.getCurrentTexture());
        }

      }

      // const l = Array.from(this.currentScene.lightSources.lights);

      { // Отладочные проходы
        // if ( import.meta.env.DEV ) this.preview.show(
        //   this.context.getCurrentTexture(),
        //   // this.depthBuffer
        //   l[0].texture
        // );
      }

    }

    requestAnimationFrame(() => this.render(frameCallback));

  }

}
