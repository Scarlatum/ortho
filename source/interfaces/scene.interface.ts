// import { Batcher } from "../mesh/batcher/batcher.model";
import { Actor } from "../entity/actor.entity";
import { Mesh } from "../mesh/mesh.model";
import { Renderer } from "../renderer/renderer.model";
import { Drawable } from "./drawable.interface";
import { PointLightRepository } from "../renderer/light/point.model";
import { DirectionLight } from "../renderer/light/light.model";

export abstract class SceneInterface {

  abstract actor: Actor;
  abstract sun: DirectionLight;
  abstract renderer: Renderer;
  abstract pipeline: GPURenderPipeline;
  abstract meshes: Map<any, Mesh>;
  abstract drawQueue: Set<Drawable>;
  abstract pointLightSource: PointLightRepository;
  abstract onpass: Set<Function>;

  abstract pass(encoder: GPUCommandEncoder, qs?: GPUQuerySet): void;
  abstract onScreenResize(): void;
  abstract setupScene(): Promise<SceneInterface>;

  public getMaterial(key: number) {
    return this.renderer.materials.repo.get(key) || null;
  }

}