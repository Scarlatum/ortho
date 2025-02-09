import { Renderer } from "../renderer.model";
import { Observer } from "../camera/camera.model";
import { mat4 } from "gl-matrix";

export const enum LightCascade {
  Distant,
  Far,
  Near,
  Close,
}

export class DirectionLight {

  // ! DirectX12 частенько любит выставлять ResourceBarrier между проходами, 
  // ! и если не повезёт ( Привет PCI шина ), то он может отъесть значительную часть кадра при больших объёмах текстур.
  // ! Скорее всего, не смотря на моё желание обойтись одной картой теней в 4-8к расширением для всего окружения,
  // ! Direct заставит меня делать каскадную карту теней.
  // ? Как вариант делать проходы с тенями асинхронными, но это нужно проверять на итог по визуалу.
  // TODO: Скорее всего, нужно будет разбивать это на 3-4 каскадных теней по 1024. 
  // TODO: Тратить 10-20% от производительности явно нет желания.
  static readonly RESOLUTION = 1024;
  static readonly shadowMapResolution = {
    width: DirectionLight.RESOLUTION,
    height: DirectionLight.RESOLUTION
  };

  public readonly texture: GPUTexture;
  public readonly observers = Array(4) as [ Observer, Observer, Observer, Observer ];

  constructor() {

    this.texture = device.createTexture({
      label     : "Shadow Map",
      format    : Renderer.DEPTH_FORMAT,
      size      : { depthOrArrayLayers: 4, ...DirectionLight.shadowMapResolution },
      usage     : GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    for ( let i = LightCascade.Distant; i <= LightCascade.Close; i++ ) {

      const res = 512 >> 2 * i;

      this.observers[i] = new Observer(this.observers[i - 1]);

      mat4.ortho(
        this.observers[i].projection,
        res * -1,
        res,
        res * -1,
        res,
        -1000,
        500,
      );

    }

    this.observers.at(-1)?.update();

  }
}