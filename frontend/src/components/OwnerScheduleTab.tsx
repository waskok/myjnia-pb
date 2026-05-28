import React from 'react';
import type { AppLogic } from '../hooks/useAppLogic';
import { ScheduleCalendar } from './ScheduleCalendar';

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
  | 'scheduleEndTime'
  | 'setScheduleEndTime'
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
  scheduleEndTime,
  setScheduleEndTime,
  employees,
  changeScheduleMonth,
  handleScheduleMonthInput,
  toggleScheduleDate,
  handleSaveSchedule,
  handleDeleteScheduleEntry,
  setSelectedScheduleDates,
}) => (
  <div className="card schedule-card text-left">
    <ScheduleCalendar
      scheduleYear={scheduleYear}
      scheduleMonth={scheduleMonth}
      scheduleData={scheduleData}
      selectedScheduleDates={selectedScheduleDates}
      onToggleDate={toggleScheduleDate}
      onDeleteEntry={handleDeleteScheduleEntry}
      changeScheduleMonth={changeScheduleMonth}
      onMonthInput={handleScheduleMonthInput}
    />

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
        <div className="schedule-form-field">
          <label>Godzina zakończenia</label>
          <input
            type="time"
            className="input-field w-full"
            value={scheduleEndTime}
            onChange={(e) => setScheduleEndTime(e.target.value)}
            required
          />
        </div>
        <div className="schedule-form-actions">
          <button
            type="submit"
            className="btn btn-success"
            disabled={selectedScheduleDates.length === 0 || employees.length === 0}
          >
            Zapisz na {selectedScheduleDates.length}{' '}
            {selectedScheduleDates.length === 1 ? 'dzień' : 'dni'}
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
