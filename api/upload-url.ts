import { put } from '@vercel/blob';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { url, name } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: "No URL provided" });
    }

    const cleanName = name ? String(name).toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : 'upload';
    
    console.log(`Downloading image from URL on Vercel: ${url}`);
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      }
    });

    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch image: ${fetchRes.status}`);
    }

    const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
    
    let ext = 'jpg';
    if (contentType.includes('image/png')) ext = 'png';
    else if (contentType.includes('image/jpeg')) ext = 'jpg';
    else if (contentType.includes('image/webp')) ext = 'webp';
    else if (contentType.includes('image/gif')) ext = 'gif';
    else if (contentType.includes('image/svg+xml')) ext = 'svg';

    const filename = `${cleanName}-${Date.now()}.${ext}`;

    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error: any) {
    console.error("Vercel Blob Upload URL Error:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}
