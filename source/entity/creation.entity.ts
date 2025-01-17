import { ProceduredMaterial } from "../mesh/mesh.material";
import { IMesh, InstancesMesh, Mesh, ShadowPoperty } from "../mesh/mesh.model";
import { Wave } from "../mesh/parsers/waveform";
import * as utils from "../renderer/renderer.utils";

interface CreationRequirements {
  geometry: ReturnType<typeof Wave.parseTextFile>,
  texture: GPUTexture,
  material: Nullable<ProceduredMaterial>,
}

interface Assets {
  textures: Nullable<Array<string>>,
  geometry: string,
}

type InstancedQuality<T extends number> = T extends 1 ? Mesh : InstancesMesh

export class Creation<State, const Instances extends number> {

  public mesh: InstancedQuality<Instances>;

  constructor(
    { geometry, material, texture }: CreationRequirements, 
    shadowprop: ShadowPoperty,
    private instances: Instances,
    public state: Nullable<State> = null
  ) {

    const data: DereferencedObjectValues<IMesh> = {
      id        : Symbol("mesh uniq id"),
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
    shadowprop: ShadowPoperty,
    instaces: I = 1 as I,
    state: Nullable<S> = null
  ) {

    let texture: GPUTexture;

    if ( assets.textures ) {

      const [ tex, _image ] = await utils.createImageTexture(window.device, assets.textures);

      texture = tex;

    } else {

      texture = utils.createBaseTexture(window.device);

    }

    const geometry = Wave.parseTextFile(assets.geometry);

    return new Creation({
      geometry: geometry,
      texture: texture,
      material: customMaterial,
    }, shadowprop, instaces, state);

  }

}