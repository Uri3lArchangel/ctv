import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crack The Vault",
  description:
    "Crack The Vault is a Web3 puzzle game where players collaborate to unlock digital vaults and share rewards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-white">
        {children}
      </body>
    </html>
  );
}
