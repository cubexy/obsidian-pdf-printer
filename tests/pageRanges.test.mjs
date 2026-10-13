import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pageRange.ts"], bundle: true, write: false, format: "esm",
});
const { parsePageRange } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("parses page ranges in document order without duplicates", () => {
	for (const [input, expected] of [
		["2-4", [2, 3, 4]], ["2-5, 7", [2, 3, 4, 5, 7]],
		["7", [7]], [" 2 - 4 , 7 ", [2, 3, 4, 7]],
		["7, 2-4, 3-5, 7", [2, 3, 4, 5, 7]], ["4-2", [2, 3, 4]],
	]) assert.deepEqual(parsePageRange(input, 8), expected);
});

test("rejects empty, malformed and out-of-bounds ranges before expansion", () => {
	for (const input of [
		"", " ", "abc", "2.5", "1 2", "1,,2", "1,", ",1", "-1", "2-", "1-2-3",
		"0", "0-2", "9", "2-9", "1-999999999999", "9007199254740992",
	]) assert.throws(() => parsePageRange(input, 8), Error, input);
});
