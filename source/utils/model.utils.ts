import { mat4 } from "gl-matrix";

export class Model extends Float32Array {

  constructor(private gbuffer: GPUBuffer) {

    super(gbuffer.size / Float32Array.BYTES_PER_ELEMENT);

    mat4.identity(this);

  }

  [ Symbol.dispose ]() {
    device.queue.writeBuffer(this.gbuffer, 0, this);
  }

}