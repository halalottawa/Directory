import { getStore } from "@netlify/blobs";
import { config } from "dotenv";
config({ override: true });

async function test() {
  try {
    console.log("Site ID:", process.env.NETLIFY_SITE_ID);
    console.log("Token:", process.env.NETLIFY_API_TOKEN?.substring(0, 5) + "...");
    const store = getStore({
      name: "uploads",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN,
    });
    
    await store.set("test-blob", "Hello world");
    console.log("Successfully wrote test-blob");
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    }
    console.log(error);
  }
}

test();
