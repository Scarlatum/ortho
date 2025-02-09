@id(0) override SHADOW_MAP_RESOLUTION: f32 = 1024.0;
@id(1) override FOG_DISTANCE: f32          = 400.0;
@id(2) override FOG_DENSITY: f32           = 0.50;
@id(3) override MIST_DENSITY: f32          = 0.05;

struct VertexOut {
  @builtin(position) pos: vec4f,
};

struct Observer {
  perspective   : mat4x4f,
  camera        : mat4x4f,
};

@group(0) @binding(0) var<uniform> view: Observer;
@group(0) @binding(1) var<storage, read> transforms: array<mat4x4f>;

@vertex fn vertexKernel(

  @builtin(instance_index) instance: u32,

  @location(0) transformationIndex: f32,
  @location(1) vertexData: vec3f,
  @location(2) normals: vec3f,
  @location(3) uv: vec2f,

) -> VertexOut {

  var result: VertexOut;

  result.pos = view.perspective * view.camera
    * transforms[instance] 
    * vec4f(vertexData, 1)
    ;

  return result;

}

@fragment fn fragmentKernel(
  @builtin(front_facing) face: bool,
  in: VertexOut,
) -> @location(0) vec4f {

  if ( face ) { discard; }

  let r = SHADOW_MAP_RESOLUTION;

  return vec4f(1);

}