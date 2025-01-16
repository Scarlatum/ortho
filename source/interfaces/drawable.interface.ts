import { mat4 } from "gl-matrix";

export abstract class Drawable {
  public drop: boolean = false;
  abstract instances: number;
  abstract model: mat4 | Array<mat4>;
  abstract vertexBuffer: GPUBuffer;
  abstract tranformationBuffer: GPUBuffer;
  abstract texture: GPUTexture;
  abstract shadowCast: boolean;
  abstract shadowRecieve: boolean;
  abstract static: boolean;
}