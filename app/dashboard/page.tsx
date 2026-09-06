'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Camera, LogOut, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  type: 'masuk' | 'pulang';
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Location State
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [locationError, setLocationError] = useState<string>('');

  // Attendance History
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  // 1. Ambil Data User & Cek Sesi Login
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setUser(profile);
      }

      // Fetch Attendance History
      fetchHistory(session.user.id);
      setLoading(false);
    };

    fetchUserData();
    getLocation();
  }, [router]);

  // 2. Dapatkan Lokasi GPS
  const getLocation = () => {
    setLocationError('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setLocationError('Gagal mengambil lokasi. Pastikan GPS/Izin Lokasi aktif.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      setLocationError('Browser Anda tidak mendukung fitur Geolocation.');
    }
  };

  // 3. Ambil Riwayat Absensi
  const fetchHistory = async (userId: string) => {
    const { data } = await supabase
      .from('attendances')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setHistory(data as AttendanceRecord[]);
    }
  };

  // 4. Helper Konversi Base64 Image ke Blob untuk Upload Supabase Storage
  const base64ToBlob = (base64String: string) => {
    const byteString = atob(base64String.split(',')[1]);
    const mimeString = base64String.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  // 5. Eksekusi Absen (Masuk / Pulang)
  const handleAttendance = async (type: 'masuk' | 'pulang') => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!coords.lat || !coords.lng) {
      setErrorMsg('Lokasi GPS belum terdeteksi. Silakan muat ulang lokasi Anda.');
      return;
    }

    if (!webcamRef.current) {
      setErrorMsg('Kamera belum siap.');
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setErrorMsg('Gagal mengambil foto dari kamera. Pastikan izin kamera diberikan.');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesi tidak ditemukan, silakan login ulang.');

      // a. Upload Foto Ke Supabase Storage
      const imageBlob = base64ToBlob(imageSrc);
      const fileName = `${session.user.id}/${Date.now()}-${type}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('absensi-photos')
        .upload(fileName, imageBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // b. Ambil Public URL Foto
      const { data: publicUrlData } = supabase.storage
        .from('absensi-photos')
        .getPublicUrl(fileName);

      const photoUrl = publicUrlData.publicUrl;

      // c. Simpan Record ke Tabel Attendances
      const { error: dbError } = await supabase.from('attendances').insert([
        {
          user_id: session.user.id,
          type,
          latitude: coords.lat,
          longitude: coords.lng,
          photo_url: photoUrl,
        },
      ]);

      if (dbError) throw dbError;

      setSuccessMsg(`Absen ${type} berhasil dicatat!`);
      fetchHistory(session.user.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat memproses absensi.');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Memuat Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Dashboard */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Selamat Datang, {user?.full_name || 'Pengguna'}!
            </h1>
            <p className="text-slate-500 text-sm">
              Role: <span className="capitalize font-semibold text-slate-700">{user?.role}</span>
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 gap-2">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>

        {/* Form Absen & Preview Kamera */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Panel Kamera */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <Camera className="w-5 h-5 text-indigo-600" />
                Kamera Absensi
              </CardTitle>
              <CardDescription>Posisikan wajah Anda di dalam bingkai kamera</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover"
                  videoConstraints={{ facingMode: 'user' }}
                />
              </div>

              {/* Status Lokasi */}
              <div className="bg-slate-100 p-3 rounded-lg text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-emerald-600" /> Koordinat GPS
                  </span>
                  <Button size="sm" variant="ghost" onClick={getLocation} className="h-6 px-2 text-xs gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </Button>
                </div>
                {coords.lat && coords.lng ? (
                  <p className="text-slate-600 font-mono text-xs">
                    Lat: {coords.lat.toFixed(6)}, Lng: {coords.lng.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-red-500 text-xs">{locationError || 'Mencari lokasi...'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Panel Aksi & Status */}
          <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <Clock className="w-5 h-5 text-emerald-600" />
                Presensi Hari Ini
              </CardTitle>
              <CardDescription>Pilih jenis absensi yang ingin dicatat</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 flex-grow flex flex-col justify-center">
              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <Button
                  onClick={() => handleAttendance('masuk')}
                  disabled={submitting || !coords.lat}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-16 text-lg font-semibold"
                >
                  {submitting ? 'Memproses...' : 'Absen Masuk'}
                </Button>

                <Button
                  onClick={() => handleAttendance('pulang')}
                  disabled={submitting || !coords.lat}
                  variant="outline"
                  className="border-slate-300 hover:bg-slate-100 text-slate-800 h-16 text-lg font-semibold"
                >
                  {submitting ? 'Memproses...' : 'Absen Pulang'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabel Riwayat Absensi */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-800">Riwayat Kehadiran</CardTitle>
            <CardDescription>Catatan kehadiran terkini Anda</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-slate-500 text-center py-6 text-sm">Belum ada riwayat absensi.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Foto Bukti</TableHead>
                      <TableHead>Koordinat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-slate-700">
                          {new Date(item.created_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                              item.type === 'masuk'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.photo_url ? (
                            <a
                              href={item.photo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline text-sm font-medium"
                            >
                              Lihat Foto
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">
                          {item.latitude && item.longitude
                            ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}