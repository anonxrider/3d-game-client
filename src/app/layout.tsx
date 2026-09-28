import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ethera — Multiplayer Neighborhood",
  description: "Explore a shared neighborhood with friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
