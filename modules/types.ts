export interface PdfPrinterSettings {
	imageFolder: string;
	imageQuality: number;
	imageEmbedFormat: string;
	preservePdfLink: boolean;
}

export type PdfDocumentBuffer = {
	fileName: string;
	pages: PdfPage[];
};

export type PdfPage = {
	pageNumber: number;
	buffer: ArrayBuffer;
};
