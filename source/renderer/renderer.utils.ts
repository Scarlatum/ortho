import { Preprocessor } from "../utils/preprocessor.utils";
import { Mesh } from "../mesh/mesh.model";
import { DirectionLight } from "./light/light.model";
import { Renderer } from "./renderer.model";

// Shader modules 
import s_utils from "./shaders/utils.wgsl?raw";
import s_constants from "./shaders/base/constants.wgsl?raw";
import s_structs from "./shaders/base/structs.wgsl?raw";
import s_bindings from "./shaders/base/bindings.wgsl?raw";
import s_vertex from "./shaders/base/vertex.wgsl?raw";
import s_fragment from "./shaders/base/fragment.wgsl?raw";

const DEFAULT_16x16 = new Float32Array(16 * 16);

export const DefaultShader = {
  constants: s_constants,
  bindings: s_bindings,
  structs: s_structs,
  utils: s_utils,
  kernel: {
    fragment: s_fragment,
    vertex: s_vertex,
  }
};

export namespace functions {
  
  export async function createImageTexture(
    device: GPUDevice,
    paths: Array<Record<string, Array<string>>>,
  ) {
  
    const queue = Array<Promise<{ texture: GPUTexture, w: number, h: number }>>();
  
    for ( const batch of paths ) {
  
      const paths = Object.keys(batch);
  
      for ( const x of paths ) {
  
        const img = new Image();
              img.src = x;

        queue.push(new Promise(async resolve => {
  
          await img.decode();
  
          const texture = device.createTexture({
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING
              | GPUTextureUsage.COPY_DST
              | GPUTextureUsage.COPY_SRC
              | GPUTextureUsage.RENDER_ATTACHMENT,
            size: {
              width: img.width,
              height: img.height,
            },
            dimension: "2d",
            mipLevelCount: batch[x].length + 1,
          });
    
          resolve({
            texture,
            h: img.height,
            w: img.width
          });
    
          createImageBitmap(img).then(bitmap => {
            device.queue.copyExternalImageToTexture({
              source: bitmap,
              flipY: true,
            }, {
              texture: texture,
            }, {
              width: img.width,
              height: img.height,
            });
          });
    
          for ( let i = 0; i < batch[x].length; i++ ) {
    
            const level = i + 1;
            const mip = new Image(); 
                  mip.src = batch[x][i];
    
            mip.decode().then(() => createImageBitmap(mip)).then(bitmap => {
              device.queue.copyExternalImageToTexture({
                source: bitmap,
                flipY: true,
              }, {
                texture: texture,
                mipLevel: level,
              }, {
                width: img.width / (2 ** level),
                height: img.height / (2 ** level),
              });
            });
    
          }
  
        }));
  
      }
  
    }
  
    return Promise.all(queue);
  
  }
    
  export function createBasePipeline(
    shaders: ReturnType<typeof Preprocessor.setup>,
    overrides: Partial<GPURenderPipelineDescriptor> = Object(),
    simplified: boolean = false,
    normalTarget = true,
    constants: Record<number, number> = {
      0: DirectionLight.RESOLUTION,
      1: DirectionLight.CASCADE_OFFSET,
    },
  ): GPURenderPipeline {
  
    const vertex: GPUVertexState = {
      module: shaders.vertex,
      buffers: [ Mesh.getVertexLayout(simplified) ],
    };
  
    const fragment: GPUFragmentState = {
      module: shaders.fragment,
      targets: normalTarget ? [ 
        { format: Renderer.RENDER_FORMAT },
        { format: Renderer.NORMAL_FORMAT, writeMask: GPUColorWrite.RED | GPUColorWrite.GREEN | GPUColorWrite.BLUE },
      ] : [
        { format: Renderer.RENDER_FORMAT }
      ],
      constants,
    }
  
    return device.createRenderPipeline({
      layout: "auto",
      depthStencil: {
        format: Renderer.DEPTH_FORMAT,
        depthWriteEnabled: true,
        depthCompare: "less",
      },
      vertex,
      fragment,
      ...overrides
    });
  
  }

}

export default functions;