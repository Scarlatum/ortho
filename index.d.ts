/// <reference types="./source/types/utils.d.ts" />
/// <reference types="./source/types/orientation.d.ts" />
/// <reference types="./source/types/assets.d.ts" />
/// <reference types="./source/types/meta.d.ts" />
/// <reference types="./source/types/memory.d.ts" />

interface ObjectConstructor {
  entries<const R extends Record<unknown,unknown>>(o: R): Array<[ keyof R, R[keyof R] ]>;
}