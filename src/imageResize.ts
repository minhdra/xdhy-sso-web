// Downsample in steps so large photos and vector icons stay crisp at small sizes.
export async function resizeImage(
  file: File,
  size: number,
  fit: 'contain' | 'cover',
  format: 'image/png' | 'image/webp',
): Promise<Blob> {
  const image = await createImageBitmap(file);
  try {
    let source: CanvasImageSource = image;
    let sourceX = 0;
    let sourceY = 0;
    let width = image.width;
    let height = image.height;
    if (fit === 'cover') {
      const side = Math.min(width, height);
      sourceX = (width - side) / 2;
      sourceY = (height - side) / 2;
      width = side;
      height = side;
    }
    const scale = Math.min(size / width, size / height);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    let sourceWidth = width;
    let sourceHeight = height;

    while (Math.max(width / targetWidth, height / targetHeight) > 2) {
      const nextWidth = Math.max(targetWidth, Math.round(width / 2));
      const nextHeight = Math.max(targetHeight, Math.round(height / 2));
      const step = document.createElement('canvas');
      step.width = nextWidth;
      step.height = nextHeight;
      const context = step.getContext('2d');
      if (!context) throw new Error('Không thể xử lý ảnh.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, nextWidth, nextHeight);
      source = step;
      sourceX = 0;
      sourceY = 0;
      sourceWidth = nextWidth;
      sourceHeight = nextHeight;
      width = nextWidth;
      height = nextHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Không thể xử lý ảnh.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight,
      (size - targetWidth) / 2, (size - targetHeight) / 2, targetWidth, targetHeight);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Không thể xuất ảnh.')),
      format,
      format === 'image/webp' ? 0.9 : undefined,
    ));
  } finally {
    image.close();
  }
}
