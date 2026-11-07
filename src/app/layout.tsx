import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nobi Vision",
  description: "Voice-first electronics copilot for Nobi Robotics. The camera watches the bench. Nobi talks you through the next step.",
  applicationName: "Nobi Vision",
};

export const viewport: Viewport = {
  themeColor: "#07080b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
