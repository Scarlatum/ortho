import { mat4, vec3 } from "gl-matrix";
import { Drawable, DrawableBuffers, RenderData } from "../interfaces/drawable.interface";
import { permutations } from "../utils/math.utils.ts";
import { Model } from "../utils/model.utils.ts";
import { ShadowParams } from "../renderer/light/light.model.ts";
import { VertexArena } from "../renderer/renderer.model.ts";
import { WGSLAlign } from "../renderer/renderer.utils.ts";

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

export type MeshPayload = Omit<Deref<RenderData>, "model">;

export const enum VertexLayoutSize {
  FULL = 8,
  REDUCED = 4,
}

export class Mesh extends Drawable {

  static cache = new Map<Symbol, WeakRef<[ BoundingPoints<vec3>, Float32Array, Float32Array ]>>();

  static MAT4SIZE = 4 * 4;

  static arenas: { full: VertexArena, reduced: VertexArena } = Object();

  static DEFAULT_VISIBILITY_BUFFER: Nullable<GPUBuffer> = null;

  public override readonly model: Model;
  public override vertexCount;
  
  public modelPointer: number = 0;
  public override data: RenderData;
  public override instances = 1; 
  public override buffers: DrawableBuffers = Object();

  public box: BoundingPoints<vec3>;
  public edges: Array<vec3>;

  constructor(
    public id = Symbol("Default mesh symbol"),
    payload: MeshPayload,
    shadow: Partial<ShadowParams>,
    visibilityBuffer ?: GPUBuffer,
  ) {

    super();

    Object.assign(this.shadowParams, shadow);

    this.data = {
      vertexes  : new WeakRef(payload.vertexes),
      normals   : new WeakRef(payload.normals),
      uv        : new WeakRef(payload.uv),
      texture   : payload.texture,
      material  : payload.material,
    };

    this.vertexCount  = payload.vertexes.length / 3;

    { // Set GPU Buffers
  
      this.buffers.tranformation = device.createBuffer({
        label: `Mesh ${ id.description } transform buffer`,
        size: Mesh.MAT4SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX
          | GPUBufferUsage.COPY_DST
          | GPUBufferUsage.STORAGE,
      });
  
      this.buffers.params = device.createBuffer({
        label: `Mesh ${ id.description } Params buffer`,
        size: Uint32Array.BYTES_PER_ELEMENT * 3,
        usage: GPUBufferUsage.UNIFORM 
          | GPUBufferUsage.COPY_DST,
      });

      this.buffers.visibility = visibilityBuffer || ( Mesh.DEFAULT_VISIBILITY_BUFFER ||= device.createBuffer({
        label: "Shared default visibility buffer",
        size: Uint32Array.BYTES_PER_ELEMENT * 1,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }));

    }

    this.model = new Model(this.buffers.tranformation);

    let fullBuffer: Float32Array;
    let reducedBuffer: Float32Array;

    { // Vertex data

      const cachedData = Mesh.cache.get(id)?.deref();

      if ( cachedData ) {
  
        [ this.box, fullBuffer, reducedBuffer ] = cachedData;
  
      } else {
  
        fullBuffer = new Float32Array(this.vertexCount * VertexLayoutSize.FULL);
        reducedBuffer = new Float32Array(this.vertexCount * VertexLayoutSize.REDUCED)
  
        this.box = Mesh.constructVertexData(this, fullBuffer, reducedBuffer);
  
        Mesh.cache.set(id, new WeakRef([
          this.box,
          fullBuffer,
          reducedBuffer,
        ]));
  
      }
  
      this.edges = permutations(this.box.a, this.box.b);

    }

    { // GBuffers

      device.queue.writeBuffer(this.buffers.tranformation, 0, new Float32Array(mat4.create()));
      device.queue.writeBuffer(this.buffers.params, 0, new Uint32Array([
        payload.material?.id || 0,
        Number(this.shadowParams.cast),
        Number(this.shadowParams.recieve),
      ]));

      Mesh.arenas.full.add(id, fullBuffer);
      Mesh.arenas.reduced.add(id, reducedBuffer);

    }

  }

  // static indexate(x: Array<Float16Array>) {

  //   const buffer = x.at(0)?.buffer;

  //   if ( !buffer ) return new Uint16Array([]);

  //   const view = new DataView(buffer);
  //   const uniq = new BigInt64Array(new Set(new BigInt64Array(buffer)));

  //   return new Uint16Array(x.map(x => {
  //     return uniq.indexOf(view.getBigInt64(x.byteOffset, true));	
  //   }));
    
  // }
  
  static constructVertexData(
    mesh    : Mesh,
    full    : Float32Array,
    reduced : Float32Array,
  ) {

    const vertexes = mesh.data.vertexes.deref();
    const normals = mesh.data.normals?.deref();
    const uv = mesh.data.uv?.deref();

    if ( !vertexes ) throw Error();

    let offset_full = 0;
    let offset_reduced = 0;

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

      reduced[offset_reduced++] = full[offset_full++] = position[0]; 
      reduced[offset_reduced++] = full[offset_full++] = position[1]; 
      reduced[offset_reduced++] = full[offset_full++] = position[2];

      if ( normals ) {
        full[offset_full++] = normals[v * 3 + 0]
        full[offset_full++] = normals[v * 3 + 1]
        full[offset_full++] = normals[v * 3 + 2]
      }

      if ( uv ) {
        full[offset_full++] = uv?.[v * 2 + 0];
        full[offset_full++] = uv?.[v * 2 + 1];
      }

      // Add align bc vec3f has align of 4 in WGSL;
      offset_reduced += 1;

    }

    return {
      a: min,
      b: max,
    } as BoundingPoints;

  }

  // TODO: Make simplified layout for shadow pass w/o normals and UV
  static getVertexLayout(simplified: boolean = false): GPUVertexBufferLayout {

    let loc = 0;

    const attributes = new Set<GPUVertexAttribute>([
      { // Vertex Data
        format: "float32x3",
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
        shaderLocation: loc++,
      },
    ]);

    if ( simplified === false ) {
      attributes.add({ // Normals Data
          format: "float32x3",
          offset: Float32Array.BYTES_PER_ELEMENT * 3,
          shaderLocation: loc++,
      });
      attributes.add({ // UV data
        format: "float32x2",
        offset: Float32Array.BYTES_PER_ELEMENT * 6,
        shaderLocation: loc++,
      });
    }

    const size = simplified ? VertexLayoutSize.REDUCED : VertexLayoutSize.FULL;

    return {
      arrayStride: size * Float32Array.BYTES_PER_ELEMENT,
      attributes,
    };
  }

}

export class InstancedMesh extends Mesh {

  override model;

  public models: Array<Float32Array>;
  public visibilityIndexes: Uint8Array;

  constructor(
    id: symbol,
    data: MeshPayload,
    shadow: Partial<ShadowParams>,
    public override readonly instances: number,
  ) {

    super(id, data, shadow, device.createBuffer({
      size  : Uint32Array.BYTES_PER_ELEMENT * instances,
      usage : GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    }));

    this.models = Array.from({ length: instances }, () => mat4.create() as Float32Array);
    this.visibilityIndexes = new Uint8Array(instances).fill(1);

    this.model = this.models[0] as Model;

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