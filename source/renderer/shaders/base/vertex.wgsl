const uv_offset = vec2f(0.5, -0.5);

@vertex fn vertexKernel(

  @builtin(instance_index) instance: u32,

  @location(0) vertexData: vec3f,
  @location(1) normals: vec3f,
  @location(2) uv: vec2f,

) -> VertexOut {

  var result: VertexOut;

  let x: mat4x4f = transforms[visibility[instance]];

  // Тут происходит некая дрянь просто из-за того, что я ленивый ублюдок
  // который не захотел передавать матрицы отдельно для каждого вида трансформаций
  let scaleFactor     = x[0][0] * x[0][0] + x[0][1] * x[0][1] + x[0][2] * x[0][2];
  let rotationMatrix  = (1.0 / scaleFactor) * mat3x3(
    x[0].xyz, 
    x[1].xyz, 
    x[2].xyz
  );

  result.world   = x * vec4f(vertexData, 1);
  result.pos     = view.perspective * view.camera * result.world;
  result.normals = vec4f(normalize(rotationMatrix * normals), 1);
  result.uv      = uv;

  let distant   = directionLigth[0].perspective * directionLigth[0].camera * result.world;
  let far       = directionLigth[1].perspective * directionLigth[1].camera * result.world;
  let near      = directionLigth[2].perspective * directionLigth[2].camera * result.world;
  let close     = directionLigth[3].perspective * directionLigth[3].camera * result.world;

  result.directionLigthSpaceDistant = vec4(
    distant.xy * uv_offset + 0.5, 
    distant.z, 1
  );

  result.directionLigthSpaceFar = vec4(
    far.xy * uv_offset + 0.5, 
    far.z, 1
  );

  result.directionLigthSpaceNear = vec4(
    near.xy * uv_offset + 0.5, 
    near.z, 1
  );

  result.directionLigthSpaceClose = vec4(
    close.xy * uv_offset + 0.5, 
    close.z, 1
  );

  return result;

}
