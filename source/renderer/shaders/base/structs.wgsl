struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) norm: vec4f,
  @location(1) textureUV: vec2f,
  @location(2) globalCoords: vec4f,
  @location(3) lightSpace: vec4f,
};

struct VertexParams {
  tick            : f32,
  size            : vec2f,
  globalPosition  : vec3f,
};

struct ViewData {
  perspective   : mat4x4f,
  camera        : mat4x4f,
};

struct InstanceParam {
  materialID    : u32,
  shadowCast    : u32,
  shadowRecieve : u32,
}