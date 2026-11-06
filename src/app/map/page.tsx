'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from 'leaflet';
import Link from 'next/link';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';
import { useLocale } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import type { MapLocation } from './LeafletMap';

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center bg-slate-100 text-sm text-slate-500">地図を読み込んでいます...</div>,
});

type FormState = {
  name: string;
  category: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  is_published: boolean;
};

const emptyForm: FormState = {
  name: '',
  category: '',
  description: '',
  address: '',
  latitude: '',
  longitude: '',
  is_published: false,
};

function readError(error: unknown): string {
  return error instanceof Error ? error.message : '地図情報を処理できませんでした。';
}

export default function CommunityMapPage() {
  const { t } = useLocale();
  const [userId, setUserId] = useState('');
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categoryFilter, setCategoryFilter] = useState('');

  const loadLocations = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('地図を利用するにはログインしてください。');
    const [{ data, error }, { data: profile, error: profileError }, { data: permissions, error: permissionsError }] = await Promise.all([
      supabase.from('map_locations').select('id, name, category, description, address, latitude, longitude, is_published').order('category').order('name'),
      supabase.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle(),
      supabase.from('staff_permissions').select('permission').eq('user_id', session.user.id).eq('permission', 'manage_map'),
    ]);
    if (error) throw error;
    if (profileError) throw profileError;
    if (permissionsError) throw permissionsError;
    setUserId(session.user.id);
    setCanManage(profile?.is_admin === true || permissions?.some((item) => item.permission === 'manage_map') === true);
    setLocations(data ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        await loadLocations();
      } catch (error) {
        console.error('地図情報の読み込みに失敗しました:', error);
        if (active) setErrorMessage(readError(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadLocations]);

  function choosePoint(point: LatLng) {
    setEditingId('');
    setForm({ ...emptyForm, latitude: point.lat.toFixed(6), longitude: point.lng.toFixed(6) });
  }

  function chooseLocation(location: MapLocation) {
    setEditingId(location.id);
    setForm({
      name: location.name,
      category: location.category,
      description: location.description,
      address: location.address,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      is_published: location.is_published,
    });
  }

  async function saveLocation(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || !userId) return;
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setErrorMessage('緯度は-90から90、経度は-180から180の数値を入力してください。');
      return;
    }
    setSaving(true);
    setErrorMessage('');
    setNotice('');
    try {
      const record = {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        latitude,
        longitude,
        is_published: form.is_published,
        updated_at: new Date().toISOString(),
      };
      const result = editingId
        ? await supabase.from('map_locations').update(record).eq('id', editingId)
        : await supabase.from('map_locations').insert({ ...record, created_by: userId });
      if (result.error) throw result.error;
      setNotice('地図情報を保存しました。');
      setEditingId('');
      setForm(emptyForm);
      await loadLocations();
    } catch (error) {
      console.error('地図情報を保存できませんでした:', error);
      setErrorMessage(readError(error));
    } finally {
      setSaving(false);
    }
  }

  async function deleteLocation() {
    if (!editingId || !canManage || !window.confirm('この地図情報を削除しますか？')) return;
    setSaving(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.from('map_locations').delete().eq('id', editingId);
      if (error) throw error;
      setEditingId('');
      setForm(emptyForm);
      setNotice('地図情報を削除しました。');
      await loadLocations();
    } catch (error) {
      console.error('地図情報を削除できませんでした:', error);
      setErrorMessage(readError(error));
    } finally {
      setSaving(false);
    }
  }

  const visibleLocations = categoryFilter
    ? locations.filter((location) => location.category === categoryFilter)
    : locations;
  const categories = [...new Set(locations.map((location) => location.category))];
  const inputClass = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Breadcrumbs items={[{ label: t('residents'), href: '/toeiken/portal' }, { label: t('map') }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Toei community map</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{t('map')}</h1>
            <p className="mt-2 text-sm text-slate-600">{t('mapIntro')}</p>
          </div>
          <Link href="/toeiken/services" className="text-sm font-semibold text-blue-700 underline">住民サービスへ</Link>
        </div>
        {errorMessage && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
        {notice && <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {loading ? (
          <p className="py-16 text-center text-sm text-slate-500">{t('loading')}</p>
        ) : (
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3">
                <p className="text-sm font-semibold">{visibleLocations.length} {t('locationCount')}</p>
                <label className="flex items-center gap-2 text-xs">
                  <span>{t('categoryLabel')}</span>
                  <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded border border-slate-300 px-2 py-1.5">
                    <option value="">{t('allCategories')}</option>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
              </div>
              <div className="h-[min(70vh,720px)] min-h-[420px]">
                <LeafletMap
                  locations={visibleLocations}
                  canManage={canManage}
                  onSelectPoint={choosePoint}
                  onSelectLocation={chooseLocation}
                />
              </div>
              <p className="border-t border-slate-200 px-3 py-2 text-[10px] text-slate-500">
                © OpenStreetMap contributors · {t('mapCoordinatesHint')}
              </p>
            </section>

            <aside className="space-y-4">
              {canManage ? (
                <section className="rounded border border-slate-200 bg-white p-4">
                  <h2 className="font-bold">{editingId ? t('editLocation') : t('addLocation')}</h2>
                  <p className="mt-1 text-xs text-slate-500">{t('mapPublicWarning')}</p>
                  <form onSubmit={saveLocation} className="mt-4 space-y-3">
                    <label className="grid gap-1 text-xs font-semibold">{t('placeName')}
                      <input required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold">{t('categoryLabel')}
                      <input required maxLength={100} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold">{t('address')}
                      <input aria-label={t('address')} maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className={inputClass} />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-semibold">{t('latitude')}
                        <input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold">{t('longitude')}
                        <input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} className={inputClass} />
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-semibold">{t('description')}
                      <textarea rows={4} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={inputClass} />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} />
                      {t('published')}
                    </label>
                    <div className="flex gap-2">
                      <button disabled={saving} className="flex-1 rounded bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? t('loading') : t('save')}</button>
                      {editingId && <button type="button" disabled={saving} onClick={() => void deleteLocation()} className="rounded border border-red-300 px-3 py-2 text-sm font-semibold text-red-700">{t('delete')}</button>}
                      {(editingId || form.latitude) && <button type="button" disabled={saving} onClick={() => { setEditingId(''); setForm(emptyForm); }} className="rounded border border-slate-300 px-3 py-2 text-sm">{'×'}</button>}
                    </div>
                  </form>
                </section>
              ) : (
                <section className="rounded border border-slate-200 bg-white p-4">
                  <h2 className="font-bold">{t('map')}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{t('mapStaffOnly')}</p>
                </section>
              )}
              <section className="max-h-[34rem] overflow-auto rounded border border-slate-200 bg-white">
                <h2 className="sticky top-0 border-b border-slate-200 bg-white p-3 text-sm font-bold">{t('map')}</h2>
                {visibleLocations.length ? visibleLocations.map((location) => (
                  <button key={location.id} type="button" onClick={() => chooseLocation(location)} className="block w-full border-b border-slate-100 p-3 text-left hover:bg-slate-50">
                    <span className="block text-sm font-semibold">{location.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{location.category}{location.address ? ` · ${location.address}` : ''}</span>
                    {canManage && <span className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] ${location.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{location.is_published ? t('published') : t('draft')}</span>}
                  </button>
                )) : <p className="p-4 text-sm text-slate-500">{t('noRecords')}</p>}
              </section>
              <p className="rounded border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-500">
                {t('mapPolicy')} 地図情報の座標は管理者が設定し、住所からの自動検索は行いません。
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
