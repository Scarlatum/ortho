const shadow_intencity = 0.25;

@fragment fn fragmentKernel(
  @builtin(front_facing) face: bool,
  in: VertexOut,
) -> @location(0) vec4f {

  var color   = vec4f(0,0,0,1);
  let globalDistance = abs(distance(in.globalCoords.xyz, params.globalPosition.xyz)) / 600;

  let texel = textureSample(texture, textureSampler, in.textureUV);

  var dynamic_shadow = textureSampleCompare(
    light_dynamic, shadowSampler, 
    in.lightSpaceDyn.xy, in.lightSpaceDyn.z - 0.00
  );

  var static_shadow = textureSampleCompare(
    light_static, shadowSampler, 
    in.lightSpaceStatic.xy, in.lightSpaceStatic.z - 0.00
  );

  materialMatcher(in, face, texel, globalDistance, &color); 

  var s = (1 - min(dynamic_shadow, static_shadow)) 
    * shadow_intencity 
    * pow(max(0, 1 - globalDistance), 3) 
    * f32(in.lightReciever)
    ;

  return vec4f(color.rgb - s, 1.0);
  
}
 