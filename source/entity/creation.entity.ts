import { ProceduredMaterial } from "../mesh/mesh.material";
import { InstancedMesh, Mesh, MeshPayload } from "../mesh/mesh.model";
import { Wave } from "../mesh/parsers/waveform";
import { ShadowParams } from "../renderer/light/light.model";
import { Drawable } from "../interfaces/drawable.interface";
import { Texture } from "../renderer/texture.model";
import { Renderer } from "../renderer/renderer.model";

interface Requirements {
  geometry: ReturnType<typeof Wave.parseTextFile>,
  texture: GPUTexture,
  material: Nullable<ProceduredMaterial>,
}

export type TextureContainer = {
  diffuse: Array<Texture>;
  occlusion: Array<Texture>;
  normals: Array<Texture>;
};

interface Assets {
  textures: Nullable<Partial<TextureContainer>>,
  geometry: string | ReturnType<typeof Wave.parseTextFile>,
}

type InstancedQuality<T extends number> = T extends 1 ? Mesh : InstancedMesh

type Params<S = object, I extends number = 1> = {
  state         : S,
  instaces      : I,
  shadow        : Partial<ShadowParams>,
}

/**
 * Creates a new Creation instance with the specified parameters
 * @param {symbol} id - The unique identifier for the creation
 * @param {Assets} assets - The assets required for the creation
 * @param {Params} params - The parameters for the creation
 * @returns {Creation} A new Creation instance
 */
export class Creation<State, const Instances extends number = 1> {

  static bufferCache= new WeakMap<Symbol, [
    Float32Array,
    Float32Array,
    Float32Array,
  ]>();

  static defaultParams = {
    state         : Object(),
    instaces      : 1,
    shadow        : Drawable.defaultShadowParams,
  } satisfies Params;

  public mesh: InstancedQuality<Instances>;

  constructor(
    id: symbol,
    req: Requirements, 
    shadow: Partial<ShadowParams>,
    private instances: Instances,
    public state: State = Object()
  ) {

    const data = Creation.createMeshPayload(id, req);

    // ? Так как InstancesMesh наследуется от Mesh, то и в ручном касте типа тут особой потребности нет
    // ? Когда нибудь TS научиться работать с константными выражениями, но пока это лишь мои хотелки.
    this.mesh = this.instances === 1
      ? new Mesh(id, data, shadow) as InstancedQuality<Instances>
      : new InstancedMesh(id, data, shadow, instances);
      ;
    
  }

  /**
   * Creates a mesh payload object with the specified geometry, material, and texture
   * @param {symbol} id - The unique identifier for the mesh
   * @param {Requirements} req - The requirements for the mesh
   * @returns {MeshPayload} The mesh payload object
   * @throws {Error} If the texture is not provided
  */
  static createMeshPayload(id: symbol, { geometry, material, texture }: Requirements): MeshPayload {

    let data: Partial<MeshPayload> = {
      material,
      texture,
    };

    if ( Creation.bufferCache.has(id) === false ) Creation.bufferCache.set(id, [
      data.vertexes  = Wave.constructBuffer(geometry, Wave.BufferType.Vertex),
      data.uv        = Wave.constructBuffer(geometry, Wave.BufferType.UV),
      data.normals   = Wave.constructBuffer(geometry, Wave.BufferType.Normal),
    ]);
    
    else [ 
      data.vertexes, 
      data.uv, 
      data.normals 
    ] = Creation.bufferCache.get(id)!;

    return data as MeshPayload;

  }

  /**
   * Creates a texture container with the specified number of mipmaps for each texture type
   * @returns {TextureContainer} An object containing arrays of textures for each type
   */
  static createTextureContainer(): TextureContainer {
    return {
      diffuse: Array(Texture.mipsQuantity),
      normals: Array(Texture.mipsQuantity),
      occlusion: Array(Texture.mipsQuantity),
    }
  }

  /**
   * Creates a new Creation instance with the specified parameters
   * @param {symbol} id - The unique identifier for the creation
   * @param {Assets} assets - The assets required for the creation
   * @param {Nullable<ProceduredMaterial>} customMaterial - The custom material to use for the creation
   * @param {Partial<Params<S,I>>} params - The parameters for the creation
   * @returns {Promise<Creation<S,I>>} A new Creation instance
   */
  static async create<const I extends number, S>(
    id              : symbol,
    assets          : Assets,
    customMaterial  : Nullable<ProceduredMaterial>,
    params          ?: Partial<Params<S,I>>,
  ): Promise<Creation<S, I>> {

    const { instaces, shadow, state } = params 
      ? Object.assign(structuredClone(Creation.defaultParams), params)
      : Creation.defaultParams; 

    let texture: GPUTexture;

    if ( assets.textures?.diffuse?.length ) {

      const [ first ] = assets.textures.diffuse;

      texture = first.texture;

    } 
    
    else texture = Renderer.defaultTexture;

    let geometry: Assets['geometry'] = typeof assets.geometry === "string" 
      ? Wave.parseTextFile(assets.geometry) 
      : assets.geometry
      ;

    return new Creation(id, {
      geometry: geometry,
      texture: texture,
      material: customMaterial,
    }, shadow, instaces as I, state as S);

  }

}