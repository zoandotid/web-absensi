'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Clock, ArrowLeft, UserPlus, Save, MapPin } from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<any[]>([]);
  
  // State Pengaturan Jam Kerja
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('15:00');
  const [lateTolerance, setLateTolerance] = useState(15);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // State Form Tambah Guru
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    initAdminData();
  }, []);

  const initAdminData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    // Cek Role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') return router.push('/dashboard');

    // Load Jam Kerja
    const { data: settings } = await supabase.from('school_settings').select('*').single();
    if (settings) {
      setWorkStart(settings.work_start.slice(0, 5));
      setWorkEnd(settings.work_end.slice(0, 5));
      setLateTolerance(settings.late_tolerance_minutes);
    }

    // Load Rekap Absensi
    fetchAttendances();
    setLoading(false);
  };

  const fetchAttendances = async () => {
    const { data } = await supabase
      .from('attendances')
      .select('*, profiles(full_name, role)')
      .order('created_at', { ascending: false });
    if (data) setAttendances(data);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    const { error } = await supabase.from('school_settings').update({
      work_start: `${workStart}:00`,
      work_end: `${workEnd}:00`,
      late_tolerance_minutes: lateTolerance,
    }).eq('id', 1);

    if (error) alert('Gagal menyimpan jadwal: ' + error.message);
    else alert('Jadwal jam sekolah Al Ihsan berhasil diperbarui!');
    setSavingSchedule(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, role: 'karyawan' }),
    });

    const result = await res.json();
    if (!res.ok) alert('Gagal: ' + result.error);
    else {
      alert('Akun Guru/Karyawan berhasil dibuat!');
      setFullName(''); setEmail(''); setPassword('');
    }
    setCreatingUser(false);
  };

  if (loading) return <div className="p-8 text-center">Memuat Panel Admin Sekolah Al Ihsan...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel Admin Sekolah Al Ihsan</h1>
          <p className="text-slate-500 text-sm">Kelola akun guru, jadwal presensi, dan rekapitulasi</p>
        </div>
        <Button onClick={() => router.push('/dashboard')} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Ke Dashboard Presensi
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Pengaturan Jam Kerja */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Atur Jam Kerja & Toleransi
            </CardTitle>
            <CardDescription>Tentukan batas waktu masuk dan keterlambatan</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Jam Masuk</label>
                  <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} required />
                </div>
                <div>
                  <label className="text-sm font-medium">Jam Pulang</label>
                  <Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Toleransi Keterlambatan (Menit)</label>
                <Input type="number" value={lateTolerance} onChange={(e) => setLateTolerance(Number(e.target.value))} required />
              </div>
              <Button type="submit" disabled={savingSchedule} className="w-full bg-indigo-600 hover:bg-indigo-700">
                <Save className="w-4 h-4 mr-2" /> {savingSchedule ? 'Menyimpan...' : 'Simpan Jadwal'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Form Buat Akun Guru Baru */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" /> Tambah Akun Guru / Karyawan
            </CardTitle>
            <CardDescription>Buat kredensial login untuk staf sekolah</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <Input placeholder="Nama Lengkap Guru" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <Input type="email" placeholder="Email Guru" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password Awal" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <Button type="submit" disabled={creatingUser} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {creatingUser ? 'Memproses...' : 'Daftarkan Akun Guru'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Rekapitulasi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" /> Rekap Kehadiran Realtime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Guru</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Foto & GPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendances.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.profiles?.full_name || 'Guru'}</TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleString('id-ID')}</TableCell>
                  <TableCell className="capitalize">{item.type}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      item.status === 'terlambat' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.status || 'Tepat Waktu'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <a href={item.photo_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline text-xs mr-2">Foto</a>
                    <a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer" className="text-emerald-600 underline text-xs">Maps</a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}