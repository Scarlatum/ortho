@group(0) @binding(0) var frame: texture_2d<f32>;

struct VertexOut {
  @builtin(position) pos: vec4f,
}

@vertex fn vertexKernel(
  @builtin(vertex_index) index: u32
) -> VertexOut {

  var result: VertexOut;

  // Create array fullscreen trianlge
  var vertexes = array<vec2f,6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0),
    vec2f( 1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0, -1.0),
  );

  result.pos = vec4f(vertexes[index], 0.0, 1.0);

  return result;

}

@fragment fn fragmentKernel(
  in: VertexOut
) -> @location(0) vec4<f32> {

  let a = textureLoad(frame, vec2i(in.pos.xy), 0).rgb;
  let b = textureLoad(frame, vec2i(in.pos.xy), 1).rgb;
  let c = textureLoad(frame, vec2i(in.pos.xy), 2).rgb;
  let d = textureLoad(frame, vec2i(in.pos.xy), 3).rgb;

  return vec4f(a + b + c + d, 1);
  
}