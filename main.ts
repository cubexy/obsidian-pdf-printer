import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	moment,
} from "obsidian";
import { Options, pdf } from "pdf-to-img";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		console.log("loading plugin");
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"hier klicken!",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("ich liebe dich");
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "convert-pdf-to-images",
			name: "Convert PDF to images",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selectedText = editor.getSelection();
				const pdfFile = this.fetchFileFromMdPath(selectedText);
				if (!pdfFile) {
					return;
				}
				const pngFiles = await this.parsePDF(pdfFile, { scale: 2 });
				editor.replaceSelection(
					pngFiles.map((f) => `![[${f}]]`).join("\n")
				);
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	onunload() {
		console.log("unloading plugin");
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

	private checkPathInput(input: string): string | null {
		const matches = input.match(/!\[\[([^\]]+)\]\]/); // match ![[something]], -> something (capture group 1)
		if (matches && matches[1]) {
			return matches[1];
		}
		return null;
	}

	private fetchVaultFile(path: string): TFile | null {
		const vaultFiles = this.app.vault.getFiles();
		const file =
			vaultFiles.find((f) => f.path === path) ??
			vaultFiles.find((f) => f.path.contains(path)); // we attempt to find the file by path, if that fails we try to find it by substring
		if (!file) {
			new Notice(`File not found: ${path}.`);
			return null;
		}
		return file;
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

	async parsePDF(file: TFile, options: Options): Promise<string[]> {
		const document = await pdf(file.path, options);
		let i = 1;
		let fileNames: string[] = [];
		for await (const image of document) {
			const newFile = await this.app.vault.createBinary(
				file.basename + `2img-${i}.png`,
				image
			);
			i++;
			fileNames.push(newFile.path);
		}
		return fileNames;
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
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
