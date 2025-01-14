struct VertexOut {
  @builtin(position) pos: vec4<f32>,
}

@vertex fn vertexKernel(
  @builtin(vertex_index) index: u32
) -> VertexOut {

  var result: VertexOut;

  // Create array fullscreen trianlge
  var vertexes = array<vec3f,6>(
    vec3f(-1.0, -1.0, 0.0),
    vec3f( 1.0, -1.0, 0.0),
    vec3f( 1.0,  1.0, 0.0),
    vec3f( 1.0,  1.0, 0.0),
    vec3f(-1.0,  1.0, 0.0),
    vec3f(-1.0, -1.0, 0.0),
  );

  result.pos = vec4f(vertexes[index], 1.0);

  return result;

}

@fragment fn fragmentKernel(
  in: VertexOut
) -> @location(0) vec4<f32> {
  return vec4f(1.0);
}