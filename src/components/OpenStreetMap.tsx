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

  useEffect(() => {
    const geocode = async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
          headers: {
            'Accept-Language': 'en'
          }
        });
        const data = await response.json();
        if (data && data.length > 0) {
          setPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        }
      } catch (error) {
        console.error('Error geocoding address:', error);
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      geocode();
    }
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
    <MapContainer center={position} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 10 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position}>
        <Popup>
          {address}
        </Popup>
      </Marker>
    </MapContainer>
  );
};
