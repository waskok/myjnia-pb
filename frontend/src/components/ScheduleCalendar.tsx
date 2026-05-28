import React, { useMemo } from 'react';
import type { ScheduleEntry, ScheduleMonthData } from '../types';

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

export interface ScheduleCalendarProps {
  readOnly?: boolean;
  title?: string;
  hint?: string;
  scheduleYear: number;
  scheduleMonth: number;
  scheduleData: ScheduleMonthData | null;
  selectedScheduleDates?: string[];
  onToggleDate?: (dateStr: string) => void;
  onDeleteEntry?: (id: number) => void;
  changeScheduleMonth: (delta: number) => void;
  onMonthInput: (val: string) => void;
}

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  readOnly = false,
  title = 'Grafik pracowników 📅',
  hint,
  scheduleYear,
  scheduleMonth,
  scheduleData,
  selectedScheduleDates = [],
  onToggleDate,
  onDeleteEntry,
  changeScheduleMonth,
  onMonthInput,
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
  const defaultHint = readOnly
    ? 'Podgląd grafiku całego zespołu — tylko do odczytu.'
    : 'Kliknij dzień, aby go zaznaczyć (możesz wybrać wiele). Następnie wybierz pracownika, godziny i zapisz.';

  return (
    <>
      <div className="schedule-toolbar mb-20">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div className="schedule-nav">
          <button type="button" className="btn btn-light" onClick={() => changeScheduleMonth(-1)}>
            ← Poprzedni
          </button>
          <input
            type="month"
            className="input-field schedule-month-input"
            value={monthInputValue}
            onChange={(e) => onMonthInput(e.target.value)}
          />
          <button type="button" className="btn btn-light" onClick={() => changeScheduleMonth(1)}>
            Następny →
          </button>
        </div>
      </div>

      <p className="text-muted schedule-hint">{hint ?? defaultHint}</p>

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
            const isSelected = !readOnly && selectedScheduleDates.includes(cell.dateStr);
            const dayEntries = schedulesByDate.get(cell.dateStr) ?? [];
            const isToday = cell.dateStr === toDateStr(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              new Date().getDate()
            );

            const dayClass = [
              'schedule-day',
              readOnly ? 'schedule-day-readonly' : '',
              isSelected ? 'schedule-day-selected' : '',
              isToday ? 'schedule-day-today' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const content = (
              <>
                <span className="schedule-day-num">{cell.day}</span>
                <div className="schedule-day-entries">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="schedule-entry"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="schedule-entry-text" title={`${entry.employee.firstName} ${entry.employee.lastName} (${entry.employee.role})`}>
                        {entry.startTime}-{entry.endTime} {entry.employee.firstName} {entry.employee.lastName.charAt(0)}.
                      </span>
                      {!readOnly && onDeleteEntry && (
                        <button
                          type="button"
                          className="schedule-entry-delete"
                          title="Usuń wpis"
                          onClick={() => onDeleteEntry(entry.id)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );

            if (readOnly) {
              return (
                <div key={cell.dateStr} className={dayClass}>
                  {content}
                </div>
              );
            }

            return (
              <button
                key={cell.dateStr}
                type="button"
                className={dayClass}
                onClick={() => onToggleDate?.(cell.dateStr)}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
