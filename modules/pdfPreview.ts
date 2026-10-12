import {
	Editor,
	MarkdownPostProcessorContext,
	MarkdownSectionInformation,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
} from "obsidian";

type PdfEmbedTarget = {
	view: MarkdownView;
	file: TFile;
	from: number;
	to: number;
};
type PdfEmbedWidget = { start: number; end: number; sourcePath: string };

// Keep native-view compatibility details out of the PDF conversion pipeline
export function registerPdfPreview(
	plugin: Plugin,
	printPdf: (file: TFile) => Promise<string | null>,
): void {
	const { app } = plugin;
	const contexts = new WeakMap<
		HTMLElement,
		{ context: MarkdownPostProcessorContext; container: HTMLElement }
	>();
	const printingFiles = new Set<string>();
	let clickedEmbed: HTMLElement | null = null;

	plugin.registerMarkdownPostProcessor((el, context) => {
		el.querySelectorAll<HTMLElement>(".internal-embed").forEach((embed) =>
			contexts.set(embed, { context, container: el }),
		);
	});
	const rememberEmbed = (event: MouseEvent) => {
		clickedEmbed =
			event.target instanceof Element &&
			event.target.closest(
				".markdown-reading-view, .markdown-source-view",
			)
				? event.target.closest<HTMLElement>(".internal-embed")
				: null;
	};
	plugin.registerDomEvent(document, "click", rememberEmbed, true);
	plugin.registerDomEvent(document, "contextmenu", rememberEmbed, true);
	plugin.registerEvent(
		app.workspace.on("file-menu", (menu, file, source) => {
			const embed = clickedEmbed;
			if (
				source !== "link-context-menu" ||
				!embed ||
				!(file instanceof TFile) ||
				file.extension.toLowerCase() !== "pdf"
			)
				return;
			menu.addItem((item) =>
				item
					.setTitle("Print PDF")
					.setIcon("printer")
					.onClick(() => printEmbed(file, embed)),
			);
		}),
	);

	async function getTarget(
		embed: HTMLElement,
		pdf: TFile,
	): Promise<PdfEmbedTarget | null> {
		const view = app.workspace
			.getLeavesOfType("markdown")
			.map((leaf) => leaf.view)
			.find(
				(view): view is MarkdownView =>
					view instanceof MarkdownView &&
					view.containerEl.contains(embed),
			);
		if (!view?.file) return null;
		const file = view.file;
		const rendered = contexts.get(embed);
		const context = rendered?.context;
		// Nested note embeds belong to a different source document
		if (context && context.sourcePath !== file.path) return null;
		const source =
			view.getMode() === "source"
				? view.editor.getValue()
				: await app.vault.read(file);
		let start: number;
		let end: number;
		let container: HTMLElement;
		if (view.getMode() === "source") {
			// Live Preview widgets can sit after the source link :() use their own range
			const node = embed as HTMLElement & {
				cmTile?: { widget?: PdfEmbedWidget };
				cmView?: { widget?: PdfEmbedWidget };
			};
			const widget = node.cmTile?.widget ?? node.cmView?.widget;
			if (widget && widget.start >= 0 && widget.end > widget.start) {
				if (widget.sourcePath !== file.path) return null;
				start = widget.start;
				end = widget.end;
				container = embed;
			} else {
				const cm = (
					view.editor as Editor & {
						cm?: { posAtDOM(node: Node, offset?: number): number };
					}
				).cm;
				container =
					embed.closest<HTMLElement>(".cm-embed-block") ?? embed;
				if (!cm) return null;
				try {
					start = cm.posAtDOM(container);
					end = cm.posAtDOM(container, container.childNodes.length);
				} catch {
					return null;
				}
				if (end === start) {
					end = source.indexOf("\n", start);
					if (end === -1) end = source.length;
				}
			}
		} else {
			// Already-rendered notes have no postprocessor context after plugin reload
			const renderer = (
				view.previewMode as typeof view.previewMode & {
					renderer?: {
						getSectionInfo(
							el: HTMLElement,
						): MarkdownSectionInformation | null;
						getSectionForElement(
							el: HTMLElement,
						): { el: HTMLElement } | null;
					};
				}
			).renderer;
			const section =
				context?.getSectionInfo(embed) ??
				renderer?.getSectionInfo(embed);
			const sectionEl =
				rendered?.container ??
				renderer?.getSectionForElement(embed)?.el;
			if (!sectionEl || !section || section.text !== source) return null;
			const lines = source.split("\n");
			start = lines
				.slice(0, section.lineStart)
				.reduce((sum, line) => sum + line.length + 1, 0);
			end =
				start +
				lines.slice(section.lineStart, section.lineEnd + 1).join("\n")
					.length;
			container = sectionEl;
		}
		const link = embed.getAttribute("src");
		const siblings = Array.from(
			container.querySelectorAll<HTMLElement>(".internal-embed"),
		).filter((el) => el.getAttribute("src") === link);
		const ordinal = container === embed ? 0 : siblings.indexOf(embed);
		const matches = (
			app.metadataCache.getFileCache(file)?.embeds ?? []
		).filter(
			(entry) =>
				entry.position.start.offset >= start &&
				entry.position.end.offset <= end &&
				entry.link === link,
		);
		if (matches.length !== (container === embed ? 1 : siblings.length))
			return null;
		const match = matches[ordinal];
		if (
			!match ||
			app.metadataCache.getFirstLinkpathDest(
				match.link.split("#")[0],
				file.path,
			)?.path !== pdf.path
		)
			return null;
		const from = match.position.start.offset;
		const to = match.position.end.offset;
		if (source.slice(from, to) !== match.original) return null;
		return { view, file, from, to };
	}

	async function printEmbed(file: TFile, embed: HTMLElement): Promise<void> {
		if (printingFiles.has(file.path)) return;
		printingFiles.add(file.path);
		try {
			const target = await getTarget(embed, file);
			if (!target) {
				new Notice("Could not locate this PDF embed in the note.");
				return;
			}
			const text = await printPdf(file);
			if (text === null) return;
			const replacement = text.replace(/^\n/, "");
			if (
				target.view.getMode() === "source" &&
				target.view.file === target.file
			) {
				const editor = target.view.editor;
				editor.replaceRange(
					replacement,
					editor.offsetToPos(target.from),
					editor.offsetToPos(target.to),
				);
			} else {
				await app.vault.process(
					target.file,
					(source) =>
						source.slice(0, target.from) +
						replacement +
						source.slice(target.to),
				);
			}
			new Notice(`Document '${file.name}' was printed successfully.`);
		} catch (error) {
			console.error("pdf-printer: failed to print PDF preview", error);
			new Notice(
				`Could not print '${file.name}'. See the console for details.`,
			);
		} finally {
			printingFiles.delete(file.path);
		}
	}
}
