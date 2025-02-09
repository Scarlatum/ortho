struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) norm: vec4f,
  @location(1) textureUV: vec2f,
  @location(2) globalCoords: vec4f,
  @location(3) directionLigthSpaceDistant  : vec4f,
  @location(4) directionLigthSpaceFar      : vec4f,
  @location(5) directionLigthSpaceNear     : vec4f,
  @location(6) directionLigthSpaceClose    : vec4f,
};

struct VertexParams {
  tick            : f32,
  size            : vec2f,
  globalPosition  : vec3f,
};

struct Observer {
  perspective   : mat4x4f,
  camera        : mat4x4f,
};

struct PointLight {
  visibility    : f32,
  color         : vec3f,
  position      : vec3f,
  range         : f32
}

struct InstanceParam {
  materialID    : u32,
  shadowCast    : u32,
  shadowRecieve : u32,
}