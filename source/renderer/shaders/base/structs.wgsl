struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) normals: vec4f,
  @location(1) uv: vec2f,
  @location(2) world: vec4f,
  @location(3) directionLigthSpaceDistant  : vec4f,
  @location(4) directionLigthSpaceFar      : vec4f,
  @location(5) directionLigthSpaceNear     : vec4f,
  @location(6) directionLigthSpaceClose    : vec4f,
};

struct FragmentOut {
  @location(0) render: vec4f,
  @location(1) normals: vec4f,
}

struct Params {
  tick            : f32,
  size            : vec2f,
  globalPosition  : vec3f,
  lookDirection   : vec3f,
  debugCascade    : f32,
};

struct Observer {
  perspective   : mat4x4f,
  camera        : mat4x4f,
};

struct PointLight {
  visibility    : f32,
  color         : vec3f,
  position      : vec3f,
  range         : f32,
}

struct InstanceParam {
  materialID    : u32,
  shadowCast    : u32,
  shadowRecieve : u32,
}