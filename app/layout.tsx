import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Preset Web Editor",
  description: "Browser-based preset asset editor",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}