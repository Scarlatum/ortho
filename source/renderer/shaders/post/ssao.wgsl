struct VertexOut {
  @builtin(position) pos: vec4<f32>,
}

@group(0) @binding(0) var depth: texture_depth_multisampled_2d;
@group(0) @binding(1) var norms: texture_multisampled_2d<f32>;

@vertex fn vertexKernel(
  @builtin(vertex_index) index: u32
) -> VertexOut {

  var result: VertexOut;

  // Fullscreen quad
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

  let r = vec3f(0.5,0.0,1.0);
  let p = vec2i(in.pos.xy);

  let n = textureLoad(norms, p, 0);
  let d = textureLoad(depth, p, 0);

  var v = 0.0;
  var o = 0.0;

  for ( var x = 0; x < 3; x++ ) {
    for ( var y = 0; y < 3; y++ ) {

      let a = textureLoad(norms, p + vec2i(x,y) + vec2i(-1,-1), 0);
      let b = textureLoad(depth, p + vec2i(x,y) + vec2i(-1,-1), 0);

      v += distance(a,n);
      o += distance(b,d);

    }
  }

  v /= 3 * 3;
  o /= 3 * 3;

  v *= pow(o, 0.5);

  return vec4f(mix(r, vec3f(0.1), v), 1.0);

}