import { Ortho } from "ortho"

export const enum Axis { X, Y, Z };
export const enum CameraView { Front, Up, Right };

export type SharedObserverBuffer = { buffer: GPUBuffer, index: number };

const enum MatrixSize {
  SIDE = 4,
  WHOLE = SIDE * SIDE,
  DOUBLE = WHOLE * 2
}

export class Observer {

  static BUFFER_SIZE = MatrixSize.DOUBLE;
  static BUFFER_TYPE = Float32Array;
  static BUFFER_STRIDE = 4 * 4 * Float32Array.BYTES_PER_ELEMENT;

  #buffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 12);
  #sendBuffer = new Float32Array(Observer.BUFFER_SIZE);

  static UP: Ortho.vec3 = [ 0, 1, 0 ];
  static FAR_POINT = 1000;

  protected needsUpdate: boolean = true;
  protected matrix = Array<Ortho.vec3>();

  public readonly direction = new Float32Array(this.#buffer,Float32Array.BYTES_PER_ELEMENT * 9,3);
  public readonly moveVector = new Float32Array(this.#buffer,Float32Array.BYTES_PER_ELEMENT * 6,3);
  public readonly position = new Float32Array(this.#buffer,Float32Array.BYTES_PER_ELEMENT * 3,3);
  public readonly target = new Float32Array(this.#buffer,0,3);
  public projection = new Float32Array(this.#sendBuffer.buffer, 0, 16) as Ortho.mat4;
  public gbuffer: Nullable<GPUBuffer>;


  constructor(protected child?: Observer, protected shared: Nullable<SharedObserverBuffer> = null) {

    if ( shared === null ) this.gbuffer = device.createBuffer({
      label: `Observer matrixes ${ crypto.randomUUID() }`,
      size: Observer.BUFFER_TYPE.BYTES_PER_ELEMENT * Observer.BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    else this.gbuffer = null;

    this.matrix[ CameraView.Front ] = [0,0,0];
    this.matrix[ CameraView.Up    ] = [0,0,0];
    this.matrix[ CameraView.Right ] = [0,0,0];

    Ortho.vec3.scale(this.target, this.target, Observer.FAR_POINT);

  }

  public update() {

    Ortho.vec3.normalize(this.direction, Ortho.vec3.subtract([0,0,0], this.target, this.position));
    
    Ortho.vec3.normalize(this.matrix[ CameraView.Front ], Ortho.vec3.sub(this.matrix[ CameraView.Front ], this.position, this.target));

    Ortho.vec3.cross(this.matrix[ CameraView.Right ], Camera.UP, this.matrix[ CameraView.Front ]);

    Ortho.vec3.normalize(this.matrix[ CameraView.Up ], Ortho.vec3.cross(this.matrix[ CameraView.Up ], this.matrix[ CameraView.Front ], this.matrix[ CameraView.Right ]));
    Ortho.vec3.normalize(this.matrix[ CameraView.Right ], this.matrix[ CameraView.Right ]);

    const tx = Ortho.vec3.dot(this.position, this.matrix[ CameraView.Right ]);
    const ty = Ortho.vec3.dot(this.position, this.matrix[ CameraView.Up ]);
    const tz = Ortho.vec3.dot(this.position, this.matrix[ CameraView.Front ]);

    // ? For some reason here is an array allocation over and over. 
    // ? I shound pack all of that vectors together in one memory chunk later.
    this.#sendBuffer.set([
      this.matrix[ CameraView.Right ][ Axis.X ], this.matrix[ CameraView.Up ][ Axis.X ], this.matrix[ CameraView.Front ][ Axis.X ], 0,
      this.matrix[ CameraView.Right ][ Axis.Y ], this.matrix[ CameraView.Up ][ Axis.Y ], this.matrix[ CameraView.Front ][ Axis.Y ], 0,
      this.matrix[ CameraView.Right ][ Axis.Z ], this.matrix[ CameraView.Up ][ Axis.Z ], this.matrix[ CameraView.Front ][ Axis.Z ], 0,
      -tx, -ty, -tz, 1,
    ], MatrixSize.WHOLE);

    const buffer = this.shared === null 
      ? this.gbuffer as GPUBuffer
      : this.shared!.buffer
      ;

    const offset = this.shared === null 
      ? 0 
      : device.limits.minStorageBufferOffsetAlignment * this.shared.index

    device.queue.writeBuffer(
      buffer, 
      offset, 
      this.#sendBuffer
    );

    this.child?.update();

  }

}

export class Camera extends Observer {

  static BASE_FOV = 75;

  #fov = Camera.BASE_FOV;
  #aspect = 16 / 9;

  public sensetivity = .1;
  public rotation = Ortho.vec2.create();
  public hooks = new Set<(i: Camera) => void>();

  constructor(aspect: number) {

    super();   

    this.#aspect = aspect;
    
    this.target.set([0,0,10]);

    Ortho.mat4.perspective(
      this.projection,
      this.fov * (Math.PI / 180),
      aspect,
      0.1,
      Camera.FAR_POINT,
    );

  }

  async [ Symbol.asyncDispose ]() {
    throw Error("TODO: THE RESOURCE CLEAN IMPL")
  }

  get realtiveMovement() {

    let transition = [ 0, 0, 0 ] as Ortho.vec3;

    const norm = Ortho.vec3.normalize([ 0, 0, 0 ], Ortho.vec3.sub([ 0, 0, 0 ], this.target, this.position));
    const cross = Ortho.vec3.cross([ 0, 0, 0 ], [ 0, 1, 0 ], norm);

    const shift = [
      cross[ 0 ] * this.moveVector[ Axis.X ] + norm[ 0 ] * this.moveVector[ Axis.Y ],
      cross[ 1 ] * this.moveVector[ Axis.X ] + norm[ 1 ] * this.moveVector[ Axis.Y ],
      cross[ 2 ] * this.moveVector[ Axis.X ] + norm[ 2 ] * this.moveVector[ Axis.Y ],
    ] as Ortho.vec3;

    shift[ Axis.Y ] += this.moveVector[ Axis.Z ] * 10;

    Ortho.vec3.add(this.target, this.target, shift);
    Ortho.vec3.add(this.position, this.position, shift);

    return transition;

  }

  get fov() { return this.#fov }
  get aspect() { return this.#aspect }

  set fov(value: number) {
    Ortho.mat4.perspective(
      this.projection,
      (this.#fov = value) * (Math.PI / 180),
      this.aspect,
      0.1,
      Camera.FAR_POINT,
    );
  }

  set aspect(value: number) {
    Ortho.mat4.perspective(
      this.projection,
      this.fov * (Math.PI / 180),
      this.#aspect = value,
      0.1,
      Camera.FAR_POINT,
    );
  }

  private move(speedFactor = 50) {

    for (let i = 0; i < this.moveVector.length; i++) {
      this.moveVector[ i ] = Math.max(Math.abs(this.moveVector[ i ])
        - Math.abs(this.moveVector[ i ]) / speedFactor, 0)
        * Math.sign(this.moveVector[ i ])
        ;

      if (Math.abs(this.moveVector[ i ]) < 0.0005) this.moveVector[ i ] = 0;

    }

    const rel = this.realtiveMovement;

    Ortho.vec3.add(this.position, this.position, rel);
    Ortho.vec3.add(this.target, this.target, rel);

  }

  public movementHandler(movement: Ortho.vec3) {

    Ortho.vec3.add(this.moveVector, this.moveVector, movement);

    this.needsUpdate = true;

  }

  public rotate(rotation: Array<[ Axis, number ]>) {

    const newPos = [ 0, 0, 1 ] satisfies Ortho.vec3;

    for (const [ axis, value ] of rotation) {

      this.rotation[ axis ] += value * (this.sensetivity * (this.fov / 75.0));

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

    Ortho.vec3.transformMat4(newPos, newPos, [
      xc, 0, xs, 0,
      0, yc, ys * -1, 0,
      xs * -1, ys, yc * xc, 0,
      0, 0, 0, 1,
    ]);

    Ortho.vec3.set(this.target,
      this.position[ 0 ] + newPos[ 0 ],
      this.position[ 1 ] + newPos[ 1 ],
      this.position[ 2 ] + newPos[ 2 ],
    );

    // quat.rotateX(this.orientation, this.orientation, rotation[Axis.Y][1] * +1 * this.sensetivity);
    // quat.rotateY(this.orientation, this.orientation, rotation[Axis.X][1] * -1 * this.sensetivity);

    // this.target = OrthoTypes.vec3.add([0,0,0], this.position, OrthoTypes.vec3.transformQuat([0,0,0], [
    //   0,
    //   0,
    //   Camera.FAR_POINT,
    // ], this.orientation));

    this.needsUpdate = true;

  }

  public override update() {

    if (this.needsUpdate === false) return;

    this.move();

    for ( const x of this.hooks ) x(this);

    super.update();

  }

  public onFront<T extends Ortho.vec3>(arr: Array<T>) {
    return arr.some(x => 0 <= Ortho.vec3.dot(
      Ortho.vec3.normalize([0,0,0], Ortho.vec3.sub([0,0,0], x, this.position)),
      this.direction,
    ));
  }

}