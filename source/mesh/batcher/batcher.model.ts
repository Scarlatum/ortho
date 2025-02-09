import { Mesh } from "../mesh.model";
import { Drawable } from "../../interfaces/drawable.interface";
import { mat4 } from "gl-matrix";

class Batch extends Drawable {
  override instances: number = 1;
  override model: mat4 | mat4[] = [];
  constructor(
    public vertexBuffer: GPUBuffer,
    public tranformationBuffer: GPUBuffer,
    public texture: GPUTexture,
  ) {
    super();
  }
}

export class Batcher {

  private meshes: Map<symbol, Mesh>;
  public vertexesAmount: number = 0;

  constructor() {
    this.meshes = new Map();
  }

  public add(mesh: Mesh): Mesh {

    this.meshes.set(mesh.id, mesh);

    this.vertexesAmount += mesh.vertexes.length / 3;

    return mesh;

  }

  public pack(device: GPUDevice, sharedTexture: GPUTexture) {

    let chunkCounter = 0;

    let vertexOffset = 0;
    let transformOffset = 0;

    const buffers = {
      vertexBuffer: device.createBuffer({
        size: this.vertexesAmount * Mesh.VERTEX_SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      }),
      transformBuffer: device.createBuffer({
        size: Mesh.MAT4SIZE * this.meshes.size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    } as const;

    for (const mesh of this.meshes.values()) {

      { // Write vertex buffer

        const data = new Float32Array(mesh.vbo);

        for (let i = 0; i < data.length; i += Mesh.VERTEX_SIZE) {
          data[ i ] = chunkCounter;
        }

        device.queue.writeBuffer(buffers.vertexBuffer, vertexOffset, data);

        vertexOffset += mesh.vbo.byteLength;

      }

      { // Write transform buffer

        device.queue.writeBuffer(
          buffers.transformBuffer,
          transformOffset,
          new Float32Array(mesh.model)
        );

        transformOffset += Mesh.MAT4SIZE;

      }

      { // Cleanup

        mesh.tranformationBuffer?.destroy();
        mesh.vertexBuffer?.destroy();

      }

      { // Prepare next chunk

        chunkCounter++;

      }

    }

    return new Batch(
      buffers.vertexBuffer,
      buffers.transformBuffer,
      sharedTexture
    );

  }

}