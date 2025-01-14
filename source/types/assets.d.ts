import { Ref } from "vue";

declare module '*.wgsl?raw' {
  const src: string;
  export default src;
}
namespace globalThis {
  var DEBUG: { value: boolean; };
  var device: GPUDevice;
  var adapter: GPUAdapter;
  var context: GPUCanvasContext;
}