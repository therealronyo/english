"use client";

import { useState } from "react";
import { WordPair, PrintMode } from "./types";
import WordInput from "./components/WordInput";
import FlashcardGrid from "./components/FlashcardGrid";
import { usePdfExport } from "./hooks/usePdfExport";

export default function Home() {
  const [words, setWords] = useState<WordPair[]>([
    { id: "1", english: "apple", hebrew: "תפוח" },
    { id: "2", english: "dog", hebrew: "כלב" },
    { id: "3", english: "house", hebrew: "בית" },
    { id: "4", english: "book", hebrew: "ספר" },
  ]);
  const [printMode, setPrintMode] = useState<PrintMode>("single");
  const { exportPdf, loading } = usePdfExport();

  const validWords = words.filter((w) => w.english.trim() || w.hebrew.trim());

  return (
    <div className="min-h-screen bg-[#f8f7ff]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-700">✏️ Flashcard Maker</h1>
            <p className="text-sm text-gray-400">English ↔ Hebrew · Print-ready A4</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Print mode toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setPrintMode("single")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  printMode === "single"
                    ? "bg-white shadow text-indigo-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Single-sided
              </button>
              <button
                onClick={() => setPrintMode("double")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  printMode === "double"
                    ? "bg-white shadow text-indigo-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Double-sided
              </button>
            </div>

            {/* Export button */}
            <button
              onClick={() => exportPdf(validWords, printMode)}
              disabled={loading || validWords.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Generating…
                </>
              ) : (
                <>📄 Export PDF</>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">
        {/* Left: input */}
        <div className="sticky top-8">
          <WordInput words={words} onChange={setWords} />
          <p className="text-xs text-gray-400 mt-3 text-center">
            {validWords.length} word{validWords.length !== 1 ? "s" : ""} ·{" "}
            {Math.ceil(validWords.length / 8)} page{Math.ceil(validWords.length / 8) !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Right: preview */}
        <FlashcardGrid words={validWords} printMode={printMode} />
      </main>
    </div>
  );
}
