// import { Batcher } from "../mesh/batcher/batcher.model";
import { Actor } from "../entity/actor.entity";
import { Mesh } from "../mesh/mesh.model";
import { Renderer } from "../renderer/renderer.model";
import { Drawable } from "./drawable.interface";
import { ProceduredMaterial } from "../mesh/mesh.material";
import { LightSources } from "../renderer/light/light.model";

export abstract class SceneInterface {

  abstract actor: Actor;
  abstract renderer: Renderer;
  abstract pipeline: GPURenderPipeline;
  abstract meshes: Map<any, Mesh>;
  abstract drawQueue: Array<Drawable>;
  abstract resourses: Record<string, URL>;
  abstract materials: Array<ProceduredMaterial>;
  abstract lightSources: LightSources;

  abstract pass(encoder: GPUCommandEncoder, qs?: GPUQuerySet): void;
  abstract onScreenChange(): void;
  abstract setupScene(): Promise<void>;

}