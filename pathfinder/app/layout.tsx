import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "PathFinder — Finding the right career path", description: "Upload your CV or speak about your background. A team of AI agents ranks the job offers that fit you, and shows why." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
  </head><body className="min-h-screen">{children}</body></html>);
}
