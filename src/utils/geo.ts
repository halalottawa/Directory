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
  } catch (err) {
    console.warn('Geocoding search failed:', err);
  }
  return '';
}
