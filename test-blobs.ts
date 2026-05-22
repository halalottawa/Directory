import { put, list } from "@vercel/blob";
import { config } from "dotenv";
config();

async function test() {
  try {
    const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
    console.log("Has BLOB_READ_WRITE_TOKEN:", hasToken);
    
    if (!hasToken) {
      console.log("Skipping test: BLOB_READ_WRITE_TOKEN is not set.");
      return;
    }

    console.log("Uploading test-blob.txt to Vercel Blob...");
    const { url } = await put("uploads/test-blob.txt", "Hello from Ottawa Halal Vercel Blob!", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true
    });
    console.log("Successfully wrote test-blob.txt. URL:", url);

    console.log("Listing blobs...");
    const { blobs } = await list();
    console.log(`Found ${blobs.length} blobs in storage.`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.log(error);
    }
  }
}

test();
