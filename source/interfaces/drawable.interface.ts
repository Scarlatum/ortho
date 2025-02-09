import { ProceduredMaterial } from "../mesh/mesh.material";
import { Model } from "../utils/model.utils";

export interface ShadowParams {
  recieve: boolean;
  cast: boolean;
};

export type DrawableBuffers = {
  params        : GPUBuffer; 
  vertex        : GPUBuffer;
  visibility    : GPUBuffer;
  tranformation : GPUBuffer;
}

export interface RenderData {
  uv        : Nullable<WeakRef<Float32Array>>,
  normals   : Nullable<WeakRef<Float32Array>>,
  material  : Nullable<ProceduredMaterial>,
  vertexes  : WeakRef<Float32Array>,
  texture   : GPUTexture;
}

export abstract class Drawable {
  public drop: boolean = false;
  abstract readonly model: Model;
  abstract data: RenderData;
  abstract instances: number;
  abstract vertexCount: number;
  abstract buffers: DrawableBuffers;
  abstract shadowParams: ShadowParams;
}