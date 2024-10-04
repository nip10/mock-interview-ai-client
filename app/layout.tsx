import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Mock Interview",
  description: "Practise your interview skills with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="w-full min-h-screen antialiased">{children}</body>
    </html>
  );
}
