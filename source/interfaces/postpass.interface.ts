export abstract class PostEffect {

  protected shaderModule: GPUShaderModule = Object();
  protected pipeline: GPURenderPipeline = Object();
  protected uniformBuffer: GPUBuffer = Object();
  protected sampler: GPUSampler = Object();
  protected bundle: GPURenderBundle = Object();

  abstract pass(framebuffer: GPUTexture, ...args: any): void;

}