import "./orientation";
import "./utils";
import "./assets";
import { Renderer } from "../renderer/renderer.model";

namespace globalThis {
  var device: GPUDevice;
  var adapter: GPUAdapter;
  var context: GPUCanvasContext;
  var auctx: AudioContext;
  var renderer: Renderer;
}