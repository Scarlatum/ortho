fn random(input: vec2<f32>) -> f32 {
  return fract(sin(dot(input ,vec2(12.9898,78.233))) * 43758.5453);
}

fn noise(st: vec2<f32>) -> f32 {

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

fn fbm(input: vec2<f32>) -> f32 {

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

fn warp(
	frag_coord: vec2<f32>
) -> f32 {

	let st: vec2f = frag_coord / vec2f(10);
         
  var q = vec2(0.0);
    	q.x = fbm(st);
    	q.y = fbm(st + vec2(1.0));

	var r = vec2(0.0);
    	r.y = fbm(st + 1.0*q + vec2(8.3,2.8) + 0.125 * (params.tick * 0.005));
		  r.x = fbm(st + 1.0*q + vec2(1.7,9.2) + 0.150 * (params.tick * 0.005));

  let f = fbm(st + r);
    
  return (f + 0.6*f*f + 0.5*f);

}

fn toGrayscale(rgb: vec3f) -> f32 {
  return rgb.r * 0.25 + rgb.g * 0.5 + rgb.b * 0.25;
}