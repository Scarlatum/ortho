struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

struct Params {
  res: vec2f,
  intencity: f32,
}

@group(0) @binding(0) var frame: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var<uniform> params: Params;

const kernel = array<vec2f, 9>(
  vec2f(-1, 1),vec2f( 0, 1),vec2f( 1, 1),
  vec2f(-1, 0),vec2f( 0, 0),vec2f( 1, 0),
  vec2f(-1,-1),vec2f( 0,-1),vec2f( 1,-1),
);

// const kernel_large = array<vec2f, 25>(
//   vec2f(-4, 4),vec2f(-2, 4),vec2f( 0, 4),vec2f( 2, 4),vec2f( 4, 4),
//   vec2f(-4, 2),vec2f(-2, 2),vec2f( 0, 2),vec2f( 2, 2),vec2f( 4, 2),
//   vec2f(-4, 0),vec2f(-2, 0),vec2f( 0, 0),vec2f( 2, 0),vec2f( 4, 0),
//   vec2f(-4,-2),vec2f(-2,-2),vec2f( 0,-2),vec2f( 2,-2),vec2f( 4,-2),
//   vec2f(-4,-4),vec2f(-2,-4),vec2f( 0,-4),vec2f( 2,-4),vec2f( 4,-4),
// );

const gaussian_weights_3x3 = array<f32, 9>(
  0.03125, 0.06250, 0.03125, 
  0.12500, 0.50000, 0.12500, 
  0.03125, 0.06250, 0.03125,
);

const vertexes = array<vec2f,6>(
  vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0),
  vec2f( 1.0,  1.0), vec2f(-1.0,  1.0), vec2f(-1.0, -1.0),
);

@vertex fn vertexKernel(
  @builtin(vertex_index) index: u32
) -> VertexOut {

  var result: VertexOut;

  result.pos = vec4f(vertexes[index], 0.0, 1.0);
  result.uv = vertexes[index] * vec2f(0.5,-0.5) + 0.5;

  return result;

}

@fragment fn fragmentKernel(
  in: VertexOut
) -> @location(0) vec4<f32> {

  let px = vec2f(1.0) / params.res * params.intencity;

  var value = vec3f(0.0);

  for ( var i = 0; i < 9; i++ ) {

    let coords = in.uv + px * kernel[i];
    
    value += textureSample(frame, smp, coords).rgb / 9.0;

  }

  return vec4f(value, 1);

}