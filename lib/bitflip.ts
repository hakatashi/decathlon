const POPCOUNT_TABLE = (() => {
	const table = new Uint8Array(256);
	for (let i = 1; i < 256; i++) {
		table[i] = (i & 1) + table[i >> 1];
	}
	return table;
})();

/**
 * Counts the number of bitflips (bitwise Hamming distance) between two binaries.
 * If the lengths differ, all the bits in the exceeding part are counted as flipped.
 */
export const countBitflips = (original: Uint8Array, submitted: Uint8Array) => {
	const commonLength = Math.min(original.length, submitted.length);
	let bitflips = Math.abs(original.length - submitted.length) * 8;
	for (let i = 0; i < commonLength; i++) {
		bitflips += POPCOUNT_TABLE[original[i] ^ submitted[i]];
	}
	return bitflips;
};
