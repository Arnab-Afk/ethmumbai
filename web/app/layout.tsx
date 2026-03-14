import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Bitcount_Prop_Double_Ink } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const bitcountPropDoubleInk = Bitcount_Prop_Double_Ink({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bitcount",
  display: "swap",
});

export const metadata: Metadata = {
  title: "D3PLOY — Web3 Vercel",
  description: "A censorship-resistant deployment platform where sites live on IPFS, resolve through ENS, and cannot be governed by any single entity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} ${bitcountPropDoubleInk.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
