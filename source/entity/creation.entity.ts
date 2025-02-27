import utils from "../renderer/renderer.utils";

import { ProceduredMaterial } from "../mesh/mesh.material";
import { InstancedMesh, Mesh, MeshPayload } from "../mesh/mesh.model";
import { Wave } from "../mesh/parsers/waveform";
import { ShadowParams } from "../renderer/light/light.model";
import { Drawable } from "../interfaces/drawable.interface";
import { Texture } from "../renderer/texture.model";

interface CreationRequirements {
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

type CreationParams<S = {}, I extends number = 1> = {
  state         : S,
  instaces      : I,
  shadow        : Partial<ShadowParams>,
}

export class Creation<State, const Instances extends number = 1> {

  static defaultParams = {
    state         : Object(),
    instaces      : 1,
    shadow        : Drawable.defaultShadowParams,
  } satisfies CreationParams;

  public mesh: InstancedQuality<Instances>;

  constructor(
    id: symbol,
    { geometry, material, texture }: CreationRequirements, 
    shadow: Partial<ShadowParams>,
    private instances: Instances,
    public state: State = Object()
  ) {

    const data: MeshPayload = {
      material  : material,
      texture   : texture,
      vertexes  : Wave.constructBuffer(geometry, Wave.BufferType.Vertex),
      uv        : Wave.constructBuffer(geometry, Wave.BufferType.UV),
      normals   : Wave.constructBuffer(geometry, Wave.BufferType.Normal),
    };

    // ? Так как InstancesMesh наследуется от Mesh, то и в ручном касте типа тут особой потребности нет
    // ? Когда нибудь TS научиться работать с константными выражениями, но пока это лишь мои хотелки.
    this.mesh = this.instances === 1
      ? new Mesh(id, data, shadow) as InstancedQuality<Instances>
      : new InstancedMesh(id, data, shadow, instances);
      ;
    
  }
  
  static async create<const I extends number, S>(
    id              : symbol,
    assets          : Assets,
    customMaterial  : Nullable<ProceduredMaterial>,
    params          ?: Partial<CreationParams<S,I>>,
  ) {

    const { instaces, shadow, state } = params 
      ? Object.assign(structuredClone(Creation.defaultParams), params)
      : Creation.defaultParams; 

    let texture: GPUTexture;

    if ( assets.textures?.diffuse?.length ) {

      const [ first ] = assets.textures.diffuse;

      texture = first.texture;

    } 
    
    else texture = utils.createBaseTexture(device);

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