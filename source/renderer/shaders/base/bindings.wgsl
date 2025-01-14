@group(0) @binding(999) var<uniform> params: VertexParams;
@group(0) @binding(998) var<uniform> view: ViewData;

@group(0) @binding(997) var<storage, read> transforms: array<mat4x4f>;

@group(0) @binding(996) var textureSampler: sampler;
@group(0) @binding(995) var meshTexture: texture_2d<f32>;

@group(0) @binding(994) var<storage, read> lights: array<ViewData>;
@group(0) @binding(993) var light_depth: texture_depth_2d;
@group(0) @binding(992) var shadowSampler: sampler_comparison;