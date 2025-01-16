struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) norm: vec4f,
  @location(2) textureUV: vec2f,
  @location(3) globalCoords: vec4f,
  @location(4) lightSpaceDyn: vec4f,
  @location(5) lightSpaceStatic: vec4f,
  @location(6) @interpolate(flat) lightReciever: u32,
  @location(7) @interpolate(flat) id: u32,
  @location(8) @interpolate(flat) material: u32,
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