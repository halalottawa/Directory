import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, limit } from 'firebase/firestore';

const BASE_URL = 'https://www.halalottawa.ca';

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
  "/login",
  "/register",
  "/tools/qibla"
];

// Helper functions for secure character escaping and robust schema URLs
function escapeHtmlText(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getAbsoluteUrl(urlStr: string): string {
  if (!urlStr) return "https://www.halalottawa.ca/default-og.jpg";
  if (urlStr.startsWith("http://") || urlStr.startsWith("https://") || urlStr.startsWith("data:")) {
    return urlStr;
  }
  return `https://www.halalottawa.ca${urlStr.startsWith("/") ? "" : "/"}${urlStr}`;
}

function cleanPriceStr(priceVal: any): string {
  if (priceVal === undefined || priceVal === null) return "0";
  const str = String(priceVal).trim();
  if (str.toLowerCase() === 'free' || str === '0') return "0";
  const numOnly = str.replace(/[^0-9.]/g, '');
  return numOnly || "0";
}

function normalizeCategoryToSlug(cat: string): string {
  if (!cat) return 'listings';
  const c = cat.toLowerCase().trim();
  if (c.includes('restaurant')) return 'restaurants';
  if (c.includes('mosque') || c.includes('masjid')) return 'mosques';
  if (c.includes('organization')) return 'organizations';
  if (c.includes('grocery')) return 'grocery';
  if (c.includes('clothing')) return 'clothing';
  if (c.includes('school')) return 'schools';
  if (c.includes('butcher')) return 'butchers';
  return c.trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]+/g, '');
}

// Helper to ensure directory exists
function ensureDirectoryExists(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

async function prerender() {
  console.log("Starting Static Site Generation (SSG) / Prerendering...");
  
  const distPath = path.resolve(process.cwd(), 'dist');
  const templatePath = path.resolve(distPath, 'index.html');
  
  if (!fs.existsSync(templatePath)) {
    console.error("Error: dist/index.html not found! Run 'vite build' first.");
    process.exit(1);
  }
  
  const baseTemplate = fs.readFileSync(templatePath, 'utf-8');
  
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let fbApp;
  let db: any = null;

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    fbApp = initializeApp(firebaseConfig, 'prerender-generator');
    db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  } else {
    console.warn("firebase-applet-config.json not found. Prerendering with static URLs only.");
  }

  // We will compile a list of all pages to render
  interface PageToPrerender {
    urlPath: string;
    filePath: string;
    routeType: string;
    initialData?: any;
    title: string;
    description: string;
    ogImage: string;
  }

  const pagesToPrerender: PageToPrerender[] = [];

  // 1. Prepare Static Pages
  for (const url of staticUrls) {
    let title = "Halal Ottawa - Halal Places in Ottawa";
    let description = "Discover Halal restaurants, mosques, grocery stores, and Islamic organizations in Ottawa.";
    let ogImage = "https://www.halalottawa.ca/default-og.jpg";

    if (url === "/news") {
      title = "Halal Ottawa News - Articles & Muslim Community Highlights";
      description = "Stay updated with the latest news, stories, and developments in the Ottawa Muslim community.";
    } else if (url === "/events") {
      title = "Halal Ottawa Events - Ottawa Muslim Community Events";
      description = "Discover upcoming events, seminars, fund raisers, and social gatherings in the Ottawa Muslim community.";
    } else if (url === "/jobs") {
      title = "Halal Ottawa Jobs - Halal Career Opportunities in Ottawa";
      description = "Browse halal career opportunities, postings, and jobs within Ottawa-based businesses and establishments.";
    } else if (url === "/restaurants") {
      title = "Halal Restaurants in Ottawa | Halal Ottawa";
      description = "Browse and discover verified Halal restaurants, cafes, and eateries across Ottawa.";
    } else if (url === "/mosques") {
      title = "Mosques & Musallahs in Ottawa | Halal Ottawa";
      description = "Find local mosques, prayer times, and Musallahs in public spaces around Ottawa.";
    } else if (url === "/grocery") {
      title = "Halal Grocery Stores in Ottawa | Halal Ottawa";
      description = "Find grocery stores, halal meat shops, and international supermarkets selling halal ingredients in Ottawa.";
    } else if (url === "/organizations") {
      title = "Islamic Organizations in Ottawa | Halal Ottawa";
      description = "Find community organizations, halal associations, charities, and support networks in Ottawa.";
    } else if (url === "/clothing") {
      title = "Islamic Clothing & Shops in Ottawa | Halal Ottawa";
      description = "Discover boutiques, modesty clothing stores, and suppliers of Islamic attire in Ottawa.";
    } else if (url === "/schools") {
      title = "Islamic Schools & Education in Ottawa | Halal Ottawa";
      description = "Find Islamic private schools, daycare centers, weekend Quran programs, and colleges in Ottawa.";
    } else if (url === "/butchers") {
      title = "Halal Butchers & Meat Shops in Ottawa | Halal Ottawa";
      description = "Find verified halal standard meat shops, poultry, and local butchers in Ottawa.";
    } else if (url === "/faq") {
      title = "Frequently Asked Questions | Halal Ottawa";
      description = "Got questions about the Halal Ottawa platform? Check out our compiled list of FAQs.";
    } else if (url === "/terms") {
      title = "Terms of Service | Halal Ottawa";
      description = "Read the legal terms of use and service agreements for using the Halal Ottawa website.";
    } else if (url === "/privacy-policy") {
      title = "Privacy Policy | Halal Ottawa";
      description = "Learn how your personal details, submissions, and metrics are secured and managed on Halal Ottawa.";
    }

    const relativeFilePath = url === "/" ? "index.html" : `${url.substring(1)}/index.html`;

    pagesToPrerender.push({
      urlPath: url,
      filePath: path.join(distPath, relativeFilePath),
      routeType: url === "/" ? "home" : "static",
      title,
      description,
      ogImage
    });
  }

  // 2. Fetch and Prepare Dynamic Pages (Listings, News, Events, Jobs)
  if (db) {
    try {
      console.log("Fetching dynamic contents from Firestore...");

      // Pre-fetch Home Page Initial Data
      try {
        const qListingsHome = query(collection(db, 'listings'), where('isApproved', '==', true), limit(50));
        const qNewsHome = query(collection(db, 'news'), where('isApproved', '==', true), limit(10));
        const qEventsHome = query(collection(db, 'events'), where('isApproved', '==', true), limit(20));
        const qJobsHome = query(collection(db, 'jobs'), where('isApproved', '==', true), limit(10));

        const [listingsSnap, newsSnap, eventsSnap, jobsSnap] = await Promise.all([
          getDocs(qListingsHome), getDocs(qNewsHome), getDocs(qEventsHome), getDocs(qJobsHome)
        ]);

        const listingsData = listingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let newsData = newsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        newsData = newsData.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()).slice(0, 6);
        let eventsData = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        eventsData = eventsData.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).slice(0, 8);
        let jobsData = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        jobsData = jobsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

        const homePage = pagesToPrerender.find(p => p.urlPath === "/");
        if (homePage) {
          homePage.initialData = {
            listings: listingsData,
            news: newsData,
            events: eventsData,
            jobs: jobsData,
            timestamp: Date.now()
          };
        }
      } catch (homeErr) {
        console.error("Error fetching home page pre-fetch data:", homeErr);
      }

      // Listings SSG
      const listingsQuery = query(collection(db, 'listings'), where('isApproved', '==', true));
      const listingsSnap = await getDocs(listingsQuery);
      listingsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        
        let categoryPath = 'listings';
        if (Array.isArray(data.category) && data.category.length > 0) {
          categoryPath = normalizeCategoryToSlug(data.category[0]);
        } else if (typeof data.category === 'string') {
          categoryPath = normalizeCategoryToSlug(data.category);
        }

        const url = `/${categoryPath}/${idPath}`;
        const title = `${data.name} | Halal Ottawa`;
        const description = data.description?.substring(0, 160) || "Discover verified halal details, reviews, and address info.";
        const ogImage = getAbsoluteUrl((data.photos && data.photos.length > 0) ? data.photos[0] : "");

        pagesToPrerender.push({
          urlPath: url,
          filePath: path.join(distPath, categoryPath, idPath, "index.html"),
          routeType: "listing",
          initialData: { id: doc.id, ...data },
          title,
          description,
          ogImage
        });

        // Also duplicate to /listings/[slug] so that it resolves gracefully in both route patterns!
        pagesToPrerender.push({
          urlPath: `/listings/${idPath}`,
          filePath: path.join(distPath, "listings", idPath, "index.html"),
          routeType: "listing",
          initialData: { id: doc.id, ...data },
          title,
          description,
          ogImage
        });
      });

      // News Articles SSG
      const newsQuery = query(collection(db, 'news'), where('isApproved', '==', true));
      const newsSnap = await getDocs(newsQuery);
      newsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        const url = `/news/${idPath}`;
        const title = `${data.title} | Halal Ottawa`;
        const description = data.content?.substring(0, 160) || "Read latest updates and news regarding the Ottawa halal and Muslim community.";
        const ogImage = getAbsoluteUrl(data.coverImage || "");

        pagesToPrerender.push({
          urlPath: url,
          filePath: path.join(distPath, "news", idPath, "index.html"),
          routeType: "news",
          initialData: { id: doc.id, ...data },
          title,
          description,
          ogImage
        });
      });

      // Events SSG
      const eventsQuery = query(collection(db, 'events'), where('isApproved', '==', true));
      const eventsSnap = await getDocs(eventsQuery);
      eventsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        const url = `/events/${idPath}`;
        const title = `${data.title} | Halal Ottawa Events`;
        const description = data.description?.substring(0, 160) || "Join community events, classes, and lectures happening across Ottawa.";
        const ogImage = getAbsoluteUrl(data.coverImage || "");

        pagesToPrerender.push({
          urlPath: url,
          filePath: path.join(distPath, "events", idPath, "index.html"),
          routeType: "event",
          initialData: { id: doc.id, ...data },
          title,
          description,
          ogImage
        });
      });

      // Jobs SSG
      const jobsQuery = query(collection(db, 'jobs'), where('isApproved', '==', true));
      const jobsSnap = await getDocs(jobsQuery);
      jobsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        const url = `/jobs/${idPath}`;
        const title = `${data.title} at ${data.company} | Halal Ottawa Jobs`;
        const description = data.description?.substring(0, 160) || "Hiring now: verify salary packages, full-time/part-time perks, and location details.";
        const ogImage = getAbsoluteUrl(data.companyLogo || "");

        pagesToPrerender.push({
          urlPath: url,
          filePath: path.join(distPath, "jobs", idPath, "index.html"),
          routeType: "job",
          initialData: { id: doc.id, ...data },
          title,
          description,
          ogImage
        });
      });

      console.log(`Successfully fetched and prepared ${pagesToPrerender.length} pages for Static Site Generation.`);
    } catch (e) {
      console.error("Error details while preparing dynamic pages:", e);
    }
  }

  // 3. Render HTML and Write to Filesystem
  let renderCount = 0;
  for (const page of pagesToPrerender) {
    try {
      let html = baseTemplate;
      
      // Inject standard SEO Tags with safe HTML escaping
      html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtmlText(page.title)}</title>`);
      html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${escapeHtmlAttr(page.description)}" />`);
      
      let extraTags = `
    <meta property="og:title" content="${escapeHtmlAttr(page.title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(page.description)}" />
    <meta property="og:image" content="${escapeHtmlAttr(page.ogImage)}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
      `;

      // Inject JSON-LD Schema standard Markup structures
      if (page.initialData) {
        let schemaData: any = {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": page.title,
          "description": page.description,
          "image": page.ogImage,
          "url": `${BASE_URL}${page.urlPath}`
        };

        const fullUrl = `${BASE_URL}${page.urlPath}`;

        if (page.routeType === 'listing') {
          let schemaType = "LocalBusiness";
          const cat = (page.initialData.category || '').toString().toLowerCase();
          if (cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe')) {
            schemaType = "Restaurant";
          } else if (cat.includes('mosque') || cat.includes('masjid')) {
            schemaType = "PlaceOfWorship";
          } else if (cat.includes('grocery') || cat.includes('supermarket')) {
            schemaType = "GroceryStore";
          } else if (cat.includes('butcher')) {
            schemaType = "FoodEstablishment";
          }

          schemaData = {
            "@context": "https://schema.org",
            "@type": schemaType,
            "name": page.initialData.name,
            "description": page.description,
            "image": page.ogImage,
            "url": fullUrl,
            "address": page.initialData.address ? {
              "@type": "PostalAddress",
              "streetAddress": page.initialData.address,
              "addressLocality": "Ottawa",
              "addressRegion": "ON",
              "postalCode": page.initialData.postalCode || "",
              "addressCountry": "CA"
            } : undefined,
            "telephone": page.initialData.phoneNumber || undefined,
            "geo": page.initialData.lat && page.initialData.lng ? {
              "@type": "GeoCoordinates",
              "latitude": parseFloat(page.initialData.lat),
              "longitude": parseFloat(page.initialData.lng)
            } : undefined
          };

          // priceRange is only valid for Commercial Local Businesses
          if (schemaType !== "PlaceOfWorship") {
            schemaData.priceRange = page.initialData.priceRange || "$$";
          }

          if (page.initialData.averageRating && page.initialData.reviewCount) {
            schemaData.aggregateRating = {
              "@type": "AggregateRating",
              "ratingValue": parseFloat(page.initialData.averageRating).toFixed(1),
              "reviewCount": parseInt(page.initialData.reviewCount) || 1,
              "bestRating": "5",
              "worstRating": "1"
            };
          }
        } else if (page.routeType === 'news') {
          schemaData = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": fullUrl
            },
            "headline": page.initialData.title,
            "image": page.ogImage ? [page.ogImage] : undefined,
            "datePublished": page.initialData.publishDate || page.initialData.createdAt || new Date().toISOString(),
            "dateModified": page.initialData.updatedAt || page.initialData.publishDate || new Date().toISOString(),
            "author": {
              "@type": "Person",
              "name": page.initialData.author || "Halal Ottawa Staff"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Halal Ottawa",
              "logo": {
                "@type": "ImageObject",
                "url": "https://www.halalottawa.ca/favicon.ico"
              }
            },
            "description": page.description
          };
        } else if (page.routeType === 'event') {
          schemaData = {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": page.initialData.title,
            "startDate": page.initialData.dateTime || new Date().toISOString(),
            "endDate": page.initialData.endDateTime || page.initialData.dateTime || new Date().toISOString(),
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "eventStatus": "https://schema.org/EventScheduled",
            "location": {
              "@type": "Place",
              "name": page.initialData.venue || page.initialData.location || "Ottawa Community Venue",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": page.initialData.location || "Ottawa",
                "addressLocality": "Ottawa",
                "addressRegion": "ON",
                "addressCountry": "CA"
              }
            },
            "image": page.ogImage ? [page.ogImage] : undefined,
            "description": page.description,
            "offers": {
              "@type": "Offer",
              "url": fullUrl,
              "price": cleanPriceStr(page.initialData.price),
              "priceCurrency": "CAD",
              "availability": "https://schema.org/InStock",
              "validFrom": page.initialData.createdAt || new Date().toISOString()
            },
            "organizer": {
              "@type": "Organization",
              "name": page.initialData.organizer || "Halal Ottawa Community Partner",
              "url": "https://www.halalottawa.ca"
            }
          };
        } else if (page.routeType === 'job') {
          let empType = ["FULL_TIME"];
          const t = (page.initialData.type || '').toUpperCase();
          if (t.includes('PART')) {
            empType = ["PART_TIME"];
          } else if (t.includes('CONTRACT')) {
            empType = ["CONTRACTOR"];
          } else if (t.includes('INTERN')) {
            empType = ["INTERN"];
          }

          schemaData = {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": page.initialData.title,
            "description": page.initialData.description || page.description,
            "datePosted": page.initialData.createdAt || new Date().toISOString(),
            "validThrough": new Date((page.initialData.createdAt ? new Date(page.initialData.createdAt) : new Date()).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            "employmentType": empType,
            "hiringOrganization": {
              "@type": "Organization",
              "name": page.initialData.company || "Halal Ottawa Partner",
              "logo": page.initialData.companyLogo ? getAbsoluteUrl(page.initialData.companyLogo) : undefined
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": page.initialData.location && page.initialData.location !== 'Ottawa' ? page.initialData.location : undefined,
                "addressLocality": "Ottawa",
                "addressRegion": "ON",
                "addressCountry": "CA"
              }
            }
          };
        }

        const breadcrumbItems = [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://www.halalottawa.ca"
          }
        ];

        if (page.routeType === 'listing') {
          const mainCategoryStr = Array.isArray(page.initialData.category) && page.initialData.category.length > 0 
            ? page.initialData.category[0] 
            : (typeof page.initialData.category === 'string' ? page.initialData.category : 'listings');
          
          const catSlug = normalizeCategoryToSlug(mainCategoryStr);

          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 2,
            "name": mainCategoryStr,
            "item": `https://www.halalottawa.ca/${catSlug}`
          });

          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 3,
            "name": page.initialData.name,
            "item": fullUrl
          });
        } else if (page.routeType === 'news') {
          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 2,
            "name": "News",
            "item": "https://www.halalottawa.ca/news"
          });

          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 3,
            "name": page.initialData.title,
            "item": fullUrl
          });
        } else if (page.routeType === 'event') {
          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 2,
            "name": "Events",
            "item": "https://www.halalottawa.ca/events"
          });

          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 3,
            "name": page.initialData.title,
            "item": fullUrl
          });
        } else if (page.routeType === 'job') {
          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 2,
            "name": "Jobs",
            "item": "https://www.halalottawa.ca/jobs"
          });

          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 3,
            "name": page.initialData.title,
            "item": fullUrl
          });
        }

        const breadcrumbSchema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbItems
        };

        extraTags += `\n    <script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;
        extraTags += `\n    <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`;
      }

      if (page.initialData) {
        extraTags += `\n    <script>window.__INITIAL_ROUTE_TYPE__ = ${JSON.stringify(page.routeType)}; window.__INITIAL_DATA__ = ${JSON.stringify(page.initialData).replace(/</g, '\\u003c')};</script>`;
      }

      html = html.replace('</head>', `${extraTags}\n  </head>`);

      // Ensure target container exists
      ensureDirectoryExists(page.filePath);
      
      // Write to filesystem
      fs.writeFileSync(page.filePath, html, 'utf-8');
      renderCount++;
    } catch (err) {
      console.error(`Error prerendering static file for path ${page.urlPath}:`, err);
    }
  }

  console.log(`Prerendering completed! Statically compiled ${renderCount} pages and wrote to 'dist/'.`);
}

prerender().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("Static Site Generation script crashed:", err);
  process.exit(1);
});
