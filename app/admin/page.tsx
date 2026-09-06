'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Calendar, MapPin, ArrowLeft, Download } from 'lucide-react';

interface AttendanceWithProfile {
  id: string;
  type: 'masuk' | 'pulang';
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    role: string;
  } | null;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [attendances, setAttendances] = useState<AttendanceWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    // Cek Role User di Tabel Profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      alert('Akses Ditolak: Halaman ini hanya untuk Admin.');
      router.push('/dashboard');
      return;
    }

    // Ambil Seluruh Data Absensi + Join Tabel Profiles
    const { data, error } = await supabase
      .from('attendances')
      .select(`
        id,
        type,
        latitude,
        longitude,
        photo_url,
        created_at,
        profiles (
          full_name,
          role
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAttendances(data as unknown as AttendanceWithProfile[]);
    }

    setLoading(false);
  };

  // Filter Data Berdasarkan Nama
  const filteredAttendances = attendances.filter((item) =>
    item.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 font-medium">Memuat Data Admin...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Admin */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Panel Rekapitulasi Admin
            </h1>
            <p className="text-slate-500 text-sm">
              Kelola dan pantau seluruh catatan kehadiran pengguna
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard')} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
          </Button>
        </div>

        {/* Tabel Rekap Seluruh Absensi */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg text-slate-800">Daftar Kehadiran Seluruh Pengguna</CardTitle>
              <CardDescription>Total {filteredAttendances.length} catatan ditemukan</CardDescription>
            </div>
            <div className="w-full md:w-72">
              <Input
                placeholder="Cari berdasarkan nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredAttendances.length === 0 ? (
              <p className="text-slate-500 text-center py-6 text-sm">Tidak ada data absensi.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Pengguna</TableHead>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Foto Bukti</TableHead>
                      <TableHead>Lokasi GPS (Google Maps)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendances.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold text-slate-800">
                          {item.profiles?.full_name || 'Tanpa Nama'}
                        </TableCell>
                        <TableCell className="text-slate-600">
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
                        <TableCell>
                          {item.latitude && item.longitude ? (
                            <a
                              href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:underline text-xs font-mono flex items-center gap-1"
                            >
                              <MapPin className="w-3.5 h-3.5" /> Buka di Maps
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
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