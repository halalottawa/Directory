import serverless from "serverless-http";
import { createApp } from "../server";

let cachedHandler: ReturnType<typeof serverless> | null = null;

export default async function handler(req: any, res: any) {
  if (!cachedHandler) {
    const app = await createApp();
    cachedHandler = serverless(app, {
      binary: ["image/*", "font/*", "application/octet-stream"],
    });
  }
  return cachedHandler(req, res);
}
