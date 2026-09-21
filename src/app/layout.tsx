import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CodeRoom — Code together. Anywhere.",
  description: "A lightweight collaborative coding room for teams, classmates, and friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('coderoom_theme');
                  var root = document.documentElement;
                  root.classList.remove('dark', 'light', 'theme-cyber', 'theme-forest');
                  if (saved === 'light') {
                    root.classList.add('light');
                  } else if (saved === 'cyber') {
                    root.classList.add('dark', 'theme-cyber');
                  } else if (saved === 'forest') {
                    root.classList.add('dark', 'theme-forest');
                  } else {
                    root.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen selection:bg-accent/30 selection:text-white transition-colors duration-200`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
