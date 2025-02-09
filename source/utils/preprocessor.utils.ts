import { ProceduredMaterial } from "../mesh/mesh.material";

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

export class Preprocessor {

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

  applyMaterials(material: Array<ProceduredMaterial>): Preprocessor {

    material.forEach(x => {
      this.code.fragment = this.code.fragment.replaceAll("// #MATERIAL", /* wgsl */`
        case ${x.id}u {
          ${x.code}
        }
        // #MATERIAL
      `);
    });

    return this;

  }

  static setup(label: string, builder: Preprocessor) {

    const fs = builder.code.fragment;
    const vs = builder.code.vertex;

    return {
      fragment: device.createShaderModule({
        label,
        code: fs,
      }),
      vertex: device.createShaderModule({
        label,
        code: vs,
      }),
    } as const;
  }

}