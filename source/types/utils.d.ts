type Nullable<T> = T | null;

type DereferencedObjectValues<O extends object> = {
  [ K in keyof O ]: O[K] extends Nullable<WeakRef<infer V>> 
    ? V 
    : O[K]
}