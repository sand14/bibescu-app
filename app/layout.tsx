import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Author } from "next/dist/lib/metadata/types/metadata-types";
import { AuthProvider } from "./context/AuthContext";
import NavbarAuth from "./components/NavbarAuth";
import AuthModal from "./components/AuthModal";
import ReportsModal from "./components/ReportsModal";
import Toast from "./components/Toast";

const inter = Inter({ subsets: ["latin"] });

const author: Author = {
  name: "Avrigeanu Sebastian",
};

export const metadata: Metadata = {
  title: "Calculator Bibescu",
  description: "Calculator distante puncte",
  authors: author,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-900 text-slate-100 min-h-screen`}>
        <AuthProvider>
          <header className="fixed top-0 left-0 right-0 h-14 z-40 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center">
              <span className="text-lg mr-2 select-none">✈</span>
              <span className="text-base font-semibold tracking-tight text-slate-100">Calculator Bibescu</span>
            </div>
            <NavbarAuth />
          </header>
          <main className="pt-14">{children}</main>
          <AuthModal />
          <ReportsModal />
          <Toast />
        </AuthProvider>
      </body>
    </html>
  );
}
