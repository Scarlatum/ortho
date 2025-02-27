type Nullable<T> = T | null;
type Result<T> = T | Error;

type Deref<O extends object> = {
  [ K in keyof O ]: O[K] extends Nullable<WeakRef<infer V>> 
    ? V 
    : O[K]
}