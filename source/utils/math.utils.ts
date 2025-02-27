export function permutations<
  T extends ArrayLike<number>
>(a: T, b: T): Array<T> {

  const len = a.length - 1;

  const result: Array<T> = [];

  for (let x = 0; x < len; x++) {
    for (let y = 0; y < len; y++) {
      for (let z = 0; z < len; z++) {

        const vertex = [
          x === 0 ? a[ 0 ] : b[ 0 ],
          y === 0 ? a[ 1 ] : b[ 1 ],
          z === 0 ? a[ 2 ] : b[ 2 ],
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