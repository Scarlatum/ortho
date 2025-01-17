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
  uv: Nullable<WeakRef<Float32Array>>,
  normals: Nullable<WeakRef<Float32Array>>,
  material: Nullable<ProceduredMaterial>,
  vertexes: WeakRef<Float32Array>,
  texture: GPUTexture;
}

export interface ShadowPoperty {
  recieve: boolean;
  cast: boolean;
};

export class Mesh extends Drawable implements IMesh {

  static TRANSFORM_BUFFER_STRIDE = 4 * 4 * Float32Array.BYTES_PER_ELEMENT;
  static VERTEX_SIZE = 9;

  public override instances = 1; 
  public override instanceParamBuffer: GPUBuffer;
  public id = Symbol("mesh");
  public model = mat4.create();
  public transformationIndex: number = 0;
  public uv: Nullable<WeakRef<Float32Array>> = null;
  public material: Nullable<ProceduredMaterial> = null;
  public texture: GPUTexture;
  override shadowCast: boolean = false;
  override shadowRecieve: boolean = false;

  public vertexes: WeakRef<Float32Array>;
  public normals: Nullable<WeakRef<Float32Array>> = null;

  vertexBuffer;
  tranformationBuffer;
  vertexCount;

  constructor(
    payload: DereferencedObjectValues<IMesh>,
    shadowprop: ShadowPoperty,
  ) {

    super();

    this.id           = payload.id
    this.vertexes     = new WeakRef(payload.vertexes);
    this.normals      = new WeakRef(payload.normals);
    this.uv           = new WeakRef(payload.uv);
    this.texture      = payload.texture;
    this.vertexCount  = payload.vertexes.length / 3;
    this.material     = payload.material;

    // @ts-expect-error
    globalThis.randomBuffer = this.vertexes;

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

    this.instanceParamBuffer = device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT * 3,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });

    const vbo = new Float32Array(this.vertexCount * Mesh.VERTEX_SIZE);

    Mesh.constructVertexData(this, vbo, this.vertexCount);

    device.queue.writeBuffer(this.vertexBuffer!, 0, vbo);

    new Uint32Array(this.instanceParamBuffer.getMappedRange()).set([
      payload.material?.id || 0,
      Number(this.shadowCast = shadowprop.cast),
      Number(this.shadowRecieve = shadowprop.recieve),
    ]);

    this.instanceParamBuffer.unmap();

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

    const vertexes = mesh.vertexes.deref();
    const normals = mesh.normals?.deref();
    const uv = mesh.uv?.deref();

    if ( !vertexes ) throw Error();

    for (let v = 0; v < vertexCount; v++) {
      
      out.set([
        mesh.transformationIndex,
        vertexes[ v * 3 + 0 ], 
        vertexes[ v * 3 + 1 ], 
        vertexes[ v * 3 + 2 ],
        normals?.[ v * 3 + 0 ] || 0.0,
        normals?.[ v * 3 + 1 ] || 0.0,
        normals?.[ v * 3 + 2 ] || 0.0,
        uv?.[ v * 2 + 0 ] || 0.0,
        uv?.[ v * 2 + 1 ] || 0.0,
      ], offset);

      offset += Mesh.VERTEX_SIZE;

    }

    return offset;

  }

  static getVertexLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: Float32Array.BYTES_PER_ELEMENT * Mesh.VERTEX_SIZE,
      attributes: [
        // ? Оставляю это лишь для того, что в последствии буду батчить ститические и динамические меши вместе
        { // Transforamtion ID
          format: "float32",
          offset: Float32Array.BYTES_PER_ELEMENT * 0,
          shaderLocation: 0
        },
        { // Vertex Data
          format: "float32x3",
          offset: Float32Array.BYTES_PER_ELEMENT * 1,
          shaderLocation: 1,
        },
        { // Normals Data
          format: "float32x3",
          offset: Float32Array.BYTES_PER_ELEMENT * 4,
          shaderLocation: 2,
        },
        { // UV data
          format: "float32x2",
          offset: Float32Array.BYTES_PER_ELEMENT * 7,
          shaderLocation: 3,
        },
      ]
    };
  }

}

export class InstancesMesh extends Mesh {

  public models: Array<mat4>;

  constructor(
    data: DereferencedObjectValues<IMesh>,
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