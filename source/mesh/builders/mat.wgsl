fn materialMatcher(
  in: VertexOut,
  face: bool,
  texel: vec4f,
  distance: f32,
  color: ptr<function, vec4f>
) {
  switch in.material {
    // #MATERIAL
    default: {
      *color = vec4f(0,0,0,1);
    }
  }

}