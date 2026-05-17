import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";

interface Event {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  type: string;
  target_type: 'peserta' | 'nominal';
  categories: string;
  reg_link: string;
  max_participants: number;
}

interface Registration {
  id: string;
  full_name: string;
  category_selected: string;
  phone_number: string;
  payment_amount: number;
  created_at: string;
}

export default function EventRegistration() {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  const [targetValue, setTargetValue] = useState<number>(0);
  const [history, setHistory] = useState<Registration[]>([]);
  const [totalEventReg, setTotalEventReg] = useState<number>(0);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('saEventRegDraft');
    if (saved) return JSON.parse(saved);
    return {
      full_name: "", gender: "Laki-laki", dob: "", email: "",
      phone_number: "", instagram: "", category_selected: "", address: "",
      payment_amount: ""
    };
  });

  useEffect(() => {
    localStorage.setItem('saEventRegDraft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    fetchActiveEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent && profile) {
      fetchProgressAndHistory();
    }
  }, [selectedEvent, profile]);

  async function fetchActiveEvents() {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvents(data || []);
      if (data && data.length > 0) setSelectedEvent(data[0]);
    } catch (error) {
      alert("Error: " + (error as any).message);
    }
  }

  async function fetchProgressAndHistory() {
    if (!profile || !selectedEvent) return;
    try {
      const { data: targetData } = await supabase
        .from("event_targets")
        .select("target_count, target_type, target_amount")
        .eq("event_id", selectedEvent.id)
        .eq("sa_id", profile.id)
        .single();

      if (targetData) {
        setTargetValue(selectedEvent.target_type === 'nominal' ? targetData.target_amount : targetData.target_count);
      } else {
        setTargetValue(0);
      }

      const { data: historyData } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .eq("registered_by", profile.id)
        .order("created_at", { ascending: false });

      setHistory(historyData || []);

      const { count } = await supabase
        .from("event_registrations")
        .select("*", { count: 'exact', head: true })
        .eq("event_id", selectedEvent.id);
      
      setTotalEventReg(count || 0);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent || !profile) return;

    if (selectedEvent.max_participants > 0 && totalEventReg >= selectedEvent.max_participants) {
      alert("Kuota pendaftaran penuh."); return;
    }

    setIsSubmitLoading(true);
    try {
      const { error } = await supabase.from("event_registrations").insert([{
        event_id: selectedEvent.id,
        registered_by: profile.id,
        full_name: formData.full_name,
        gender: formData.gender,
        dob: formData.dob,
        email: formData.email,
        phone_number: formData.phone_number,
        instagram: formData.instagram,
        category_selected: formData.category_selected,
        address: formData.address,
        payment_amount: parseFloat(formData.payment_amount) || 0
      }]);

      if (error) throw error;
      alert("Pendaftaran berhasil!");
      setFormData((prev: any) => ({
        ...prev,
        full_name: "", gender: "Laki-laki", dob: "", email: "",
        phone_number: "", instagram: "", address: "",
        payment_amount: ""
      }));
      localStorage.removeItem('saEventRegDraft');
      fetchProgressAndHistory();
    } catch (error) {
      alert("Gagal: " + (error as any).message);
    } finally {
      setIsSubmitLoading(false);
    }
  }

  const currentAchievement = selectedEvent?.target_type === 'nominal'
    ? history.reduce((sum, item) => sum + (item.payment_amount || 0), 0)
    : history.length;

  const percent = Math.min(Math.round((currentAchievement / (targetValue || 1)) * 100), 100);

  return (
    <>
      <PageMeta title="Registrasi Event | Gramedia" description="Input data peserta & monitoring progres target." />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Registrasi Event</h1>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">
              Tipe Target: {selectedEvent?.target_type === 'nominal' ? 'Nominal (Rp)' : 'Peserta'}
            </p>
          </div>

          <select className="h-10 px-4 border border-gray-300 rounded-lg dark:bg-gray-900 outline-none min-w-[250px] text-xs font-black uppercase" value={selectedEvent?.id || ""} onChange={(e) => setSelectedEvent(events.find(ev => ev.id === e.target.value) || null)}>
            {events.map(ev => (<option key={ev.id} value={ev.id}>{ev.name}</option>))}
          </select>
        </div>

        {selectedEvent && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-5">
              <div className="rounded-xl border border-gray-200 bg-white p-5 dark:bg-white/[0.03] shadow-sm">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Monitoring Progres</h3>
                <div className="flex items-end justify-between mb-2">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">
                      {selectedEvent.target_type === 'nominal' ? `Rp ${currentAchievement.toLocaleString()}` : `${currentAchievement} Orang`}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Target: {selectedEvent.target_type === 'nominal' ? `Rp ${targetValue.toLocaleString()}` : `${targetValue} Orang`}</span>
                  </div>
                  <Badge color={currentAchievement >= targetValue ? "success" : "warning"}>{percent}%</Badge>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 dark:bg-gray-800 overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full transition-all duration-700" style={{ width: `${percent}%` }}></div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 dark:bg-white/[0.03] shadow-sm">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Link / Form Luar</h3>
                {selectedEvent.reg_link ? (
                  <a href={selectedEvent.reg_link.startsWith('http') ? selectedEvent.reg_link : `https://${selectedEvent.reg_link}`} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full py-3 bg-gray-900 text-white text-[10px] font-black uppercase rounded-lg hover:bg-black transition-all gap-2">
                    Buka Website Event
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
                  </a>
                ) : <p className="text-[10px] text-gray-400 italic">Tidak ada link eksternal.</p>}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:bg-white/[0.03] shadow-sm">
                <h2 className="mb-5 text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Form Registrasi Peserta</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <InputField label="Nama Lengkap" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase">Jenis Kelamin</label>
                      <select className="w-full h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 text-xs font-bold" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} required>
                        <option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    <InputField label="Tgl Lahir" type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} required />
                    
                    <InputField label="Email" type="email" placeholder="contoh@gmail.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    <InputField label="Nomor WhatsApp" placeholder="08..." value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} required />
                    
                    <InputField label="Instagram" placeholder="@username" value={formData.instagram} onChange={(e) => setFormData({ ...formData, instagram: e.target.value })} />
                    <InputField label="Usia / Kategori" placeholder="SD / Umum" value={formData.category_selected} onChange={(e) => setFormData({ ...formData, category_selected: e.target.value })} />
                    
                    <div className="md:col-span-2">
                      <InputField label="Alamat / Domisili" placeholder="Masukkan alamat lengkap" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                    </div>

                    <div className="md:col-span-2 pt-2 border-t border-gray-100 dark:border-white/[0.05]">
                      <InputField label="Nominal Pembayaran (Rp)" type="number" placeholder="Masukkan angka saja" value={formData.payment_amount} onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })} required />
                    </div>
                  </div>
                  <Button type="submit" disabled={isSubmitLoading} className="w-full py-3 text-xs font-black uppercase tracking-widest mt-2">{isSubmitLoading ? "Memproses..." : "Daftarkan Peserta"}</Button>
                </form>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}
