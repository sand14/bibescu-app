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
      <body className={inter.className}>{children}</body>
    </html>
  );
}
