import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Load configuration
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  console.error("firebase-applet-config.json not found!");
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "default");

const uploadDir = path.join(process.cwd(), "public", "uploads");

// Helper to calculate SHA-256 hash
function getFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

// Regex to identify Cloudflare/Cloudinary-style hash prefix
const hashPattern = /^[a-z0-9]{20}-/i;

async function run() {
  if (!fs.existsSync(uploadDir)) {
    console.log("No uploads directory found. Exiting.");
    process.exit(0);
  }

  console.log("Scanning public/uploads for files...");
  const files = fs.readdirSync(uploadDir);
  console.log(`Found ${files.length} total files in public/uploads/`);

  // Build hash-to-files registry
  const hashToFiles: Record<string, string[]> = {};
  for (const file of files) {
    if (file === "." || file === "..") continue;
    
    const filePath = path.join(uploadDir, file);
    if (!fs.statSync(filePath).isFile()) continue;

    try {
      const hash = getFileHash(filePath);
      if (!hashToFiles[hash]) {
        hashToFiles[hash] = [];
      }
      hashToFiles[hash].push(file);
    } catch (e) {
      console.warn(`Could not hash file ${file}:`, e);
    }
  }

  const slugToHashMapping: Record<string, string> = {};
  const deleteList: string[] = [];
  let foundPairsCount = 0;

  // Find duplicate pairs
  for (const [hash, group] of Object.entries(hashToFiles)) {
    if (group.length > 1) {
      const hashBasedFiles = group.filter(name => hashPattern.test(name));
      const slugBasedFiles = group.filter(name => !hashPattern.test(name));

      if (hashBasedFiles.length > 0 && slugBasedFiles.length > 0) {
        // Choose the first hash-based file as the canonical target
        const canonical = hashBasedFiles[0];

        for (const slugFile of slugBasedFiles) {
          slugToHashMapping[slugFile] = canonical;
          deleteList.push(slugFile);
          foundPairsCount++;
          console.log(`Found duplicate: ${slugFile} -> ${canonical}`);
        }
      }
    }
  }

  console.log(`\nFound ${foundPairsCount} duplicate pairs.`);
  if (foundPairsCount === 0) {
    console.log("No duplicate slug-to-hash pairs discovered. Script execution complete.");
    process.exit(0);
  }

  // Collections to scan
  const collectionsToScan = ["listings", "events", "jobs", "news", "settings"];
  console.log(`\nScanning Firestore collections [${collectionsToScan.join(", ")}] for references...`);

  let dbUpdatesCount = 0;

  for (const colName of collectionsToScan) {
    try {
      const querySnapshot = await getDocs(collection(db, colName));
      for (const d of querySnapshot.docs) {
        const docData = d.data();
        let currentData = { ...docData };
        let anyChanges = false;

        // Recursively walk and replace references for every mapping
        for (const [slugFile, canonicalFile] of Object.entries(slugToHashMapping)) {
          // Walk function
          const replaceInVal = (val: any): { newVal: any; changed: boolean } => {
            let replaced = false;
            if (typeof val === "string") {
              if (val.includes(slugFile)) {
                return { newVal: val.replace(slugFile, canonicalFile), changed: true };
              }
            } else if (Array.isArray(val)) {
              const mapped = val.map(item => {
                const res = replaceInVal(item);
                if (res.changed) replaced = true;
                return res.newVal;
              });
              return { newVal: mapped, changed: replaced };
            } else if (val && typeof val === "object") {
              const resObj: any = {};
              for (const k of Object.keys(val)) {
                const res = replaceInVal(val[k]);
                if (res.changed) replaced = true;
                resObj[k] = res.newVal;
              }
              return { newVal: resObj, changed: replaced };
            }
            return { newVal: val, changed: false };
          };

          const runReplacement = replaceInVal(currentData);
          if (runReplacement.changed) {
            currentData = runReplacement.newVal;
            anyChanges = true;
          }
        }

        if (anyChanges) {
          console.log(`Updating doc in [${colName}]: ID=${d.id}`);
          await updateDoc(doc(db, colName, d.id), currentData);
          dbUpdatesCount++;
        }
      }
    } catch (colErr) {
      console.error(`Error processing collection ${colName}:`, colErr);
    }
  }

  console.log(`\nFirestore update phase complete. Total documents updated: ${dbUpdatesCount}`);

  // Delete slug-based duplicates from disk
  console.log(`\nDeleting slug-based copies from local disk...`);
  let deletedFilesCount = 0;
  for (const slugFile of deleteList) {
    const fullPath = path.join(uploadDir, slugFile);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`Deleted: ${slugFile}`);
        deletedFilesCount++;
      } catch (delErr) {
        console.error(`Failed to delete file ${slugFile}:`, delErr);
      }
    }
  }

  console.log(`\nSuccessfully deleted ${deletedFilesCount} file(s) from public/uploads/`);
  console.log("Cleanup runner completed successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error("Cleanup script failed with unexpected error:", err);
  process.exit(1);
});
