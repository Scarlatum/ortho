// import { SceneInterface } from "../interfaces/scene.interface";
import { Axis, Camera } from "../renderer/camera/camera.model";
import { clampedSinEasing } from "../utils/easing.utils";

type Buttons = Record<KeyboardEvent[ 'code' ], boolean>;

export class Actor {

  public maxSpeed = 3;
  public acceleration = 0;
  public motionState = false;

  public buttons: Buttons = {
    "KeyW": false,
    "KeyS": false,
    "KeyD": false,
    "KeyA": false,
  };

  constructor(public camera: Camera) {
    this.applyListeners(window);
  }

  get movementSpeed(): number {
    return this.maxSpeed * Math.max(clampedSinEasing(this.acceleration), 0.025);
  }

  public keyboardHandler(e: KeyboardEvent, active: boolean) {
    this.buttons[ e.code ] = active;
  }

  public mouseMoveHandler(e: MouseEvent) {

    if (e.shiftKey) return;

    this.camera.rotate([
      [ Axis.X, e.movementX * (Math.PI / 180) ],
      [ Axis.Y, e.movementY * (Math.PI / 180) ],
    ]);

  }

  public mouseWheelHandler(e: WheelEvent) {

    if (e.shiftKey) {
      this.camera.movementHandler([
        0.00,
        0.00,
        Math.sign(e.deltaY) * -1,
      ]);
    } else {
      this.camera.updatePerspective(this.camera.fov + Math.sign(e.deltaY));
    }

  }

  public update() {

    this.camera.movementHandler([
      this.buttons[ "KeyD"  ]
        ? -this.movementSpeed : this.buttons[ "KeyA" ]
          ? this.movementSpeed : 0,
      this.buttons[ "KeyS" ]
        ? -this.movementSpeed : this.buttons[ "KeyW" ]
          ? this.movementSpeed : 0,
      0,
    ]);

    this.camera.update();

    if (this.motionState === false) {
      this.acceleration = Math.max(0.25, this.acceleration - 0.0075);
    }

  }

  applyListeners(target: HTMLCanvasElement | Window = window) {

    target.addEventListener("keydown", (e) => {
      this.keyboardHandler(e as KeyboardEvent, true);
      this.acceleration = Math.min(0.5, this.acceleration + 0.0075);
      this.motionState = true;
    });

    target.addEventListener("keyup", (e) => {
      this.keyboardHandler(e as KeyboardEvent, false);
      this.motionState = false;
    });

    target.addEventListener("wheel", (e) => {
      this.mouseWheelHandler(e as WheelEvent);
    });

    target.addEventListener("mousemove", (e) => {
      this.mouseMoveHandler(e as MouseEvent);
    });

  }

}