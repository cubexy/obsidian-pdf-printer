import { Canvas, createCanvas, CanvasRenderingContext2D } from "canvas";

type CanvasWithContext = {
	canvas: Canvas | null;
	context: CanvasRenderingContext2D | null;
};

export class NodeCanvasFactory {
	create(
		width: number,
		height: number,
		transparent: boolean
	): CanvasWithContext {
		const canvas = createCanvas(width, height);
		const context = canvas.getContext("2d", { alpha: transparent });
		if (transparent) context.clearRect(0, 0, width, height);
		return {
			canvas,
			context,
		};
	}

	reset(
		canvasAndContext: CanvasWithContext,
		width: number,
		height: number
	): void {
		if (!canvasAndContext.canvas) {
			throw new Error("Canvas is not specified");
		}
		if (!canvasAndContext.context) {
			throw new Error("Context is not specified");
		}
		canvasAndContext.canvas.width = width;
		canvasAndContext.canvas.height = height;
	}

	destroy(canvasAndContext: CanvasWithContext) {
		if (!canvasAndContext.canvas) {
			throw new Error("Canvas is not specified");
		}
		if (!canvasAndContext.context) {
			throw new Error("Context is not specified");
		}
		canvasAndContext.canvas.width = 0;
		canvasAndContext.canvas.height = 0;
		canvasAndContext.canvas = null;
		canvasAndContext.context = null;
	}
}
