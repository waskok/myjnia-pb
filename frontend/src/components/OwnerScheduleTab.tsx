import React, { useMemo } from 'react';
import type { AppLogic } from '../hooks/useAppLogic';
import type { ScheduleEntry } from '../types';

const WEEKDAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function buildCalendarCells(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: ({ day: number; dateStr: string } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type ScheduleTabProps = Pick<
  AppLogic,
  | 'scheduleYear'
  | 'scheduleMonth'
  | 'scheduleData'
  | 'selectedScheduleDates'
  | 'scheduleEmployeeId'
  | 'setScheduleEmployeeId'
  | 'scheduleStartTime'
  | 'setScheduleStartTime'
  | 'employees'
  | 'changeScheduleMonth'
  | 'handleScheduleMonthInput'
  | 'toggleScheduleDate'
  | 'handleSaveSchedule'
  | 'handleDeleteScheduleEntry'
  | 'setSelectedScheduleDates'
>;

export const OwnerScheduleTab: React.FC<ScheduleTabProps> = ({
  scheduleYear,
  scheduleMonth,
  scheduleData,
  selectedScheduleDates,
  scheduleEmployeeId,
  setScheduleEmployeeId,
  scheduleStartTime,
  setScheduleStartTime,
  employees,
  changeScheduleMonth,
  handleScheduleMonthInput,
  toggleScheduleDate,
  handleSaveSchedule,
  handleDeleteScheduleEntry,
  setSelectedScheduleDates,
}) => {
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const entry of scheduleData?.schedules ?? []) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, [scheduleData]);

  const cells = buildCalendarCells(scheduleYear, scheduleMonth);
  const monthLabel = `${MONTH_NAMES[scheduleMonth - 1]} ${scheduleYear}`;
  const monthInputValue = `${scheduleYear}-${pad(scheduleMonth)}`;

  return (
    <div className="card schedule-card text-left">
      <div className="flex-space-between mb-20" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0 }}>Grafik pracowników 📅</h3>
        <div className="schedule-nav">
          <button type="button" className="btn btn-light" onClick={() => changeScheduleMonth(-1)}>
            ← Poprzedni
          </button>
          <input
            type="month"
            className="input-field schedule-month-input"
            value={monthInputValue}
            onChange={(e) => handleScheduleMonthInput(e.target.value)}
          />
          <button type="button" className="btn btn-light" onClick={() => changeScheduleMonth(1)}>
            Następny →
          </button>
        </div>
      </div>

      <p className="text-muted schedule-hint">
        Kliknij dzień, aby go zaznaczyć (możesz wybrać wiele). Następnie wybierz pracownika i godzinę startu, i zapisz.
      </p>

      <div className="schedule-calendar">
        <div className="schedule-month-title">{monthLabel}</div>
        <div className="schedule-weekdays">
          {WEEKDAYS.map((d) => (
            <div key={d} className="schedule-weekday">{d}</div>
          ))}
        </div>
        <div className="schedule-grid">
          {cells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="schedule-day schedule-day-empty" />;
            }
            const isSelected = selectedScheduleDates.includes(cell.dateStr);
            const dayEntries = schedulesByDate.get(cell.dateStr) ?? [];
            const isToday = cell.dateStr === toDateStr(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              new Date().getDate()
            );

            return (
              <button
                key={cell.dateStr}
                type="button"
                className={`schedule-day ${isSelected ? 'schedule-day-selected' : ''} ${isToday ? 'schedule-day-today' : ''}`}
                onClick={() => toggleScheduleDate(cell.dateStr)}
              >
                <span className="schedule-day-num">{cell.day}</span>
                <div className="schedule-day-entries">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="schedule-entry"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="schedule-entry-text">
                        {entry.startTime} {entry.employee.firstName.charAt(0)}. {entry.employee.lastName}
                      </span>
                      <button
                        type="button"
                        className="schedule-entry-delete"
                        title="Usuń wpis"
                        onClick={() => handleDeleteScheduleEntry(entry.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSaveSchedule} className="schedule-form">
        <div className="schedule-form-row">
          <div className="schedule-form-field">
            <label>Pracownik</label>
            <select
              className="select-field w-full"
              value={scheduleEmployeeId}
              onChange={(e) => setScheduleEmployeeId(e.target.value)}
              required
            >
              <option value="" disabled>Wybierz pracownika</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.role})
                </option>
              ))}
            </select>
          </div>
          <div className="schedule-form-field">
            <label>Godzina rozpoczęcia</label>
            <input
              type="time"
              className="input-field w-full"
              value={scheduleStartTime}
              onChange={(e) => setScheduleStartTime(e.target.value)}
              required
            />
          </div>
          <div className="schedule-form-actions">
            <button
              type="submit"
              className="btn btn-success"
              disabled={selectedScheduleDates.length === 0 || employees.length === 0}
            >
              Zapisz na {selectedScheduleDates.length} {selectedScheduleDates.length === 1 ? 'dzień' : 'dni'}
            </button>
            {selectedScheduleDates.length > 0 && (
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setSelectedScheduleDates([])}
              >
                Wyczyść zaznaczenie
              </button>
            )}
          </div>
        </div>
        {employees.length === 0 && (
          <p className="text-danger" style={{ marginTop: '10px' }}>
            Brak pracowników — dodaj ich w zakładce „Pracownicy”.
          </p>
        )}
        {selectedScheduleDates.length > 0 && (
          <p className="text-muted" style={{ marginTop: '8px', fontSize: '14px' }}>
            Zaznaczone dni: {selectedScheduleDates.sort().join(', ')}
          </p>
        )}
      </form>
    </div>
  );
};
