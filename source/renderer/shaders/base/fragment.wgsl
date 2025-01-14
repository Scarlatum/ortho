@fragment fn fragmentKernel(
  @builtin(front_facing) face: bool,
  in: VertexOut,
) -> @location(0) vec4f {

  var color   = vec4f(0,0,0,1);
  let globalDistance = abs(distance(in.globalCoords.xyz, params.globalPosition.xyz)) / 600;

  let texel = textureSample(meshTexture, textureSampler, in.textureUV);

  let visibility = textureSampleCompare(
    light_depth, shadowSampler, 
    in.lightSpace.xy, in.lightSpace.z - 0.00
  );

  materialMatcher(in, face, texel, globalDistance, &color); 

  var s = (1 - visibility) * 0.15 * pow(max(0, 1 - globalDistance), 3) * f32(in.lightReciever);

  return vec4f(color.rgb - s, 1.0);
  
}
 