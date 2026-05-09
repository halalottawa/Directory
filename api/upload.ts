import { put } from '@vercel/blob';
import sharp from 'sharp';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const filenameStr = req.query.filename || `upload-${Date.now()}`;
    const cleanNameStr = filenameStr.replace(/\.[^/.]+$/, "");
    const cleanName = cleanNameStr.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'upload';
    const filename = `${cleanName}.webp`;

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: "No file content received" });
    }

    const procBuffer = await sharp(buffer)
      .webp({ quality: 90, effort: 6 })
      .toBuffer();

    const blob = await put(filename, procBuffer, {
      access: 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error: any) {
    console.error("Vercel Blob Upload Error:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}

