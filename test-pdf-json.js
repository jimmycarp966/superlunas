const PDFParser = require("pdf2json");
const fs = require("fs");
const path = require("path");

const pdfPath = path.join(__dirname, "LISTA DE PRECIO LOCAL TACO RALO CATAMARCA.pdf");
const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync("test-pdf-data.json", JSON.stringify(pdfData, null, 2));
    console.log("JSON exportado a test-pdf-data.json");
});

pdfParser.loadPDF(pdfPath);
