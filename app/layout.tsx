import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Own your spot - Add Your Website to the Island",
  description: "Choose a building, add your website, and get featured on Island.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
