import { BrowserCanvasFactory } from "utils/canvas/canvasFactory";
import {
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	loadPdfJs,
} from "obsidian";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_SETTINGS, PdfPrinterSettingsTab } from "modules/settings";
import { PdfDocumentBuffer, PdfPage, PdfPrinterSettings } from "modules/types";

export default class PdfPrinterPlugin extends Plugin {
	settings: PdfPrinterSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "convert-pdf-to-images",
			name: "Convert PDF to images",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selectedText = editor.getSelection();
				const pdfFile = this.fetchFileFromMdPath(selectedText);
				if (!pdfFile) {
					return;
				}
				new Notice(`Printing document '${pdfFile.name}'...`);
				const fileBufferArray = await this.parsePdf(pdfFile);
				const imagePathList = await this.convertPdfBufferToImages({
					fileName: pdfFile.basename,
					pages: fileBufferArray,
				});

				if (imagePathList.length === 0) {
					new Notice(
						"No images could be generated from the document."
					);
					return;
				}

				const imageLinks = imagePathList
					.map((imagePath) =>
						this.settings.imageEmbedFormat.replace(
							"${filename}",
							imagePath
						)
					)
					.join("\n");

				const replacementText = this.settings.preservePdfLink
					? `[[${pdfFile.path}]]\n${imageLinks}`
					: `\n${imageLinks}`;

				editor.replaceSelection(replacementText);

				new Notice(
					`Document '${pdfFile.name}' was printed successfully.`
				);
			},
		});
		this.addSettingTab(new PdfPrinterSettingsTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Checks if the input string adheres to the format ![[something]].
	 * @param input the string to parse
	 * @description checks if the input is a valid file path
	 * @returns found file path (something) or null
	 */
	private checkPathInput(input: string): string | null {
		const matches = input.match(/!\[\[([^\]]+)\]\]/); // match ![[something]], -> something (capture group 1)
		if (matches && matches[1]) {
			return matches[1];
		}
		return null;
	}

	/**
	 * attempts to parse a string as a file path
	 * @param input the string to parse
	 * @returns the file if it is a valid file path, null otherwise
	 */
	private fetchFileFromMdPath(input: string): TFile | null {
		const path = input.trim();
		if (!path) {
			new Notice("Please select a valid PDF file link.");
			return null;
		}
		const filePath = this.checkPathInput(path);
		if (!filePath) {
			new Notice(
				`Invalid file path: ${path}. Please highlight a valid PDF file ![[link.pdf]].`
			);
			return null;
		}
		const file = this.app.metadataCache.getFirstLinkpathDest(filePath, "");
		if (!file) {
			new Notice(`File not found: ${filePath}.`);
			return null;
		}
		if (file.extension !== "pdf") {
			new Notice(`File is not a PDF: ${filePath}.`);
			return null;
		}
		return file;
	}

	/**
	 * Parses a given TFile object (PDF) and converts it to PNG images.
	 * The images are saved in the vault and their paths are returned as an array of strings.
	 * @param file The TFile object representing the PDF file to be parsed.
	 * @description The function uses the pdfjs library to convert the PDF to images.
	 * @throws Error if the canvas or context cannot be created.
	 * @returns An array of strings representing the paths of the saved PNG images.
	 */
	async parsePdf(file: TFile): Promise<PdfPage[]> {
		const pdfjs = await loadPdfJs();
		const arrayBuffer = await this.app.vault.readBinary(file);
		const buffer = new Uint8Array(arrayBuffer);
		const document = await pdfjs.getDocument(buffer).promise;

		const pages: number = document.numPages;
		let pdfBuffer: PdfPage[] = [];

		for (let i = 1; i <= pages; i++) {
			const page = await document.getPage(i);
			const viewport = page.getViewport({ scale: 2 });
			const canvasFactory = new BrowserCanvasFactory();
			const { canvas, context } = canvasFactory.create(
				viewport.width,
				viewport.height,
				false
			);
			if (!canvas || !context) {
				console.error(
					"pdf-printer: could not generate canvas or context"
				);
				return [];
			}
			await page.render({ canvasContext: context, viewport }).promise;
			const blob = await new Promise<Blob | null>((resolve) => {
				/** @ts-ignore because toBlob exists, but is not found */
				canvas.toBlob(
					resolve,
					"image/webp",
					this.settings.imageQuality
				);
			});

			if (blob) {
				pdfBuffer.push({
					pageNumber: i,
					buffer: await blob.arrayBuffer(),
				});
			} else {
				console.error(
					`pdf-printer: could not generate blob for page ${i}`
				);
			}
			canvasFactory.destroy({ canvas, context });
		}

		return pdfBuffer;
	}

	/**
	 * Converts a PDF page buffer to a PNG file and saves it in the vault.
	 * @param page The PDF page buffer to convert.
	 * @param pageNumber The page number of the PDF.
	 * @returns The path of the saved PNG file.
	 */
	private async convertPdfBufferToImages(
		pdfBuffer: PdfDocumentBuffer
	): Promise<string[]> {
		let uuid = uuidv4();
		while (
			this.app.vault.getFileByPath(
				`${this.settings.imageFolder}/${uuid}`
			) !== null
		) {
			uuid = uuidv4(); // if folder already exists (???), generate a new uuid
		}
		await this.app.vault.createFolder(
			`${this.settings.imageFolder}/${uuid}`
		);
		const writeTasks = pdfBuffer.pages.map(async (page) => {
			const fileName = `${pdfBuffer.fileName}-${page.pageNumber}.webp`;
			const fullPath = `${this.settings.imageFolder}/${uuid}/${fileName}`;
			await this.app.vault.createBinary(fullPath, page.buffer);
			return fileName;
		});
		return Promise.all(writeTasks);
	}
}
