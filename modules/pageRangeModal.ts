import { App, Modal, Notice, Setting } from "obsidian";
import { parsePageRange } from "utils/pageRange";

class PageRangeModal extends Modal {
	private pages: number[] | null = null;

	constructor(
		app: App,
		private pageCount: number,
		private resolve: (pages: number[] | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Print PDF page ranges");
		let value = "";
		const submit = () => {
			try {
				this.pages = parsePageRange(value, this.pageCount);
			} catch {
				new Notice(`Enter pages between 1 and ${this.pageCount}, for example: 2-5, 7.`);
				return;
			}
			this.close();
		};
		new Setting(this.contentEl)
			.setName(`Pages (1–${this.pageCount})`)
			.addText((text) => {
				text.setPlaceholder("2-5, 7").onChange((input) => { value = input; });
				text.inputEl.setAttribute("aria-label", "Page ranges");
				text.inputEl.focus();
			});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) => button.setButtonText("Print").setCta().onClick(submit));
		this.scope.register([], "Enter", () => { submit(); return false; });
	}

	onClose(): void {
		this.resolve(this.pages);
	}
}

export function promptForPageRange(app: App, pageCount: number): Promise<number[] | null> {
	return new Promise((resolve) => new PageRangeModal(app, pageCount, resolve).open());
}
