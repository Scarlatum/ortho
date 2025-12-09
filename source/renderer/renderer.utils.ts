// Shader modules 
import s_utils from "./shaders/utils.wgsl?raw";
import s_constants from "./shaders/base/constants.wgsl?raw";
import s_structs from "./shaders/base/structs.wgsl?raw";
import s_bindings from "./shaders/base/bindings.wgsl?raw";
import s_vertex from "./shaders/base/vertex.wgsl?raw";
import s_fragment from "./shaders/base/fragment.wgsl?raw";

export const DefaultShader = {
  constants: s_constants,
  bindings: s_bindings,
  structs: s_structs,
  utils: s_utils,
  kernel: {
    fragment: s_fragment,
    vertex: s_vertex,
  }
};

/** 
 * @see https://www.w3.org/TR/WGSL/#alignment-and-size
 */
export const enum WGSLAlign {
  SCALAR = 1,
  VEC2 = 2,
  VEC3 = 4,
  VEC4 = 4,
  MAT2X2 = 2,
  MAT3X3 = 4,
  MAT4X4 = 4,
}