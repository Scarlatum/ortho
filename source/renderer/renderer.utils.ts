import { Preprocessor } from "../utils/preprocessor.utils";
import { Mesh } from "../mesh/mesh.model";
import { DirectionLight } from "./light/light.model";
import { Renderer } from "./renderer.model";

const DEFAULT_16x16 = new Float32Array(16 * 16);

export function createBaseTexture(device: GPUDevice) {

  const baseTexture = device.createTexture({
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING
      | GPUTextureUsage.COPY_DST
      | GPUTextureUsage.RENDER_ATTACHMENT,
    size: { width: 16, height: 16, depthOrArrayLayers: 1 },
    dimension: "2d",
  });

  device.queue.writeTexture(
    {
      texture: baseTexture
    },
    DEFAULT_16x16,
    {
      bytesPerRow: 16 * Float32Array.BYTES_PER_ELEMENT,
      rowsPerImage: 16,
    },
    {
      width: baseTexture.width,
      height: baseTexture.height,
    },
  );

  return baseTexture;

}

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

export async function generateAtlasTexture(device: GPUDevice, textures: Array<GPUTexture>) {

  const encoder = device.createCommandEncoder();

  const atlasTexture = device.createTexture({
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING
      | GPUTextureUsage.COPY_DST
      | GPUTextureUsage.RENDER_ATTACHMENT,
    size: {
      width: 64,
      height: 32,
    },
  });

  textures.forEach((x, i) => {
    encoder.copyTextureToTexture({
      texture: x
    }, {
      texture: atlasTexture,
      origin: {
        x: i * 32,
      }
    }, {
      width: x.width,
      height: x.height,
    });
  });

  device.queue.submit([ encoder.finish(), ]);

  textures.forEach(x => x.destroy());

  return atlasTexture;

}

export function createBaseFragmentTarget(): GPUColorTargetState {
  return {
    format: Renderer.RENDER_FORMAT,
    blend: {
      alpha: {
        srcFactor: "src-alpha",
        dstFactor: "one-minus-src-alpha",
        operation: "add"
      },
      color: {
        srcFactor: "src-alpha",
        dstFactor: "one-minus-src-alpha",
        operation: "add"
      }
    }
  };
}

export function createBasePipeline(
  shaders: ReturnType<typeof Preprocessor.setup>,
  overrides: Partial<GPURenderPipelineDescriptor> = Object(),
): GPURenderPipeline {

  const vertex: GPUVertexState = {
    entryPoint: "vertexKernel",
    module: shaders.vertex,
    buffers: [ Mesh.getVertexLayout() ],
  };

  const fragment: GPUFragmentState = {
    entryPoint: "fragmentKernel",
    module: shaders.fragment,
    targets: [ createBaseFragmentTarget() ],
    constants: {
      0: DirectionLight.RESOLUTION,
    }
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
