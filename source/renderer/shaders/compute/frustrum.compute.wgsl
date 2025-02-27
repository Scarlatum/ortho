struct Observer {
  perspective: mat4x4f,
  camera: mat4x4f,
};

@group(0) @binding(0) var<storage, read> boundingBoxes: array<array<vec3f, 8>>;
@group(0) @binding(1) var<storage, read_write> visibility: array<u32>;
@group(0) @binding(2) var<uniform> view: Observer;

var<workgroup> sharedVisible: array<u32, 8>;

@compute @workgroup_size(8)
fn frustum(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) wg_id: vec3<u32>
) {
  let boxIndex = wg_id.x;
  let vertexIndex = local_id.x;

  let worldPos = vec4f(boundingBoxes[boxIndex][vertexIndex], 1.0);
  let viewPos = view.camera * worldPos;
  let clipPos = view.perspective * viewPos;

  var inside = false;
  if (abs(clipPos.x) <= clipPos.w &&
      abs(clipPos.y) <= clipPos.w &&
      clipPos.z >= 0.0 && clipPos.z <= clipPos.w) {
    inside = true;
  }

  sharedVisible[vertexIndex] = select(0u, 1u, inside);
  workgroupBarrier();

  if (local_id.x == 0u) {
    var anyVisible = 0u;
    for (var i = 0u; i < 8u; i++) {
      if (sharedVisible[i] == 1u) {
        anyVisible = 1u;
        break;
      }
    }
    visibility[boxIndex] = anyVisible;
  }
  
}