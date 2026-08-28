import type { Metadata } from "next";
import { GoogleAnalytics } from "./component/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Island city - an ai buddy on your mac",
  description: "Download heyclicky for Mac.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
