const fs = require("fs");
const pdf = require("pdf-parse");

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node test-pdf.cjs "path/to/cv.pdf"');
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);

  try {
    const result = await pdf(buffer);

    console.log("PDF parsed successfully");
    console.log("Pages:", result.numpages);
    console.log("PDF.js version:", result.version);
    console.log("Extracted text length:", result.text.length);
    console.log("Text preview:", result.text.slice(0, 500));
  } catch (error) {
    console.error("PDF parsing failed:", error);
  }
}

main();