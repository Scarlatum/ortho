const rotationMask = mat4x4<f32>(
  0,1,1,0,
  1,0,1,0,
  1,1,0,0,
  1,1,1,0,
);

@vertex fn vertexKernel(

  @location(0) meshID: f32,
  @location(1) materialID: f32,
  @location(2) vertexData: vec3f,
  @location(3) normals: vec3f,
  @location(4) uv: vec2f,
  @location(5) sr: f32,

  // @builtin(vertex_index) index: u32,
  @builtin(instance_index) instance: u32,

) -> VertexOut {

  var result: VertexOut;

  let x: mat4x4f = transforms[instance];

  let transf = view.perspective * view.camera * x;
  
  let light_dyn     = lights[0].perspective * lights[0].camera * x * vec4f(vertexData, 1);
  let light_static  = lights[1].perspective * lights[1].camera * x * vec4f(vertexData, 1);

  // Тут происходит некая дрянь просто из-за того, что я ленивый ублюдок
  // который не захотел передавать матрицы отдельно для каждого вида трансформаций
  let scaleFactor     = x[0][0] * x[0][0] + x[0][1] * x[0][1] + x[0][2] * x[0][2];
  let rotationMatrix  = (1.0 / scaleFactor) * mat3x3(
    x[0].xyz, 
    x[1].xyz, 
    x[2].xyz
  );

  result.id    = u32(meshID);
  result.pos   = transf * vec4f(vertexData, 1);
  result.color = vec4f(
    BASE_SHAPE_R_COLOR,
    BASE_SHAPE_G_COLOR,
    BASE_SHAPE_B_COLOR,
    1
  );

  result.lightReciever  = u32(sr); 
  result.material       = u32(materialID);
  result.norm           = vec4f(normalize(rotationMatrix * normals), 1);
  result.textureUV      = uv;
  result.globalCoords   = x * vec4f(vertexData, 1);

  result.lightSpaceDyn  = vec4(
    light_dyn.xy * vec2f(0.5, -0.5) + vec2f(0.5), 
    light_dyn.z, 
    1
  );

  result.lightSpaceStatic = vec4(
    light_static.xy * vec2f(0.5, -0.5) + vec2f(0.5), 
    light_static.z, 
    1
  );

  return result;

}
