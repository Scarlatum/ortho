export function clampedSinEasing(x: number) {
  return Math.sin(Math.max(0, Math.min(1, x)) * Math.PI - Math.PI / 2) / 2 + .5;
}