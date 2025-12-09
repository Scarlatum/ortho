@id(0) override SHADOW_MAP_RESOLUTION     : f32 = 1024.0;
@id(1) override SHADOW_MAP_CASCADE_OFFSET : u32 = 0;

@id(2) override FOG_DISTANCE  : f32 = 600.0;
@id(3) override FOG_DENSITY   : f32 = 0.7;
@id(4) override MIST_DENSITY  : f32 = 0.3;

const NORMAL_PREVIEW = false;

const pallete = array<vec3f, 4>(
  vec3f(1.0,0.0,0.2),
  vec3f(0.5,1.0,0.0),
  vec3f(0.0,0.5,1.0),
  vec3f(1.0,0.0,1.0),
);

const KERNEL_3x3 = array<vec2f,9>(
  vec2f(-1, 1), vec2f( 0, 1), vec2f( 1, 1),
  vec2f(-1, 0), vec2f( 0, 0), vec2f( 1, 0),
  vec2f(-1,-1), vec2f( 0,-1), vec2f( 1,-1),
);

const KERNEL_2x2 = array<vec2f,5>(
  vec2f(-1, 1), vec2f( 1, 1),
  vec2f( 0, 0),
  vec2f(-1,-1), vec2f( 1,-1),
);
