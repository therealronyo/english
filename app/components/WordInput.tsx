"use client";

import { useState } from "react";
import { WordPair } from "../types";

interface Props {
  words: WordPair[];
  onChange: (words: WordPair[]) => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function WordInput({ words, onChange }: Props) {
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  function addRow() {
    onChange([...words, { id: generateId(), english: "", hebrew: "" }]);
  }

  function removeRow(id: string) {
    onChange(words.filter((w) => w.id !== id));
  }

  function updateRow(id: string, field: "english" | "hebrew", value: string) {
    onChange(words.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  }

  function handleBulkImport() {
    const pairs = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [english = "", hebrew = ""] = line.split(",").map((s) => s.trim());
        return { id: generateId(), english, hebrew };
      });
    onChange([...words, ...pairs]);
    setBulkText("");
    setShowBulk(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Word List</h2>
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {showBulk ? "Manual entry" : "Bulk import"}
        </button>
      </div>

      {showBulk ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            One word pair per line, formatted as: <code className="bg-gray-100 px-1 rounded">english, hebrew</code>
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            placeholder={"apple, תפוח\ndog, כלב\nhouse, בית"}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={handleBulkImport}
            disabled={!bulkText.trim()}
            className="w-full bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Import words
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 mb-2 px-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">English</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">עברית</span>
          </div>

          {words.map((word) => (
            <div key={word.id} className="grid grid-cols-2 gap-3 items-center group">
              <input
                type="text"
                value={word.english}
                onChange={(e) => updateRow(word.id, "english", e.target.value)}
                placeholder="English word"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={word.hebrew}
                  onChange={(e) => updateRow(word.id, "hebrew", e.target.value)}
                  placeholder="מילה בעברית"
                  dir="rtl"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={() => removeRow(word.id)}
                  className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addRow}
            className="mt-3 w-full border-2 border-dashed border-gray-200 text-gray-400 rounded-xl py-2 text-sm hover:border-indigo-300 hover:text-indigo-400 transition-colors"
          >
            + Add word
          </button>
        </div>
      )}
    </div>
  );
}
