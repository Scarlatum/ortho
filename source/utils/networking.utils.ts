export async function parallelFetch<K>(urls: Array<[ K, URL ]>) {

  const result = new Set<{ name: K, res: ArrayBuffer }>();

  const barrier = new Set<Promise<any>>();

  for ( let i = 0; i < urls.length; i++ ) {

    const x = {
      name: urls[i][0],
      res: Object(),
    }

    result.add(x);

    barrier.add(fetch(urls[i][1])
      .then(result => result.arrayBuffer())
      .then(buffer => x.res = buffer)
    );

  }

  await Promise.all(barrier);

  return result;

}