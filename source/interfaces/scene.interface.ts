import { Actor } from "../entity/actor.entity";
import { Renderer } from "../renderer/renderer.model";
import { Drawable } from "./drawable.interface";
import { PointLightRepository } from "../renderer/light/point.model";
import { DirectionLight } from "../renderer/light/light.model";
import { Mesh } from "../mesh/mesh.model";

interface Updatable {
  update(): void;
}

export abstract class SceneInterface {

  protected bundles = new Set<GPURenderBundle>();
  protected drawQueue = new Set<Drawable>();
  protected updateQueue = new Set<Updatable>();

  abstract actor: Actor;
  abstract sun: DirectionLight;
  abstract renderer: Renderer;
  abstract pipeline: GPURenderPipeline;
  abstract pointLightSource: PointLightRepository;
  abstract onpass: Set<Function>;
  abstract meshes: Map<Symbol, Mesh>;

  abstract pass(encoder: GPUCommandEncoder, qs?: GPUQuerySet): void;
  abstract setupScene(): Promise<SceneInterface>;
  abstract add(x: Drawable): void;

  public getMaterial(key: number) {
    return this.renderer.materials.repo.get(key) || null;
  }


}