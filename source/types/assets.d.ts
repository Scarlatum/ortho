declare module '*.wgsl?raw' {
  const src: string;
  export default src;
}
namespace globalThis {
  var device  : GPUDevice;
  var adapter : GPUAdapter;
  var context : GPUCanvasContext;
  var auctx   : AudioContext;
}