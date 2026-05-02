import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Flashcards",
  description: "Generate printable English-Hebrew flashcards for kids",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f8f7ff]">{children}</body>
    </html>
  );
}
