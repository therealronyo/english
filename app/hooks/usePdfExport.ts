"use client";

import { useState } from "react";
import { WordPair, PrintMode } from "../types";

const CARDS_PER_PAGE = 8;
const CARD_W = 95; // mm
const CARD_H = 65; // mm
const MARGIN = 10; // mm
const COLS = 2;
const ROWS = 4;

export function usePdfExport() {
  const [loading, setLoading] = useState(false);

  async function exportPdf(words: WordPair[], printMode: PrintMode) {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pages: WordPair[][] = [];
      for (let i = 0; i < words.length; i += CARDS_PER_PAGE) {
        pages.push(words.slice(i, i + CARDS_PER_PAGE));
      }

      pages.forEach((pageWords, pi) => {
        if (pi > 0) doc.addPage();

        drawPage(doc, pageWords, "front", printMode);

        if (printMode === "double") {
          doc.addPage();
          drawPage(doc, pageWords, "back", printMode);
        }
      });

      doc.save("flashcards.pdf");
    } finally {
      setLoading(false);
    }
  }

  return { exportPdf, loading };
}

function drawPage(doc: import("jspdf").jsPDF, words: WordPair[], side: "front" | "back", printMode: PrintMode) {
  const filled = [...words];
  while (filled.length < CARDS_PER_PAGE) filled.push({ id: "", english: "", hebrew: "" });

  for (let i = 0; i < CARDS_PER_PAGE; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const x = MARGIN + col * CARD_W;
    const y = MARGIN + row * CARD_H;

    // Card border (dashed)
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x, y, CARD_W, CARD_H);
    doc.setLineDashPattern([], 0);

    let word: WordPair;
    if (side === "back" && printMode === "double") {
      // Mirror columns for duplex printing alignment
      const mirroredCol = col === 0 ? 1 : 0;
      word = filled[row * COLS + mirroredCol];
    } else {
      word = filled[i];
    }

    const cx = x + CARD_W / 2;
    const cy = y + CARD_H / 2;

    if (side === "front" || printMode === "single") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(31, 41, 55);
      doc.text(word.english || "", cx, printMode === "single" && word.hebrew ? cy - 5 : cy, { align: "center", baseline: "middle" });

      if (printMode === "single" && word.hebrew) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(18);
        doc.setTextColor(67, 56, 202);
        doc.text(word.hebrew, cx, cy + 12, { align: "center", baseline: "middle" });
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(20);
      doc.setTextColor(67, 56, 202);
      doc.text(word.hebrew || "", cx, cy, { align: "center", baseline: "middle" });
    }
  }
}
