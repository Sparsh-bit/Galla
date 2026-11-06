import type { Document, Types } from "mongoose";

// What a value looks like after JSON.stringify → JSON.parse, so API clients get the types they
// actually receive: ObjectIds and Dates become strings, Mongoose arrays become plain arrays and
// document internals disappear. Internals are stripped only from real Mongoose documents
// (sub-documents inside lean results), never from plain objects that happen to use the same
// key names (e.g. an `errors` list).

type DocumentInternals = Exclude<keyof Document, "_id">;
type Fn = (...args: never[]) => unknown;

type PlainObject<T> = { [K in keyof T as K extends `$${string}` ? never : T[K] extends Fn ? never : K]: Json<T[K]> };
type MongooseDoc<T> = { [K in keyof T as K extends DocumentInternals | `$${string}` ? never : T[K] extends Fn ? never : K]: Json<T[K]> };

export type Json<T> = T extends string | number | boolean | null
  ? T
  : T extends undefined
    ? undefined
    : T extends Date
      ? string
      : T extends Types.ObjectId
        ? string
        : T extends Types.Decimal128
          ? string
          : T extends Fn
            ? never
            : T extends ReadonlyArray<infer U>
              ? Json<U>[]
              : T extends Map<string, infer V>
                ? Record<string, Json<V>>
                : T extends Document
                  ? MongooseDoc<T>
                  : T extends object
                    ? PlainObject<T>
                    : T;
