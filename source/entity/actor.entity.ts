// import { SceneInterface } from "../interfaces/scene.interface";
import { vec3 } from "gl-matrix";
import { SceneInterface } from "../interfaces/scene.interface";
import { Axis, Camera } from "../renderer/camera/camera.model";
import { clampedSinEasing } from "../utils/easing.utils";

type Buttons = Record<KeyboardEvent[ 'code' ], boolean>;

export class Actor {

  public maxSpeed = parseInt(localStorage.getItem("ortho::actor::maxSpeed") || "1");
  public acceleration = 0;
  public motionState = false;
  
  public buttons: Buttons = {
    "KeyW": false,
    "KeyS": false,
    "KeyD": false,
    "KeyA": false,
  };

  constructor({ renderer }: SceneInterface, public camera: Camera) {

    this.applyListeners(window);

    this.camera.hooks.add(() => this.update());

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

    if (e.shiftKey) this.camera.movementHandler([
      0.00,
      0.00,
      Math.sign(e.deltaY) * -0.15,
    ]);
    
    else this.camera.fov += Math.sign(e.deltaY);

  }

  public update() {

    const moveVector = [
      this.buttons[ "KeyD"  ]
        ? -this.movementSpeed : this.buttons[ "KeyA" ]
          ? this.movementSpeed : 0,
      this.buttons[ "KeyS" ]
        ? -this.movementSpeed : this.buttons[ "KeyW" ]
          ? this.movementSpeed : 0,
      0,
    ];

    const activeVectors = moveVector.reduce((a,c) => a + Math.abs(Math.sign(c)), 0) === 1
      ? 1
      : Math.SQRT2
      ;

    this.camera.movementHandler(moveVector.map(x => (x * 0.015) / activeVectors) as vec3);
    
    if (this.motionState === false) {
      this.acceleration = Math.max(0.25, this.acceleration - 0.0075);
    }

  }

  applyListeners(target: HTMLCanvasElement | Window = window) {

    target.addEventListener("keydown", (e) => {
      
      this.keyboardHandler(e as KeyboardEvent, true);

      if ( Object.values(this.buttons).some(x => x) ) {
        this.acceleration = Math.min(0.5, this.acceleration + 0.0075);
        this.motionState = true;
      }

    }, { passive: true });

    target.addEventListener("keyup", (e) => {

      this.keyboardHandler(e as KeyboardEvent, false);

      if ( Object.values(this.buttons).every(x => x) ) {
        this.motionState = false;
      }

    }, { passive: true });

    target.addEventListener("wheel", (e) => {
      this.mouseWheelHandler(e as WheelEvent);
    }, { passive: true });

    target.addEventListener("mousemove", (e) => {
      this.mouseMoveHandler(e as MouseEvent);
    }, { passive: true });

    {

      let last: Nullable<Touch> = null;

      (target as Window).addEventListener("touchmove", event => {
  
        const current = event.targetTouches[0];
  
        if ( last ) {
          this.camera.rotate([
            [ Axis.X, (last.screenX - current.screenX) * (Math.PI / 180) ],
            [ Axis.Y, (last.screenY - current.screenY) * (Math.PI / 180) ],
          ]);
        }
  
        last = event.targetTouches[0];
  
      }, { passive: true });
  
      (target as Window).addEventListener("touchend", () => {
        last = null;
      });

    }

  }

}