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
  static readonly RESOLUTION = parseInt(localStorage.getItem("ortho::shadow::resolution") || "800");
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

  public needsUpdate = true;
  public debugCascade = false;

  private static readonly OFFSET = parseInt(localStorage.getItem("ortho::shadow::offset") || "256");

  constructor(private scene: SceneInterface) {

    this.texture = device.createTexture({
      label     : "Shadow Map",
      format    : Renderer.DEPTH_FORMAT,
      size      : { depthOrArrayLayers: DirectionLight.LEVELS, ...DirectionLight.shadowMapResolution },
      usage     : GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    for ( let i = 0; i < DirectionLight.LEVELS; i++ ) {

      const res = 512 >> 2 * i + DirectionLight.OFFSET;

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

    this.head.update();

  }

  get head() {
    return this.observers[DirectionLight.LEVELS - 1];
  }

  public update() {

    if ( this.needsUpdate === false ) return;

    const time = this.scene.renderer.info.currentFrame / 10_000;

    for ( let i = 0; i < this.observers.length; i++ ) {

      const origin: Ortho.vec3 = [0,0,0];

      const observer  = this.observers[i];
      const offset    = (512 >> 2 * i);

      Ortho.vec3.mul(origin, this.scene.actor.camera.direction, [
        offset + this.scene.actor.camera.aspect,
        0,
        offset,
      ]);

      Ortho.vec3.add(origin, this.scene.actor.camera.position, origin);
      Ortho.vec3.add(observer.position, [
        500 * Math.sin(time),
        500,
        500 * Math.cos(time),
      ], origin);
      
      observer.target.set(origin);

    }

    this.head.update();

  }

}
