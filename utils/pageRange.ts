import { flatten, parse } from "multi-integer-range";

export function parsePageRange(input: string, pageCount: number): number[] {
	const ranges = parse(input);
	if (
		/\d\s+\d/.test(input) ||
		!ranges.length ||
		ranges.some(([start, end]) => start < 1 || end > pageCount)
	) {
		throw new Error("Invalid page range");
	}
	return flatten(ranges);
}
