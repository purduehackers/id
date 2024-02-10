import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Space_Grotesk, Space_Mono } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={`${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <Component {...pageProps} />;
    </main>
  );
}
