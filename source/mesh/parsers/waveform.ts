export type ParseResult = {
  buffers: {
    vertex: Float32Array,
    normals: Float32Array;
    uv: Float32Array;
  },
  faces: Uint32Array,
};

export namespace Wave {

  const FACE_SPREAD = 3;

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

    let facePtr = 0;
    const faces: ParseResult['faces'] = new Uint32Array(100_000);

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

          // We are just assume that 

          const a = x.split("/") as unknown as [ number, number, number ];
          const b = y.split("/") as unknown as [ number, number, number ];
          const c = z.split("/") as unknown as [ number, number, number ];

          faces.set(a, facePtr);
          faces.set(b, facePtr += FACE_SPREAD);
          faces.set(c, facePtr += FACE_SPREAD);

          facePtr += FACE_SPREAD;

        }
      }
    }

    return {
      buffers: {
        vertex: buffers.vertex.slice(0, counters.vertex * 3),
        normals: buffers.normals.slice(0, counters.normals * 3),
        uv: buffers.uv.slice(0, counters.uv * 2),
      },
      faces: faces.slice(0, facePtr),
    };
  }

  export function parseTextFileCombined(file: string): Set<ParseResult> {

    const chunks = file
      .trimEnd()
      .split(/\o.+\n/gm)
      .filter(x => x[0] === "v")
      ;

    const result = new Set<ParseResult>();

    for ( const chunk of chunks ) {

      const offsets = {
        "v": Number.MAX_SAFE_INTEGER,
        "t": Number.MAX_SAFE_INTEGER,
        "n": Number.MAX_SAFE_INTEGER,
      };

      const lines = chunk.split("\n").slice(0,-1);

      for ( var i = lines.length - 1; i > 0; i-- ) {

        const line = lines[i];

        if ( line[0] !== "f" ) break;

        for ( const x of line.split(" ").slice(1) ) {

          const [v,t,n] = x.split("/");

          offsets.v = Math.min(offsets.v, parseFloat(v) || Number.MAX_SAFE_INTEGER);
          offsets.t = Math.min(offsets.t, parseFloat(t) || Number.MAX_SAFE_INTEGER);
          offsets.n = Math.min(offsets.n, parseFloat(n) || Number.MAX_SAFE_INTEGER);

        }

      }

      const parsed = parseTextFile(chunk);

      for ( var i = 0; i < parsed.faces.length; i += 3 ) {

        const v = parsed.faces[i + 0];
        const t = parsed.faces[i + 1];
        const n = parsed.faces[i + 2];

        parsed.faces[i + 0] = v - (offsets.v - 1);
        parsed.faces[i + 1] = t - (offsets.t - 1);
        parsed.faces[i + 2] = n - (offsets.n - 1);
  
      }

      result.add(parsed);

    }

    return result;

  }

  export function constructBuffer(result: ParseResult, type: BufferType) {

    const offset = type === BufferType.UV ? 2 : 3;

    const buffer = new Float32Array(result.faces.length * offset);

    let target: Float32Array;

    switch (type) {
      case BufferType.Normal: 
        target = result.buffers.normals; break;
      case BufferType.UV: 
        target = result.buffers.uv; break;
      case BufferType.Vertex: 
        target = result.buffers.vertex; break;
    }

    const faces = result.faces;
    const len = faces.length / FACE_SPREAD;

    for (let ptr = 0; ptr < len; ptr++) {

      const index = faces[ptr * 3 + type] - 1;

      for ( let i = 0; i < offset; i++ ) {

        const a = ptr * offset + i;
        const b = index * offset + i;

        buffer[a] = target[b];

      }

    }

    return buffer;

  }

}
