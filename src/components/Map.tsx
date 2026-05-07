import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: Array<{
    id: string;
    position: [number, number];
    title: string;
  }>;
  className?: string;
}

const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

export const Map: React.FC<MapProps> = ({ center, zoom = 13, markers = [], className = "h-64 w-full rounded-2xl overflow-hidden" }) => {
  return (
    <div className={className}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={false} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap center={center} />
        {markers.map((marker) => (
          <Marker key={marker.id} position={marker.position}>
            <Popup>
              <span className="font-bold">{marker.title}</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
