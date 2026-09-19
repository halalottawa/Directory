/**
 * ssrTemplates.ts
 *
 * Provides static HTML generators for:
 * - Home page (renderHomeSSRHtml)
 * - Category / Directory listing pages (renderCategorySSRHtml)
 * - Single listing / restaurant detail pages (renderListingDetailSSRHtml)
 * - News article detail pages (renderNewsDetailSSRHtml)
 * - Event detail pages (renderEventDetailSSRHtml)
 * - Job detail pages (renderJobDetailSSRHtml)
 *
 * Used during static site generation (scripts/prerender.ts) and dynamic server SSR (server.ts).
 */

export function escapeHtmlText(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeHtmlAttr(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function normalizeCategoryToSlug(cat: string): string {
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

export function getOptimizedImageUrlSSR(url: string | null | undefined, width: number = 800, height?: number): string | undefined {
  if (!url) return undefined;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.startsWith('data:') || lowerUrl.endsWith('.svg') || lowerUrl.includes('google.com/images/') || lowerUrl.includes('.gstatic.com/') || lowerUrl.includes('r2.dev') || lowerUrl.includes('r2.cloudflarestorage.com')) {
    return url;
  }
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    const baseUrl = url.split('=')[0];
    const params = [];
    if (width) params.push(`w${width}`);
    if (height) params.push(`h${height}`);
    params.push('c');
    return `${baseUrl}=${params.join('-')}`;
  }
  if (url.includes('images.unsplash.com')) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('w', width.toString());
      if (height) urlObj.searchParams.set('h', height.toString());
      urlObj.searchParams.set('q', '85');
      urlObj.searchParams.set('fit', 'crop');
      urlObj.searchParams.set('auto', 'format');
      return urlObj.toString();
    } catch {
      return url;
    }
  }
  if (url.includes('res.cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      const transform = `w_${width}${height ? `,h_${height}` : ''},c_fill,q_85,f_auto`;
      return `${parts[0]}/upload/${transform}/${parts[1]}`;
    }
  }
  const params: string[] = [`url=${encodeURIComponent(url)}`, `w=${width}`];
  if (height) params.push(`h=${height}`);
  params.push('q=85');
  return `/api/optimize-image?${params.join('&')}`;
}

/**
 * Static HTML for Homepage (LCP optimization)
 */
export function renderHomeSSRHtml(data: {
  listings?: any[];
  news?: any[];
  events?: any[];
  jobs?: any[];
}): string {
  const listings = data.listings || [];
  const news = data.news || [];
  const events = data.events || [];
  const jobs = data.jobs || [];

  const categories = [
    { name: 'Restaurants', slug: 'restaurants', icon: '🍽️', color: 'bg-red-50 text-[#e90b35]' },
    { name: 'Mosques', slug: 'mosques', icon: '🕌', color: 'bg-emerald-50 text-emerald-600' },
    { name: 'Grocery', slug: 'grocery', icon: '🛒', color: 'bg-blue-50 text-blue-600' },
    { name: 'Butchers', slug: 'butchers', icon: '🥩', color: 'bg-amber-50 text-amber-600' },
    { name: 'Clothing', slug: 'clothing', icon: '👔', color: 'bg-purple-50 text-purple-600' },
    { name: 'Schools', slug: 'schools', icon: '🏫', color: 'bg-indigo-50 text-indigo-600' },
    { name: 'Organizations', slug: 'organizations', icon: '🏢', color: 'bg-rose-50 text-rose-600' },
  ];

  const categoryCardsHtml = categories.map(cat => `
    <a href="/${cat.slug}" class="flex flex-col items-center gap-2 p-3 sm:p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-md transition-all text-decoration-none shadow-xs group">
      <div class="w-11 h-11 sm:w-12 sm:h-12 ${cat.color} rounded-2xl flex items-center justify-center text-xl sm:text-2xl group-hover:scale-105 transition-transform">
        <span>${cat.icon}</span>
      </div>
      <span class="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 text-center leading-tight">${cat.name}</span>
    </a>
  `).join('\n');

  const listingCardsHtml = listings.slice(0, 8).map((l, idx) => {
    let catSlug = 'listings';
    if (Array.isArray(l.category) && l.category.length > 0) {
      catSlug = normalizeCategoryToSlug(l.category[0]);
    } else if (typeof l.category === 'string') {
      catSlug = normalizeCategoryToSlug(l.category);
    }
    const listingUrl = `/${catSlug}/${l.slug || l.id}`;
    const photoUrl = (l.photos && l.photos.length > 0) ? l.photos[0] : (l.coverImage || '/ottawa-sunset.webp');
    const optimizedPhoto = getOptimizedImageUrlSSR(photoUrl, 480, 240) || photoUrl;
    const rating = l.averageRating ? Number(l.averageRating).toFixed(1) : '5.0';
    const rawAddress = l.address ? l.address.split(',')[0] : 'Ottawa, ON';
    const isEager = idx < 2;

    return `
      <article class="bg-white rounded-3xl overflow-hidden shadow-xs border border-gray-100 group hover:shadow-md transition-all flex flex-col">
        <a href="${escapeHtmlAttr(listingUrl)}" class="flex flex-col h-full text-decoration-none text-inherit">
          <div class="relative aspect-[2/1] w-full bg-gray-100 overflow-hidden">
            <img 
              src="${escapeHtmlAttr(optimizedPhoto)}" 
              alt="${escapeHtmlAttr(l.name)}" 
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              loading="${isEager ? 'eager' : 'lazy'}" 
              ${isEager ? 'fetchpriority="high"' : ''}
              width="480" 
              height="240" 
              decoding="async"
            />
            ${l.isFeatured ? '<div class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Featured</div>' : ''}
            <div class="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-lg flex items-center gap-1 text-xs font-bold text-gray-800 shadow-xs">
              <span class="text-amber-500">★</span>
              <span>${rating}</span>
            </div>
          </div>
          <div class="p-4 flex-1 flex flex-col justify-between">
            <div>
              <h3 class="font-bold text-base text-gray-900 line-clamp-1 m-0 leading-snug">${escapeHtmlText(l.name)}</h3>
              <div class="text-gray-500 text-xs font-medium mt-1.5 flex items-center gap-1">
                <span class="text-[#e90b35]">📍</span>
                <span class="truncate">${escapeHtmlText(rawAddress)}</span>
              </div>
            </div>
            <div class="mt-3 pt-2.5 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
              <span class="font-medium text-gray-400 capitalize">${escapeHtmlText(Array.isArray(l.category) ? l.category[0] : (l.category || 'Halal'))}</span>
              <span class="text-[#e90b35] font-semibold">View →</span>
            </div>
          </div>
        </a>
      </article>
    `;
  }).join('\n');

  const newsCardsHtml = news.slice(0, 4).map(item => {
    const newsUrl = `/news/${item.slug || item.id}`;
    const coverUrl = item.coverImage ? (getOptimizedImageUrlSSR(item.coverImage, 400, 225) || item.coverImage) : '/ottawa-sunset.webp';
    const dateStr = item.publishDate || item.createdAt ? new Date(item.publishDate || item.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    return `
      <article class="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100 hover:shadow-md transition-all flex flex-col">
        <a href="${escapeHtmlAttr(newsUrl)}" class="flex flex-col h-full text-decoration-none text-inherit">
          <div class="aspect-[16/9] w-full bg-gray-100 overflow-hidden">
            <img src="${escapeHtmlAttr(coverUrl)}" alt="${escapeHtmlAttr(item.title)}" class="w-full h-full object-cover" loading="lazy" width="400" height="225" decoding="async" />
          </div>
          <div class="p-4 flex-1 flex flex-col justify-between">
            <h3 class="font-bold text-sm text-gray-900 line-clamp-2 m-0 leading-snug">${escapeHtmlText(item.title)}</h3>
            ${dateStr ? `<span class="text-xs text-gray-400 mt-2 block">${dateStr}</span>` : ''}
          </div>
        </a>
      </article>
    `;
  }).join('\n');

  return `
    <div class="w-full min-h-screen bg-gray-50" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Hero Section -->
      <section class="relative w-full h-[380px] sm:h-[440px] md:h-[500px] flex flex-col justify-center items-center px-4 overflow-hidden mb-8 md:mb-12">
        <div class="absolute inset-0 z-0">
          <img 
            src="/ottawa-sunset.webp" 
            alt="Halal Places in Ottawa" 
            class="w-full h-full object-cover brightness-[0.45] saturate-[1.2]" 
            fetchpriority="high"
            loading="eager"
            width="1920" 
            height="600"
            decoding="async"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/65 to-transparent"></div>
          <div class="absolute inset-0 bg-black/40"></div>
        </div>
        <div class="relative z-10 w-full max-w-3xl mx-auto text-center space-y-4 sm:space-y-6">
          <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight drop-shadow-md leading-tight m-0">
            Halal Places in Ottawa
          </h1>
          <p class="text-white/90 text-sm sm:text-base md:text-lg max-w-xl mx-auto font-normal drop-shadow-xs m-0">
            Discover verified halal restaurants, cafes, mosques, and local community news across the Ottawa Muslim community.
          </p>
          <div class="w-full max-w-2xl mx-auto pt-2">
            <form action="/listings" method="GET" class="relative w-full bg-white rounded-2xl shadow-xl overflow-hidden flex items-center p-1">
              <span class="pl-4 text-gray-400 text-lg">🔍</span>
              <input 
                type="text" 
                name="search" 
                placeholder="Search restaurants, mosques, or places..." 
                class="w-full pl-3 pr-4 py-3.5 sm:py-4 bg-white border-none text-gray-900 placeholder-gray-400 text-sm sm:text-base outline-none"
              />
              <button type="submit" class="bg-[#e90b35] text-white px-5 py-3 rounded-xl font-semibold text-sm hover:brightness-110 transition-all">Search</button>
            </form>
          </div>
        </div>
      </section>

      <!-- Main Content Container -->
      <div class="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 pb-16 space-y-10 md:space-y-14">
        <!-- Categories Grid -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900 m-0">Explore Categories</h2>
            <a href="/listings" class="text-[#e90b35] text-xs sm:text-sm font-semibold hover:underline text-decoration-none">All Directories →</a>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            ${categoryCardsHtml}
          </div>
        </section>

        <!-- Latest Listings Section -->
        <section class="space-y-4">
          <div class="flex justify-between items-end">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold text-gray-900 leading-tight m-0">Latest Listings</h2>
              <p class="text-xs sm:text-sm text-gray-500 mt-1 m-0">Recently added and verified halal places in Ottawa</p>
            </div>
            <a href="/restaurants" class="text-[#e90b35] text-xs sm:text-sm font-semibold hover:underline text-decoration-none">
              View all (${listings.length > 0 ? listings.length : '100+'}) →
            </a>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            ${listingCardsHtml}
          </div>
        </section>

        ${news.length > 0 ? `
        <!-- Latest News Section -->
        <section class="space-y-4">
          <div class="flex justify-between items-end">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold text-gray-900 leading-tight m-0">Community News</h2>
              <p class="text-xs sm:text-sm text-gray-500 mt-1 m-0">Updates, stories and announcements from Muslim Ottawa</p>
            </div>
            <a href="/news" class="text-[#e90b35] text-xs sm:text-sm font-semibold hover:underline text-decoration-none">
              View all news →
            </a>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            ${newsCardsHtml}
          </div>
        </section>` : ''}
      </div>
    </div>
  `;
}

/**
 * Static HTML for Category / Directory Listing Pages
 */
export function renderCategorySSRHtml(options: {
  title: string;
  h1Text: string;
  description: string;
  formattedCategory: string;
  urlPath: string;
  listings: any[];
}): string {
  const { h1Text, description, formattedCategory, urlPath, listings } = options;
  const isUnderRestaurants = urlPath.startsWith('/restaurants') || urlPath.startsWith('/restaurants/');
  const cleanUrlPath = urlPath.replace(/\/+$/, '');
  const categories = ['Restaurants', 'Mosques', 'Organizations', 'Grocery', 'Clothing', 'Schools', 'Butchers'];

  const categoryPillsHtml = categories.map(cat => {
    const slug = cat.toLowerCase();
    const isActive = !isUnderRestaurants && formattedCategory.toLowerCase() === cat.toLowerCase();
    const activeClass = isActive 
      ? 'background-color: #e90b35; color: #ffffff; border: 1px solid #e90b35;' 
      : 'background-color: #ffffff; color: #4b5563; border: 1px solid #e5e7eb;';
    return `<a href="/${slug}" style="padding: 8px 16px; border-radius: 9999px; font-size: 14px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; ${activeClass}">${escapeHtmlText(cat)}</a>`;
  }).join('\n');

  const locations = [
    { name: 'All Ottawa', path: '/restaurants' },
    { name: 'Orleans', path: '/restaurants/orleans' },
    { name: 'Kanata', path: '/restaurants/kanata' },
    { name: 'Barrhaven', path: '/restaurants/barrhaven' },
    { name: 'Downtown', path: '/restaurants/downtown' }
  ];

  const locationPillsHtml = locations.map(loc => {
    const isActive = cleanUrlPath === loc.path;
    const activeClass = isActive 
      ? 'background-color: #111827; color: #ffffff; border: 1px solid #111827;' 
      : 'background-color: #ffffff; color: #4b5563; border: 1px solid #e5e7eb;';
    return `<a href="${loc.path}" style="padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; ${activeClass}">📍 ${escapeHtmlText(loc.name)}</a>`;
  }).join('\n');

  const listingsCardsHtml = listings.length > 0 ? listings.map((l, idx) => {
    let catSlug = 'listings';
    if (Array.isArray(l.category) && l.category.length > 0) {
      catSlug = normalizeCategoryToSlug(l.category[0]);
    } else if (typeof l.category === 'string') {
      catSlug = normalizeCategoryToSlug(l.category);
    }
    const listingUrl = `/${catSlug}/${l.slug || l.id}`;
    const photoUrl = (l.photos && l.photos.length > 0) ? l.photos[0] : (l.coverImage || '/ottawa-sunset.webp');
    const optimizedPhoto = getOptimizedImageUrlSSR(photoUrl, 480, 240) || photoUrl;
    const rating = l.averageRating ? Number(l.averageRating).toFixed(1) : '5.0';
    const reviewCount = l.reviewCount || 0;
    const address = l.address ? escapeHtmlText(l.address) : 'Ottawa, ON';
    const isEager = idx < 2;

    return `
    <article style="background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #f3f4f6; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; text-decoration: none; color: inherit;">
      <a href="${escapeHtmlAttr(listingUrl)}" style="display: flex; flex-direction: column; text-decoration: none; color: inherit; height: 100%;">
        <div style="position: relative; width: 100%; height: 190px; background-color: #f3f4f6; overflow: hidden;">
          <img 
            src="${escapeHtmlAttr(optimizedPhoto)}" 
            alt="${escapeHtmlAttr(l.name)}" 
            style="width: 100%; height: 100%; object-fit: cover;" 
            loading="${isEager ? 'eager' : 'lazy'}"
            ${isEager ? 'fetchpriority="high"' : ''}
            width="480"
            height="240"
            decoding="async"
          />
          <div style="position: absolute; top: 12px; right: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #e90b35; background-color: rgba(254, 242, 242, 0.95); border: 1px solid #fee2e2; padding: 4px 8px; border-radius: 6px;">
            ${escapeHtmlText(Array.isArray(l.category) ? l.category[0] : (l.category || formattedCategory))}
          </div>
        </div>
        <div style="padding: 16px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <h2 style="font-size: 18px; font-weight: 700; line-height: 1.25; margin: 0; color: #111827;">${escapeHtmlText(l.name)}</h2>
              <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; background-color: #fefce8; color: #a16207; padding: 4px 8px; border-radius: 8px; white-space: nowrap;">
                ★ ${rating}
              </div>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin: 6px 0 0 0;">📍 ${address}</p>
            ${l.description ? `<p style="color: #4b5563; font-size: 13px; margin: 8px 0 0 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtmlText(l.description)}</p>` : ''}
          </div>
          <div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f9fafb; padding-top: 8px;">
            <span>${reviewCount} reviews</span>
            <span style="color: #e90b35; font-weight: 600;">View Details →</span>
          </div>
        </div>
      </a>
    </article>`;
  }).join('\n') : `
    <div style="text-align: center; padding: 48px 16px; grid-column: 1 / -1; background: #fafafa; border-radius: 16px; border: 1px dashed #e5e7eb;">
      <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Verified ${escapeHtmlText(formattedCategory)} in Ottawa</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0;">Explore local halal dining options, browse nearby neighborhoods, or submit a new community listing.</p>
      <a href="/restaurants" style="display: inline-block; background-color: #e90b35; color: #ffffff; padding: 8px 18px; border-radius: 9999px; text-decoration: none; font-size: 14px; font-weight: 700;">View All Halal Restaurants</a>
    </div>`;

  const breadcrumbsHtml = isUnderRestaurants && cleanUrlPath !== '/restaurants'
    ? `<nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; margin-bottom: 12px; display: flex; gap: 8px; align-items: center;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <a href="/restaurants" style="color: #6b7280; text-decoration: none;">Restaurants</a>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">${escapeHtmlText(formattedCategory)}</span>
      </nav>`
    : `<nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; margin-bottom: 12px; display: flex; gap: 8px; align-items: center;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">${escapeHtmlText(formattedCategory)}</span>
      </nav>`;

  return `
    <div class="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl xl:max-w-[1400px] mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${breadcrumbsHtml}

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <h1 style="font-size: 26px; font-weight: 800; color: #111827; margin: 0; letter-spacing: -0.025em;">${escapeHtmlText(h1Text)}</h1>
          <p style="font-size: 14px; color: #4b5563; margin-top: 6px; max-width: 800px; line-height: 1.5;">${escapeHtmlText(description)}</p>
        </div>
      </div>

      <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; flex-wrap: wrap;">
        <a href="/listings" style="padding: 8px 16px; border-radius: 9999px; font-size: 14px; font-weight: 700; text-decoration: none; background-color: #ffffff; color: #4b5563; border: 1px solid #e5e7eb;">All</a>
        ${categoryPillsHtml}
      </div>

      ${isUnderRestaurants ? `
      <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; margin-bottom: 20px; flex-wrap: wrap;">
        ${locationPillsHtml}
      </div>` : ''}

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
        ${listingsCardsHtml}
      </div>
    </div>
  `;
}

/**
 * Static HTML for Single Listing Detail Pages (LCP optimization)
 */
export function renderListingDetailSSRHtml(listing: any): string {
  const catArray = Array.isArray(listing.category) ? listing.category : (listing.category ? [listing.category] : ['Restaurants']);
  const mainCategory = catArray[0] || 'Restaurants';
  const catSlug = normalizeCategoryToSlug(mainCategory);
  const photoUrl = (listing.photos && listing.photos.length > 0) ? listing.photos[0] : (listing.coverImage || '/ottawa-sunset.webp');
  const optimizedPhoto = getOptimizedImageUrlSSR(photoUrl, 1920, 600) || photoUrl;
  const rating = listing.averageRating ? Number(listing.averageRating).toFixed(1) : '5.0';
  const reviewCount = listing.reviewCount || 0;
  const address = listing.address || 'Ottawa, ON';
  const phone = listing.phoneNumber;
  const website = listing.website;
  const description = listing.description || '';

  const typesArray = Array.isArray(listing.types) ? listing.types : (listing.types ? [listing.types] : []);
  const cuisinesArray = Array.isArray(listing.cuisine) ? listing.cuisine : (listing.cuisine ? [listing.cuisine] : []);
  const tags = Array.from(new Set([...typesArray, ...cuisinesArray])).filter(Boolean).slice(0, 3);

  const tagsHtml = tags.map(tag => `
    <span class="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">
      ${escapeHtmlText(tag)}
    </span>
  `).join(' ');

  const galleryHtml = (listing.photos && listing.photos.length > 1) ? `
    <div class="space-y-4 pt-4 border-t border-gray-100">
      <h2 class="text-xl font-bold text-gray-900 m-0">Photos</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        ${listing.photos.slice(0, 4).map((p: string) => `
          <div class="aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100">
            <img src="${escapeHtmlAttr(getOptimizedImageUrlSSR(p, 400, 300) || p)}" alt="${escapeHtmlAttr(listing.name)}" class="w-full h-full object-cover" loading="lazy" width="400" height="300" decoding="async" />
          </div>
        `).join('\n')}
      </div>
    </div>
  ` : '';

  return `
    <div class="min-h-screen bg-gray-50 pb-16" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-xs md:overflow-hidden md:border md:border-gray-100">
        <!-- Hero Banner with LCP Image -->
        <div class="relative h-72 sm:h-80 md:h-96 bg-slate-900 overflow-hidden">
          <img 
            src="${escapeHtmlAttr(optimizedPhoto)}" 
            alt="${escapeHtmlAttr(listing.name)}" 
            class="absolute inset-0 w-full h-full object-cover object-center" 
            fetchpriority="high" 
            loading="eager" 
            width="1920" 
            height="600"
            decoding="async"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent"></div>
          ${listing.isFeatured ? '<div class="absolute top-4 left-4 bg-[#e90b35] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-md">Featured</div>' : ''}
          
          <div class="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2.5 flex-wrap text-white">
                <a href="/${catSlug}" class="bg-[#e90b35] text-white border border-[#e90b35] px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase text-decoration-none shadow-xs">
                  ${escapeHtmlText(mainCategory)}
                </a>
                ${tagsHtml}
              </div>
              <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-white m-0 drop-shadow-md">${escapeHtmlText(listing.name)}</h1>
              <div class="flex items-center gap-3 mt-2 text-sm text-white/90">
                <div class="flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                  <span class="text-amber-400">★</span>
                  <span class="font-bold">${rating}</span>
                  <span class="text-white/70 text-xs">(${reviewCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Body -->
        <div class="p-6 md:p-8 space-y-6">
          <!-- Breadcrumbs -->
          <nav aria-label="Breadcrumb" class="flex gap-2 text-xs text-gray-500 items-center">
            <a href="/" class="text-gray-500 hover:text-gray-900 text-decoration-none">Home</a>
            <span>/</span>
            <a href="/${catSlug}" class="text-gray-500 hover:text-gray-900 text-decoration-none">${escapeHtmlText(mainCategory)}</a>
            <span>/</span>
            <span class="text-gray-900 font-semibold truncate">${escapeHtmlText(listing.name)}</span>
          </nav>

          <!-- Quick Info Strip -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-100 bg-gray-50/50 rounded-2xl p-4">
            <div class="flex items-start gap-3">
              <span class="text-xl">📍</span>
              <div>
                <span class="text-[11px] font-bold uppercase text-gray-400 block">Address</span>
                <span class="text-sm font-semibold text-gray-800">${escapeHtmlText(address)}</span>
              </div>
            </div>
            ${phone ? `
            <div class="flex items-start gap-3">
              <span class="text-xl">📞</span>
              <div>
                <span class="text-[11px] font-bold uppercase text-gray-400 block">Phone</span>
                <a href="tel:${escapeHtmlAttr(phone)}" class="text-sm font-semibold text-[#e90b35] text-decoration-none">${escapeHtmlText(phone)}</a>
              </div>
            </div>` : ''}
            ${website ? `
            <div class="flex items-start gap-3">
              <span class="text-xl">🌐</span>
              <div>
                <span class="text-[11px] font-bold uppercase text-gray-400 block">Website</span>
                <a href="${escapeHtmlAttr(website.startsWith('http') ? website : `https://${website}`)}" target="_blank" rel="noopener noreferrer" class="text-sm font-semibold text-[#e90b35] text-decoration-none truncate block max-w-[180px]">Visit Website</a>
              </div>
            </div>` : ''}
            <div class="flex items-start gap-3">
              <span class="text-xl">✅</span>
              <div>
                <span class="text-[11px] font-bold uppercase text-gray-400 block">Halal Verification</span>
                <span class="text-sm font-semibold text-green-700">Community Verified</span>
              </div>
            </div>
          </div>

          <!-- Description Section -->
          ${description ? `
          <div class="space-y-2">
            <h2 class="text-xl font-bold text-gray-900 m-0">About ${escapeHtmlText(listing.name)}</h2>
            <p class="text-gray-600 text-sm md:text-base leading-relaxed whitespace-pre-line m-0">${escapeHtmlText(description)}</p>
          </div>` : ''}

          ${galleryHtml}

          <!-- Operating Hours / Location -->
          <div class="space-y-2 pt-4 border-t border-gray-100">
            <h2 class="text-xl font-bold text-gray-900 m-0">Location & Details</h2>
            <p class="text-gray-600 text-sm m-0">📍 ${escapeHtmlText(address)}</p>
            ${listing.openingHours ? `<p class="text-gray-500 text-xs mt-1">🕒 Hours: ${escapeHtmlText(typeof listing.openingHours === 'string' ? listing.openingHours : JSON.stringify(listing.openingHours))}</p>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Static HTML for News Detail Pages
 */
export function renderNewsDetailSSRHtml(news: any): string {
  const coverUrl = news.coverImage ? (getOptimizedImageUrlSSR(news.coverImage, 1200, 600) || news.coverImage) : '/ottawa-sunset.webp';
  const dateStr = news.publishDate || news.createdAt ? new Date(news.publishDate || news.createdAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return `
    <div class="max-w-4xl mx-auto px-4 py-8" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" class="flex gap-2 text-xs text-gray-500 items-center mb-6">
        <a href="/" class="text-gray-500 hover:text-gray-900 text-decoration-none">Home</a>
        <span>/</span>
        <a href="/news" class="text-gray-500 hover:text-gray-900 text-decoration-none">News</a>
        <span>/</span>
        <span class="text-gray-900 font-semibold truncate">${escapeHtmlText(news.title)}</span>
      </nav>

      <article class="bg-white rounded-3xl overflow-hidden shadow-xs border border-gray-100">
        <div class="aspect-[16/9] w-full bg-gray-100 overflow-hidden relative">
          <img src="${escapeHtmlAttr(coverUrl)}" alt="${escapeHtmlAttr(news.title)}" class="w-full h-full object-cover" fetchpriority="high" loading="eager" width="1200" height="675" decoding="async" />
        </div>
        <div class="p-6 md:p-10 space-y-4">
          <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight m-0">${escapeHtmlText(news.title)}</h1>
          <div class="flex items-center gap-4 text-xs text-gray-500 pb-4 border-b border-gray-100">
            ${dateStr ? `<span>📅 Published: ${dateStr}</span>` : ''}
            ${news.author ? `<span>✍️ By: ${escapeHtmlText(news.author)}</span>` : ''}
          </div>
          <div class="text-gray-700 text-base leading-relaxed whitespace-pre-line pt-2">
            ${escapeHtmlText(news.content || news.description || '')}
          </div>
        </div>
      </article>
    </div>
  `;
}

/**
 * Static HTML for News List Hub Page (/news)
 */
export function renderNewsListSSRHtml(articles: any[] = []): string {
  const newsList = articles.length > 0 ? articles : [];

  const newsCardsHtml = newsList.map((article, idx) => {
    const articleUrl = `/news/${article.slug || article.id}`;
    const coverUrl = article.coverImage ? (getOptimizedImageUrlSSR(article.coverImage, 400, 200) || article.coverImage) : '/ottawa-sunset.webp';
    const dateStr = article.publishDate || article.createdAt ? new Date(article.publishDate || article.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    return `
      <article class="bg-white rounded-3xl overflow-hidden shadow-xs border border-gray-100 hover:shadow-md transition-all flex flex-col">
        <a href="${escapeHtmlAttr(articleUrl)}" class="flex flex-col h-full text-decoration-none text-inherit">
          <div class="relative aspect-[16/9] w-full bg-gray-100 overflow-hidden">
            <img 
              src="${escapeHtmlAttr(coverUrl)}" 
              alt="${escapeHtmlAttr(article.title)}" 
              class="w-full h-full object-cover" 
              loading="${idx < 3 ? 'eager' : 'lazy'}" 
              ${idx < 3 ? 'fetchpriority="high"' : ''}
              width="400" 
              height="225" 
              decoding="async" 
            />
            ${article.isFeatured ? '<span class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Featured</span>' : ''}
          </div>
          <div class="p-5 flex-1 flex flex-col justify-between">
            <div>
              <h2 class="font-bold text-lg text-gray-900 leading-snug m-0 hover:text-[#e90b35] transition-colors">${escapeHtmlText(article.title)}</h2>
              <p class="mt-2 text-sm text-gray-500 line-clamp-3 leading-relaxed m-0">${escapeHtmlText(article.content || '')}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>📅 ${dateStr}</span>
              ${article.author ? `<span>✍️ ${escapeHtmlText(article.author)}</span>` : ''}
            </div>
          </div>
        </a>
      </article>
    `;
  }).join('\n');

  return `
    <div class="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl xl:max-w-[1400px] mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; display: flex; gap: 8px; align-items: center;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">News</span>
      </nav>

      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 style="font-size: 28px; font-weight: 800; color: #111827; margin: 0; letter-spacing: -0.025em;">Ottawa Muslim Community News</h1>
          <p style="font-size: 15px; color: #4b5563; margin-top: 6px; margin-bottom: 0;">Stay informed with local updates, mosque announcements, and stories from across Ottawa.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${newsCardsHtml}
      </div>
    </div>
  `;
}

/**
 * Static HTML for FAQ Page (/faq)
 */
export function renderFAQSSRHtml(): string {
  const faqs = [
    {
      question: "What is Halal Ottawa?",
      answer: "Halal Ottawa is a community-driven platform designed to help residents and visitors discover halal-certified restaurants, grocery stores, mosques, schools, and organizations in the Ottawa region."
    },
    {
      question: "How can I add a business listing?",
      answer: "You can click on 'Add Listing' in the navigation menu. Fill out the business details (name, category, address, hours, photos), and submit it for review. Our team approves listings once verified."
    },
    {
      question: "Is it free to list my business?",
      answer: "Basic listings are completely free for all community businesses and organizations. We also offer featured listing options if you want increased visibility on our home page and search results."
    },
    {
      question: "How do you verify halal status?",
      answer: "We rely on a combination of community reporting, official certification agency data (such as HMA or HMS), and direct verification with business owners. If you notice any discrepancy, you can report it to us directly."
    },
    {
      question: "How can I suggest community news or updates?",
      answer: "You can submit community news, mosque announcements, or local stories by reaching out to our editorial team at info@halalottawa.ca. All submissions are reviewed to ensure they benefit the Ottawa Muslim community."
    },
    {
      question: "How do I report an incorrect listing?",
      answer: "If you find information that is outdated, incorrect, or a business that has closed, please contact us via email at info@halalottawa.ca with the listing name and details."
    }
  ];

  const faqsHtml = faqs.map(item => `
    <div class="border border-gray-100 rounded-2xl overflow-hidden bg-white p-6 shadow-xs">
      <h3 class="font-bold text-gray-900 text-base md:text-lg m-0">${escapeHtmlText(item.question)}</h3>
      <p class="mt-3 text-gray-600 text-sm md:text-base leading-relaxed m-0">${escapeHtmlText(item.answer)}</p>
    </div>
  `).join('\n');

  return `
    <div class="p-4 md:p-8 max-w-4xl mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; display: flex; gap: 8px; align-items: center; margin-bottom: 24px;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">FAQ</span>
      </nav>

      <div class="text-center space-y-3 mb-10">
        <div style="width: 56px; height: 56px; background-color: #fef2f2; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #e90b35; font-size: 24px;">
          ❓
        </div>
        <h1 style="font-size: 32px; font-weight: 800; color: #111827; margin: 0;">Frequently Asked Questions</h1>
        <p style="font-size: 15px; color: #6b7280; max-width: 600px; margin: 0 auto;">Everything you need to know about Halal Ottawa, how we verify listings, and community guidelines.</p>
      </div>

      <div class="space-y-4">
        ${faqsHtml}
      </div>

      <div class="mt-12 p-8 bg-red-50 rounded-3xl text-center">
        <h2 class="text-xl font-bold text-gray-900 m-0">Still have questions?</h2>
        <p class="text-gray-600 text-sm mt-2 mb-6">Our community team is here to assist you with any inquiries or feedback.</p>
        <a href="mailto:info@halalottawa.ca" class="inline-block px-6 py-3 bg-[#e90b35] text-white font-bold text-sm rounded-xl text-decoration-none shadow-md hover:brightness-110 transition-all">
          Contact Support
        </a>
      </div>
    </div>
  `;
}

/**
 * Static HTML for Privacy Policy (/privacy-policy)
 */
export function renderPrivacyPolicySSRHtml(): string {
  return `
    <div class="p-4 md:p-8 max-w-4xl mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; display: flex; gap: 8px; align-items: center; margin-bottom: 24px;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">Privacy Policy</span>
      </nav>

      <div class="bg-white rounded-3xl border border-gray-100 p-6 md:p-12 shadow-xs space-y-8">
        <div class="text-center space-y-3 pb-6 border-b border-gray-100">
          <div style="width: 56px; height: 56px; background-color: #fef2f2; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #e90b35; font-size: 24px;">
            🛡️
          </div>
          <h1 style="font-size: 32px; font-weight: 800; color: #111827; margin: 0;">Privacy Policy</h1>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">Last updated: March 25, 2026</p>
        </div>

        <div class="space-y-6 text-gray-700 text-sm md:text-base leading-relaxed">
          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">1. Introduction</h2>
            <p>Halal Ottawa ("we", "us", or "our") is committed to protecting the privacy of our community members in Ontario and across Canada. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application. We comply with the Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable Canadian privacy legislation.</p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">2. Information We Collect</h2>
            <p>We collect information that you voluntarily provide to us when using our platform:</p>
            <ul class="list-disc pl-6 space-y-1 mt-2 text-gray-600">
              <li><strong>Account Details:</strong> When you sign in via Google or email, we receive your name, email address, and profile photo.</li>
              <li><strong>Community Content:</strong> Listings, reviews, comments, and community news submissions you provide.</li>
              <li><strong>Saved Items:</strong> Bookmarks and preferences saved to your account.</li>
              <li><strong>Technical Data:</strong> Device type, browser information, and non-identifying usage telemetry.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">3. How We Use Your Information</h2>
            <p>We use your information to operate and maintain the Halal Ottawa directory, verify submitted business listings, display your author profile on verified reviews, moderate community submissions, and improve platform performance.</p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">4. Data Sharing & Disclosure</h2>
            <p>We never sell your personal information. Information is only shared with trusted infrastructure providers (such as Google Cloud / Firebase) for authentication and data storage, or when required by Canadian law.</p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">5. Contact Us</h2>
            <p>If you have any questions or requests regarding your personal information, please contact us at <a href="mailto:privacy@halalottawa.ca" class="text-[#e90b35] font-semibold">privacy@halalottawa.ca</a>.</p>
          </section>
        </div>
      </div>
    </div>
  `;
}

/**
 * Static HTML for Terms of Service (/terms)
 */
export function renderTermsSSRHtml(): string {
  return `
    <div class="p-4 md:p-8 max-w-4xl mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; display: flex; gap: 8px; align-items: center; margin-bottom: 24px;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">Terms of Service</span>
      </nav>

      <div class="bg-white rounded-3xl border border-gray-100 p-6 md:p-12 shadow-xs space-y-8">
        <div class="text-center space-y-3 pb-6 border-b border-gray-100">
          <div style="width: 56px; height: 56px; background-color: #fef2f2; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #e90b35; font-size: 24px;">
            📄
          </div>
          <h1 style="font-size: 32px; font-weight: 800; color: #111827; margin: 0;">Terms of Service</h1>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">Last updated: April 29, 2026</p>
        </div>

        <div class="space-y-6 text-gray-700 text-sm md:text-base leading-relaxed">
          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>By accessing and using Halal Ottawa, you agree to be bound by these Terms of Service and all applicable Canadian laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">2. Use License</h2>
            <p>Permission is granted to view and access the directory content on Halal Ottawa for personal, non-commercial use. You may not scrape, mirror, or reverse engineer platform components without explicit permission.</p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">3. User Content & Submissions</h2>
            <p>By posting reviews, listings, or articles, you grant Halal Ottawa a non-exclusive license to display such content. You are responsible for ensuring your submissions are truthful, accurate, and comply with halal dietary and community standards.</p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">4. Disclaimers & Halal Verification</h2>
            <p>While Halal Ottawa takes rigorous measures to verify halal certification and community reports, users are encouraged to confirm directly with establishments regarding specific dietary preferences, hand-slaughtered zabihah requirements, or cross-contamination policies.</p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-gray-900 mb-2">5. Governing Law</h2>
            <p>These terms and conditions are governed by and construed in accordance with the laws of Ontario, Canada.</p>
          </section>
        </div>
      </div>
    </div>
  `;
}

/**
 * Static HTML for Qibla Direction Page (/tools/qibla or /qibla)
 */
export function renderQiblaSSRHtml(): string {
  return `
    <div class="p-4 md:p-8 max-w-4xl mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; display: flex; gap: 8px; align-items: center; margin-bottom: 24px;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <span style="color: #6b7280;">Tools</span>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">Qibla Direction</span>
      </nav>

      <div class="text-center space-y-3 mb-8">
        <div style="width: 56px; height: 56px; background-color: #ecfdf5; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #059669; font-size: 24px;">
          🧭
        </div>
        <h1 style="font-size: 32px; font-weight: 800; color: #111827; margin: 0;">Ottawa Qibla Direction</h1>
        <p style="font-size: 15px; color: #6b7280; max-width: 600px; margin: 0 auto;">Find the precise Kaaba direction from Ottawa, Ontario towards Makkah al-Mukarramah.</p>
      </div>

      <div class="bg-white rounded-3xl border border-gray-100 p-6 md:p-10 shadow-xs text-center space-y-6">
        <div class="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
          Ottawa Bearing: 55.8° North-East
        </div>

        <div class="relative w-48 h-48 sm:w-64 sm:h-64 mx-auto rounded-full border-4 border-emerald-100 flex items-center justify-center bg-gray-50 shadow-inner">
          <div style="position: absolute; top: 12px; font-weight: 800; color: #dc2626; font-size: 14px;">N</div>
          <div style="position: absolute; bottom: 12px; font-weight: 800; color: #6b7280; font-size: 14px;">S</div>
          <div style="position: absolute; right: 12px; font-weight: 800; color: #6b7280; font-size: 14px;">E</div>
          <div style="position: absolute; left: 12px; font-weight: 800; color: #6b7280; font-size: 14px;">W</div>
          <div style="transform: rotate(55.8deg); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <span style="font-size: 36px; color: #059669;">🕋</span>
            <span style="font-size: 11px; font-weight: 700; color: #059669;">Qibla (55.8°)</span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center pt-4 border-t border-gray-100">
          <div class="bg-gray-50 p-4 rounded-2xl">
            <span class="text-xs text-gray-500 font-medium">True Bearing</span>
            <p class="text-lg font-bold text-gray-900 m-0 mt-1">55.8° NE</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-2xl">
            <span class="text-xs text-gray-500 font-medium">Distance to Kaaba</span>
            <p class="text-lg font-bold text-gray-900 m-0 mt-1">~10,250 km</p>
          </div>
          <div class="bg-gray-50 p-4 rounded-2xl">
            <span class="text-xs text-gray-500 font-medium">Ottawa Coordinates</span>
            <p class="text-lg font-bold text-gray-900 m-0 mt-1">45.42° N, 75.70° W</p>
          </div>
        </div>

        <div class="text-left bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl space-y-3">
          <h3 class="text-base font-bold text-emerald-950 m-0">How to Align Your Prayer in Ottawa</h3>
          <p class="text-sm text-emerald-900/80 leading-relaxed m-0">
            From the National Capital Region (Ottawa & Gatineau), face approximately North-East (about 56 degrees clockwise from True North). On mobile devices with compass sensors enabled, the interactive live dial will auto-calibrate to your exact orientation.
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Static HTML for Saved Items Page (/saved)
 */
export function renderSavedItemsSSRHtml(): string {
  return `
    <div class="p-4 md:p-8 max-w-4xl mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; display: flex; gap: 8px; align-items: center; margin-bottom: 24px;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">Saved Items</span>
      </nav>

      <div class="bg-white rounded-3xl border border-gray-100 p-8 md:p-12 shadow-xs text-center space-y-4">
        <div style="width: 64px; height: 64px; background-color: #fef2f2; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #e90b35; font-size: 28px;">
          🔖
        </div>
        <h1 style="font-size: 28px; font-weight: 800; color: #111827; margin: 0;">Saved Places & Articles</h1>
        <p style="font-size: 15px; color: #6b7280; max-width: 500px; margin: 0 auto;">Keep track of your favorite Ottawa halal restaurants, grocery spots, and community news.</p>
        
        <div class="pt-6 flex flex-wrap gap-3 justify-center">
          <a href="/restaurants" class="px-5 py-2.5 bg-[#e90b35] text-white font-bold text-sm rounded-xl text-decoration-none shadow-md hover:brightness-110 transition-all">
            Explore Restaurants
          </a>
          <a href="/mosques" class="px-5 py-2.5 bg-gray-100 text-gray-800 font-bold text-sm rounded-xl text-decoration-none hover:bg-gray-200 transition-all">
            Find Mosques
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Static HTML for Login Page (/login)
 */
export function renderLoginSSRHtml(): string {
  return `
    <div class="p-4 md:p-8 max-w-md mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="bg-white rounded-3xl border border-gray-100 p-8 shadow-xs text-center space-y-6">
        <div style="width: 56px; height: 56px; background-color: #fef2f2; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #e90b35; font-size: 24px;">
          🍁
        </div>
        <div>
          <h1 style="font-size: 24px; font-weight: 800; color: #111827; margin: 0;">Sign In to Halal Ottawa</h1>
          <p style="font-size: 14px; color: #6b7280; margin-top: 6px; margin-bottom: 0;">Access your saved places, leave verified reviews, and contribute to the community directory.</p>
        </div>

        <div class="space-y-3 pt-2">
          <div class="w-full py-3.5 px-4 border border-gray-200 rounded-2xl text-gray-700 font-bold text-sm bg-gray-50 flex items-center justify-center gap-3">
            <span>Continue with Google</span>
          </div>
          <div class="w-full py-3.5 px-4 border border-gray-200 rounded-2xl text-gray-700 font-bold text-sm bg-gray-50 flex items-center justify-center gap-3">
            <span>Sign in with Email</span>
          </div>
        </div>

        <p class="text-xs text-gray-400">
          By signing in, you agree to Halal Ottawa's <a href="/terms" class="text-gray-600 underline">Terms of Service</a> and <a href="/privacy-policy" class="text-gray-600 underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  `;
}

/**
 * Static HTML for Add Listing Page (/listings/add)
 */
export function renderAddListingSSRHtml(): string {
  return `
    <div class="p-4 md:p-8 max-w-3xl mx-auto" style="min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #6b7280; display: flex; gap: 8px; align-items: center; margin-bottom: 24px;">
        <a href="/" style="color: #6b7280; text-decoration: none;">Home</a>
        <span>/</span>
        <a href="/listings" style="color: #6b7280; text-decoration: none;">Listings</a>
        <span>/</span>
        <span style="color: #111827; font-weight: 600;">Add Listing</span>
      </nav>

      <div class="bg-white rounded-3xl border border-gray-100 p-6 md:p-10 shadow-xs space-y-6">
        <div>
          <h1 style="font-size: 28px; font-weight: 800; color: #111827; margin: 0;">Submit a Place in Ottawa</h1>
          <p style="font-size: 14px; color: #6b7280; margin-top: 6px; margin-bottom: 0;">Help Ottawa Muslims discover certified halal restaurants, grocery markets, mosques, and schools.</p>
        </div>

        <div class="p-4 bg-red-50/70 border border-red-100 rounded-2xl text-sm text-red-900 space-y-2">
          <strong>Community Guidelines:</strong>
          <ul class="list-disc pl-5 space-y-1 text-xs text-red-800 m-0">
            <li>Establishment must be located within the Greater Ottawa & Gatineau region.</li>
            <li>Food businesses must offer certified halal meat or 100% halal menu options.</li>
            <li>All submissions undergo verification by community moderators before public listing.</li>
          </ul>
        </div>

        <div class="space-y-4 pt-2">
          <div class="p-4 border border-gray-100 rounded-2xl bg-gray-50">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Step 1: Business Details</span>
            <p class="text-sm text-gray-700 mt-1 m-0">Name, category (Restaurant, Mosque, Grocery, School, Butcher, Clothing), address, and phone number.</p>
          </div>
          <div class="p-4 border border-gray-100 rounded-2xl bg-gray-50">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Step 2: Halal & Dietary Information</span>
            <p class="text-sm text-gray-700 mt-1 m-0">Halal certification body, hand-slaughtered zabihah status, pork/alcohol free declaration.</p>
          </div>
          <div class="p-4 border border-gray-100 rounded-2xl bg-gray-50">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Step 3: Operating Hours & Photos</span>
            <p class="text-sm text-gray-700 mt-1 m-0">Upload storefront and interior photos, add operating hours and social links.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Static HTML for 404 Not Found Pages
 */
export function renderNotFoundSSRHtml(): string {
  return `
    <div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center justify-center" style="min-height: 70vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="bg-white rounded-3xl border border-gray-100 p-8 md:p-12 shadow-xs text-center space-y-6 w-full">
        <div style="width: 72px; height: 72px; background-color: #fef2f2; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: #e90b35; font-size: 32px; font-weight: 800;">
          404
        </div>
        <div>
          <h1 style="font-size: 28px; font-weight: 800; color: #111827; margin: 0;">Page Not Found</h1>
          <p style="font-size: 15px; color: #6b7280; margin-top: 8px; margin-bottom: 0;">Sorry, we couldn't find the page you're looking for on Halal Ottawa. It may have moved or been updated.</p>
        </div>

        <div class="pt-4 flex flex-wrap gap-3 justify-center">
          <a href="/" class="px-6 py-3 bg-[#e90b35] text-white font-bold text-sm rounded-xl text-decoration-none shadow-md hover:brightness-110 transition-all">
            Return to Home
          </a>
          <a href="/listings" class="px-6 py-3 bg-gray-100 text-gray-800 font-bold text-sm rounded-xl text-decoration-none hover:bg-gray-200 transition-all">
            Browse All Listings
          </a>
          <a href="/news" class="px-6 py-3 bg-gray-100 text-gray-800 font-bold text-sm rounded-xl text-decoration-none hover:bg-gray-200 transition-all">
            Community News
          </a>
        </div>
      </div>
    </div>
  `;
}

