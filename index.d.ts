namespace globalThis {
  var device: GPUDevice;
  var adapter: GPUAdapter;
  var context: GPUCanvasContext;
  var auctx: AudioContext;
}


declare module '*?raw' {
  const src: string
  export default src
}

interface ImportMeta {
  env: {
    DEV: boolean
  }
}