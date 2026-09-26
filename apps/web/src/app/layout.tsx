import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { Toasts } from "@/components/Toasts";
import "./globals.css";

const latin = Inter({ variable: "--font-sans-latin", subsets: ["latin"] });
const thai = Noto_Sans_Thai({ variable: "--font-sans-thai", subsets: ["thai"] });

export const metadata: Metadata = {
  title: "ไปด้วยกัน Bpai Duay Gan",
  description: "Meet the other half of Chiang Mai: Thai locals and foreigners trading what they know, chatting in their own languages.",
  applicationName: "Bpai Duay Gan",
  appleWebApp: { capable: true, title: "ไปด้วยกัน", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7faf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1714" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${latin.variable} ${thai.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppProvider>
          {children}
          <Toasts />
        </AppProvider>
      </body>
    </html>
  );
}
