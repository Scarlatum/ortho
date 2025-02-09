import { mat4, vec3 } from "gl-matrix";
import { Drawable, DrawableBuffers, RenderData, ShadowParams } from "../interfaces/drawable.interface";
import { permutations } from "../utils/math.utils.ts";
import { Model } from "../utils/model.utils.ts";

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

export interface BoundingPoints<
  V extends ArrayLike<number> = vec3
> {
  a: V;
  b: V;
}

export type MeshPayload = Omit<DereferencedObjectValues<RenderData>, "model">;

export class Mesh extends Drawable {

  static MAT4SIZE = 4 * 4;
  static VERTEX_SIZE = 9;

  public override readonly model: Model;
  public vertexCount;
  public id = Symbol(Math.random());
  public modelPointer: number = 0;
  public override data: RenderData;
  public override instances = 1; 
  public override buffers: DrawableBuffers = Object();
  public override shadowParams: ShadowParams = {
    cast: true,
    recieve: false,
  };

  public box: BoundingPoints<vec3>;
  public edges: Array<vec3>;

  constructor(
    payload: MeshPayload,
    shadowprop: ShadowParams,
    visibilityBuffer = device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT * 1,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
  ) {

    super();

    this.data = {
      vertexes  : new WeakRef(payload.vertexes),
      normals   : new WeakRef(payload.normals),
      uv        : new WeakRef(payload.uv),
      texture   : payload.texture,
      material  : payload.material,
    };

    this.vertexCount  = payload.vertexes.length / 3;

    { // Set GPU Buffers

      this.buffers.vertex = device.createBuffer({
        size: this.vertexCount * Mesh.VERTEX_SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX
          | GPUBufferUsage.COPY_DST
      });
  
      this.buffers.tranformation = device.createBuffer({
        size: Mesh.MAT4SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX
          | GPUBufferUsage.COPY_DST
          | GPUBufferUsage.STORAGE,
        mappedAtCreation: true
      });
  
      this.buffers.params = device.createBuffer({
        size: Uint32Array.BYTES_PER_ELEMENT * 3,
        usage: GPUBufferUsage.UNIFORM,
        mappedAtCreation: true,
      });
  
      this.buffers.visibility = visibilityBuffer;

      { // ? Populate the transforamtion buffer with an identity values to prevent mesh to pop out on a vertex stage.

        mat4.identity(new Float32Array(this.buffers.tranformation.getMappedRange()));

        this.buffers.tranformation.unmap();

      }

    }

    this.model = new Model(this.buffers.tranformation);

    const vbo = new Float32Array(this.vertexCount * Mesh.VERTEX_SIZE);

    this.box    = Mesh.constructVertexData(this, vbo);
    this.edges  = permutations(this.box.a, this.box.b);

    device.queue.writeBuffer(this.buffers.vertex, 0, vbo);

    new Uint32Array(this.buffers.params.getMappedRange()).set([
      payload.material?.id || 0,
      Number(this.shadowParams.cast = shadowprop.cast),
      Number(this.shadowParams.recieve = shadowprop.recieve),
    ]);

    this.buffers.params.unmap();

  }

  static constructVertexData(
    mesh: Mesh,
    out: Float32Array,
  ) {

    const vertexes = mesh.data.vertexes.deref();
    const normals = mesh.data.normals?.deref();
    const uv = mesh.data.uv?.deref();

    if ( !vertexes ) throw Error();

    let offset = 0;

    const min = [
      0 + Number.MAX_SAFE_INTEGER,
      0 + Number.MAX_SAFE_INTEGER,
      0 + Number.MAX_SAFE_INTEGER,
    ] as vec3;

    const max = [
      0 - Number.MAX_SAFE_INTEGER,
      0 - Number.MAX_SAFE_INTEGER,
      0 - Number.MAX_SAFE_INTEGER,
    ] as vec3;

    const position = [0,0,0] as vec3;

    for (let v = 0; v < mesh.vertexCount; v++) {

      position[0] = vertexes[v * 3 + 0],
      position[1] = vertexes[v * 3 + 1],
      position[2] = vertexes[v * 3 + 2],

      vec3.min(min, position, min);
      vec3.max(max, position, max);

      out[offset] = mesh.modelPointer;

      out[offset + 1] = position[0]; 
      out[offset + 2] = position[1]; 
      out[offset + 3] = position[2];

      if ( normals ) {
        out[offset + 4] = normals[v * 3 + 0]
        out[offset + 5] = normals[v * 3 + 1]
        out[offset + 6] = normals[v * 3 + 2]
      }

      if ( uv ) {
        out[offset + 7] = uv?.[v * 2 + 0];
        out[offset + 8] = uv?.[v * 2 + 1];
      }

      offset += Mesh.VERTEX_SIZE;

    }

    return {
      a: min,
      b: max,
    } as BoundingPoints;

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

  public models: Array<Float32Array>;
  public visibilityIndexes: Uint8Array;

  constructor(
    data: MeshPayload,
    shadowprop: ShadowParams,
    public override readonly instances: number,
  ) {

    super(data, shadowprop, device.createBuffer({
      size  : Uint32Array.BYTES_PER_ELEMENT * instances,
      usage : GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    }));

    this.models = Array.from({ length: instances }, () => mat4.create() as Float32Array);
    this.visibilityIndexes = new Uint8Array(instances).fill(1);

    this.buffers.tranformation = device.createBuffer({
      size: Mesh.MAT4SIZE * instances * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX
        | GPUBufferUsage.COPY_DST
        | GPUBufferUsage.STORAGE,
    });

  }  

  public * writeModels(): Generator<[ Float32Array, number ]> {

    const stride = Mesh.MAT4SIZE;
    
    const transformationBatch = new Float32Array(this.instances * stride);

    for (let i = 0; i < this.instances; i++) {

      yield [ this.models[i], i ];

      transformationBatch.set(this.models[i], i * stride);

    }

    device.queue.writeBuffer(
      this.buffers.tranformation, 
      0, 
      transformationBatch
    );

  }

  updateVisibilityBuffer() {

    const data = new Uint32Array(this.instances);

    let ptr = 0;

    for ( let i = 0; i < data.length; i++ ) {
      if ( this.visibilityIndexes[i] === 1 ) data[ptr++] = i;
    }

    device.queue.writeBuffer(this.buffers.visibility, 0, data);

    return data.length;

  }

}