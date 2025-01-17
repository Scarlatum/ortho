const shadow_map_uv = 1.0 / (1024.0 * 3.0);
const shadow_offset = 0.001;

@fragment fn fragmentKernel(
  @builtin(front_facing) face: bool,
  in: VertexOut,
) -> @location(0) vec4f {

  var color    = vec4f(1.0);
  let distance = abs(distance(in.globalCoords.xyz, params.globalPosition.xyz)) / 600;

  let texel = textureSample(texture, textureSampler, in.textureUV);

  let shdw = dot(in.norm.xyz, light_direction) * -0.1;
  let mist = noise(in.globalCoords.yz / 100 + params.tick / 600) * 0.01;

  var visibility = textureSampleCompare(
    light_depth, shadowSampler, 
    in.lightSpace.xy + vec2(1,1) * shadow_map_uv, in.lightSpace.z + shadow_offset
  ) + textureSampleCompare(
    light_depth, shadowSampler, 
    in.lightSpace.xy + vec2(0,1) * shadow_map_uv, in.lightSpace.z + shadow_offset
  ) + textureSampleCompare(
    light_depth, shadowSampler, 
    in.lightSpace.xy + vec2(1,0) * shadow_map_uv, in.lightSpace.z + shadow_offset
  ) + textureSampleCompare(
    light_depth, shadowSampler, 
    in.lightSpace.xy + vec2(0,0) * shadow_map_uv, in.lightSpace.z + shadow_offset
  );

  visibility /= 4.0;

  switch instanceParams.materialID {
    // #MATERIAL
    default: {
      color = vec4f(0,0,0,1);
    }
  }

  let a = max(color.rgb - shdw, vec3f(0));
  let b = (1 - visibility) * 0.15 * f32(instanceParams.shadowRecieve);
  let c = max(a - b, vec3f(0)) + mist;

  let n = (in.pos.x % 2.0 * 0.25) * (in.pos.y % 2.0 * 0.25) * (1 - distance);

  let dr = (c + distance) - n;

  return vec4f(dr, 1.0);
  
}
 
