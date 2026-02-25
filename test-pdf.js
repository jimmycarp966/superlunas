const PDFParser = require("pdf2json");
const fs = require("fs");
const path = require("path");

const pdfPath = path.join(__dirname, "LISTA DE PRECIO LOCAL TACO RALO CATAMARCA.pdf");
const pdfParser = new PDFParser(null, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", () => {
    const text = pdfParser.getRawTextContent();
    const lines = text.split("\n").filter(l => l.trim().length > 0).slice(0, 50);
    console.log("--- PRIMERAS 50 LINEAS ---");
    lines.forEach((l, i) => console.log(`${i}: ${JSON.stringify(l)}`));
});

pdfParser.loadPDF(pdfPath);
