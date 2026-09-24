import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediaPipe Vision Lens & LLM Intelligence",
  description: "Real-time object tracking and LLM multimodal reasoning in Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#030712] text-slate-100 min-h-screen flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
