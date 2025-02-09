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

  let x: mat4x4f = transforms[visibility[instance]];

  let transformation = view.perspective * view.camera * x;

  let an = x * vec4f(vertexData, 1);

  let light_distant   = directionLigth[0].perspective * directionLigth[0].camera * an;
  let light_far       = directionLigth[1].perspective * directionLigth[1].camera * an;
  let light_near      = directionLigth[2].perspective * directionLigth[2].camera * an;
  let light_close     = directionLigth[3].perspective * directionLigth[3].camera * an;

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

  result.directionLigthSpaceDistant = vec4(
    light_distant.xy * vec2f(0.5, -0.5) + vec2f(0.5), 
    light_distant.z, 
    1
  );

  result.directionLigthSpaceFar = vec4(
    light_far.xy * vec2f(0.5, -0.5) + vec2f(0.5), 
    light_far.z, 
    1
  );

  result.directionLigthSpaceNear = vec4(
    light_near.xy * vec2f(0.5, -0.5) + vec2f(0.5), 
    light_near.z, 
    1
  );

  result.directionLigthSpaceClose = vec4(
    light_close.xy * vec2f(0.5, -0.5) + vec2f(0.5), 
    light_close.z, 
    1
  );

  return result;

}
