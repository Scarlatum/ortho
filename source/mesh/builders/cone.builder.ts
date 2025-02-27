export default class Cone {

  private static size = 3 * 3;

  public position: Position = { x: 0, y: 0, z: 0 };

  public static makeMesh(edges: number) {

    const vertex = new Float32Array(edges * Cone.size);

    const edgeSize = 360 / edges;
    const edgeRadians = Math.PI / 180;

    for (let i = 0; i < edges; i++) {

      const a = Math.cos(edgeRadians * (edgeSize * (i + 0)));
      const b = Math.sin(edgeRadians * (edgeSize * (i + 0)));
      const c = Math.cos(edgeRadians * (edgeSize * (i + 1)));
      const d = Math.sin(edgeRadians * (edgeSize * (i + 1)));

      vertex.set([
        a, b, 1,
        c, d, 1,
        0, 0, 0,
      ], Cone.size * i);

    }

    return vertex;

  }

}