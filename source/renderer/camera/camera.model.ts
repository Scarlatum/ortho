import { mat4, vec2, vec3 } from "gl-matrix";

export const enum Axis { X, Y, Z };
export const enum CameraView { Front, Up, Right };


export class Observer {

  static BUFFER_SIZE = 4 * 4 * 2;
  static BUFFER_TYPE = Float32Array;
  static BUFFER_STRIDE = 4 * 4 * Float32Array.BYTES_PER_ELEMENT;

  static UP: vec3 = [ 0, 1, 0 ];
  static FAR_POINT = 1000;

  protected needsUpdate: boolean = true;
  protected matrix = Array<vec3>();

  public position = [ 0, 1.7, 0 ] as vec3;
  public target = [ 0, 1, 1 ] as vec3;
  public projection = mat4.create();

  public buffer: GPUBuffer;

  constructor() {
    
    this.buffer = device.createBuffer({
      label: `Observer matrixes ${ crypto.randomUUID() }`,
      size: Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    this.matrix[ CameraView.Front ] = vec3.create();
    this.matrix[ CameraView.Up ] = vec3.create();
    this.matrix[ CameraView.Right ] = vec3.create();

    vec3.scale(this.target, this.target, Observer.FAR_POINT);

  }

  public update() {

    vec3.normalize(this.matrix[ CameraView.Front ], vec3.sub(this.matrix[ CameraView.Front ], this.position, this.target));

    vec3.cross(this.matrix[ CameraView.Right ], Camera.UP, this.matrix[ CameraView.Front ]);

    vec3.normalize(this.matrix[ CameraView.Up ], vec3.cross(this.matrix[ CameraView.Up ], this.matrix[ CameraView.Front ], this.matrix[ CameraView.Right ]));
    vec3.normalize(this.matrix[ CameraView.Right ], this.matrix[ CameraView.Right ]);

    const tx = vec3.dot(this.position, this.matrix[ CameraView.Right ]);
    const ty = vec3.dot(this.position, this.matrix[ CameraView.Up ]);
    const tz = vec3.dot(this.position, this.matrix[ CameraView.Front ]);

    device.queue.writeBuffer(this.buffer, 0, new Camera.BUFFER_TYPE(this.projection));
    device.queue.writeBuffer(this.buffer, Observer.BUFFER_STRIDE, new Camera.BUFFER_TYPE([
      this.matrix[ CameraView.Right ][ Axis.X ], this.matrix[ CameraView.Up ][ Axis.X ], this.matrix[ CameraView.Front ][ Axis.X ], 0,
      this.matrix[ CameraView.Right ][ Axis.Y ], this.matrix[ CameraView.Up ][ Axis.Y ], this.matrix[ CameraView.Front ][ Axis.Y ], 0,
      this.matrix[ CameraView.Right ][ Axis.Z ], this.matrix[ CameraView.Up ][ Axis.Z ], this.matrix[ CameraView.Front ][ Axis.Z ], 0,
      -tx, -ty, -tz, 1,
    ]));

  }

}

export class Camera extends Observer {

  static BASE_FOV = 75;

  public fov = Camera.BASE_FOV;
  public moveInertia = vec3.create();
  public sensetivity = .1;
  public rotation = vec2.create();

  constructor(
    public aspect: number,
  ) {

    super();    

    mat4.perspective(
      this.projection,
      this.fov * (Math.PI / 180),
      aspect,
      0.1,
      Camera.FAR_POINT,
    );

    // const scale = 10;

    // mat4.ortho(
    //   this.projection,
    //   -scale, scale, 
    //   -scale, scale, 
    //   0.1, 100
    // );

  }

  get realtiveMovement() {

    let transition = [ 0, 0, 0 ] as vec3;

    const norm = vec3.normalize([ 0, 0, 0 ], vec3.sub([ 0, 0, 0 ], this.target, this.position));
    const cross = vec3.cross([ 0, 0, 0 ], [ 0, 1, 0 ], norm);

    const shift = [
      cross[ 0 ] * this.moveInertia[ Axis.X ] + norm[ 0 ] * this.moveInertia[ Axis.Y ],
      cross[ 1 ] * this.moveInertia[ Axis.X ] + norm[ 1 ] * this.moveInertia[ Axis.Y ],
      cross[ 2 ] * this.moveInertia[ Axis.X ] + norm[ 2 ] * this.moveInertia[ Axis.Y ],
    ] as vec3;

    shift[ Axis.Y ] += this.moveInertia[ Axis.Z ] * 10;

    vec3.add(this.target, this.target, shift);
    vec3.add(this.position, this.position, shift);

    return transition;

  }

  private move(speedFactor = 50) {

    for (let i = 0; i < this.moveInertia.length; i++) {
      this.moveInertia[ i ] = Math.max(Math.abs(this.moveInertia[ i ])
        - Math.abs(this.moveInertia[ i ]) / speedFactor, 0)
        * Math.sign(this.moveInertia[ i ])
        ;

      if (Math.abs(this.moveInertia[ i ]) < 0.0005) this.moveInertia[ i ] = 0;

    }

    const rel = this.realtiveMovement;

    vec3.add(this.position, this.position, rel);
    vec3.add(this.target, this.target, rel);

  }

  public movementHandler(movement: vec3) {

    vec3.add(this.moveInertia, this.moveInertia, movement.map(x => x * 0.015) as vec3);

    this.needsUpdate = true;

  }

  public rotate(rotation: Array<[ Axis, number ]>) {

    const newPos = [ 0, 0, 1 ] satisfies vec3;

    for (const [ axis, value ] of rotation) {

      this.rotation[ axis ] += value * this.sensetivity;

      switch (axis) {
        case Axis.X:
          this.rotation[ axis ] %= Math.PI * 2;
          break;
        case Axis.Y:
          this.rotation[ axis ] = Math.max(-1, Math.min(this.rotation[ axis ], 1));
          break;
      }

    }

    const yc = Math.cos(this.rotation[ Axis.Y ] * -1);
    const ys = Math.sin(this.rotation[ Axis.Y ] * -1);

    const xc = Math.cos(this.rotation[ Axis.X ]);
    const xs = Math.sin(this.rotation[ Axis.X ]);

    vec3.transformMat4(newPos, newPos, [
      xc, 0, xs, 0,
      0, yc, ys * -1, 0,
      xs * -1, ys, yc * xc, 0,
      0, 0, 0, 1,
    ]);

    vec3.set(this.target,
      this.position[ 0 ] + newPos[ 0 ],
      this.position[ 1 ] + newPos[ 1 ],
      this.position[ 2 ] + newPos[ 2 ],
    );

    // quat.rotateX(this.orientation, this.orientation, rotation[Axis.Y][1] * +1 * this.sensetivity);
    // quat.rotateY(this.orientation, this.orientation, rotation[Axis.X][1] * -1 * this.sensetivity);

    // this.target = vec3.add([0,0,0], this.position, vec3.transformQuat([0,0,0], [
    //   0,
    //   0,
    //   Camera.FAR_POINT,
    // ], this.orientation));

    this.needsUpdate = true;

  }

  public updatePerspective(fov: number = this.fov) {
    mat4.perspective(
      this.projection,
      (this.fov = fov) * (Math.PI / 180),
      this.aspect,
      0.1,
      Camera.FAR_POINT,
    );
  }

  public override update() {

    if (!this.needsUpdate) return;

    this.move();

    super.update();

  }

  public viewSort<T extends vec3>(arr: Array<T>) {

    const pos = this.position
    const tar = this.target

    const cur = vec3.normalize([ 0, 0, 0 ], vec3.sub([ 0, 0, 0 ], pos, tar));

    arr.sort((current, next) => {

      const a = vec3.dot(
        vec3.normalize([ 0, 0,0 ], vec3.sub([ 0, 0, 0 ], pos, current)),
        cur,
      );

      const b = vec3.dot(
        vec3.normalize([ 0, 0,0 ], vec3.sub([ 0, 0, 0 ], pos, next)),
        cur,
      );

      return a >= 0
        ? (b - a) - (vec3.dist(next, pos) - vec3.dist(current, pos)) / 120
        : 1
        ;

    });

  }

}