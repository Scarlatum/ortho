export abstract class PostEffect {

  protected active = true;
  protected module: GPUShaderModule = Object();
  protected pipeline: GPURenderPipeline = Object();
  protected uniformBuffer: GPUBuffer = Object();
  protected sampler: GPUSampler = Object();
  protected bundle: GPURenderBundle = Object();

  // Brand type to uniquely identify each post effect
  abstract readonly brand: symbol;

  abstract pass(framebuffer: GPUTexture, ...args: any): void;

}