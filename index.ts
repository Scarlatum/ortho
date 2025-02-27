import * as Ortho from "gl-matrix";

// Main
import { Renderer } from "./source/renderer/renderer.model";
import { Scene } from "./source/renderer/scene.model";

// Mesh
import { ProceduredMaterial } from "./source/mesh/mesh.material";

// Passes
import { BlurPass } from "./source/renderer/passes/blur.pass";

// Light
import { DirectionLight } from "./source/renderer/light/light.model";
import { PointLight } from "./source/renderer/light/point.model"
 
// Entities
import { Creation } from "./source/entity/creation.entity";

export { Scene, ProceduredMaterial, BlurPass, DirectionLight, PointLight, Renderer, Creation, Ortho };

// export namespace Ortho {

//   export const Renderer = renderer;
//   export const Scene = scene;
//   export const Math = glmatrix;

//   export namespace Entities {

//     export const Creation = creation;

//   }

//   export namespace Light {
//     export const Directional = DirectionLight;
//     export const Point = PointLight;
//   }

//   export namespace PostEffects {
//     export const Blur = BlurPass;
//   }

//   export namespace Materials {
//     export const Procudured = ProceduredMaterial;
//   }

// }