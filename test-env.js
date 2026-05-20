console.log("From process.env directly:", process.env.NETLIFY_SITE_ID);
import { config } from "dotenv";
config({ override: true });
console.log("After override:", process.env.NETLIFY_SITE_ID);
