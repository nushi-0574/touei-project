'use client';

import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from 'leaflet';
import { useEffect } from 'react';

export type MapLocation = {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  is_published: boolean;
};

function MapClickSelector({ onSelect }: { onSelect: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng);
    },
  });
  return null;
}

function FitLocations({ locations }: { locations: MapLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length) {
      map.fitBounds(locations.map((location) => [location.latitude, location.longitude]), {
        padding: [32, 32],
        maxZoom: 12,
      });
    }
  }, [locations, map]);
  return null;
}

export default function LeafletMap({
  locations,
  canManage,
  onSelectPoint,
  onSelectLocation,
}: {
  locations: MapLocation[];
  canManage: boolean;
  onSelectPoint: (point: LatLng) => void;
  onSelectLocation: (location: MapLocation) => void;
}) {
  const center: [number, number] = locations.length
    ? [locations[0].latitude, locations[0].longitude]
    : [36.2048, 138.2529];

  return (
    <MapContainer center={center} zoom={locations.length ? 12 : 5} scrollWheelZoom className="h-full min-h-[420px] w-full">
      <FitLocations locations={locations} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {canManage && <MapClickSelector onSelect={onSelectPoint} />}
      {locations.map((location) => (
        <CircleMarker
          key={location.id}
          center={[location.latitude, location.longitude]}
          radius={9}
          pathOptions={{
            color: location.is_published ? '#0369a1' : '#b45309',
            fillColor: location.is_published ? '#0ea5e9' : '#f59e0b',
            fillOpacity: 0.85,
          }}
          eventHandlers={{ click: () => canManage && onSelectLocation(location) }}
        >
          <Popup>
            <div className="min-w-40">
              <p className="font-semibold">{location.name}</p>
              <p className="text-xs">{location.category}</p>
              {location.address && <p className="mt-1 text-xs">{location.address}</p>}
              {location.description && <p className="mt-1 text-xs">{location.description}</p>}
              {canManage && <p className="mt-2 text-[10px]">{location.is_published ? '公開中' : '非公開'}</p>}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
