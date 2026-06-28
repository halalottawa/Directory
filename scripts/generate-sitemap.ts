import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const BASE_URL = 'https://www.halalottawa.ca';

const escapeXml = (str: string): string => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

const staticUrls = [
  "/",
  "/news",
  "/events",
  "/jobs",
  "/restaurants",
  "/mosques",
  "/organizations",
  "/grocery",
  "/clothing",
  "/schools",
  "/butchers",
  "/faq",
  "/terms",
  "/privacy-policy",
  "/tools/qibla"
];

async function generateSitemap() {
  console.log("Generating sitemap...");
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let fbApp;
  let db;

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    fbApp = initializeApp(firebaseConfig, 'sitemap-generator');
    db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  } else {
    console.warn("firebase-applet-config.json not found. Generating sitemap with static URLs only.");
  }

  const urls: { loc: string; lastmod: string; changefreq: string; priority: string; imageUrl?: string | null; name?: string | null }[] = [];
  const today = new Date().toISOString().split('T')[0];

  // Add static URLs
  for (const url of staticUrls) {
    let priority = "0.8";
    if (url === "/") priority = "1.0";
    else if (["/news", "/events", "/jobs"].includes(url)) priority = "0.9";
    else if (["/faq", "/terms", "/privacy-policy"].includes(url)) priority = "0.3";

    urls.push({
      loc: `${BASE_URL}${url}`,
      lastmod: today,
      changefreq: priority === "0.3" ? "monthly" : "daily",
      priority: priority,
    });
  }

  const getDocLastmod = (data: any): string => {
    const rawDate = data.updatedAt || data.createdAt;
    if (!rawDate) return today;
    if (typeof rawDate.toDate === 'function') {
      return rawDate.toDate().toISOString().split('T')[0];
    }
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? today : d.toISOString().split('T')[0];
  };

  // Fetch dynamic content if DB is available
  if (db) {
    try {
      // 1. Listings
      const listingsQuery = query(collection(db, 'listings'), where('isApproved', '==', true));
      const listingsSnap = await getDocs(listingsQuery);
      listingsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        
        let categoryPath = 'listings';
        if (Array.isArray(data.category) && data.category.length > 0) {
          categoryPath = encodeURIComponent(data.category[0].toLowerCase());
        } else if (typeof data.category === 'string') {
          categoryPath = encodeURIComponent(data.category.toLowerCase());
        }

        const imageUrl = data.photos?.[0] || data.coverImage || null;
        urls.push({
          loc: `${BASE_URL}/${categoryPath}/${idPath}`,
          lastmod: getDocLastmod(data),
          changefreq: "weekly",
          priority: "0.7",
          imageUrl,
          name: data.name || data.title || null
        });
      });

      // 2. News
      const newsQuery = query(collection(db, 'news'), where('isApproved', '==', true));
      const newsSnap = await getDocs(newsQuery);
      newsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        const imageUrl = data.photos?.[0] || data.coverImage || null;
        urls.push({
          loc: `${BASE_URL}/news/${idPath}`,
          lastmod: getDocLastmod(data),
          changefreq: "weekly",
          priority: "0.7",
          imageUrl,
          name: data.name || data.title || null
        });
      });

      // 3. Events
      const eventsQuery = query(collection(db, 'events'), where('isApproved', '==', true));
      const eventsSnap = await getDocs(eventsQuery);
      eventsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        const imageUrl = data.photos?.[0] || data.coverImage || null;
        urls.push({
          loc: `${BASE_URL}/events/${idPath}`,
          lastmod: getDocLastmod(data),
          changefreq: "weekly",
          priority: "0.7",
          imageUrl,
          name: data.name || data.title || null
         });
      });

      // 4. Jobs
      const jobsQuery = query(collection(db, 'jobs'), where('isApproved', '==', true));
      const jobsSnap = await getDocs(jobsQuery);
      jobsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        const imageUrl = data.photos?.[0] || data.coverImage || null;
        urls.push({
          loc: `${BASE_URL}/jobs/${idPath}`,
          lastmod: getDocLastmod(data),
          changefreq: "weekly",
          priority: "0.7",
          imageUrl,
          name: data.name || data.title || null
        });
      });
      console.log(`Added dynamic URLs from Firestore. Total URLs: ${urls.length}`);
    } catch (e) {
      console.error("Error fetching dynamic URLs from Firestore:", e);
    }
  }

  // Generate XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;
  
  for (const url of urls) {
    xml += `  <url>\n`;
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    if (url.imageUrl) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(url.imageUrl)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(url.name || '')}</image:title>\n`;
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  }
  
  xml += `</urlset>\n`;

  const outputPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
  fs.writeFileSync(outputPath, xml);
  console.log(`Sitemap written to ${outputPath}`);

  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    const distLogPath = path.join(distPath, 'sitemap.xml');
    fs.writeFileSync(distLogPath, xml);
    console.log(`Sitemap written to ${distLogPath}`);
  }

  // Generate Google News sitemap (sitemap-news.xml)
  const getDocPubDate = (data: any): string => {
    const rawDate = data.publishDate || data.createdAt;
    if (!rawDate) return today;
    if (typeof rawDate.toDate === 'function') {
      return rawDate.toDate().toISOString().split('T')[0];
    }
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? today : d.toISOString().split('T')[0];
  };

  const newsUrls: { loc: string; title: string; pubDate: string }[] = [];

  if (db) {
    try {
      const q = query(collection(db, 'news'));
      const snap = await getDocs(q);
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.isApproved === false) return;
        const idPath = data.slug || doc.id;
        newsUrls.push({
          loc: `${BASE_URL}/news/${idPath}`,
          title: data.title || '',
          pubDate: getDocPubDate(data)
        });
      });
    } catch (e) {
      console.error("Error fetching news for sitemap-news.xml:", e);
    }
  }

  let newsXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  newsXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  newsXml += `        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;

  for (const item of newsUrls) {
    newsXml += `  <url>\n`;
    newsXml += `    <loc>${item.loc}</loc>\n`;
    newsXml += `    <news:news>\n`;
    newsXml += `      <news:publication>\n`;
    newsXml += `        <news:name>Halal Ottawa</news:name>\n`;
    newsXml += `        <news:language>en</news:language>\n`;
    newsXml += `      </news:publication>\n`;
    newsXml += `      <news:publication_date>${item.pubDate}</news:publication_date>\n`;
    newsXml += `      <news:title>${escapeXml((item.title || '').trim())}</news:title>\n`;
    newsXml += `    </news:news>\n`;
    newsXml += `  </url>\n`;
  }

  newsXml += `</urlset>\n`;

  const outputNewsPath = path.resolve(process.cwd(), 'public', 'sitemap-news.xml');
  fs.writeFileSync(outputNewsPath, newsXml);
  console.log(`News sitemap written to ${outputNewsPath}`);

  if (fs.existsSync(distPath)) {
    const distNewsPath = path.join(distPath, 'sitemap-news.xml');
    fs.writeFileSync(distNewsPath, newsXml);
    console.log(`News sitemap written to ${distNewsPath}`);
  }
}

generateSitemap().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
