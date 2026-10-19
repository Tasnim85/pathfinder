import { NextResponse } from "next/server";
import { guard, requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX = 10 * 1024 * 1024;

export const POST = guard(async (req: Request) => {
  await requireUser("candidate");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file received." },
      { status: 400 }
    );
  }

  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return NextResponse.json(
      { error: "Only PDF files are accepted." },
      { status: 415 }
    );
  }

  if (file.size > MAX) {
    return NextResponse.json(
      { error: "The PDF is larger than 10 MB." },
      { status: 413 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  if (buf.subarray(0, 5).toString() !== "%PDF-") {
    return NextResponse.json(
      { error: "This file is not a valid PDF." },
      { status: 415 }
    );
  }

  console.log("[extract] Upload received:", {
    name: file.name,
    type: file.type,
    size: file.size,
    signature: buf.subarray(0, 8).toString("ascii"),
  });

  try {
    // pdf-parse 1.1.1
    // @ts-ignore pdf-parse's legacy internal module
   const { PDFParse } = await import("pdf-parse");

const parser = new PDFParse({ data: buf });

let result;

try {
  result = await parser.getText();
} finally {
  await parser.destroy();
}
    console.log("[extract] PDF parsed:", {
      pages: result.numpages,
      textLength: result.text?.length ?? 0,
    });

    const clean = String(result.text ?? "")
      .replace(/\u0000/g, " ")
      .trim();

    const n = clean ? clean.split(/\s+/).length : 0;

    if (n < 15) {
      return NextResponse.json(
        {
          error:
            "No readable text found. Scanned PDFs are not supported yet: upload a text-based PDF or paste your CV text.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: clean,
      n_words: n,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    console.error("[extract] PDF parsing failed:", e);

    const hint = /password|encrypt/i.test(msg)
      ? "The PDF is password-protected."
      : "The PDF could not be read (damaged or unusual format).";

    return NextResponse.json(
      {
        error: `${hint} Check the server terminal for details.`,
      },
      { status: 422 }
    );
  }
});
