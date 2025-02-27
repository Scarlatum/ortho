import { Ortho, Renderer } from "ortho"
import { Observer } from "../camera/camera.model";

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
  static readonly RESOLUTION = 1024;
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

  constructor() {

    this.texture = device.createTexture({
      label     : "Shadow Map",
      format    : Renderer.DEPTH_FORMAT,
      size      : { depthOrArrayLayers: DirectionLight.LEVELS, ...DirectionLight.shadowMapResolution },
      usage     : GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    for ( let i = 0; i < DirectionLight.LEVELS; i++ ) {

      const res = 512 >> 2 * i;

      this.observers[i] = new Observer(this.observers[i - 1]);

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

    this.observer.update();

  }

  get observer() {
    return this.observers[DirectionLight.LEVELS - 1];
  }

}