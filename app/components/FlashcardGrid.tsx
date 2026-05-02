"use client";

import { WordPair, PrintMode } from "../types";

interface Props {
  words: WordPair[];
  printMode: PrintMode;
}

const CARDS_PER_PAGE = 8; // 2x4 grid

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function Card({ word, side }: { word: WordPair; side: "front" | "back" }) {
  return (
    <div className="relative border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-white aspect-[3/2]">
      {side === "front" ? (
        <span className="text-2xl font-bold text-gray-800 tracking-wide px-2 text-center" style={{ fontFamily: "Inter, sans-serif" }}>
          {word.english || "…"}
        </span>
      ) : (
        <span className="text-2xl font-semibold text-indigo-700 px-2 text-center" dir="rtl" style={{ fontFamily: "Heebo, sans-serif" }}>
          {word.hebrew || "…"}
        </span>
      )}
    </div>
  );
}

function Page({ cards, side }: { cards: WordPair[]; side: "front" | "back" }) {
  const filled = [...cards];
  while (filled.length < CARDS_PER_PAGE) {
    filled.push({ id: `empty-${filled.length}`, english: "", hebrew: "" });
  }

  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 p-4 w-full">
      <div className="grid grid-cols-2 gap-3">
        {filled.map((word, i) => (
          <Card key={word.id + i} word={word} side={side} />
        ))}
      </div>
      <p className="text-center text-xs text-gray-300 mt-3">
        {side === "front" ? "Side A — English" : "Side B — Hebrew"} · Cut along dashed lines
      </p>
    </div>
  );
}

export default function FlashcardGrid({ words, printMode }: Props) {
  if (words.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-3">🃏</div>
        <p className="text-gray-400 text-sm">Add words on the left to see your flashcards here.</p>
      </div>
    );
  }

  const pages = chunk(words, CARDS_PER_PAGE);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Preview</h2>
      {pages.map((pageWords, i) => (
        <div key={i} className="space-y-3">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Page {i + 1}</p>
          <Page cards={pageWords} side="front" />
          {printMode === "double" && <Page cards={pageWords} side="back" />}
          {printMode === "single" && (
            <div className="bg-white rounded-xl shadow border border-gray-100 p-4 w-full">
              <div className="grid grid-cols-2 gap-3">
                {[...pageWords, ...Array(CARDS_PER_PAGE - pageWords.length).fill({ id: "e", english: "", hebrew: "" })].map((word, j) => (
                  <div
                    key={j}
                    className="relative border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center bg-white aspect-[3/2] gap-1 px-2"
                  >
                    <span className="text-xl font-bold text-gray-800 text-center" style={{ fontFamily: "Inter, sans-serif" }}>
                      {word.english || ""}
                    </span>
                    {word.hebrew && (
                      <span className="text-base font-medium text-indigo-500 text-center" dir="rtl" style={{ fontFamily: "Heebo, sans-serif" }}>
                        {word.hebrew}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-gray-300 mt-3">Single-sided · Cut along dashed lines</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
