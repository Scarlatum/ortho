import { type ParseResult } from "../parsers/waveform";

export default function(): ParseResult {
  return {
    faces: new Uint32Array([
      1,1,1, 2,2,1, 3,3,1,
      2,2,1, 4,4,1, 3,3,1,
    ]),
    buffers: {
      vertex: new Float32Array([
        -1, 0,  1,
         1, 0,  1,
        -1, 0, -1,
         1, 0, -1,
      ]),
      normals: new Float32Array([
        0,0,1,
      ]),
      uv: new Float32Array([
        1,1,
        0,1,
        1,0,
        0,0,
      ])
    }
  }
}