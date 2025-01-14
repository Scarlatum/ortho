@id(0) override canvas_w: f32 = 1.0;
@id(1) override canvas_h: f32 = 1.0;

struct VertexOut {
  @builtin(position) pos: vec4<f32>,
  @location(1) uv: vec2f,
}

@group(0) @binding(0) var depth: texture_depth_2d;
@group(0) @binding(1) var<uniform> model: mat4x4<f32>;

@vertex fn vertexKernel(
  @builtin(vertex_index) index: u32,
  @location(0) vertexData: vec2f,
) -> VertexOut {

  var result: VertexOut;

  result.pos = model * vec4f(vertexData, 1.0, 1.0);
  result.uv = vertexData * vec2f(0.5,-0.5) + .5;

  return result;

}

@fragment fn fragmentKernel(
  in: VertexOut
) -> @location(0) vec4<f32> {

  let coord = vec2f(canvas_w, canvas_h) * in.uv;
  let color = textureLoad(depth, vec2i(coord), 0);

  return vec4(vec3(smoothstep(0.99,1.0,color)), 1);
  
}