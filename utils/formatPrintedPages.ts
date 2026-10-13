import type { PdfPrinterSettings } from "../modules/types";

export function formatPrintedPages(
	pdfPath: string,
	imagePaths: string[],
	settings: Pick<
		PdfPrinterSettings,
		"imageEmbedFormat" | "preservePdfLink" | "newlineBetweenPages"
	>,
): string {
	const newline = settings.newlineBetweenPages ? "\n\n" : "\n";
	const imageLinks = imagePaths.map((path) =>
		settings.imageEmbedFormat.replace("${filename}", path),
	).join(newline);
	return settings.preservePdfLink
		? `[[${pdfPath}]]\n${imageLinks}`
		: `\n${imageLinks}`;
}
