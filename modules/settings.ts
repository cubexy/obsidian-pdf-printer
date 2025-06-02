import PdfPrinterPlugin from "main";
import { PluginSettingTab, App, Setting, normalizePath } from "obsidian";
import { FolderSuggest } from "utils/suggest/folderSuggest";
import { PdfPrinterSettings } from "./types";

export const DEFAULT_SETTINGS: PdfPrinterSettings = {
	imageFolder: "",
	imageQuality: 0.5,
	imageEmbedFormat: "![[${filename}]]",
	preservePdfLink: false,
};

export class PdfPrinterSettingsTab extends PluginSettingTab {
	plugin: PdfPrinterPlugin;

	constructor(app: App, plugin: PdfPrinterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Image quality")
			.setDesc(
				"Quality of the printed images. Higher values result in better quality but larger file sizes."
			)
			.addSlider((cb) => {
				cb.setLimits(0, 1, 0.01)
					.setValue(this.plugin.settings.imageQuality)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.imageQuality = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(this.containerEl)
			.setName("Printed image folder path")
			.setDesc("Place printed images from PDFs in this folder.")
			.addSearch((cb) => {
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder("Example: folder1/folder2")
					.setValue(this.plugin.settings.imageFolder)
					.onChange(async (new_folder) => {
						this.plugin.settings.imageFolder =
							normalizePath(new_folder);
						await this.plugin.saveSettings();
					});
			});

		new Setting(this.containerEl)
			.setName("Show link to original PDF above printed images")
			.setDesc(
				"Keep a link to the original PDF above the printed images as a reference."
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.preservePdfLink).onChange(
					async (value) => {
						this.plugin.settings.preservePdfLink = value;
						await this.plugin.saveSettings();
					}
				);
			});

		new Setting(this.containerEl)
			.setName("Image embed format")
			.setDesc(
				"Format for embedding images in the markdown file. Use ${filename} as a placeholder for the image file name."
			)
			.addText((cb) => {
				cb.setPlaceholder("![[${filename}]]")
					.setValue(this.plugin.settings.imageEmbedFormat)
					.onChange(async (value) => {
						this.plugin.settings.imageEmbedFormat = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
