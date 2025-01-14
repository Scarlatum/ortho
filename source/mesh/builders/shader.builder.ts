import MaterialMatcher from "./mat.wgsl?raw";

import { ProceduredMaterial } from "../mesh.material";

interface ShaderCode {
  vertex: string,
  fragment: string,
}

interface OptionalParams {
  utils: string,
  constants: string,
  structs: string,
  bindings: string,
}

interface ShaderParams extends Partial<OptionalParams> {
  kernel: ShaderCode;
}

export class ShaderBuilder {

  private materialMap: string = MaterialMatcher;
  private code: ShaderCode = Object();

  constructor(private params: ShaderParams) {

    this.code.fragment = [
      String(this.params.constants),
      String(this.params.structs),
      String(this.params.bindings),
      String(this.params.utils || ""),
      this.params.kernel.fragment
    ].join("\n");

    this.code.vertex = [
      String(this.params.constants),
      String(this.params.structs),
      String(this.params.bindings),
      this.params.kernel.vertex
    ].join("\n");

  }

  applyMaterials(material: Array<ProceduredMaterial>): ShaderBuilder {

    material.forEach(x => {
      this.materialMap = this.materialMap.replaceAll("// #MATERIAL", /* wgsl */`
        case ${x.id}u {
          ${x.code}
        }
        // #MATERIAL
      `);
    });

    return this;

  }

  static compile(builder: ShaderBuilder, device: GPUDevice) {

    const fs = builder.code.fragment + "\n" + builder.materialMap;
    const vs = builder.code.vertex;

    return {
      fragment: device.createShaderModule({
        code: fs,
      }),
      vertex: device.createShaderModule({
        code: vs,
      }),
    } as const;
  }

}