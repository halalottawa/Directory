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
  if (lowerUrl.startsWith('data:') || lowerUrl.endsWith('.svg') || lowerUrl.includes('google.com/images/') || lowerUrl.includes('.gstatic.com/')) {
    return url;
  }
  let targetUrl = url;
  const uploadIdx = url.indexOf('/uploads/');
  if (uploadIdx !== -1) {
    targetUrl = url.substring(uploadIdx);
  }
  if (targetUrl.includes('googleusercontent.com') || targetUrl.includes('ggpht.com')) {
    const baseUrl = targetUrl.split('=')[0];
    const params = [];
    if (width) params.push(`w${width}`);
    if (height) params.push(`h${height}`);
    params.push('c');
    return `${baseUrl}=${params.join('-')}`;
  }
  if (targetUrl.includes('images.unsplash.com')) {
    try {
      const urlObj = new URL(targetUrl);
      urlObj.searchParams.set('w', width.toString());
      if (height) urlObj.searchParams.set('h', height.toString());
      urlObj.searchParams.set('q', '85');
      urlObj.searchParams.set('fit', 'crop');
      urlObj.searchParams.set('auto', 'format');
      return urlObj.toString();
    } catch {
      return targetUrl;
    }
  }
  if (targetUrl.includes('res.cloudinary.com')) {
    const parts = targetUrl.split('/upload/');
    if (parts.length === 2) {
      const transform = `w_${width}${height ? `,h_${height}` : ''},c_fill,q_85,f_auto`;
      return `${parts[0]}/upload/${transform}/${parts[1]}`;
    }
  }
  const params: string[] = [`url=${encodeURIComponent(targetUrl)}`, `w=${width}`];
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

  const eventsCardsHtml = events.slice(0, 4).map(item => {
    const eventUrl = `/events/${item.slug || item.id}`;
    const coverUrl = item.coverImage ? (getOptimizedImageUrlSSR(item.coverImage, 400, 225) || item.coverImage) : '/ottawa-sunset.webp';
    const dateStr = item.dateTime || item.date ? new Date(item.dateTime || item.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    return `
      <article class="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100 hover:shadow-md transition-all flex flex-col">
        <a href="${escapeHtmlAttr(eventUrl)}" class="flex flex-col h-full text-decoration-none text-inherit">
          <div class="aspect-[16/9] w-full bg-gray-100 overflow-hidden">
            <img src="${escapeHtmlAttr(coverUrl)}" alt="${escapeHtmlAttr(item.title)}" class="w-full h-full object-cover" loading="lazy" width="400" height="225" decoding="async" />
          </div>
          <div class="p-4 flex-1 flex flex-col justify-between">
            <h3 class="font-bold text-sm text-gray-900 line-clamp-2 m-0 leading-snug">${escapeHtmlText(item.title)}</h3>
            <div class="mt-2 text-xs text-gray-500 flex items-center justify-between">
              <span>📅 ${dateStr}</span>
              ${item.location ? `<span class="truncate max-w-[120px]">📍 ${escapeHtmlText(item.location)}</span>` : ''}
            </div>
          </div>
        </a>
      </article>
    `;
  }).join('\n');

  const jobsCardsHtml = jobs.slice(0, 4).map(item => {
    const jobUrl = `/jobs/${item.slug || item.id}`;
    return `
      <article class="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 hover:shadow-md transition-all flex flex-col justify-between">
        <a href="${escapeHtmlAttr(jobUrl)}" class="text-decoration-none text-inherit">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[10px] font-bold text-[#e90b35] uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-md">${escapeHtmlText(item.type || 'Full-time')}</span>
              <h3 class="font-bold text-base text-gray-900 mt-2 m-0 line-clamp-1">${escapeHtmlText(item.title)}</h3>
              <p class="text-sm text-gray-600 mt-1 m-0">${escapeHtmlText(item.company || 'Ottawa Business')}</p>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
            <span>📍 ${escapeHtmlText(item.location || 'Ottawa, ON')}</span>
            <span class="text-[#e90b35] font-semibold">Apply →</span>
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
            Discover verified halal restaurants, cafes, mosques, local events, news, and job opportunities across the Ottawa Muslim community.
          </p>
          <div class="w-full max-w-2xl mx-auto pt-2">
            <form action="/listings" method="GET" class="relative w-full bg-white rounded-2xl shadow-xl overflow-hidden flex items-center p-1">
              <span class="pl-4 text-gray-400 text-lg">🔍</span>
              <input 
                type="text" 
                name="search" 
                placeholder="Search restaurants, mosques, events, or jobs..." 
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

        ${events.length > 0 ? `
        <!-- Upcoming Events Section -->
        <section class="space-y-4">
          <div class="flex justify-between items-end">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold text-gray-900 leading-tight m-0">Upcoming Events</h2>
              <p class="text-xs sm:text-sm text-gray-500 mt-1 m-0">Local gatherings, lectures, fundraisers and festivals</p>
            </div>
            <a href="/events" class="text-[#e90b35] text-xs sm:text-sm font-semibold hover:underline text-decoration-none">
              View all events →
            </a>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            ${eventsCardsHtml}
          </div>
        </section>` : ''}

        ${jobs.length > 0 ? `
        <!-- Job Opportunities Section -->
        <section class="space-y-4">
          <div class="flex justify-between items-end">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold text-gray-900 leading-tight m-0">Job Opportunities</h2>
              <p class="text-xs sm:text-sm text-gray-500 mt-1 m-0">Local openings with businesses and organizations</p>
            </div>
            <a href="/jobs" class="text-[#e90b35] text-xs sm:text-sm font-semibold hover:underline text-decoration-none">
              View all jobs →
            </a>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            ${jobsCardsHtml}
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
 * Static HTML for Event Detail Pages
 */
export function renderEventDetailSSRHtml(event: any): string {
  const coverUrl = event.coverImage ? (getOptimizedImageUrlSSR(event.coverImage, 1200, 600) || event.coverImage) : '/ottawa-sunset.webp';
  const dateStr = event.dateTime || event.date ? new Date(event.dateTime || event.date).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return `
    <div class="max-w-4xl mx-auto px-4 py-8" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" class="flex gap-2 text-xs text-gray-500 items-center mb-6">
        <a href="/" class="text-gray-500 hover:text-gray-900 text-decoration-none">Home</a>
        <span>/</span>
        <a href="/events" class="text-gray-500 hover:text-gray-900 text-decoration-none">Events</a>
        <span>/</span>
        <span class="text-gray-900 font-semibold truncate">${escapeHtmlText(event.title)}</span>
      </nav>

      <article class="bg-white rounded-3xl overflow-hidden shadow-xs border border-gray-100">
        <div class="aspect-[16/9] w-full bg-gray-100 overflow-hidden relative">
          <img src="${escapeHtmlAttr(coverUrl)}" alt="${escapeHtmlAttr(event.title)}" class="w-full h-full object-cover" fetchpriority="high" loading="eager" width="1200" height="675" decoding="async" />
        </div>
        <div class="p-6 md:p-10 space-y-4">
          <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight m-0">${escapeHtmlText(event.title)}</h1>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4 border-y border-gray-100 bg-gray-50 rounded-2xl p-4 text-sm">
            ${dateStr ? `<div><strong>Date & Time:</strong> ${dateStr}</div>` : ''}
            ${event.location ? `<div><strong>Location:</strong> 📍 ${escapeHtmlText(event.location)}</div>` : ''}
            ${event.organizer ? `<div><strong>Organizer:</strong> ${escapeHtmlText(event.organizer)}</div>` : ''}
            ${event.price ? `<div><strong>Price:</strong> ${escapeHtmlText(event.price)}</div>` : ''}
          </div>
          <div class="text-gray-700 text-base leading-relaxed whitespace-pre-line pt-2">
            ${escapeHtmlText(event.description || '')}
          </div>
        </div>
      </article>
    </div>
  `;
}

/**
 * Static HTML for Job Detail Pages
 */
export function renderJobDetailSSRHtml(job: any): string {
  return `
    <div class="max-w-4xl mx-auto px-4 py-8" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <nav aria-label="Breadcrumb" class="flex gap-2 text-xs text-gray-500 items-center mb-6">
        <a href="/" class="text-gray-500 hover:text-gray-900 text-decoration-none">Home</a>
        <span>/</span>
        <a href="/jobs" class="text-gray-500 hover:text-gray-900 text-decoration-none">Jobs</a>
        <span>/</span>
        <span class="text-gray-900 font-semibold truncate">${escapeHtmlText(job.title)}</span>
      </nav>

      <article class="bg-white rounded-3xl overflow-hidden shadow-xs border border-gray-100 p-6 md:p-10 space-y-6">
        <div>
          <span class="bg-red-50 text-[#e90b35] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">${escapeHtmlText(job.type || 'Full-time')}</span>
          <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mt-3 m-0">${escapeHtmlText(job.title)}</h1>
          <p class="text-lg text-gray-600 font-medium mt-1 m-0">${escapeHtmlText(job.company || 'Ottawa Business')}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4 border-y border-gray-100 bg-gray-50 rounded-2xl p-4 text-sm">
          <div><strong>Location:</strong> 📍 ${escapeHtmlText(job.location || 'Ottawa, ON')}</div>
          ${job.salary ? `<div><strong>Salary:</strong> 💰 ${escapeHtmlText(job.salary)}</div>` : ''}
          ${job.deadline ? `<div><strong>Deadline:</strong> ⏰ ${escapeHtmlText(job.deadline)}</div>` : ''}
        </div>
        <div class="text-gray-700 text-base leading-relaxed whitespace-pre-line">
          ${escapeHtmlText(job.description || '')}
        </div>
      </article>
    </div>
  `;
}
