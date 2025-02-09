import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Wave } from "../source/mesh/parsers/waveform.ts";

import parseTargets from "./assets/wavefront/target.json" with { type: "json" };

const file = Deno.readTextFileSync(`${ import.meta.dirname }/assets/wavefront/cube.obj`);

Deno.test("Parse .obj format", async test => {

  const result = Wave.parseTextFile(file);

  await test.step("Validate buffers sizes", () => {

    assert(result.buffers.vertex.length === 8 * 3);
    assert(result.buffers.normals.length === 6 * 3);
    assert(result.buffers.uv.length === 12 * 2);
  
  });

  await test.step("Compare with target", () => {

    type TargetKeys = keyof typeof parseTargets;
    type BufferType = Exclude<TargetKeys, "faces">;
  
    for ( const key of Object.keys(parseTargets) ) {
      for ( let i = 0; i < parseTargets.faces.length; i++ ) {
        switch (key as TargetKeys) {
          case "faces":
            assertEquals(parseTargets.faces[i], result.faces[i]);
            break;
          default:
            assertEquals(
              parseTargets[key as BufferType][i], 
              result.buffers[key as BufferType][i]
            );
        }
      }
    }

  })

});