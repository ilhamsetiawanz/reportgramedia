import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { TrashBinIcon } from "../../icons";
import Badge from "../../components/ui/badge/Badge";

interface Event {
  id: string;
  name: string;
  description: string;
  categories: string[];
  registration_deadline: string;
}

interface Participant {
  id: string;
  name: string;
  age: number;
  school_class: string;
  phone: string;
  category: string;
  created_at: string;
}

export default function EventRegistration() {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [target, setTarget] = useState<number>(0);
  const [history, setHistory] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    school_class: "",
    address: "",
    phone: "",
    category: ""
  });

  useEffect(() => {
    fetchActiveEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent && profile) {
      fetchProgressAndHistory();
    }
  }, [selectedEvent, profile]);

  async function fetchActiveEvents() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("registration_deadline", { ascending: true });

    setEvents(data || []);
    if (data && data.length > 0) {
      setSelectedEvent(data[0]);
    }
  }

  async function fetchProgressAndHistory() {
    if (!profile || !selectedEvent) return;
    setIsLoading(true);
    try {
      // 1. Fetch Target
      const { data: targetData } = await supabase
        .from("event_targets")
        .select("target_count")
        .eq("event_id", selectedEvent.id)
        .eq("sa_id", profile.id)
        .single();

      setTarget(targetData?.target_count || 0);

      // 2. Fetch History
      const { data: historyData } = await supabase
        .from("event_participants")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .eq("sa_id", profile.id)
        .order("created_at", { ascending: false });

      setHistory(historyData || []);
    } catch (error) {
      console.error("Error fetching progress:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent || !profile) return;

    // Check deadline
    if (new Date() > new Date(selectedEvent.registration_deadline)) {
      alert("Pendaftaran sudah ditutup untuk event ini.");
      return;
    }

    setIsSubmitLoading(true);
    try {
      const { error } = await supabase.from("event_participants").insert([{
        event_id: selectedEvent.id,
        sa_id: profile.id,
        name: formData.name,
        age: parseInt(formData.age),
        school_class: formData.school_class,
        address: formData.address,
        phone: formData.phone,
        category: formData.category
      }]);

      if (error) throw error;

      alert("Peserta berhasil didaftarkan!");
      setFormData({
        name: "",
        age: "",
        school_class: "",
        address: "",
        phone: "",
        category: selectedEvent.categories?.[0] || ""
      });
      fetchProgressAndHistory();
    } catch (error) {
      alert("Gagal daftar: " + (error as any).message);
    } finally {
      setIsSubmitLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus pendaftaran peserta ini?")) return;
    try {
      const { error } = await supabase.from("event_participants").delete().eq("id", id);
      if (error) throw error;
      fetchProgressAndHistory();
    } catch (error) {
      alert("Gagal hapus: " + (error as any).message);
    }
  }

  const isDeadlinePassed = selectedEvent ? (new Date() > new Date(selectedEvent.registration_deadline)) : false;

  return (
    <>
      <PageMeta title="Pendaftaran Event | Gramedia Tracker" description="Input data peserta event" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pendaftaran Event</h1>
            <p className="text-sm text-gray-500">Pilih event dan daftarkan peserta baru.</p>
          </div>

          <select
            className="h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none min-w-[250px]"
            value={selectedEvent?.id || ""}
            onChange={(e) => setSelectedEvent(events.find(ev => ev.id === e.target.value) || null)}
          >
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name} ({new Date(ev.registration_deadline).toLocaleDateString()})</option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Progress Card */}
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Progres Target</h3>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{history.length} <span className="text-sm font-normal text-gray-500">/ {target}</span></span>
                  <Badge color={history.length >= target ? "success" : "warning"}>
                    {history.length >= target ? "Target Tercapai" : "Belum Target"}
                  </Badge>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 dark:bg-gray-800">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((history.length / (target || 1)) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Detail Event</h3>
                <p className="text-xs text-gray-500 mb-4">{selectedEvent.description || "Tidak ada deskripsi."}</p>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Deadline:</span>
                    <span className={`font-medium ${isDeadlinePassed ? "text-error-500" : "text-gray-900 dark:text-white"}`}>
                      {new Date(selectedEvent.registration_deadline).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                    </span>
                  </div>
                  {isDeadlinePassed && (
                    <Badge color="error">Pendaftaran Tutup</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Registration Form */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Formulir Peserta Baru</h2>
                {isDeadlinePassed ? (
                  <div className="p-10 text-center border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-gray-400 italic">Pendaftaran untuk event ini sudah ditutup otomatis karena melewati batas tanggal pendaftaran.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <InputField
                        label="Nama Lengkap Peserta"
                        placeholder="Masukkan nama lengkap peserta"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <InputField
                      label="Umur"
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      required
                    />
                    <InputField
                      label="Sekolah / Kelas"
                      placeholder="Contoh: SDN 1 Kendari / 3"
                      value={formData.school_class}
                      onChange={(e) => setFormData({ ...formData, school_class: e.target.value })}
                      required
                    />
                    <div className="md:col-span-2">
                      <InputField
                        label="Alamat"
                        placeholder="Masukkan alamat lengkap"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                      />
                    </div>
                    <InputField
                      label="Telepon / HP"
                      placeholder="Contoh: 08123456789"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Kategori Lomba</label>
                      <select
                        className="w-full h-11 px-4 text-sm border border-gray-300 rounded-lg focus:border-brand-500 outline-none dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      >
                        <option value="">Pilih Kategori...</option>
                        {selectedEvent.categories?.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2 pt-2">
                      <Button type="submit" disabled={isSubmitLoading} className="w-full">
                        {isSubmitLoading ? "Mendaftar..." : "Daftarkan Peserta"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Local History Table */}
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Peserta Terdaftar Oleh Anda</h2>
                <div className="max-w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell isHeader className="px-4 py-3 text-theme-xs">Nama</TableCell>
                        <TableCell isHeader className="px-4 py-3 text-theme-xs">Kategori</TableCell>
                        <TableCell isHeader className="px-4 py-3 text-theme-xs">HP</TableCell>
                        <TableCell isHeader className="px-4 py-3 text-end text-theme-xs">Aksi</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-gray-400 italic">Belum ada peserta yang didaftarkan.</TableCell>
                        </TableRow>
                      ) : (
                        history.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="px-4 py-3 text-sm font-medium">{item.name}</TableCell>
                            <TableCell className="px-4 py-3 text-sm">{item.category}</TableCell>
                            <TableCell className="px-4 py-3 text-sm">{item.phone}</TableCell>
                            <TableCell className="px-4 py-3 text-end">
                              <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-error-500">
                                <TrashBinIcon className="size-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
