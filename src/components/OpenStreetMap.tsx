import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface OpenStreetMapProps {
  address: string;
}

export const OpenStreetMap: React.FC<OpenStreetMapProps> = ({ address }) => {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproximate, setIsApproximate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const geocode = async () => {
      setLoading(true);
      const rawQuery = String(address || "").trim();
      if (!rawQuery) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      const queriesToTry: string[] = [];

      // Try 1: The original query
      queriesToTry.push(rawQuery);

      // Helper to strip unit, apt, suite numbers and Canadian/US postal codes
      const cleanAddress = (str: string) => {
        return str
          .replace(/(?:Unit|Apt|Suite|#|Room|Office|Floor|Ste)\s*[A-Za-z0-9\-]+/gi, "")
          .replace(/\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b/gi, "") // Canadian postal codes
          .replace(/\b\d{5}(-\d{4})?\b/g, "") // US zip codes
          .replace(/\b(Canada)\b/gi, "")
          .replace(/,\s*,/g, ",")
          .replace(/^,\s*|,\s*$/g, "")
          .trim();
      };

      // Try 2: Cleaned query
      const cleaned = cleanAddress(rawQuery);
      if (cleaned && cleaned !== rawQuery) {
        queriesToTry.push(cleaned);
      }

      // Try 3: Skip prepended business name
      const parts = cleaned.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        if (!/^\d/.test(parts[0]) && /^\d/.test(parts[1])) {
          const potentialAddress = parts.slice(1).join(", ");
          queriesToTry.push(cleanAddress(potentialAddress));
        }
      }

      // Try 4: Extract street with house number only, and tag on Ottawa, ON
      for (const part of parts) {
        if (/^\d+\s+[A-Za-z0-9\s]+/.test(part)) {
          const streetAndNum = part;
          if (!streetAndNum.toLowerCase().includes("ottawa")) {
            queriesToTry.push(`${streetAndNum}, Ottawa, ON`);
          } else {
            queriesToTry.push(streetAndNum);
          }
        }
      }

      // Deduplicate queries
      const uniqueQueries = Array.from(new Set(queriesToTry)).filter(Boolean);

      let foundCoords: [number, number] | null = null;

      // Sequential search attempts directly to OpenStreetMap Nominatim with an 8-second timeout
      for (const query of uniqueQueries) {
        if (cancelled) break;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`,
            {
              signal: controller.signal,
              headers: {
                'Accept-Language': 'en'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data && Array.isArray(data) && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lon = parseFloat(data[0].lon);
              if (!isNaN(lat) && !isNaN(lon)) {
                foundCoords = [lat, lon];
                break;
              }
            }
          }
        } catch (error) {
          console.error(`Error geocoding with query "${query}":`, error);
        } finally {
          clearTimeout(timeoutId);
        }
      }

      if (cancelled) return;

      if (foundCoords) {
        setPosition(foundCoords);
        setIsApproximate(false);
      } else {
        // Fallback to Ottawa areas
        const addrLower = rawQuery.toLowerCase();
        let fallbackCoords: [number, number] = [45.4215, -75.6972]; // Downtown Ottawa default

        if (addrLower.includes("orléans") || addrLower.includes("orleans")) {
          fallbackCoords = [45.4748, -75.4851];
        } else if (addrLower.includes("kanata")) {
          fallbackCoords = [45.3088, -75.8969];
        } else if (addrLower.includes("barrhaven")) {
          fallbackCoords = [45.2754, -75.7533];
        }

        setPosition(fallbackCoords);
        setIsApproximate(true);
      }

      setLoading(false);
    };

    geocode();

    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400 font-medium text-sm animate-pulse">Loading map...</span>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center px-4 text-center">
        <span className="text-gray-400 font-medium text-sm">Could not pinpoint location on map.</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ height: '100%', width: '100%' }}>
      <MapContainer center={position} zoom={isApproximate ? 12 : 15} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 10 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            {isApproximate ? (
              <div className="text-center font-sans">
                <div className="font-semibold text-xs text-amber-800">Approximate location</div>
                <div className="text-[11px] text-gray-500 mt-1">{address}</div>
              </div>
            ) : (
              address
            )}
          </Popup>
        </Marker>
      </MapContainer>
      {isApproximate && (
        <div 
          className="absolute bottom-3 left-3 bg-white/95 border border-amber-200 text-amber-800 text-[11px] font-semibold px-2.5 py-1 rounded shadow-md z-[1000] pointer-events-none select-none"
        >
          Approximate location
        </div>
      )}
    </div>
  );
};
