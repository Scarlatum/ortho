struct VertexOut {
  @builtin(position) pos: vec4f,
};

struct Observer {
  perspective: mat4x4f,
  camera: mat4x4f,
};

@group(0) @binding(0) var<uniform> view: Observer;
@group(0) @binding(1) var<storage, read> transforms: array<mat4x4f>;

@vertex fn vertexKernel(
  @builtin(instance_index) instance: u32,
  @location(0) vertexData: vec3f,
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

  return vec4f(vec3f(in.pos.z), 1);

}