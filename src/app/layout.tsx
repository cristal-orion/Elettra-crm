import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Elettra S.r.l.",
  description: "Cruscotto di controllo — anagrafiche, commesse, acquisti.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
