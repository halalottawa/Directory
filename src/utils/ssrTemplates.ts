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

  const categories = [
    { 
      name: 'Restaurants', 
      slug: 'restaurants', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 2v6a3 3 0 01-3 3 3 3 0 01-3-3V2m-3 0v6a3 3 0 003 3 3 3 0 003-3V2M6 2v20m0-11a3 3 0 003-3V2M6 8a3 3 0 00-3-3V2"></path></svg>'
    },
    { 
      name: 'Mosques', 
      slug: 'mosques', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>'
    },
    { 
      name: 'Organizations', 
      slug: 'organizations', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>'
    },
    { 
      name: 'Grocery', 
      slug: 'grocery', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>'
    },
    { 
      name: 'Clothing', 
      slug: 'clothing', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.5a2 2 0 001.24 1.54L6 11.5V20a2 2 0 002 2h8a2 2 0 002-2v-8.5l1.9-0.77a2 2 0 001.24-1.54l.58-3.5a2 2 0 00-1.34-2.23z"></path></svg>'
    },
    { 
      name: 'Schools', 
      slug: 'schools', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5"></path></svg>'
    },
    { 
      name: 'Butchers', 
      slug: 'butchers', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2"></circle><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 7v5l3 3"></path></svg>'
    },
  ];

  const categoryCardsMobileHtml = categories.slice(0, 6).map(cat => `
    <a href="/${cat.slug}" aria-label="Browse ${escapeHtmlAttr(cat.name)} category" class="flex flex-col items-center gap-2 p-4 bg-white border border-gray-50 rounded-2xl hover:shadow-md transition-all text-decoration-none">
      <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35]">
        ${cat.svg}
      </div>
      <span class="text-[10px] font-bold uppercase tracking-wider text-gray-600 text-center leading-tight">${escapeHtmlText(cat.name)}</span>
    </a>
  `).join('\n');

  const categoryCardsDesktopHtml = categories.map(cat => `
    <div class="flex-1 min-w-[130px]">
      <a href="/${cat.slug}" aria-label="Browse ${escapeHtmlAttr(cat.name)} category" class="flex flex-col items-center gap-2 p-4 bg-white border border-gray-50 rounded-2xl hover:shadow-md transition-all h-full text-decoration-none">
        <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35]">
          ${cat.svg}
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-600 text-center leading-tight">${escapeHtmlText(cat.name)}</span>
      </a>
    </div>
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
      <a href="${escapeHtmlAttr(listingUrl)}" class="min-w-[240px] md:min-w-0 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50 group hover:shadow-md transition-all text-decoration-none text-inherit block">
        <div class="relative aspect-[2/1] w-full bg-gray-100">
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
          ${l.isFeatured ? '<div class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>' : ''}
          <div class="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold text-gray-800">
            <svg class="w-3 h-3 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            <span>${rating}</span>
          </div>
        </div>
        <div class="p-4">
          <h3 class="font-bold leading-tight line-clamp-1 m-0 text-gray-900">${escapeHtmlText(l.name)}</h3>
          <div class="text-gray-500 text-xs font-semibold mt-2 flex items-center justify-between flex-wrap gap-2">
            <span class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>${escapeHtmlText(rawAddress)}</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }).join('\n');

  const newsCardsHtml = news.slice(0, 6).map((item, index) => {
    const newsUrl = `/news/${item.slug || item.id}`;
    const coverUrl = item.coverImage ? (getOptimizedImageUrlSSR(item.coverImage, 400, 192) || item.coverImage) : '/ottawa-sunset.webp';
    const dateStr = item.publishDate || item.createdAt ? new Date(item.publishDate || item.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const authorName = item.author || 'Youssef Agrebi';

    return `
      <a href="${escapeHtmlAttr(newsUrl)}" class="bg-white hover:shadow-md transition-all border border-gray-50 group flex md:flex-col gap-4 md:gap-0 p-3 md:p-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm text-decoration-none text-inherit ${index >= 3 ? 'hidden md:flex' : ''}">
        <div class="relative w-24 h-24 md:w-full md:h-48 aspect-square md:aspect-none shrink-0 bg-gray-100">
          <img src="${escapeHtmlAttr(coverUrl)}" alt="${escapeHtmlAttr(item.title)}" class="w-full h-full object-cover rounded-xl md:rounded-none group-hover:scale-105 transition-transform duration-500" loading="lazy" width="400" height="192" decoding="async" />
        </div>
        <div class="flex-1 flex flex-col justify-between py-1 md:p-5">
          <div>
            <h3 class="font-bold leading-tight m-0 text-gray-900 group-hover:text-[#e90b35] transition-colors">${escapeHtmlText(item.title)}</h3>
            <div class="hidden md:block">
              <p class="text-gray-500 text-sm line-clamp-2 leading-relaxed mt-2 m-0">${escapeHtmlText(item.content || '')}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 mt-3 md:mt-4 text-xs text-gray-400 font-semibold">
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${dateStr}</span>
            </span>
            <span class="flex items-center gap-1.5 text-gray-500 font-medium">
              <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>By ${escapeHtmlText(authorName)}</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }).join('\n');

  return `
    <div class="w-full" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Hero Section -->
      <section class="relative w-full h-[400px] md:h-[500px] lg:h-[550px] flex flex-col justify-center items-center px-4 overflow-hidden mb-8 md:mb-12">
        <div class="absolute inset-0 z-0">
          <img 
            src="https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/global-hero-1781326553984.webp" 
            alt="Ottawa Sunset" 
            class="w-full h-full object-cover brightness-[0.45] saturate-[1.2]" 
            fetchpriority="high"
            loading="eager"
            width="1920" 
            height="1080"
            decoding="async"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/65 to-transparent"></div>
          <div class="absolute inset-0 bg-black/55"></div>
        </div>
        <div class="relative z-10 w-full max-w-3xl mx-auto text-center space-y-6">
          <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight drop-shadow-lg leading-tight m-0">
            Halal Places in Ottawa
          </h1>
          <p class="text-white/95 text-sm md:text-lg max-w-xl mx-auto font-medium drop-shadow-md m-0">
            Discover verified halal restaurants, cafes, mosques, and local community news
          </p>
          <div class="w-full max-w-2xl mx-auto">
            <form action="/listings" method="GET" class="relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[#e90b35] transition-all flex items-center">
              <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input 
                type="text" 
                name="search" 
                placeholder="Search halal restaurants, mosques, or places in Ottawa..." 
                class="w-full pl-12 pr-4 py-4 md:py-5 bg-white border-none text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 text-sm md:text-base outline-none"
              />
            </form>
          </div>
        </div>
      </section>

      <!-- Main Content Container -->
      <div class="max-w-7xl xl:max-w-[1400px] mx-auto px-4 md:px-8 pb-12 space-y-8 md:space-y-12">
        <!-- Categories - Mobile Grid -->
        <section class="grid grid-cols-3 gap-3 md:hidden">
          ${categoryCardsMobileHtml}
        </section>

        <!-- Categories - Desktop Carousel -->
        <section class="hidden md:block relative group mb-8">
          <div class="overflow-x-auto py-2 scroll-smooth scrollbar-hide">
            <div class="flex gap-3">
              ${categoryCardsDesktopHtml}
            </div>
          </div>
        </section>

        <!-- Latest Listings Section -->
        <section class="space-y-4">
          <div class="flex justify-between items-end">
            <h2 class="text-xl md:text-2xl font-bold text-gray-900 leading-tight m-0">Latest Listings</h2>
            <a href="/listings" class="text-[#e90b35] text-sm md:text-base font-semibold hover:underline decoration-2 underline-offset-4 text-decoration-none">
              View all
            </a>
          </div>
          <div class="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0">
            ${listingCardsHtml}
          </div>
        </section>

        ${news.length > 0 ? `
        <!-- Latest News Section -->
        <section class="space-y-4">
          <div class="flex justify-between items-end">
            <h2 class="text-xl md:text-2xl font-bold text-gray-900 leading-tight m-0">Latest News</h2>
            <a href="/news" class="text-[#e90b35] text-sm md:text-base font-semibold hover:underline decoration-2 underline-offset-4 text-decoration-none">
              View all
            </a>
          </div>
          <div class="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
            ${newsCardsHtml}
          </div>
        </section>` : ''}

        <!-- FAQ Section -->
        <section class="hidden md:block space-y-8 pt-8 pb-4">
          <div class="text-center space-y-2">
            <h2 class="text-2xl font-bold text-gray-900 m-0">Frequently Asked Questions</h2>
            <p class="text-gray-500 m-0">Everything you need to know about Halal Ottawa</p>
          </div>
          <div class="space-y-4">
            <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm p-6">
              <h3 class="font-bold text-lg text-gray-900 m-0">How do I add my business to the directory?</h3>
              <p class="text-gray-500 text-sm leading-relaxed mt-2 m-0">You can add your business by clicking the "Add Listing" button or the "+" icon in the top right corner. Ensure you have an account and are logged in to submit your business details for approval.</p>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm p-6">
              <h3 class="font-bold text-lg text-gray-900 m-0">Is it free to list my business?</h3>
              <p class="text-gray-500 text-sm leading-relaxed mt-2 m-0">Yes! Basic listings are completely free. We also offer premium features to stand out and attract more customers, which you can explore in your dashboard.</p>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm p-6">
              <h3 class="font-bold text-lg text-gray-900 m-0">How are listings approved?</h3>
              <p class="text-gray-500 text-sm leading-relaxed mt-2 m-0">Our community moderators review all submitted listings within 24-48 hours. They verify the information to ensure quality standards our community expects.</p>
            </div>
          </div>
        </section>
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
  const categories = [
    { name: 'Restaurants', slug: 'restaurants' },
    { name: 'Mosques', slug: 'mosques' },
    { name: 'Organizations', slug: 'organizations' },
    { name: 'Grocery', slug: 'grocery' },
    { name: 'Clothing', slug: 'clothing' },
    { name: 'Schools', slug: 'schools' },
    { name: 'Butchers', slug: 'butchers' },
  ];

  const categoryPillsHtml = categories.map(cat => {
    const isActive = !isUnderRestaurants && formattedCategory.toLowerCase() === cat.name.toLowerCase();
    const activeClass = isActive 
      ? 'bg-[#e90b35] text-white shadow-md shadow-red-100' 
      : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50';
    return `<a href="/${cat.slug}" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all text-decoration-none ${activeClass}">${escapeHtmlText(cat.name)}</a>`;
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
      ? 'bg-gray-900 text-white' 
      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50';
    return `
      <a href="${loc.path}" class="px-3.5 py-1.5 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 text-decoration-none ${activeClass}">
        <svg class="w-3.5 h-3.5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        ${escapeHtmlText(loc.name)}
      </a>
    `;
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
    const optimizedPhoto = getOptimizedImageUrlSSR(photoUrl, 400, 192) || photoUrl;
    const rating = l.averageRating ? Number(l.averageRating).toFixed(1) : '5.0';
    const reviewCount = l.reviewCount || 0;
    const address = l.address ? escapeHtmlText(l.address.split(',')[0]) : 'Ottawa, ON';
    const mainCat = Array.isArray(l.category) ? (l.category[0] || 'Listing') : (l.category || 'Listing');
    const isEager = idx < 4;

    const typesArray = Array.isArray(l.types) ? l.types : (l.types ? [l.types] : []);
    const cuisinesArray = Array.isArray(l.cuisine) ? l.cuisine : (l.cuisine ? [l.cuisine] : []);
    const tags = Array.from(new Set([...typesArray, ...cuisinesArray])).filter(Boolean).slice(0, 2);

    return `
    <a href="${escapeHtmlAttr(listingUrl)}" class="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md border border-gray-50 flex flex-col sm:flex-row transition-all group text-decoration-none text-inherit">
      <div class="relative h-48 sm:w-48 sm:h-auto shrink-0 bg-gray-100">
        <img 
          src="${escapeHtmlAttr(optimizedPhoto)}" 
          alt="${escapeHtmlAttr(l.name)}" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          loading="${isEager ? 'eager' : 'lazy'}"
          ${isEager ? 'fetchpriority="high"' : ''}
          width="400"
          height="192"
          decoding="async"
        />
        <div class="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-[#e90b35] bg-red-50 border border-red-100 px-2 py-1 rounded-md shadow-md backdrop-blur-md bg-opacity-95">
          ${escapeHtmlText(mainCat)}
        </div>
        ${l.isFeatured ? '<div class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>' : ''}
      </div>
      <div class="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start">
            <h2 class="font-bold text-lg leading-tight group-hover:text-[#e90b35] transition-colors m-0 text-gray-900">${escapeHtmlText(l.name)}</h2>
            <div class="flex items-center gap-1 text-xs font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg">
              <svg class="w-3 h-3 fill-yellow-400 text-yellow-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
              <span>${rating}</span>
            </div>
          </div>
          <div class="text-gray-500 text-sm mt-1 flex items-center justify-between flex-wrap gap-2">
            <span class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>${address}</span>
            </span>
          </div>
          ${tags.length > 0 ? `
          <div class="flex flex-wrap gap-2 mt-3">
            ${tags.map(t => `<span class="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">${escapeHtmlText(t)}</span>`).join('')}
          </div>` : ''}
        </div>
        <div class="mt-4 flex justify-between items-center">
          <span class="text-xs text-gray-400">${reviewCount} reviews</span>
        </div>
      </div>
    </a>`;
  }).join('\n') : `
    <div class="col-span-full text-center py-12 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
      <p class="text-gray-900 text-base font-semibold mb-2">Verified ${escapeHtmlText(formattedCategory)} in Ottawa</p>
      <p class="text-gray-500 text-sm mb-4">Explore local halal dining options, browse nearby neighborhoods, or submit a new community listing.</p>
      <a href="/restaurants" class="inline-block bg-[#e90b35] text-white px-5 py-2 rounded-full font-bold text-sm text-decoration-none shadow-sm hover:bg-[#d00a2f]">View All Halal Restaurants</a>
    </div>`;

  const breadcrumbsHtml = isUnderRestaurants && cleanUrlPath !== '/restaurants'
    ? `<nav aria-label="Breadcrumbs" class="flex items-center gap-2 text-xs md:text-sm text-gray-500">
        <a href="/" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Home</a>
        <span class="text-gray-400">›</span>
        <a href="/restaurants" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Restaurants</a>
        <span class="text-gray-400">›</span>
        <span class="font-semibold text-gray-900">${escapeHtmlText(formattedCategory)}</span>
      </nav>`
    : `<nav aria-label="Breadcrumbs" class="flex items-center gap-2 text-xs md:text-sm text-gray-500">
        <a href="/" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Home</a>
        <span class="text-gray-400">›</span>
        <span class="font-semibold text-gray-900">${escapeHtmlText(formattedCategory)}</span>
      </nav>`;

  return `
    <div class="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl xl:max-w-[1400px] mx-auto min-h-screen" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${breadcrumbsHtml}

      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-gray-900 m-0">${escapeHtmlText(h1Text)}</h1>
          <p class="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed m-0">${escapeHtmlText(description)}</p>
        </div>
        <a href="/listings/add" class="bg-[#e90b35] text-white p-2 md:p-3 rounded-full shadow-lg text-sm font-bold flex items-center justify-center hover:bg-[#d00a2f] text-decoration-none shrink-0" title="Add New Listing">
          <svg class="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        </a>
      </div>

      <div class="space-y-4">
        <div class="relative w-full">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input type="text" placeholder="Search halal ${escapeHtmlText(formattedCategory.toLowerCase())} in Ottawa..." class="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none" />
        </div>

        <div class="flex md:flex-wrap gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <a href="/listings" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all text-decoration-none ${cleanUrlPath === '/listings' ? 'bg-[#e90b35] text-white shadow-md shadow-red-100' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}">All</a>
          ${categoryPillsHtml}
        </div>

        ${isUnderRestaurants ? `
        <div class="pt-2">
          <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-400 shrink-0 mr-1">Locations:</span>
            ${locationPillsHtml}
          </div>
        </div>` : ''}
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
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
  const tags = Array.from(new Set([...typesArray, ...cuisinesArray])).filter(Boolean).slice(0, 2);

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
    <div class="min-h-screen bg-gray-50 pb-20" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] max-w-[76rem] xl:max-w-[1336px] mx-auto pt-6 space-y-6">
        <!-- Hero Banner -->
        <div class="relative h-72 sm:h-80 md:h-[420px] rounded-3xl overflow-hidden shadow-sm bg-slate-900">
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
          <div class="absolute inset-0 bg-black/70"></div>
          ${listing.isFeatured ? '<div class="absolute top-4 left-4 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest shadow-md">Featured</div>' : ''}
          
          <div class="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2 flex-wrap text-white">
                <a href="/${catSlug}" class="bg-[#e90b35] text-white border border-[#e90b35] px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase text-decoration-none shadow-sm">
                  ${escapeHtmlText(mainCategory)}
                </a>
                ${tagsHtml}
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <h1 class="text-2xl font-bold leading-tight m-0 text-white">${escapeHtmlText(listing.name)}</h1>
              </div>
              <div class="flex items-center gap-4 mt-2 text-sm">
                <div class="flex items-center gap-1">
                  <span class="text-yellow-400">★</span>
                  <span class="font-bold">${rating}</span>
                  <span class="text-white/70 text-xs">(${reviewCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <!-- Breadcrumbs -->
          <div class="hidden md:flex items-center gap-2 text-[13px] text-gray-500 font-medium overflow-x-auto whitespace-nowrap">
            <a href="/" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Home</a>
            <span class="text-gray-300">›</span>
            <a href="/${catSlug}" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">${escapeHtmlText(mainCategory)}</a>
            <span class="text-gray-300">›</span>
            <span class="text-gray-900 truncate max-w-[200px] font-semibold">${escapeHtmlText(listing.name)}</span>
          </div>

          <!-- 10-Column Layout matching ListingDetail.tsx -->
          <div class="grid grid-cols-1 lg:grid-cols-10 gap-8 mt-6">
            <!-- Left Column (col-span-7) -->
            <div class="lg:col-span-7 flex flex-col h-full gap-8">
              
              <!-- Info Buttons (Mobile: flex lg:hidden) -->
              <div class="flex lg:hidden flex-wrap justify-center gap-6 py-2">
                ${address ? `
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.name + ' ' + address)}" target="_blank" rel="nofollow noopener noreferrer" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><circle cx="12" cy="11" r="2" stroke-width="2"></circle></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Directions</span>
                </a>` : ''}

                ${phone ? `
                <a href="tel:${escapeHtmlAttr(phone)}" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Phone</span>
                </a>` : ''}

                ${listing.email ? `
                <a href="mailto:${escapeHtmlAttr(listing.email)}" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Email</span>
                </a>` : ''}

                ${website ? `
                <a href="${escapeHtmlAttr(website.startsWith('http') ? website : `https://${website}`)}" target="_blank" rel="nofollow noopener noreferrer" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><line x1="2" y1="12" x2="22" y2="12" stroke-width="2"></line><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Website</span>
                </a>` : ''}

                ${(listing.menuUrl || listing.menuPdfUrl) ? `
                <a href="${escapeHtmlAttr((listing.menuPdfUrl || listing.menuUrl)!.startsWith('http') ? (listing.menuPdfUrl || listing.menuUrl)! : `https://${(listing.menuPdfUrl || listing.menuUrl)!}`)}" target="_blank" rel="nofollow noopener noreferrer" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Menu</span>
                </a>` : ''}
              </div>

              <!-- Navigation Tabs -->
              <div class="border-b border-gray-100">
                <div class="flex gap-8">
                  <span class="pb-4 font-bold text-sm text-[#e90b35] border-b-2 border-[#e90b35]">Overview</span>
                  <span class="pb-4 font-bold text-sm text-gray-400">Reviews (${reviewCount})</span>
                  ${(listing.photos && listing.photos.length > 1) ? `<span class="pb-4 font-bold text-sm text-gray-400">Photos (${listing.photos.length})</span>` : ''}
                  ${(listing.menuUrl || listing.menuPdfUrl || (listing.menuItems && listing.menuItems.length > 0)) ? `<span class="pb-4 font-bold text-sm text-gray-400">Menu</span>` : ''}
                </div>
              </div>

              <!-- About Section -->
              ${description ? `
              <section class="space-y-4">
                <h2 class="text-xl font-bold m-0 text-gray-900">About</h2>
                <div class="text-gray-600 leading-relaxed whitespace-pre-line text-sm md:text-base">
                  ${escapeHtmlText(description)}
                </div>
              </section>` : ''}

              <!-- Menu Section (if present) -->
              ${(listing.menuUrl || listing.menuPdfUrl || (listing.menuItems && listing.menuItems.length > 0)) ? `
              <div class="space-y-4 pt-4 border-t border-gray-50">
                <div class="flex justify-between items-center">
                  <h2 class="text-xl font-bold flex items-center gap-2 m-0 text-gray-900">
                    <span class="w-8 h-8 rounded-full bg-[#e90b35]/10 text-[#e90b35] flex items-center justify-center font-bold text-sm">★</span>
                    Menu
                  </h2>
                  ${(listing.menuPdfUrl || listing.menuUrl) ? `
                  <a href="${escapeHtmlAttr((listing.menuPdfUrl || listing.menuUrl)!.startsWith('http') ? (listing.menuPdfUrl || listing.menuUrl)! : `https://${(listing.menuPdfUrl || listing.menuUrl)!}`)}" target="_blank" rel="nofollow noopener noreferrer" class="text-[#e90b35] text-sm font-bold flex items-center gap-1 hover:underline text-decoration-none">
                    View Full Menu ↗
                  </a>` : ''}
                </div>
              </div>` : ''}

              <!-- Photos Gallery -->
              ${galleryHtml}

              <!-- Reviews Section -->
              <section class="space-y-6 pt-6 border-t border-gray-100">
                <div class="flex justify-between items-center">
                  <div>
                    <h2 class="text-xl font-bold m-0 text-gray-900">Reviews</h2>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-yellow-400 font-bold text-lg">★</span>
                      <span class="font-bold text-gray-900 text-lg">${rating}</span>
                      <span class="text-gray-400 text-sm">(${reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <!-- Right Column (Sidebar) matching ListingDetail.tsx -->
            <div class="flex flex-col lg:col-span-3 gap-6 h-full">
              <!-- Location Card -->
              ${address ? `
              <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
                <h2 class="text-xl font-bold m-0 text-gray-900">Location</h2>
                <div class="flex items-start gap-3 text-sm text-gray-600">
                  <span class="text-base text-[#e90b35] shrink-0 mt-0.5">📍</span>
                  <span>${escapeHtmlText(address)}</span>
                </div>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.name + ' ' + address)}" target="_blank" rel="nofollow noopener noreferrer" class="w-full py-3 bg-red-50 text-[#e90b35] font-bold rounded-xl hover:bg-red-100 transition-colors text-sm block text-center text-decoration-none">
                  Get Directions
                </a>
              </div>` : ''}

              <!-- Contact Card -->
              <div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 class="text-xl font-bold mb-4 m-0 text-gray-900">Contact</h2>
                
                ${phone ? `
                <div class="flex items-center gap-4 text-sm text-gray-600">
                  <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  </div>
                  <a href="tel:${escapeHtmlAttr(phone)}" class="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors text-decoration-none">${escapeHtmlText(phone)}</a>
                </div>` : ''}

                ${listing.email ? `
                <div class="flex items-center gap-4 text-sm text-gray-600 break-all">
                  <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </div>
                  <a href="mailto:${escapeHtmlAttr(listing.email)}" class="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors line-clamp-1 text-decoration-none">${escapeHtmlText(listing.email)}</a>
                </div>` : ''}

                ${website ? `
                <div class="flex items-center gap-4 text-sm text-gray-600 break-all">
                  <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><line x1="2" y1="12" x2="22" y2="12" stroke-width="2"></line><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  </div>
                  <a href="${escapeHtmlAttr(website.startsWith('http') ? website : `https://${website}`)}" target="_blank" rel="nofollow noopener noreferrer" class="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors line-clamp-1 text-decoration-none">
                    ${escapeHtmlText(website.replace(/^https?:\/\//, ''))}
                  </a>
                </div>` : ''}

                ${(listing.menuUrl || listing.menuPdfUrl) ? `
                <div class="flex items-center gap-4 text-sm text-gray-600 break-all pt-2">
                  <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <a href="${escapeHtmlAttr((listing.menuPdfUrl || listing.menuUrl)!.startsWith('http') ? (listing.menuPdfUrl || listing.menuUrl)! : `https://${(listing.menuPdfUrl || listing.menuUrl)!}`)}" target="_blank" rel="nofollow noopener noreferrer" class="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors text-decoration-none">
                    View Menu
                  </a>
                </div>` : ''}
              </div>

              <!-- Hours Card -->
              ${listing.openingHours ? `
              <div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 class="text-xl font-bold m-0 text-gray-900">Hours</h2>
                <div class="space-y-3">
                  ${(typeof listing.openingHours === 'string' ? listing.openingHours.split(', ') : []).map((hour: string) => {
                    const parts = hour.split(': ');
                    if (parts.length < 2) return `<div class="text-sm text-gray-700">${escapeHtmlText(hour)}</div>`;
                    const [day, time] = parts;
                    const isClosed = time.toLowerCase().includes('closed');
                    return `
                      <div class="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                        <span class="text-[13px] font-semibold text-gray-900">${escapeHtmlText(day)}</span>
                        <span class="text-[13px] font-semibold ${isClosed ? 'text-red-500' : 'text-gray-900'}">${escapeHtmlText(time)}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>` : ''}

              <!-- Social Media Card -->
              ${(listing.socialMedia && Object.values(listing.socialMedia).some(val => val)) ? `
              <div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 class="text-xl font-bold mb-4 m-0 text-gray-900">Social Media</h2>
                <div class="flex flex-wrap gap-4">
                  ${listing.socialMedia?.instagram ? `
                  <a href="${escapeHtmlAttr(listing.socialMedia.instagram.startsWith('http') ? listing.socialMedia.instagram : `https://${listing.socialMedia.instagram}`)}" target="_blank" rel="nofollow noopener noreferrer" class="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors text-decoration-none">
                    Instagram
                  </a>` : ''}
                  ${listing.socialMedia?.facebook ? `
                  <a href="${escapeHtmlAttr(listing.socialMedia.facebook.startsWith('http') ? listing.socialMedia.facebook : `https://${listing.socialMedia.facebook}`)}" target="_blank" rel="nofollow noopener noreferrer" class="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors text-decoration-none">
                    Facebook
                  </a>` : ''}
                  ${listing.socialMedia?.twitter ? `
                  <a href="${escapeHtmlAttr(listing.socialMedia.twitter.startsWith('http') ? listing.socialMedia.twitter : `https://${listing.socialMedia.twitter}`)}" target="_blank" rel="nofollow noopener noreferrer" class="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors text-decoration-none">
                    Twitter
                  </a>` : ''}
                  ${listing.socialMedia?.tiktok ? `
                  <a href="${escapeHtmlAttr(listing.socialMedia.tiktok.startsWith('http') ? listing.socialMedia.tiktok : `https://${listing.socialMedia.tiktok}`)}" target="_blank" rel="nofollow noopener noreferrer" class="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors text-decoration-none">
                    TikTok
                  </a>` : ''}
                </div>
              </div>` : ''}
            </div>
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
  const coverUrl = news.coverImage ? (getOptimizedImageUrlSSR(news.coverImage, 800, 256) || news.coverImage) : '/ottawa-sunset.webp';
  const dateStr = news.publishDate || news.createdAt ? new Date(news.publishDate || news.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const authorName = news.author || 'Youssef Agrebi';
  const initials = authorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const sourceLink = news.sourceLink ? (news.sourceLink.startsWith('http') ? news.sourceLink : `https://${news.sourceLink}`) : null;

  return `
    <div class="md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="relative h-64 bg-gray-100 overflow-hidden">
        <img src="${escapeHtmlAttr(coverUrl)}" alt="${escapeHtmlAttr(news.title)}" class="w-full h-full object-cover" fetchpriority="high" width="800" height="256" decoding="async" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div class="absolute bottom-6 left-6 right-6 text-white">
          <h1 class="text-2xl font-bold leading-tight m-0 text-white">${escapeHtmlText(news.title)}</h1>
          <div class="flex flex-wrap items-center gap-4 mt-3 text-xs text-white/90">
            <span class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${dateStr}</span>
            </span>
            <span class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>By ${escapeHtmlText(authorName)}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="p-6 space-y-8">
        <article class="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap flow-root overflow-hidden">
          ${escapeHtmlText(news.content || news.description || '')}
        </article>

        ${sourceLink ? `
        <div class="flex justify-center pt-4">
          <a href="${escapeHtmlAttr(sourceLink)}" target="_blank" rel="nofollow noopener noreferrer" class="flex items-center gap-2 px-8 py-4 bg-[#e90b35] text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-100 hover:bg-[#d00a2f] transition-all text-decoration-none">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            Learn More
          </a>
        </div>` : ''}

        <!-- E-E-A-T Author Profile Card -->
        <section class="pt-6 border-t border-gray-100">
          <div class="bg-gray-50/80 border border-gray-100 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 shadow-sm">
            <div class="w-14 h-14 rounded-2xl bg-[#e90b35] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
              ${escapeHtmlText(initials)}
            </div>
            <div class="space-y-1.5 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-[10px] uppercase font-bold tracking-wider text-[#e90b35] bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                  Editorial Contributor
                </span>
                <span class="text-[11px] text-gray-400 font-medium">
                  Verified Local Journalist
                </span>
              </div>
              <h3 class="text-base font-bold text-gray-900 leading-snug m-0">
                Written by ${escapeHtmlText(authorName)}
              </h3>
              <p class="text-xs sm:text-sm text-gray-600 leading-relaxed m-0 mt-1">
                Editor and community researcher at Halal Ottawa, dedicated to researching and reporting on local Ottawa community announcements, Muslim lifestyle, and verified halal dining.
              </p>
            </div>
          </div>
        </section>
      </div>
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
    const coverUrl = article.coverImage ? (getOptimizedImageUrlSSR(article.coverImage, 400, 192) || article.coverImage) : '/ottawa-sunset.webp';
    const dateStr = article.publishDate || article.createdAt ? new Date(article.publishDate || article.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const authorName = article.author || 'Youssef Agrebi';

    return `
      <a href="${escapeHtmlAttr(articleUrl)}" class="block bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-50 group flex flex-col text-decoration-none text-inherit">
        <div class="relative h-48 shrink-0 bg-gray-100">
          <img 
            src="${escapeHtmlAttr(coverUrl)}" 
            alt="${escapeHtmlAttr(article.title)}" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            loading="${idx < 3 ? 'eager' : 'lazy'}" 
            ${idx < 3 ? 'fetchpriority="high"' : ''}
            width="400" 
            height="192" 
            decoding="async" 
          />
          ${article.isFeatured ? '<div class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>' : ''}
        </div>
        <div class="p-5 flex flex-col justify-between flex-1">
          <div>
            <h2 class="text-lg font-bold leading-tight group-hover:text-[#e90b35] transition-colors m-0 text-gray-900">${escapeHtmlText(article.title)}</h2>
            <p class="text-gray-500 text-sm line-clamp-2 leading-relaxed mt-2 m-0">${escapeHtmlText(article.content || '')}</p>
          </div>
          <div class="pt-4 flex justify-between items-end border-t border-gray-50 mt-3">
            <div class="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-semibold">
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>${dateStr}</span>
              </span>
              <span class="flex items-center gap-1.5 text-gray-500 font-medium">
                <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>By ${escapeHtmlText(authorName)}</span>
              </span>
            </div>
          </div>
        </div>
      </a>
    `;
  }).join('\n');

  return `
    <div class="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl xl:max-w-[1400px] mx-auto min-h-screen" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 m-0">Ottawa News</h1>
          <p class="text-sm text-gray-500 mt-1 m-0">Stay up to date with the latest stories and Muslim community news in Ottawa.</p>
        </div>
      </div>

      <div class="relative w-full">
        <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input type="text" placeholder="Search community news, announcements, and articles..." class="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none" />
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
      answer: "You can click on 'Add Listing' in the navigation menu. You'll need to create an account, fill out the business details (name, category, address, hours, photos), and submit it for review. Our team will approve it once verified."
    },
    {
      question: "Is it free to list my business?",
      answer: "Basic listings are completely free. We also offer featured listing options if you want to increase your visibility on our home page and search results."
    },
    {
      question: "How do you verify halal status?",
      answer: "We rely on a combination of community reporting, official certification agency data (like HMA or HMS), and direct verification with business owners. If you notice an error, please report it to us immediately."
    },
    {
      question: "How can I suggest community news or updates?",
      answer: "You can submit community news, mosque announcements, or local stories by reaching out to our editorial team at info@halalottawa.ca. All submissions are reviewed to ensure they benefit the Ottawa Muslim community."
    },
    {
      question: "How do I report a listing?",
      answer: "If you find information that is incorrect or a business that should no longer be listed, please contact us via email at info@halalottawa.ca with the listing details."
    }
  ];

  const faqsHtml = faqs.map(item => `
    <div class="border border-gray-100 rounded-xl overflow-hidden">
      <div class="w-full flex items-center justify-between p-4 md:p-6 text-left bg-white">
        <span class="font-bold text-gray-900">${escapeHtmlText(item.question)}</span>
        <svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
      <div class="px-4 pb-4 md:px-6 md:pb-6 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-3">
        ${escapeHtmlText(item.answer)}
      </div>
    </div>
  `).join('\n');

  return `
    <div class="bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div class="text-center space-y-4">
          <div class="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m.08 4h.01"></path></svg>
          </div>
          <div class="space-y-2">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 m-0">Frequently Asked Questions</h1>
            <p class="text-gray-500 max-w-2xl mx-auto m-0">
              Everything you need to know about using Halal Ottawa. Can't find what you're looking for? Reach out to our team.
            </p>
          </div>
        </div>

        <div class="space-y-4">
          ${faqsHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Static HTML for Privacy Policy (/privacy-policy)
 */
export function renderPrivacyPolicySSRHtml(): string {
  return `
    <div class="bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div class="text-center space-y-4">
          <div class="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <div class="space-y-2">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 m-0">Your Privacy Matters</h1>
            <p class="text-gray-500 m-0">Last updated: March 25, 2026</p>
          </div>
        </div>

        <div class="prose prose-sm max-w-none text-gray-600 leading-relaxed space-y-8">
          <section class="space-y-4">
            <div class="flex items-center gap-3 text-gray-900">
              <svg class="w-5 h-5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <h2 class="text-xl font-bold m-0 text-gray-900">Introduction</h2>
            </div>
            <p>
              Halal Ottawa ("we", "us", or "our") is committed to protecting the privacy of our users in Ontario and across Canada. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile-optimized web application.
              We comply with the <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong> and other applicable Canadian privacy laws.
            </p>
          </section>

          <section class="space-y-4">
            <div class="flex items-center gap-3 text-gray-900">
              <svg class="w-5 h-5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <h2 class="text-xl font-bold m-0 text-gray-900">Information We Collect</h2>
            </div>
            <p>We collect information that you provide directly to us when you:</p>
            <ul class="list-disc pl-5 space-y-2">
              <li><strong>Account Information:</strong> When you sign in via Google or email, we receive your name, email address, and profile picture.</li>
              <li><strong>User Content:</strong> Information you submit through our platform, including business listings, news articles, comments, and reviews.</li>
              <li><strong>Interaction Data:</strong> Information about the items you save (bookmarks) and your interactions with content.</li>
            </ul>
          </section>

          <section class="space-y-4">
            <div class="flex items-center gap-3 text-gray-900">
              <svg class="w-5 h-5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"></rect><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11V7a5 5 0 0110 0v4"></path></svg>
              <h2 class="text-xl font-bold m-0 text-gray-900">Data Security & Storage</h2>
            </div>
            <p>We use enterprise-grade cloud infrastructure (Google Cloud and Firebase) with encrypted data storage. We never sell your personal information to third parties.</p>
          </section>

          <section class="space-y-4">
            <div class="flex items-center gap-3 text-gray-900">
              <svg class="w-5 h-5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              <h2 class="text-xl font-bold m-0 text-gray-900">Contact Us</h2>
            </div>
            <p>If you have questions about this Privacy Policy, please contact our team at <a href="mailto:privacy@halalottawa.ca" class="text-[#e90b35] font-semibold text-decoration-none hover:underline">privacy@halalottawa.ca</a>.</p>
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
    <div class="bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div class="text-center space-y-4">
          <div class="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <div class="space-y-2">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 m-0">Terms of Service</h1>
            <p class="text-gray-500 m-0">Last updated: April 29, 2024</p>
          </div>
        </div>

        <div class="prose prose-sm max-w-none text-gray-600 leading-relaxed space-y-8">
          <section class="space-y-4">
            <h2 class="text-xl font-bold text-gray-900 mb-4 m-0">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Halal Ottawa, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-bold text-gray-900 mb-4 m-0">2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information or software) on Halal Ottawa's website for personal, non-commercial transitory viewing only.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-bold text-gray-900 mb-4 m-0">3. User Submissions & Content</h2>
            <p>
              By submitting listings, reviews, or news articles, you certify that the information provided is accurate and complies with halal verification guidelines and community standards.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-bold text-gray-900 mb-4 m-0">4. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of Ontario, Canada.
            </p>
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
    <div class="bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div class="flex flex-col items-center text-center space-y-8">
          <div class="space-y-4">
            <div class="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor"></polygon></svg>
            </div>
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 m-0">Ottawa Qibla Direction</h1>
            <p class="text-gray-500 max-w-xl mx-auto m-0">
              Align your device with the arrow below to face the Kaaba in Mecca from Ottawa or anywhere else. For best accuracy, hold your device flat and away from magnetic interference.
            </p>
          </div>

          <div class="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
            Ottawa Bearing: 55.8° North-East
          </div>

          <div class="relative w-64 h-64 md:w-80 md:h-80 mx-auto my-4">
            <div class="absolute inset-0 rounded-full border-4 border-gray-100 shadow-inner bg-gray-50 flex items-center justify-center overflow-hidden">
              <div class="absolute top-4 text-[#e90b35] font-bold">N</div>
              <div class="absolute bottom-4 text-gray-400 font-bold">S</div>
              <div class="absolute right-4 text-gray-400 font-bold">E</div>
              <div class="absolute left-4 text-gray-400 font-bold">W</div>

              <div style="transform: rotate(55.8deg);" class="flex flex-col items-center justify-center">
                <div class="w-2 h-24 bg-[#e90b35] rounded-t-full shadow-md"></div>
                <span class="text-xs font-bold text-[#e90b35] mt-1">Qibla (55.8°)</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center w-full pt-4 border-t border-gray-100">
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
    <main class="min-h-screen bg-[#F9FAFB] pb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="max-w-5xl mx-auto px-6 py-8 space-y-12">
        <h1 class="text-3xl font-bold m-0 text-gray-900">Saved Items</h1>

        <section class="space-y-3">
          <h2 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2 m-0">
            Saved Listings & News
          </h2>
          <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
            <div class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-[#e90b35] mx-auto">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 m-0">Saved Places & Articles</h3>
            <p class="text-sm text-gray-500 max-w-md mx-auto m-0">Keep track of your favorite Ottawa halal restaurants, grocery spots, and community news.</p>
            <div class="pt-4 flex flex-wrap gap-3 justify-center">
              <a href="/restaurants" class="px-5 py-2.5 bg-[#e90b35] text-white font-bold text-sm rounded-xl text-decoration-none shadow-md hover:bg-[#d00a2f] transition-all">
                Explore Restaurants
              </a>
              <a href="/mosques" class="px-5 py-2.5 bg-gray-100 text-gray-800 font-bold text-sm rounded-xl text-decoration-none hover:bg-gray-200 transition-all">
                Find Mosques
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  `;
}

/**
 * Static HTML for Login Page (/login)
 */
export function renderLoginSSRHtml(): string {
  return `
    <div class="min-h-screen bg-gray-50 flex flex-col justify-start pt-8 px-6 pb-6 max-w-md mx-auto w-full" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="text-center mb-5 space-y-1">
        <div class="w-12 h-12 bg-[#e90b35] rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg shadow-red-200 text-white">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 m-0">Welcome Back</h1>
        <p class="text-sm text-gray-500 m-0">Sign in to access community features.</p>
      </div>

      <div class="flex p-1 bg-gray-200/50 rounded-2xl mb-4">
        <a href="/login" class="flex-1 py-3 text-sm font-bold rounded-xl bg-white text-gray-900 shadow-sm text-center text-decoration-none">Login</a>
        <a href="/register" class="flex-1 py-3 text-sm font-bold rounded-xl text-gray-500 hover:text-gray-700 text-center text-decoration-none">Register</a>
      </div>

      <a href="/login" class="w-full py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm text-decoration-none">
        <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"></path><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"></path></svg>
        Sign in with Google
      </a>

      <div class="relative py-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-200"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-4 bg-gray-50 text-gray-400 uppercase tracking-[0.2em] text-[11px] font-bold">Or continue with email</span>
        </div>
      </div>

      <div class="space-y-4">
        <div class="relative">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          <input type="email" placeholder="Email Address" class="w-full pl-14 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none" />
        </div>
        <div class="relative">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"></rect><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11V7a5 5 0 0110 0v4"></path></svg>
          <input type="password" placeholder="Password" class="w-full pl-14 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none" />
        </div>
      </div>

      <p class="text-xs text-gray-400 text-center mt-6">
        By signing in, you agree to Halal Ottawa's <a href="/terms" class="text-gray-600 underline text-decoration-none">Terms of Service</a> and <a href="/privacy-policy" class="text-gray-600 underline text-decoration-none">Privacy Policy</a>.
      </p>
    </div>
  `;
}

/**
 * Static HTML for Add Listing Page (/listings/add)
 */
export function renderAddListingSSRHtml(): string {
  return `
    <div class="p-4 md:p-8 max-w-3xl mx-auto min-h-screen" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="bg-white rounded-3xl border border-gray-100 p-6 md:p-10 shadow-sm space-y-6">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 m-0">Submit a Place in Ottawa</h1>
          <p class="text-sm text-gray-500 mt-1 m-0">Help Ottawa Muslims discover certified halal restaurants, grocery markets, mosques, and schools.</p>
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
    <main class="flex-1 w-full max-w-7xl mx-auto px-4 mt-8 lg:mt-12 mb-20 flex flex-col items-center justify-center" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100 w-full text-center space-y-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <span class="text-3xl font-bold text-[#e90b35]">404</span>
        </div>
        
        <div class="space-y-2 max-w-md mx-auto">
          <h1 class="text-2xl font-bold text-gray-900 m-0">Page Not Found</h1>
          <p class="text-gray-500 m-0">Sorry, we couldn't find the page you're looking for.</p>
        </div>

        <div class="pt-4 flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md mx-auto">
          <a href="/" class="flex-1 inline-flex items-center justify-center px-6 py-3.5 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-200 hover:bg-[#d00a2f] active:scale-95 transition-all text-decoration-none">
            Go Home
          </a>
          <a href="/listings" class="flex-1 inline-flex items-center justify-center px-6 py-3.5 border border-gray-200 rounded-2xl text-gray-700 bg-white hover:bg-gray-50 font-bold transition-all active:scale-95 text-decoration-none">
            Browse All Listings
          </a>
        </div>
      </div>
    </main>
  `;
}

