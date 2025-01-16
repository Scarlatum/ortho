@group(0) @binding(0) var<uniform> params: VertexParams;
@group(0) @binding(1) var<uniform> view: ViewData;
@group(0) @binding(2) var textureSampler: sampler;
@group(0) @binding(3) var shadowSampler: sampler_comparison;

@group(1) @binding(0) var<storage, read> transforms: array<mat4x4f>;
@group(1) @binding(1) var texture: texture_2d<f32>;

@group(2) @binding(0) var<storage, read> lights: array<ViewData>;
@group(2) @binding(1) var light_dynamic: texture_depth_2d;
@group(2) @binding(2) var light_static: texture_depth_2d;