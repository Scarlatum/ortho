import { ProceduredMaterial } from "../mesh/mesh.material";
import { DirectionLight, ShadowParams } from "../renderer/light/light.model";
import { Model } from "../utils/model.utils";

export type DrawableBuffers = {
  params          : GPUBuffer; 
  vertex_full     : GPUBuffer;
  vertex_reduced  : GPUBuffer;
  visibility      : GPUBuffer;
  tranformation   : GPUBuffer;
}

export interface RenderData {
  uv        : Nullable<WeakRef<Float32Array>>,
  normals   : Nullable<WeakRef<Float32Array>>,
  material  : Nullable<ProceduredMaterial>,
  vertexes  : WeakRef<Float32Array>,
  texture   : GPUTexture;
}

export abstract class Drawable {

  static defaultShadowParams = {
    cast: true,
    recieve: true,
    cascade: DirectionLight.DEFAULT_CASCADE_FLAG
  };

  abstract readonly id: Symbol;
  abstract readonly model: Model;
  abstract readonly data: RenderData;
  abstract readonly instances: number;
  abstract readonly vertexCount: number;
  abstract readonly buffers: DrawableBuffers;
  public drop: boolean = false;
  public shadowParams: ShadowParams = structuredClone(Drawable.defaultShadowParams);
}