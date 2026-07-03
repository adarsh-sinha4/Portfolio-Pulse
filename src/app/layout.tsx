import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Portfolio Pulse",
  description: "Client wealth-management dashboard for Relationship Managers",
};

// Set the theme class before paint to avoid a flash of the wrong theme.
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('pp-theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
