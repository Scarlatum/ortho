type Mat2x2<T> = Array<Array<T>>;

type ParseResult = {
  buffers: {
    vertex: Float32Array,
    normals: Float32Array;
    uv: Float32Array;
  },
  faces: Mat2x2<number>,
};

export namespace Wave {

  const forceCast = (x: string) => parseFloat(x) || 0;

  export const enum BufferType { Vertex, UV, Normal };

  export function parseTextFile(file: string): ParseResult {
    const lines = file.split("\n");

    const counters = {
      vertex: 0,
      normals: 0,
      uv: 0,
    };

    const buffers = {
      vertex: new Float32Array(lines.length * 3),
      normals: new Float32Array(lines.length * 3),
      uv: new Float32Array(lines.length * 2),
    } as const;

    const faces: Mat2x2<number> = [];

    for (const line of lines) {
      const { 0: tag, 1: x, 2: y, 3: z } = line.split(" ");

      switch (tag) {
        case "v":
          buffers.vertex.set(
            [
              parseFloat(x),
              parseFloat(y),
              parseFloat(z),
            ],
            counters.vertex * 3,
          );
          counters.vertex += 1;
          break;
        case "vn":
          buffers.normals.set(
            [
              parseFloat(x),
              parseFloat(y),
              parseFloat(z),
            ],
            counters.normals * 3,
          );
          counters.normals += 1;
          break;
        case "vt":
          buffers.uv.set(
            [
              parseFloat(x),
              parseFloat(y),
            ],
            counters.uv * 2,
          );
          counters.uv += 1;
          break;
        case "f": {
          const a = x.split("/").map(forceCast);
          const b = y.split("/").map(forceCast);
          const c = z.split("/").map(forceCast);

          faces.push(a, b, c);
        }
      }
    }

    return {
      buffers: {
        vertex: buffers.vertex.slice(0, counters.vertex * 3),
        normals: buffers.normals.slice(0, counters.normals * 3),
        uv: buffers.uv.slice(0, counters.uv * 2),
      },
      faces,
    };
  }

  export function constructBuffer(result: ParseResult, type: BufferType) {

    const offset = type === BufferType.UV ? 2 : 3;

    const buffer = new Float32Array(result.faces.length * offset);

    const targetTable = [ result.buffers.vertex, result.buffers.uv, result.buffers.normals ];

    for (const [ index, face ] of result.faces.entries()) {
      buffer.set(targetTable[ type ].subarray(
        (face[ type ] - 1) * offset + 0,
        (face[ type ] - 1) * offset + offset,
      ), index * offset);
    };

    return buffer;

  }

}
