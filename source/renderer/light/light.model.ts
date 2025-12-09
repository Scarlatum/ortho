import { Ortho, Renderer } from "ortho"
import { Observer } from "../camera/camera.model";
import { SceneInterface } from "../../interfaces/scene.interface";

export const enum LightCascade {
  Distant = 1 << 1,
  Far = 1 << 2,
  Near = 1 << 3,
  Close = 1 << 4,
}

export interface ShadowParams {
  recieve: boolean;
  cast: boolean;
  cascade: LightCascade
};

export class DirectionLight {

  static readonly LEVELS = Math.log2(LightCascade.Close);
  static readonly RESOLUTION = parseInt(localStorage.getItem("ortho::shadow::resolution") || "1024");
  static readonly CASCADE_OFFSET = 0;
  static readonly DEFAULT_CASCADE_FLAG: LightCascade = LightCascade.Distant | LightCascade.Far | LightCascade.Near | LightCascade.Close;
  static readonly shadowMapResolution = {
    width: DirectionLight.RESOLUTION,
    height: DirectionLight.RESOLUTION
  };
  static readonly layout = [
    LightCascade.Distant,
    LightCascade.Far,
    LightCascade.Near,
    LightCascade.Close,
  ] as const;

  public readonly texture: GPUTexture;
  public readonly observers = Array(4) as [ Observer, Observer, Observer, Observer ];
  public readonly sharedBuffer: GPUBuffer;

  public needsUpdate = true;
  public debugCascade = false;

  private static readonly OFFSET = parseInt(localStorage.getItem("ortho::shadow::offset") || "1024");

  constructor(public scene: SceneInterface) {

    this.texture = device.createTexture({
      label     : "Shadow Map",
      format    : Renderer.DEPTH_FORMAT,
      size      : { depthOrArrayLayers: DirectionLight.LEVELS, ...DirectionLight.shadowMapResolution },
      usage     : GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.sharedBuffer = device.createBuffer({
      label: "Shared Observer Buffer",
      size: Float32Array.BYTES_PER_ELEMENT * device.limits.minStorageBufferOffsetAlignment * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    for ( let i = 0; i < DirectionLight.LEVELS; i++ ) {

      const res = 512 >> 2 * i + DirectionLight.OFFSET;

      this.observers[i] = new Observer(this.observers[i - 1], {
        buffer: this.sharedBuffer,
        index: i,
      });

      Ortho.mat4.ortho(
        this.observers[i].projection,
        -res,
        res,
        -res,
        res,
        -Observer.FAR_POINT * 2,
        Observer.FAR_POINT * 2,
      );

    }

    this.head.update();

  }

  get head() {
    return this.observers[DirectionLight.LEVELS - 1];
  }

  public update() {

    if ( this.needsUpdate === false ) return;

    this.head.update();

  }

}
