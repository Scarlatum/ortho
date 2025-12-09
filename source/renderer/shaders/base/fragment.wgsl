const SHADOW_INTENSITY = 0.05;

@fragment fn fragmentKernel(
  @builtin(front_facing) face: bool,
  in: VertexOut,
) -> FragmentOut {

  // let uv = (in.pos.xy / params.size);
  // let depthTest = textureSampleCompare(preDepth, shadowSampler, uv, in.pos.z);

  // if ( depthTest == 1.0 ) {
  //   discard;
  // }

  var result: FragmentOut;

  var debug_color = vec3f(1.0);

  var light = vec3f(0.0);
  var color = vec3f(1.0);

  let dist  = distance(in.world.xyz, params.globalPosition.xyz);

  let nrml  = dot(in.normals.xyz, light_direction);
  let ambt  = vec3f(1.0);

  let shadow_offset = clamp(-0.001 * tan(asin(nrml)), 0.0, 1.0);
  let shadow_px2uv = 1.0 / SHADOW_MAP_RESOLUTION;

  var visibility = 0.0;

  if ( instanceParams.shadowRecieve == 1u ) { // Каскадная карта теней

    let lp = array<vec4f, 4>(
      in.directionLigthSpaceDistant,
      in.directionLigthSpaceFar,
      in.directionLigthSpaceNear,
      in.directionLigthSpaceClose
    );

    for ( var i: u32 = SHADOW_MAP_CASCADE_OFFSET; i < 4; i += 1 ) {

      var texel = 0.0;

      let space     = lp[i];
      let bounders  = ceil(saturate(space.x) % 1.0) * ceil(saturate(space.y) % 1.0);

      switch i {
        // case 3u: {

        //   for ( var k: u32 = 0; k < 9; k++ ) {
        //     let n = textureGatherCompare(light_depth, shadowSampler, space.xy + shadow_px2uv * KERNEL_3x3[k], 3 - i, space.z);
        //     texel += n.x + n.y + n.z + n.y;
        //   }

        //   texel /= 36.0;

        // }
        default: {

          let n = textureGatherCompare(light_depth, shadowSampler, space.xy, 3 - i, space.z);
          texel = (n.x + n.y + n.z + n.y) / 4.0;

        }
      }

      visibility = mix(
        visibility,
        1.0 - texel,
        bounders
      );

      if ( params.debugCascade == 1.0 ) {
        debug_color = mix(
          debug_color,
          pallete[i],
          bounders
        );
      }

    }

  }

  // Точечные источники света
  for ( var i: u32 = 0; i < arrayLength(&pointLigth); i++ ) {

    let p: PointLight = pointLigth[i];

    if ( p.visibility != 0.0 ) {

      let n = p.range / distance(in.world.xyz, p.position);

      light += p.color
        * (n * n)
        * saturate(dot(in.normals.xyz, p.position - in.world.xyz))
        ;
      
    }

  }

  switch instanceParams.materialID {

    @include(material);

    default: {
      color = vec3f(0,0,0);
    }

  }

  let shadow    = visibility * SHADOW_INTENSITY * saturate(nrml);
  let dark      = saturate(nrml * -SHADOW_INTENSITY);
  let intencity = toGrayscale(light);

  color  = saturate(color - shadow - dark);
  color += light;

  if ( params.debugCascade == 1.0 ) {
    color *= debug_color;
  }

  @include(fragment);

  result.render = vec4f(color, 1.0);
  result.normals = vec4f(abs(in.normals.xyz), 1.0);

  return result;

}
 
