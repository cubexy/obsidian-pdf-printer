import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/formatPrintedPages.ts"], bundle: true, write: false, format: "esm",
});
const { formatPrintedPages } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

const settings = {
	imageEmbedFormat: "![[${filename}]]",
	preservePdfLink: false,
	newlineBetweenPages: false,
};

test("formats image embeds in their original order with default settings", () => {
	const result = formatPrintedPages(
		"lecture.pdf",
		["lecture-2.webp", "lecture-7.webp"],
		settings,
	);

	assert.equal(result, "\n![[lecture-2.webp]]\n![[lecture-7.webp]]");
});

test("adds a blank line between images when enabled", () => {
	const result = formatPrintedPages(
		"lecture.pdf",
		["lecture-2.webp", "lecture-7.webp"],
		{ ...settings, newlineBetweenPages: true },
	);

	assert.equal(result, "\n![[lecture-2.webp]]\n\n![[lecture-7.webp]]");
});
