import { Wave, ParseResult } from "../../source/mesh/parsers/waveform.ts";

declare const Deno: any;

const LEN = 50_000;

const data: ParseResult = {
  buffers: {
    normals : new Float32Array(LEN),
    uv      : new Float32Array(LEN),
    vertex  : new Float32Array(LEN)
  },
  faces: new Uint32Array(LEN * 3).fill(1)
}

Deno.bench("Construct Buffer", () => {

  Wave.constructBuffer(data, Wave.BufferType.Vertex);
  Wave.constructBuffer(data, Wave.BufferType.UV);
  Wave.constructBuffer(data, Wave.BufferType.Normal);

});