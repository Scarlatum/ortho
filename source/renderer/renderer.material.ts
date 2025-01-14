import { ProceduredMaterial } from "../mesh/mesh.material";

export class MaterialRepository {

  public repo = new Map<number, ProceduredMaterial>();

  public register(material: ProceduredMaterial) {

    this.repo.set(material.id, material);

    return material;

  }

}
