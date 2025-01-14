struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

struct Params {
  res: vec2f,
  dir: vec2f,
}

@group(0) @binding(0) var frame: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var<uniform> params: Params;

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
  result.uv = vertexes[index] * vec2f(0.5,-0.5) + 0.5;

  return result;

}

@fragment fn fragmentKernel(
  in: VertexOut
) -> @location(0) vec4<f32> {

  let px = vec2f(1.0) / params.res;

  var value = vec3f(0);

  value += textureSample(frame, smp, in.uv + px * vec2f(0,0)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(2,0)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(4,0)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(6,0)).rgb;

  value += textureSample(frame, smp, in.uv + px * vec2f(1,1)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(3,1)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(5,1)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(7,1)).rgb;

  value += textureSample(frame, smp, in.uv + px * vec2f(0,2)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(2,2)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(4,2)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(6,2)).rgb;

  value += textureSample(frame, smp, in.uv + px * vec2f(1,3)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(3,3)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(5,3)).rgb;
  value += textureSample(frame, smp, in.uv + px * vec2f(7,3)).rgb;

  return vec4f(value / 16, 1.0);

}