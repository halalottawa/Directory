import { put } from '@vercel/blob';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { url, name } = await request.json();
    if (!url) {
      return Response.json({ error: "No URL provided" }, { status: 400 });
    }

    const cleanName = name ? name.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : 'upload';
    
    console.log(`Downloading image from URL on Vercel Edge: ${url}`);
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

    const blob = await put(filename, fetchRes.body as any, {
      access: 'public',
      contentType
    });

    return Response.json({ url: blob.url });
  } catch (error: any) {
    console.error("Vercel Blob Upload URL Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
