import serverless from "serverless-http";
import { createApp } from "../server";

let cachedApp: Awaited<ReturnType<typeof createApp>> | null = null;
let cachedLambdaHandler: ReturnType<typeof serverless> | null = null;

export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    cachedApp = await createApp();
  }

  // Vercel @vercel/node invokes handler(req, res) with Node IncomingMessage & ServerResponse
  if (res && typeof res.setHeader === "function" && typeof res.end === "function") {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      res.once("finish", done);
      res.once("close", done);
      (cachedApp as any)(req, res, (err: any) => {
        if (err && !settled) {
          settled = true;
          reject(err);
        } else {
          done();
        }
      });
    });
  }

  // Fallback for AWS Lambda / API Gateway (event, context) invocations
  if (!cachedLambdaHandler) {
    cachedLambdaHandler = serverless(cachedApp, {
      binary: ["image/*", "font/*", "application/octet-stream"],
    });
  }
  return cachedLambdaHandler(req, res);
}
