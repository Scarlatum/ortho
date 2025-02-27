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

  private static readonly fragmentMixin = "@include(fragment);";
  private static readonly materialMixin = "@include(material);";

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

  public applyMaterials(material: Array<ProceduredMaterial>): Preprocessor {

    material.forEach(x => {
      this.code.fragment = this.code.fragment.replaceAll(Preprocessor.materialMixin, /* wgsl */`
        case ${ x.id }u {
          ${ x.code }
        }
        ${ Preprocessor.materialMixin }
      `);
    });

    return this;

  }

  public applyFragment(wgsl: string) {
    this.code.fragment = this.code.fragment.replaceAll(
      Preprocessor.fragmentMixin, 
      wgsl + "\n" + Preprocessor.fragmentMixin
    );
  }
  
  static setup(label: string, builder: Preprocessor) {

    const vs = builder.code.vertex;
    const fs = builder.code.fragment
      .replaceAll(Preprocessor.fragmentMixin, String())
      .replaceAll(Preprocessor.materialMixin, String())
      ;

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