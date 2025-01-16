import { mat4, vec3 } from "gl-matrix";
import { Drawable } from "../interfaces/drawable.interface";
import { ProceduredMaterial } from "./mesh.material.ts";

export const enum VERTEX_LAYOUT {
  ID,
  MATERIAL,
  X,
  Y,
  Z,
  NX,
  NY,
  NZ,
  UVX,
  UVY,
  SR,
}

export interface IMesh {
  id: symbol,
  uv: Nullable<Float32Array>,
  normals: Nullable<Float32Array>,
  material: Nullable<ProceduredMaterial>,
  vertexes: Float32Array,
  texture: GPUTexture;
}

export interface ShadowPoperty {
  recieve: boolean;
  cast: boolean;
  static: boolean;
};

export class Mesh extends Drawable implements IMesh {

  static TRANSFORM_BUFFER_STRIDE = 4 * 4 * Float32Array.BYTES_PER_ELEMENT;
  static VERTEX_SIZE = 11;

  public override instances = 1; 

  public id = Symbol("mesh");
  public model = mat4.create();
  public transformationIndex: number = 0;
  public uv: Nullable<Float32Array> = null;
  public normals: Nullable<Float32Array> = null;
  public material: Nullable<ProceduredMaterial> = null;
  public texture: GPUTexture;
  override shadowCast: boolean = false;
  override shadowRecieve: boolean = false;
  override static: boolean = true;

  public vertexes: Float32Array = new Float32Array();
  public vbo: Float32Array = new Float32Array();

  vertexBuffer;
  tranformationBuffer;
  vertexCount;

  constructor(
    payload: IMesh,
    shadowprop: ShadowPoperty,
  ) {

    super();

    this.texture      = payload.texture;
    this.vertexes     = payload.vertexes;
    this.normals      = payload.normals;
    this.vertexCount  = payload.vertexes.length / 3;

    Object.assign(this, payload);

    this.vbo = new Float32Array(this.vertexCount * Mesh.VERTEX_SIZE);

    // vertex buffer set
    this.vertexBuffer = device.createBuffer({
      size: this.vertexCount * Mesh.VERTEX_SIZE * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX
        | GPUBufferUsage.COPY_DST
    });

    this.tranformationBuffer = device.createBuffer({
      size: Mesh.TRANSFORM_BUFFER_STRIDE,
      usage: GPUBufferUsage.VERTEX
        | GPUBufferUsage.COPY_DST
        | GPUBufferUsage.STORAGE,
    });

    this.shadowCast = shadowprop.cast;
    this.shadowRecieve = shadowprop.recieve;
    this.static = shadowprop.static;

    Mesh.constructVertexData(this, this.vbo, this.vertexCount);

    device.queue.writeBuffer(this.vertexBuffer!, 0, this.vbo);

  }

  set writeModel(value: mat4) {

    this.model = value;

    if (this.tranformationBuffer) {
      device.queue.writeBuffer(
        this.tranformationBuffer,
        0,
        new Float32Array(this.model)
      );
    }

  }

  static constructVertexData(
    mesh: Mesh,
    out: Float32Array,
    vertexCount: number,
    offset: number = 0,
  ) {

    let min = vec3.create();
    let max = vec3.create();

    for (let v = 0; v < vertexCount; v++) {

      const pos = [
        mesh.vertexes[ v * 3 + 0 ], 
        mesh.vertexes[ v * 3 + 1 ], 
        mesh.vertexes[ v * 3 + 2 ]
      ];

      min.forEach((x,i) => min[i] = Math.min(x, pos[i]));
      max.forEach((x,i) => max[i] = Math.max(x, pos[i]));
      
      out.set([
        mesh.transformationIndex,
        mesh.material?.id || 0.0,
        ...pos,
        mesh.normals?.[ v * 3 + 0 ] || 0.0,
        mesh.normals?.[ v * 3 + 1 ] || 0.0,
        mesh.normals?.[ v * 3 + 2 ] || 0.0,
        mesh.uv?.[ v * 2 + 0 ] || 0.0,
        mesh.uv?.[ v * 2 + 1 ] || 0.0,
        mesh.shadowRecieve ? 1.0 : 0.0,
      ], offset);

      offset += Mesh.VERTEX_SIZE;

    }

    return offset;

  }

  static getVertexLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: Float32Array.BYTES_PER_ELEMENT * Mesh.VERTEX_SIZE,
      attributes: [
        { // ID
          format: "float32",
          offset: Float32Array.BYTES_PER_ELEMENT * 0,
          shaderLocation: 0
        },
        { // Material ID
          format: "float32",
          offset: Float32Array.BYTES_PER_ELEMENT * 1,
          shaderLocation: 1
        },
        { // Vertex Data
          format: "float32x3",
          offset: Float32Array.BYTES_PER_ELEMENT * 2,
          shaderLocation: 2,
        },
        { // Normals Data
          format: "float32x3",
          offset: Float32Array.BYTES_PER_ELEMENT * 5,
          shaderLocation: 3,
        },
        { // UV data
          format: "float32x2",
          offset: Float32Array.BYTES_PER_ELEMENT * 8,
          shaderLocation: 4,
        },
        { // Shadow Reciever
          format: "float32",
          offset: Float32Array.BYTES_PER_ELEMENT * 10,
          shaderLocation: 5,
        }
      ]
    };
  }

}

export class InstancesMesh extends Mesh {

  public models: Array<mat4>;

  constructor(
    data: IMesh,
    shadowprop: ShadowPoperty,
    public override instances: number,
  ) {

    super(data, shadowprop);

    this.models = Array.from({ length: instances }, () => mat4.create());

    this.tranformationBuffer = device.createBuffer({
      size: Mesh.TRANSFORM_BUFFER_STRIDE * instances,
      usage: GPUBufferUsage.VERTEX
        | GPUBufferUsage.COPY_DST
        | GPUBufferUsage.STORAGE,
    });

  }  

  public * writeModels(): Generator<[ mat4, number ]> {

    const size = Mesh.TRANSFORM_BUFFER_STRIDE / Float32Array.BYTES_PER_ELEMENT;

    const transformationBatch = new Float32Array(this.instances * size);

    for (let i = 0; i < this.instances; i++) {

      yield [ this.models[i], i ];

      transformationBatch.set(this.models[i], i * size);

    }

    device.queue.writeBuffer(
      this.tranformationBuffer, 
      0, 
      transformationBatch
    );

  }

}