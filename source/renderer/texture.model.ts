declare const testBit: Blob; 

export class Texture {

  static mipsQuantity = 4;

  constructor(public texture: GPUTexture) {

  }

  get width() {
    return this.texture.width;
  }

  get height() {
    return this.texture.height;
  }

  public static async fromBuffer(buffer: ArrayBuffer, mips: Array<ArrayBuffer> = []): Promise<Result<Texture>> {

    const data = new Blob([ buffer ]);

    let bitmap = await createImageBitmap(data);

    if ( bitmap.width < 256 || bitmap.height < 256 ) return Error("Texture should be larger than 256x256 px")

    return Texture.create(
      bitmap, 
      bitmap.width, 
      bitmap.height,
      mips.map(x => new Blob([ x ]))
    );

  }

  private static create(
    image   : ImageBitmapSource,
    width   : number, 
    height  : number,
    mipmaps : Array<ImageBitmapSource>,
  ) {

    const bitmaps = new Set<ImageBitmap>();

    const texture = device.createTexture({
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING
        | GPUTextureUsage.COPY_DST
        | GPUTextureUsage.COPY_SRC
        | GPUTextureUsage.RENDER_ATTACHMENT,
      size: {
        width: width,
        height: height,
      },
      dimension: "2d",
      mipLevelCount: Texture.mipsQuantity + 1,
    });

    const send = (x: ImageBitmap, level: number, height: number, width: number) => {

      bitmaps.add(x);

      device.queue.copyExternalImageToTexture(
        { source: x, flipY: true },
        { texture, mipLevel: level },
        { width, height }
      );

    };

    if ( image instanceof ImageBitmap ) send(image, 0, image.height, image.width);

    else createImageBitmap(image).then(x => send(x, 0, x.height, x.width));

    for (let i = 0; i < Texture.mipsQuantity; i++) {

      const level = i + 1;
      const mipWidth = width >> level;
      const mipHeight = height >> level;

      const mip = mipmaps[ i ];

      const sendCurrent = (x: ImageBitmap) => send(x, level, mipHeight, mipWidth);

      if ( mip instanceof ImageBitmap ) sendCurrent(mip);

      else createImageBitmap(image, {
        resizeHeight  : mipHeight,
        resizeWidth   : mipWidth,
        resizeQuality : "medium",
      }).then(sendCurrent);

    }

    queueMicrotask(() => bitmaps.forEach(x => x.close()));

    return new Texture(texture);

  }
}