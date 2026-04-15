struct VertexOut {
  @builtin(position) pos: vec4<f32>,
}

@group(0) @binding(0) var depth: texture_depth_multisampled_2d;
@group(0) @binding(1) var norms: texture_multisampled_2d<f32>;

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

  let r = vec4f(1.0,0.5,0.5,1.0);
  let t = textureLoad(norms, vec2i(in.pos.xy), 0);
  let s = textureLoad(depth, vec2i(in.pos.xy), 0);

  var v = 0.0;

  for ( var x: i32 = 0; x < 3; x++ ) {
    for ( var y: i32 = 0; y < 3; y++ ) {

      let c = vec2i(in.pos.xy) + vec2i((x - 3) * 2, (y - 3) * 2);

      let n = textureLoad(norms, c, 0);
      let d = textureLoad(depth, c, 0);

      v += distance(t, n);

    }
  }

  v /= 3 * 3;

  return mix(r, vec4f(0.0), v);

}