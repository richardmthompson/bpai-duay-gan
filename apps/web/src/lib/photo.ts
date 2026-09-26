// Profile photos are shrunk on the phone before upload: at most 512px on the long side, JPEG at
// 0.85. Redrawing through a canvas also drops the EXIF block, so GPS data in the original never
// leaves the device. The upload is tens of kilobytes rather than the megabytes a camera writes.

export const AVATAR_MAX_SIDE = 512;
const QUALITY = 0.85;

/** Thrown when the browser cannot read the file as an image (a PDF, a text file, a format it lacks). */
export class PhotoDecodeError extends Error {}

type Drawable = { source: CanvasImageSource; width: number; height: number; release(): void };

async function decode(file: Blob): Promise<Drawable> {
  // createImageBitmap applies the EXIF orientation when asked, so a portrait taken sideways stays
  // upright. Older Safari lacks it or the option; an <img> also honours orientation by default.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // fall through to <img>, which also tells a real decode failure apart from a missing option
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoDecodeError("could not decode image");
  }
}

/** Decodes, scales so the long side is at most 512px, and re-encodes as JPEG. */
export async function resizePhoto(file: Blob): Promise<Blob> {
  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new PhotoDecodeError("empty image");
    const scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d canvas");
    // JPEG has no transparency: a transparent PNG would otherwise turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) throw new Error("could not encode JPEG");
    return blob;
  } finally {
    img.release();
  }
}
