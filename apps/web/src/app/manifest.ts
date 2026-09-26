import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ไปด้วยกัน Bpai Duay Gan",
    short_name: "ไปด้วยกัน",
    description: "Thai locals and foreigners in Chiang Mai, trading what they know and chatting in their own languages.",
    start_url: "/",
    // The QR code points at /install; this is the identity of the installed app on the device.
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7faf8",
    theme_color: "#0b5a44",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
