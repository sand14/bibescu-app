import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Author } from "next/dist/lib/metadata/types/metadata-types";

const inter = Inter({ subsets: ["latin"] });

const author: Author = {
  name: "Avrigeanu Sebastian"
}

export const metadata: Metadata = {
  title: "Calculator Bibescu",
  description: "Calculator distante puncte",
  authors: author
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-900 text-slate-100 min-h-screen`}>
        <header className="fixed top-0 left-0 right-0 h-14 z-50 bg-slate-900 border-b border-slate-700 flex items-center px-5">
          <span className="text-lg mr-2 select-none">✈</span>
          <span className="text-base font-semibold tracking-tight text-slate-100">Calculator Bibescu</span>
        </header>
        <main className="pt-14">{children}</main>
      </body>
    </html>
  );
}
