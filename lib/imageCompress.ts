export type CompressOptions = {
  /** Maximum width or height in pixels */
  maxSide?: number
  /** 0..1 for lossy formats like JPEG/WebP */
  quality?: number
  /** Output mime type. Default: image/jpeg */
  mimeType?: string
}

function stripExtension(name: string) {
  return name.replace(/\.(png|jpg|jpeg|webp|heic|heif)$/i, "")
}

/**
 * Resize + compress an image file on the client.
 * If anything fails (unsupported format, browser limitation), returns the original file.
 */
export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxSide = opts.maxSide ?? 1600
  const quality = opts.quality ?? 0.75
  const mimeType = opts.mimeType ?? "image/jpeg"

  // Only attempt for images
  if (!file.type?.startsWith("image/")) return file

  try {
    // Decode
    const bitmap = await createImageBitmap(file)

    const { width, height } = bitmap
    const scale = Math.min(1, maxSide / Math.max(width, height))
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    // If no resizing needed and already reasonably small, still recompress for size reduction
    const canvas = document.createElement("canvas")
    canvas.width = targetW
    canvas.height = targetH

    const ctx = canvas.getContext("2d")
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        mimeType,
        quality,
      )
    })

    const outExt = mimeType === "image/webp" ? ".webp" : ".jpg"
    const outName = `${stripExtension(file.name || "photo")}${outExt}`

    return new File([blob], outName, { type: blob.type || mimeType, lastModified: Date.now() })
  } catch {
    return file
  }
}
