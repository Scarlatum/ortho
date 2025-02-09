import { vec2 } from "gl-matrix";
import { ProceduredMaterial } from "../mesh/mesh.material";
import { InstancesMesh, Mesh, MeshPayload } from "../mesh/mesh.model";
import { Wave } from "../mesh/parsers/waveform";
import * as utils from "../renderer/renderer.utils";
import { ShadowParams } from "../interfaces/drawable.interface";

interface CreationRequirements {
  geometry: ReturnType<typeof Wave.parseTextFile>,
  texture: GPUTexture,
  material: Nullable<ProceduredMaterial>,
}

interface Assets {
  textures: Nullable<Array<Record<string, Array<string>>>>,
  geometry: string | ReturnType<typeof Wave.parseTextFile>,
}

type InstancedQuality<T extends number> = T extends 1 ? Mesh : InstancesMesh

export class Creation<State, const Instances extends number = 1> {

  public mesh: InstancedQuality<Instances>;

  constructor(
    { geometry, material, texture }: CreationRequirements, 
    shadowprop: ShadowParams,
    private instances: Instances,
    public state: Nullable<State> = null
  ) {

    const data: MeshPayload = {
      material  : material,
      vertexes  : Wave.constructBuffer(geometry, Wave.BufferType.Vertex),
      texture   : texture,
      uv        : Wave.constructBuffer(geometry, Wave.BufferType.UV),
      normals   : Wave.constructBuffer(geometry, Wave.BufferType.Normal),
    };

    // ? Так как InstancesMesh наследуется от Mesh, то и в ручном касте типа тут особой потребности нет
    // ? Когда нибудь TS научиться работать с константными выражениями, но пока это лишь мои хотелки.
    this.mesh = this.instances === 1
      ? new Mesh(data, shadowprop) as InstancedQuality<Instances>
      : new InstancesMesh(data, shadowprop, instances);
      ;
    
  }
  
  static async create<const I extends number, S>(
    assets: Assets,
    customMaterial: Nullable<ProceduredMaterial> = null,
    shadowprop: ShadowParams,
    instaces: I = 1 as I,
    state: Nullable<S> = null,
    sizeMut?: vec2,
  ) {

    let texture: GPUTexture;

    if ( assets.textures ) {

      const [ first ] = await utils.createImageTexture(window.device, assets.textures);

      texture = first.texture;

      if ( sizeMut ) {
        sizeMut[0] = first.w;
        sizeMut[1] = first.h;
      }

    } else {

      texture = utils.createBaseTexture(window.device);

    }

    let geometry: Assets['geometry'];

    if ( typeof assets.geometry === "string" ) {

      geometry = Wave.parseTextFile(assets.geometry);

      // if ( import.meta.env.DEV && geometry.buffers.vertex.length === 0 ) throw Error();

    } else {

      geometry = assets.geometry;

    }

    return new Creation({
      geometry: geometry,
      texture: texture,
      material: customMaterial,
    }, shadowprop, instaces, state);

  }

}