import { ShaderBuilder } from "../mesh/builders/shader.builder";
import { Mesh } from "../mesh/mesh.model";
import { Renderer } from "./renderer.model";

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
    new Float32Array(Array.from({ length: 16 * 16 }, () => 0)),
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
  paths: Array<string>,
): Promise<[ GPUTexture, { width: number, height: number } ]> {

  const images = paths.map(x => {

    const img = new Image();

    img.src = x;

    return img;

  });

  await Promise.all(images.map(x => x.decode()));

  if ( import.meta.env.DEV ) {

    const identicalSize = images.every(x => x.height + x.width === images[0].height + images[0].width);

    if ( identicalSize === false ) throw Error();

  }

  const texture = device.createTexture({
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING
      | GPUTextureUsage.COPY_DST
      | GPUTextureUsage.COPY_SRC
      | GPUTextureUsage.RENDER_ATTACHMENT,
    size: {
      width: images[0].width,
      height: images[0].height,
    },
    dimension: "2d",
  });

  for ( const x of images ) {
    createImageBitmap(x).then(bitmap => {
      device.queue.copyExternalImageToTexture({
        source: bitmap,
        flipY: true,
      }, {
        texture,
      }, {
        width: x.width,
        height: x.height,
      });
    });
  }

  return [ texture, { 
    width: images[0].width, 
    height: images[0].height 
  } ];

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
  device: GPUDevice,
  shaders: ReturnType<typeof ShaderBuilder.compile>,
  overrides: Partial<GPURenderPipelineDescriptor> = Object(),
  constants?: Record<string, number>,
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
  }

  if ( constants ) fragment.constants = vertex.constants = constants;

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
