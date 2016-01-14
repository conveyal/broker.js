/**
 * Interface file for Multimap (https://www.npmjs.com/package/multimap)
 * @author mattwigway
 */

declare class Multimap<K, V> {
  size: number;
  get(key: K): V;
  has(key: K): boolean;
  set(key: K, val: V): Multimap<K, V>; // returns this
  delete(key: K): boolean;
  forEach(cb: (val: V, key: K, map: Multimap<K, V>) => mixed, thisArg?: any): void;
  keys(): Iterator<K>;
  values: Iterator<V>;
}