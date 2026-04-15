export const enum BindgroupLabels {
  BaseGroup,
  InstanceGroup,
  ShadowMappingGroup,
  PointLightGroup
}

export const enum MSAA { NONE = 1, X4 = 4, X8 = 8, X16 = 16 };

export const enum GBufferType { 
  Frame, 
  Depth, 
  Normal 
};

export const layouts = [
  {
    label: BindgroupLabels.BaseGroup.toString(),
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } },
    ]
  },
  {
    label: BindgroupLabels.InstanceGroup.toString(),
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d", sampleType: "float" } },
    ]
  },
  {
    label: BindgroupLabels.ShadowMappingGroup.toString(),
     entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "2d-array", sampleType: "depth" } },
    ]
  },
  {
    label: BindgroupLabels.PointLightGroup.toString(),
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } }
    ]
  },
] satisfies Array<GPUBindGroupLayoutDescriptor>;