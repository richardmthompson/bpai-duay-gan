import type { Metadata, Viewport } from "next";
import { Kanit, Sora, Unbounded } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { ServiceWorker } from "@/components/ServiceWorker";
import { Toasts } from "@/components/Toasts";
import "./globals.css";

const latin = Sora({ variable: "--font-sans-latin", subsets: ["latin"] });
const display = Unbounded({ variable: "--font-display-latin", subsets: ["latin"], weight: ["600", "700", "800"] });
const thai = Kanit({ variable: "--font-sans-thai", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "ไปด้วยกัน Bpai Dûay Gan",
  description: "Meet the other half of Chiang Mai: Thai locals and foreigners trading what they know, chatting in their own languages.",
  applicationName: "Bpai Dûay Gan",
  appleWebApp: { capable: true, title: "ไปด้วยกัน", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#efdfc9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${latin.variable} ${display.variable} ${thai.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppProvider>
          {children}
          <Toasts />
        </AppProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
