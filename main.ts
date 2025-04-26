import { NodeCanvasFactory } from "canvasFactory";
import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	loadPdfJs,
} from "obsidian";

interface PDFPrinterSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: PDFPrinterSettings = {
	mySetting: "default",
};

type PDFDocumentBuffer = {
	fileName: string;
	pages: PDFPage[];
};

type PDFPage = {
	pageNumber: number;
	buffer: ArrayBuffer;
};

export default class MyPlugin extends Plugin {
	settings: PDFPrinterSettings;

	async onload() {
		console.log("loading plugin");
		await this.loadSettings();

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		this.addCommand({
			id: "convert-pdf-to-images",
			name: "Convert PDF to images",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selectedText = editor.getSelection();
				const pdfFile = this.fetchFileFromMdPath(selectedText);
				if (!pdfFile) {
					return;
				}
				const fileBufferArray = await this.parsePDF(pdfFile);
				const imagePathList = await this.convertPDFBufferToImages({
					fileName: pdfFile.name,
					pages: fileBufferArray,
				});

				editor.replaceSelection(
					imagePathList
						.map((imagePath) => `![[${imagePath}]]`)
						.join("\n")
				);
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
		console.log("unloading pdf printer plugin");
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
	 * Takes the path of a file and returns the TFile object if it exists in the vault.
	 * If the file is not found, it returns null.
	 * @param path path to the file (either just the name or the full path)
	 * @returns File object if it exists, null otherwise
	 */
	private fetchVaultFile(path: string): TFile | null {
		return this.app.metadataCache.getFirstLinkpathDest(path, "");
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
		const file = this.fetchVaultFile(filePath);
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
	async parsePDF(file: TFile): Promise<PDFPage[]> {
		const pdfjs = await loadPdfJs();
		const arrayBuffer = await this.app.vault.adapter.readBinary(file.path);
		const buffer = new Uint8Array(arrayBuffer);
		const document = await pdfjs.getDocument(buffer).promise;

		const pages: number = document.numPages;
		let pdfBuffer: PDFPage[] = [];

		for (let i = 1; i <= pages; i++) {
			const page = await document.getPage(i);
			const viewport = page.getViewport({ scale: 2 });
			const canvasFactory = new NodeCanvasFactory();
			const { canvas, context } = canvasFactory.create(
				viewport.width,
				viewport.height,
				false
			);
			if (!canvas || !context) {
				console.error("could not generate canvas or context");
				return [];
			}
			await page.render({ canvasContext: context, viewport }).promise;
			const blob = await new Promise<Blob | null>((resolve) => {
				/** @ts-ignore because toBlob exists, but is not found */
				canvas.toBlob(resolve, "image/png");
			});

			if (blob) {
				pdfBuffer.push({
					pageNumber: i,
					buffer: await blob.arrayBuffer(), // Store base64 string (binary data)
				});
			} else {
				console.error(`could not generate blob for page ${i}`);
			}
		}

		return pdfBuffer;
	}

	/**
	 * Converts a PDF page buffer to a PNG file and saves it in the vault.
	 * @param page The PDF page buffer to convert.
	 * @param pageNumber The page number of the PDF.
	 * @returns The path of the saved PNG file.
	 */
	private async convertPDFBufferToImages(
		pdfBuffer: PDFDocumentBuffer
	): Promise<string[]> {
		const writeTasks = pdfBuffer.pages.map(async (page) => {
			const name = `${pdfBuffer.fileName}-${page.pageNumber}.png`;
			await this.app.vault.createBinary(name, page.buffer);
			return name;
		});
		return Promise.all(writeTasks);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
