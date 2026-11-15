// Human refs (D-0068) are allocated on the device from a per-device block so two
// offline devices never issue the same number: device 1 → 1000–1999, device 2 → 2000–2999…
// Imported rows keep their spreadsheet entry numbers (2–67), which sit below every block.

export const REF_BLOCK_SIZE = 1000;

export function blockRange(block: number): [number, number] {
  if (!Number.isInteger(block) || block < 1) throw new Error(`Invalid ref block ${block}`);
  return [block * REF_BLOCK_SIZE, block * REF_BLOCK_SIZE + REF_BLOCK_SIZE - 1];
}

/** Next free ref number in this device's block, given every ref number already in use. */
export function nextRefNo(used: Iterable<number>, block: number): number {
  const [lo, hi] = blockRange(block);
  let max = lo - 1;
  for (const n of used) if (n >= lo && n <= hi && n > max) max = n;
  if (max >= hi) throw new Error(`Ref block ${block} is full`);
  return max + 1;
}
