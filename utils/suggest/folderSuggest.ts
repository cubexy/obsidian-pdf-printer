import { AbstractInputSuggest, App, Setting } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<string> {
	private folders: string[];

	constructor(app: App, public inputEl: HTMLInputElement) {
		super(app, inputEl);
		// Get all folders and include root folder
		this.folders = ["/"].concat(
			this.app.vault.getAllFolders().map((folder) => folder.path)
		);
	}

	getSuggestions(inputStr: string): string[] {
		const inputLower = inputStr.toLowerCase();
		return this.folders.filter((folder) =>
			folder.toLowerCase().includes(inputLower)
		);
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.createEl("div", { text: folder });
	}

	selectSuggestion(folder: string): void {
		this.inputEl.value = folder;
		const event = new Event("input");
		this.inputEl.dispatchEvent(event);
		this.close();
	}
}
