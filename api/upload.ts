import { put } from '@vercel/blob';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const filename = req.query.filename || `upload-${Date.now()}.jpg`;

    // Upload directly to Vercel Blob from the request stream
    const blob = await put(filename, req, {
      access: 'public',
    });

    return res.status(200).json({ url: blob.url });
  } catch (error: any) {
    console.error("Vercel Blob Upload Error:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}

// Disable the default body parser so we receive the raw stream
export const config = {
  api: {
    bodyParser: false,
  },
};
