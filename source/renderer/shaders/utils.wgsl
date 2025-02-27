@must_use fn random(input: vec2<f32>) -> f32 {
  return fract(sin(dot(input ,vec2(12.9898,78.233))) * 43758.5453);
}

@must_use fn noise(st: vec2<f32>) -> f32 {

  let i: vec2f = floor(st);
  let f: vec2f = fract(st);

  // Four corners in 2D of a tile
  let a = random(i);
  let b = random(i + vec2(1.0, 0.0));
  let c = random(i + vec2(0.0, 1.0));
  let d = random(i + vec2(1.0, 1.0));

  let u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) 
    + (c - a) * u.y * (1.0 - u.x) 
    + (d - b) * u.x * u.y
    ;

}

@must_use fn fbm(input: vec2<f32>) -> f32 {

  var x = input;

  var v = 0.0;
  var a = 0.5;

  let shift = vec2(100.0);

  // Rotate to reduce axial bias
  let rot = mat2x2(
     cos(0.5), sin(0.5),
    -sin(0.5), cos(0.5)
  );

  for (var i: i32 = 1; i < 5; i++) {
    v += a * noise(x);
    x = rot * x * 2.0 + shift;
    a *= 0.5;
  }

  return v;

}

@must_use fn warp(pos: vec2<f32>) -> f32 {

	let st: vec2f = pos / vec2f(10);
         
  var q = vec2(0.0);
    	q.x = fbm(st);
    	q.y = fbm(st + vec2(1.0));

	var r = vec2(0.0);
    	r.y = fbm(st + 1.0*q + vec2(8.3,2.8) + 0.125 * (params.tick * 0.005));
		  r.x = fbm(st + 1.0*q + vec2(1.7,9.2) + 0.150 * (params.tick * 0.005));

  let f = fbm(st + r);
    
  return (f + 0.6*f*f + 0.5*f);

}

@must_use fn toGrayscale(rgb: vec3f) -> f32 {
  return rgb.r * 0.25 + rgb.g * 0.5 + rgb.b * 0.25;
}

fn HUEtoRGB(hue: f32) -> vec3f {
  return saturate(abs(hue * 6.0 - vec3f(3, 2, 4)) * vec3f(1, -1, -1) + vec3f(-1, 2, 2));
}

fn RGBtoHCV(rgb: vec3f) -> vec3f {

  let p = select(
    vec4(rgb.bg, -1.0,  2.0 / 3.0),
    vec4(rgb.gb,  0.0, -1.0 / 3.0),
    rgb.g > rgb.b
  );

  let q = select(
    vec4(p.xyw, rgb.r),
    vec4(rgb.r, p.yzx),
    rgb.r > p.x,
  );

  let c = q.x - min(q.w, q.y);
  let h = abs((q.w - q.y) / (6. * c + 0.0000000001) + q.z);

  return vec3(h, c, q.x);

}

fn RGBtoHSL(rgb: vec3f) -> vec3f {

  // RGB [0..1] to Hue-Saturation-Lightness [0..1]
  var hcv = RGBtoHCV(rgb);

  let z = hcv.z - hcv.y * 0.5;
  let s = hcv.y / (1. - abs(z * 2. - 1.) + 0.0000000001);

  return vec3f(hcv.x, s, z);

}

fn HSLtoRGB(hsl: vec3f) -> vec3f {

  let rgb = HUEtoRGB(hsl.x);

  let c = (1. - abs(2. * hsl.z - 1.)) * hsl.y;

  return (rgb - 0.5) * c + hsl.z;

}