import { useState } from 'react';
import { api } from '../utils/apiClient';
import type { ScheduleMonthData } from '../types';

export const useSchedule = (
  setMessage: (msg: string) => void,
  userRole: 'customer' | 'employee' | 'owner' | null,
) => {
  const now = new Date();
  const [scheduleYear, setScheduleYear] = useState(now.getFullYear());
  const [scheduleMonth, setScheduleMonth] = useState(now.getMonth() + 1);
  const [scheduleData, setScheduleData] = useState<ScheduleMonthData | null>(null);
  const [selectedScheduleDates, setSelectedScheduleDates] = useState<string[]>([]);
  const [scheduleEmployeeId, setScheduleEmployeeId] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('08:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('16:00');

  const fetchSchedule = async (year = scheduleYear, month = scheduleMonth) => {
    const path =
      userRole === 'employee' ? '/api/employee/schedule' : '/api/owner/schedule';
    const res = await api.get(`${path}?year=${year}&month=${month}`);
    const data = (await res.json()) as ScheduleMonthData & { error?: string };
    if (res.ok) {
      setScheduleData(data);
      setScheduleYear(data.year);
      setScheduleMonth(data.month);
    } else {
      setMessage('❌ ' + (data.error ?? 'Błąd pobierania grafiku.'));
    }
  };

  const changeScheduleMonth = (delta: number) => {
    let y = scheduleYear;
    let m = scheduleMonth + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setScheduleYear(y);
    setScheduleMonth(m);
    setSelectedScheduleDates([]);
    void fetchSchedule(y, m);
  };

  const handleScheduleMonthInput = (val: string) => {
    if (!val) return;
    const [y, m] = val.split('-').map(Number);
    if (!y || !m) return;
    setScheduleYear(y);
    setScheduleMonth(m);
    setSelectedScheduleDates([]);
    void fetchSchedule(y, m);
  };

  const toggleScheduleDate = (dateStr: string) => {
    setSelectedScheduleDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr],
    );
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleEmployeeId) {
      setMessage('❌ Wybierz pracownika.');
      return;
    }
    if (selectedScheduleDates.length === 0) {
      setMessage('❌ Zaznacz co najmniej jeden dzień w kalendarzu.');
      return;
    }
    if (scheduleEndTime <= scheduleStartTime) {
      setMessage('❌ Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }
    const res = await api.post('/api/owner/schedule', {
      employeeId: Number(scheduleEmployeeId),
      startTime: scheduleStartTime,
      endTime: scheduleEndTime,
      dates: selectedScheduleDates,
    });
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setMessage('✅ ' + (data.message ?? 'Zapisano grafik.'));
      setSelectedScheduleDates([]);
      void fetchSchedule();
    } else {
      setMessage('❌ ' + (data.error ?? 'Błąd zapisu grafiku.'));
    }
  };

  const handleDeleteScheduleEntry = async (id: number) => {
    if (!window.confirm('Usunąć ten wpis z grafiku?')) return;
    const res = await api.delete(`/api/owner/schedule/${id}`);
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setMessage('✅ ' + (data.message ?? 'Usunięto wpis.'));
      void fetchSchedule();
    } else {
      setMessage('❌ ' + (data.error ?? 'Błąd usuwania.'));
    }
  };

  return {
    scheduleYear,
    scheduleMonth,
    scheduleData,
    selectedScheduleDates,
    setSelectedScheduleDates,
    scheduleEmployeeId,
    setScheduleEmployeeId,
    scheduleStartTime,
    setScheduleStartTime,
    scheduleEndTime,
    setScheduleEndTime,
    fetchSchedule,
    changeScheduleMonth,
    handleScheduleMonthInput,
    toggleScheduleDate,
    handleSaveSchedule,
    handleDeleteScheduleEntry,
  };
};
