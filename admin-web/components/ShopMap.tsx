'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import type { Geo } from '../lib/db';
import { useLang } from '../lib/i18n';
import type * as LeafletNS from 'leaflet';

const TZ_INITIAL: { lat: number; lng: number } = { lat: -6.7924, lng: 39.2083 };

export default function ShopMap({ value, onChange }: { value: Geo; onChange: (g: Geo) => void }) {
  const { t } = useLang();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [place, setPlace] = useState(value.place || '');

  const L = () => LRef.current!;

  const dropPin = (lat: number, lng: number, placeText: string) => {
    const map = mapRef.current;
    const LMod = LRef.current;
    if (!map || !LMod) return;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }
    layerRef.current = LMod.layerGroup().addTo(map);
    LMod.circleMarker([lat, lng], {
      radius: 10,
      color: '#146B78',
      weight: 3,
      fillColor: '#2BB6C9',
      fillOpacity: 0.65,
    })
      .addTo(layerRef.current)
      .bindPopup(placeText || t('map.click.pin'))
      .openPopup();
    setPlace(placeText);
    onChange({ lat, lng, place: placeText });
  };

  useEffect(() => {
    let cancelled = false;
    let map: LeafletNS.Map | null = null;

    (async () => {
      const LMod = await import('leaflet');
      if (cancelled || !containerRef.current) return;
      LRef.current = LMod;

      const initial: [number, number] = [value.lat || TZ_INITIAL.lat, value.lng || TZ_INITIAL.lng];
      map = LMod.map(containerRef.current, { zoomControl: true }).setView(initial, value.place ? 13 : 6);
      mapRef.current = map;

      LMod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = LMod.layerGroup().addTo(map);
      if (value.lat && value.lng) {
        LMod.circleMarker([value.lat, value.lng], {
          radius: 10,
          color: '#146B78',
          weight: 3,
          fillColor: '#2BB6C9',
          fillOpacity: 0.65,
        })
          .addTo(layerRef.current)
          .bindPopup(value.place || '')
          .openPopup();
        map.setView([value.lat, value.lng], 13);
      }

      map.on('click', async (e: LeafletNS.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          const text = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          if (!cancelled) dropPin(lat, lng, text);
        } catch {
          if (!cancelled) dropPin(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      });

      /* Request location permission and move the map to the admin's area */
      if (navigator.geolocation && !value.lat && !value.lng) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled || !mapRef.current) return;
            mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 13);
          },
          () => {},
          { timeout: 6000 }
        );
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchPlace = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const hit = data[0];
        mapRef.current?.flyTo([+hit.lat, +hit.lon], 15, { duration: 1 });
        dropPin(+hit.lat, +hit.lon, hit.display_name || q);
      } else {
        setPlace(t('map.notfound'));
      }
    } catch {
      setPlace(t('map.network'));
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPlace(t('map.unsupported'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 15);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          const text = data.display_name || t('map.geo.now');
          dropPin(latitude, longitude, text);
        } catch {
          dropPin(latitude, longitude, t('map.geo.now'));
        }
        setLocating(false);
      },
      () => {
        setPlace(t('map.denied'));
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            placeholder={t('map.search.ph')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                searchPlace();
              }
            }}
            style={{ margin: 0 }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={searchPlace} disabled={searching}>
            {searching ? <><Search size={14} /> {t('map.searching')}</> : <><Search size={14} /> {t('map.search')}</>}
          </button>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={useMyLocation} disabled={locating}>
          <MapPin size={14} /> {locating ? t('map.gps.locating') : t('map.gps')}
        </button>
      </div>

      <div
        ref={containerRef}
        style={{ height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}
      />

      <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--muted)' }}>
        <strong>{t('map.approx.label')}</strong>{' '}
        <span style={{ color: 'var(--text)' }}>{place || t('map.approx.empty')}</span>
        {value.lat ? (
          <span style={{ display: 'block', opacity: 0.8 }}>
            {t('map.coords', { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) })}
          </span>
        ) : null}
      </div>
    </div>
  );
}