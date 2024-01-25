/** Get types of the values of a record. */
export type ValueOf<T extends Record<any, any>> = T[keyof T];
