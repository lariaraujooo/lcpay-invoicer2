import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { DemoBanner } from "@/components/DemoBanner";
import { Header } from "@/components/Header";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LC Culture Store — Demonstração LC Pay",
  description:
    "Loja interna de demonstração para testar a integração de pagamentos Pix com a API da LC Pay.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-lc-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
        >
          Pular para o conteúdo
        </a>
        <DemoBanner />
        <Header />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border-subtle bg-surface-card">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-text-muted sm:px-6">
            LC Culture Store — aplicação interna de demonstração e testes. Sem finalidade
            comercial. Integração via API LC Pay.
          </div>
        </footer>
      </body>
    </html>
  );
}
