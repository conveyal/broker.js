/**
 * Interface file for BitSet (https://www.npmjs.com/package/bitset)
 * @author mattwigway
 * See http://flowtype.org/docs/advanced-configuration.html for information on interface files.
 */

 declare class BitSet {
  constructor (wordLength: number): void;
  set (pos: number): void;
 	get (pos: number): boolean;
  clear (pos: number): void;
  wordLength (): number;
  cardinality (): number;
  toString (): string;
  toBinaryString (): string;
  or (bitset: BitSet): void;
  and (bitset: BitSet): void;
  andNot (bitset: BitSet): void;
  xor (bitset: BitSet): void;
 };