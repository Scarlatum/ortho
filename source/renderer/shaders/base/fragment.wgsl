@fragment fn fragmentKernel(
  @builtin(front_facing) face: bool,
  in: VertexOut,
) -> @location(0) vec4f {

  if ( face == false ) { discard; }

  var light = vec3f(0.0);
  var color = vec4f(1.0);

  let dist  = distance(in.globalCoords.xyz, params.globalPosition.xyz);

  let nrml  = dot(in.norm.xyz, light_direction);
  let ambt  = vec3f(1.0);
  let mist  = noise(in.globalCoords.yz / 100 + params.tick / 600) * MIST_DENSITY;
  let fog   = abs(dist) / FOG_DISTANCE * FOG_DENSITY;

  let shadow_offset = clamp(-0.005 * tan(asin(nrml)), 0.0, 1.0);
  let shadow_map_uv = 1.0 / SHADOW_MAP_RESOLUTION;

  var visibility = 0.0;

  if ( instanceParams.shadowRecieve == 1u ) {

    let lp = array<vec4f, 4>(
      in.directionLigthSpaceDistant,
      in.directionLigthSpaceFar,
      in.directionLigthSpaceNear,
      in.directionLigthSpaceClose
    );

    for ( var i: u32 = 0; i < 4; i += 1 ) {

      let space = lp[i];

      let texel = textureSampleCompare(
        light_depth, shadowSampler, 
        space.xy, 3 - i, space.z,
      );

      visibility = mix(
        visibility,
        1.0 - texel,
        ceil(clamp(0.0, 1.0, space.x) % 1.0) 
        * 
        ceil(clamp(0.0, 1.0, space.y) % 1.0)
      );

    }

  }

  // Point lights
  for ( var i: u32 = 0; i < arrayLength(&pointLigth); i++ ) {

    let p: PointLight = pointLigth[i];

    if ( p.visibility != 0.0 ) {

      let n = p.range / distance(in.globalCoords.xyz, p.position);

      light += p.color
        * (n * n)
        * clamp(dot(in.norm.xyz, p.position - in.globalCoords.xyz), 0.0, 1.0)
        ;
      
    }

  }

  switch instanceParams.materialID {
    // #MATERIAL
    default: {
      color = vec4f(0,0,0,1);
    }
  }

  let shadow    = visibility * 0.15 * smoothstep(0.0, 1.0, nrml);
  let dark      = nrml * -0.15;
  let intencity = toGrayscale(ambt) + toGrayscale(light);

  let r = mix(clamp((color.rgb - dark - shadow + light) * intencity, vec3f(0), vec3f(1)), ambt, fog * 2) + mist;

  return vec4f(r, 1.0);

}
 
