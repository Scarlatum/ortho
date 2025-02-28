export abstract class Attachable {

  public abstract module: GPUShaderModule;
  public abstract pipeline: GPURenderPipeline;
  public abstract gbuffer: GPUTexture;
  
  public abstract attach(encoder: GPUCommandEncoder, view: GPUTextureView): GPUCommandEncoder;

}