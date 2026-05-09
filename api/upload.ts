import { put } from '@vercel/blob';

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
    const filename = req.query.filename || `upload-${Date.now()}.jpg`;

    const blob = await put(filename, req, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error: any) {
    console.error("Vercel Blob Upload Error:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}
