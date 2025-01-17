const rotationMask = mat4x4<f32>(
  0,1,1,0,
  1,0,1,0,
  1,1,0,0,
  1,1,1,0,
);

@vertex fn vertexKernel(

  @builtin(instance_index) instance: u32,

  @location(0) transformationIndex: f32,
  @location(1) vertexData: vec3f,
  @location(2) normals: vec3f,
  @location(3) uv: vec2f,

) -> VertexOut {

  var result: VertexOut;

  let x: mat4x4f = transforms[instance];

  let transformation = view.perspective * view.camera * x;
  let light = lights[0].perspective * lights[0].camera * x * vec4f(vertexData, 1);

  // Тут происходит некая дрянь просто из-за того, что я ленивый ублюдок
  // который не захотел передавать матрицы отдельно для каждого вида трансформаций
  let scaleFactor     = x[0][0] * x[0][0] + x[0][1] * x[0][1] + x[0][2] * x[0][2];
  let rotationMatrix  = (1.0 / scaleFactor) * mat3x3(
    x[0].xyz, 
    x[1].xyz, 
    x[2].xyz
  );

  result.pos            = transformation * vec4f(vertexData, 1);
  result.norm           = vec4f(normalize(rotationMatrix * normals), 1);
  result.textureUV      = uv;
  result.globalCoords   = x * vec4f(vertexData, 1);
  result.lightSpace     = vec4(
    light.xy * vec2f(0.5, -0.5) + vec2f(0.5), 
    light.z, 
    1
  );

  return result;

}
