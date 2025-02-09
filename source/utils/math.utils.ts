export function permutations<
  T extends ArrayLike<number>
>(point1: T, point2: T): Array<T> {

  const len = point1.length - 1;

  const result: Array<T> = [];

  for (let x = 0; x < len; x++) {
    for (let y = 0; y < len; y++) {
      for (let z = 0; z < len; z++) {

        const vertex = [
          x === 0 ? point1[ 0 ] : point2[ 0 ],
          y === 0 ? point1[ 1 ] : point2[ 1 ],
          z === 0 ? point1[ 2 ] : point2[ 2 ],
        ] as unknown as T;

        result.push(vertex);

      }
    }
  }

  return result;

}

export function inRange(v: number, [ min, max ]: [ number, number ]) {
  return min <= v && v <= max;
}