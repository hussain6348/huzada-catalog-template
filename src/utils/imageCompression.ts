import imageCompression from 'browser-image-compression';

async function processCompression(file: File, maxSizeMB: number, maxWidthOrHeight: number, prefix: string): Promise<File> {
  const compressedBlob = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.9 
  });
  const safeName = `${Date.now()}-${prefix}.webp`;
  return new File([compressedBlob], safeName, { type: 'image/webp' });
}

export const compressHero = (file: File) => processCompression(file, 0.5, 1920, 'hero');
export const compressService = (file: File) => processCompression(file, 0.2, 1080, 'service');
export const compressLogo = (file: File) => processCompression(file, 0.1, 512, 'logo');
