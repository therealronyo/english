"use client";

import { WordPair, PrintMode } from "../types";

interface Props {
  words: WordPair[];
  printMode: PrintMode;
}

const CARDS_PER_PAGE = 8;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export default function PrintView({ words, printMode }: Props) {
  const pages = chunk(words, CARDS_PER_PAGE);

  return (
    <div id="print-root" className="hidden">
      {pages.map((pageWords, pi) => {
        const filled = [...pageWords];
        while (filled.length < CARDS_PER_PAGE) filled.push({ id: `e${filled.length}`, english: "", hebrew: "" });

        return (
          <div key={pi}>
            {/* Front side */}
            <div
              className="print-page"
              style={{
                width: "210mm",
                minHeight: "297mm",
                padding: "10mm",
                boxSizing: "border-box",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "repeat(4, 1fr)",
                gap: "0",
                pageBreakAfter: printMode === "double" ? "always" : "auto",
              }}
            >
              {filled.map((word, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px dashed #ccc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "8px",
                  }}
                >
                  {printMode === "single" ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "28px", fontWeight: 700, fontFamily: "Inter, sans-serif", color: "#1f2937" }}>
                        {word.english}
                      </div>
                      {word.hebrew && (
                        <div style={{ fontSize: "22px", fontWeight: 500, fontFamily: "Heebo, sans-serif", color: "#4338ca", direction: "rtl", marginTop: "4px" }}>
                          {word.hebrew}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: "28px", fontWeight: 700, fontFamily: "Inter, sans-serif", color: "#1f2937", textAlign: "center" }}>
                      {word.english}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Back side (double only) */}
            {printMode === "double" && (
              <div
                className="print-page"
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  padding: "10mm",
                  boxSizing: "border-box",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gridTemplateRows: "repeat(4, 1fr)",
                  gap: "0",
                  pageBreakAfter: "always",
                }}
              >
                {/* Mirror columns for duplex alignment */}
                {[...filled].map((_, i) => {
                  const col = i % 2;
                  const row = Math.floor(i / 2);
                  const mirroredCol = col === 0 ? 1 : 0;
                  const mirroredIndex = row * 2 + mirroredCol;
                  const word = filled[mirroredIndex];
                  return (
                    <div
                      key={i}
                      style={{
                        border: "1px dashed #ccc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "8px",
                      }}
                    >
                      <div style={{ fontSize: "28px", fontWeight: 500, fontFamily: "Heebo, sans-serif", color: "#4338ca", direction: "rtl", textAlign: "center" }}>
                        {word?.hebrew}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
