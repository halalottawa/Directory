import { put } from '@vercel/blob';

export const config = {
  runtime: 'edge', // Edge runtime is required to use native Request/Response
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename') || `upload-${Date.now()}.jpg`;

    // Upload directly to Vercel Blob from the request body stream
    const blob = await put(filename, request.body as any, {
      access: 'public',
    });

    return Response.json({ url: blob.url });
  } catch (error: any) {
    console.error("Vercel Blob Upload Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
