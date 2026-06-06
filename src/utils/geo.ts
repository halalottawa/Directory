/**
 * Utility to fetch precise user location during registration or profile setup.
 * Uses navigator.geolocation if available, falls back to IP geolocation, and finally "Ottawa, ON".
 */
export async function getPreciseLocation(): Promise<string> {
  // Try navigator geolocation
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = position.coords;
      const res = await fetch(
        `/api/geocode?reverse=true&lat=${latitude}&lon=${longitude}`
      );
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
          const city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || 'Ottawa';
          const stateProv = addr.state || addr.province || 'ON';
          const stateCode = stateProv === 'Ontario' ? 'ON' : stateProv === 'Quebec' ? 'QC' : stateProv;
          
          // Prioritize granular suburban / neighborhood names
          let suburb = addr.suburb || 
                       addr.neighbourhood || 
                       addr.neighbourhood_level3 ||
                       addr.neighbourhood_level2 ||
                       addr.city_district || 
                       addr.quarter || 
                       addr.residential || 
                       addr.village ||
                       '';
          
          if (!suburb && data.display_name) {
            // Highly robust component-based parsing fallback
            const parts = data.display_name.split(',').map((p: string) => p.trim());
            const cityIndex = parts.findIndex((p: string) => {
              const pl = p.toLowerCase();
              return pl === 'ottawa' || pl === 'gatineau' || pl === 'ottawa (city)' || pl === 'city of ottawa';
            });
            if (cityIndex > 0) {
              for (let i = cityIndex - 1; i >= 0; i--) {
                const candidate = parts[i];
                // Exclude street numbers, postal codes, and entries with digits to target the exact suburb name
                if (candidate && 
                    !/^\d+$/.test(candidate) && 
                    !/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(candidate) &&
                    !/\d/.test(candidate)
                ) {
                  suburb = candidate;
                  break;
                }
              }
            }
          }
          
          if (suburb) {
            return suburb;
          }
          return `${city}, ${stateCode}`;
        }
      }
    }
    } catch (err) {
      console.warn('Browser Geolocation or reverse geocoding failed, trying IP fallback:', err);
    }
  }

  // Fallback 1: IP Geolocation (ipapi.co for fast response)
  try {
    const ipRes = await fetch('https://ipapi.co/json/');
    if (ipRes.ok) {
      const ipData = await ipRes.json();
      if (ipData && ipData.city) {
        const city = ipData.city;
        const region = ipData.region_code || ipData.region || 'ON';
        return `${city}, ${region}`;
      }
    }
  } catch (ipErr) {
    console.warn('IP Geolocation failed:', ipErr);
  }

  // Final fallback
  return 'Ottawa, ON';
}

/**
 * Utility to geocode an address in Ottawa and extract its suburb / neighborhood.
 */
export async function getSuburbFromAddress(address: string): Promise<string> {
  if (!address || address.trim().length === 0) return '';
  try {
    const queryStr = address.toLowerCase().includes('ottawa') ? address : `${address}, Ottawa, ON`;
    const res = await fetch(
      `/api/geocode?q=${encodeURIComponent(queryStr)}`
    );
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
        const addr = item.address;
        if (addr) {
          let suburb = addr.suburb || 
                       addr.neighbourhood || 
                       addr.neighbourhood_level3 ||
                       addr.neighbourhood_level2 ||
                       addr.city_district || 
                       addr.quarter || 
                       addr.residential || 
                       addr.village ||
                       '';
          
          if (!suburb && item.display_name) {
            const parts = item.display_name.split(',').map((p: string) => p.trim());
            const cityIndex = parts.findIndex((p: string) => {
              const pl = p.toLowerCase();
              return pl === 'ottawa' || pl === 'gatineau' || pl === 'ottawa (city)' || pl === 'city of ottawa';
            });
            if (cityIndex > 0) {
              for (let i = cityIndex - 1; i >= 0; i--) {
                const candidate = parts[i];
                if (candidate && 
                    !/^\d+$/.test(candidate) && 
                    !/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(candidate) &&
                    !/\d/.test(candidate)
                ) {
                  suburb = candidate;
                  break;
                }
              }
            }
          }
          if (suburb) {
            return suburb;
          }
        }
      }
    }
  }
  } catch (err) {
    console.warn('Geocoding search failed:', err);
  }
  return '';
}

/**
 * Maps a listing's address and suburb to one of the four key Ottawa districts:
 * orleans, kanata, barrhaven, or downtown.
 * Returns null if the address is not situated in these domains.
 */
export function getNeighborhoodFromAddress(address: string = '', suburb: string = ''): 'orleans' | 'kanata' | 'barrhaven' | 'downtown' | null {
  const normalizedAddr = address.toLowerCase();
  const normalizedSub = suburb.toLowerCase();

  // Combine them for aggregate analysis
  const combined = `${normalizedSub} ${normalizedAddr}`;

  // 1. Direct Postal Code / Forward Sortation Area (FSA) matching - extremely reliable in Ottawa
  const fsaMatch = combined.match(/\b([kK][12][a-zA-Z])\s?\d/);
  if (fsaMatch) {
    const fsa = fsaMatch[1].toUpperCase();
    if (['K1C', 'K1E', 'K1W'].includes(fsa)) return 'orleans';
    if (['K2K', 'K2L', 'K2M', 'K2T', 'K2S'].includes(fsa)) return 'kanata';
    if (['K2J'].includes(fsa)) return 'barrhaven';
    if (['K1N', 'K1P', 'K1R', 'K1S', 'K1Y', 'K1A'].includes(fsa)) return 'downtown';
  }

  // 2. Suburb or Neighborhood Name Keyword Matching
  // ORLEANS
  const orleansKeywords = [
    'orleans', 'orléans', 'convent glen', 'chateauneuf', 'queenswood height', 'fallingbrook', 
    'chatelaine village', 'cardinal creek', 'avalon', 'notting gate', 'chapel hill'
  ];
  if (orleansKeywords.some(keyword => combined.includes(keyword))) {
    return 'orleans';
  }

  // KANATA / STITTSVILLE
  const kanataKeywords = [
    'kanata', 'stittsville', 'glen cairn', 'hazeldean', 'beaverbrook', 'katimavik', 
    'morgan\'s grant', 'morgans grant', 'bridlewood', 'emerald meadows'
  ];
  if (kanataKeywords.some(keyword => combined.includes(keyword))) {
    return 'kanata';
  }

  // BARRHAVEN
  const barrhavenKeywords = [
    'barrhaven', 'stonebridge', 'half moon bay', 'chapman mills', 'longfields', 
    'davidson heights', 'jockvale'
  ];
  if (barrhavenKeywords.some(keyword => combined.includes(keyword))) {
    return 'barrhaven';
  }

  // DOWNTOWN / CENTRAL
  const downtownKeywords = [
    'downtown', 'centretown', 'byward market', 'byward', 'lowertown', 'sandy hill', 
    'the glebe', 'glebe', 'golden triangle', 'lebreton flats', 'hintonburg', 
    'chinatown', 'little italy', 'westboro', 'old ottawa south', 'old ottawa east'
  ];
  if (downtownKeywords.some(keyword => combined.includes(keyword))) {
    return 'downtown';
  }

  // 3. Street-based checks for borderline cases or unlabelled items
  
  // ORLEANS Streets
  const orleansStreets = [
    'st. joseph blvd', 'st joseph blvd', 'tenth line', '10th line', 'trim rd', 'trim road',
    'jeanne d\'arc', 'jeanne darc', 'prestone', 'dufount', 'prestwick', 'charette', 'portobello',
    'watters', 'valin', 'charlemagne', 'belcourt'
  ];
  if (orleansStreets.some(street => normalizedAddr.includes(street))) {
    return 'orleans';
  }

  // Specific check for Innes Road (Only Orleans side, since Innes starts east of Trainyards)
  if (normalizedAddr.includes('innes') && !normalizedAddr.includes('kanata') && !normalizedAddr.includes('barrhaven')) {
    return 'orleans';
  }

  // KANATA Streets
  const kanataStreets = [
    'terry fox', 'earl grey', 'campeau', 'march rd', 'march road', 'hazeldean', 
    'eagleson', 'kanata ave', 'castlefrank', 'katimavik road', 'palladium', 'iber rd'
  ];
  if (kanataStreets.some(street => normalizedAddr.includes(street))) {
    return 'kanata';
  }

  // BARRHAVEN Streets
  const barrhavenStreets = [
    'strandherd', 'marketplace ave', 'berrigan', 'cresthaven', 'chapman mills'
  ];
  if (barrhavenStreets.some(street => normalizedAddr.includes(street))) {
    return 'barrhaven';
  }
  // Greenbank / Woodroffe in South Ottawa (above 3000 block is Barrhaven)
  const blockCheck = normalizedAddr.match(/(\d+)\s+(greenbank|woodroffe)/);
  if (blockCheck) {
    const num = parseInt(blockCheck[1], 10);
    if (num >= 3000) return 'barrhaven';
  }

  // DOWNTOWN / CENTRAL Streets
  const downtownStreets = [
    'rideau st', 'elgin st', 'laurier ave', 'sparks st', 'dalhousie st', 
    'albert st', 'slater st', 'o\'connor', 'metcalfe', 'kent st', 'lyon st', 
    'gloucester st', 'cooper st', 'lisgar st', 'gladstone', 'somerset st'
  ];
  if (downtownStreets.some(street => normalizedAddr.includes(street))) {
    return 'downtown';
  }
  // Bank street check (under 1300 is downtown/glebe, above is Ottawa South/Heron Gate/etc.)
  const bankCheck = normalizedAddr.match(/(\d+)\s+bank\s+st/);
  if (bankCheck) {
    const num = parseInt(bankCheck[1], 10);
    if (num < 1300) return 'downtown';
  }

  return null;
}
