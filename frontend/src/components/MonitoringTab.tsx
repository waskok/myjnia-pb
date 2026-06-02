import React, { useState } from 'react';
import type { MonitoringConfig, MonitoringData, MonitoringPoint } from '../types';

interface Props {
  monitoringData: MonitoringData | null;
  fetchMonitoring: (period?: '1h' | '24h' | '7d' | '30d') => void;
  monitoringConfig?: MonitoringConfig;
  canManageConfig?: boolean;
  onMonitoringConfigChange?: (key: keyof MonitoringConfig, value: number) => void;
  onSaveMonitoringConfig?: () => void;
}

const toLabelTime = (value: string) => new Date(value).toLocaleString('pl-PL');
const isLpgFuel = (fuelType: string) => fuelType.toUpperCase().includes('LPG');

type TimelineEntry = {
  timestamp: string;
  level?: number;
  pressure?: number;
  temperature?: number;
};

type AlertEvaluation = {
  status: 'OK' | 'Wysłano alert';
  levelAlert: boolean;
  pressureAlert: boolean;
  temperatureAlert: boolean;
};

const buildTimeline = (
  levelPoints: MonitoringPoint[],
  pressurePoints: MonitoringPoint[],
  temperaturePoints: MonitoringPoint[]
): TimelineEntry[] => {
  const map = new Map<string, TimelineEntry>();
  for (const point of levelPoints) {
    const key = point.timestamp;
    const current = map.get(key) ?? { timestamp: key };
    current.level = point.value;
    map.set(key, current);
  }
  for (const point of pressurePoints) {
    const key = point.timestamp;
    const current = map.get(key) ?? { timestamp: key };
    current.pressure = point.value;
    map.set(key, current);
  }
  for (const point of temperaturePoints) {
    const key = point.timestamp;
    const current = map.get(key) ?? { timestamp: key };
    current.temperature = point.value;
    map.set(key, current);
  }
  return Array.from(map.values())
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-8)
    .reverse();
};

const toNumberOrNull = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const evaluateCardAlert = ({
  level,
  maxLevel,
  pressure,
  temperature,
  isLpg,
  config
}: {
  level: number | null;
  maxLevel: number | null;
  pressure: number | null;
  temperature: number | null;
  isLpg: boolean;
  config?: MonitoringConfig;
}): AlertEvaluation => {
  const levelPercent = level !== null && maxLevel && maxLevel > 0 ? (level / maxLevel) * 100 : null;
  const lowLevelThreshold = isLpg ? config?.lpgLowLevelPercent ?? 20 : config?.fuelLowLevelPercent ?? 20;
  const pressureThreshold = isLpg ? config?.lpgMaxPressureBar ?? 14 : config?.fuelMaxPressureBar ?? 2.5;
  const temperatureThreshold = isLpg ? config?.lpgMaxTempC ?? 30 : config?.fuelMaxTempC ?? 35;

  const levelAlert = levelPercent !== null && levelPercent <= lowLevelThreshold;
  const pressureAlert = pressure !== null && pressure >= pressureThreshold;
  const temperatureAlert = temperature !== null && temperature >= temperatureThreshold;

  if (levelAlert || pressureAlert || temperatureAlert) {
    return { status: 'Wysłano alert', levelAlert, pressureAlert, temperatureAlert };
  }
  return { status: 'OK', levelAlert, pressureAlert, temperatureAlert };
};

export const MonitoringTab: React.FC<Props> = ({
  monitoringData,
  fetchMonitoring,
  monitoringConfig,
  canManageConfig = false,
  onMonitoringConfigChange,
  onSaveMonitoringConfig,
}) => {
  const [period, setPeriod] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const fuelTanks = (monitoringData?.fuels ?? []).filter((fuel) => !isLpgFuel(fuel.type));
  const historyColumns = [
    ...(monitoringData?.tankTelemetry ?? []).map((tank) => ({
      key: tank.tank,
      title: tank.label,
      fuelLabel: tank.tank === 'ON' ? 'ON' : tank.tank,
      isLpg: false,
      maxLevel: tank.maxLevel ?? null,
      entries: buildTimeline(tank.history.level, tank.history.pressure, tank.history.temperature)
    })),
    {
      key: 'LPG',
      title: 'Zbiornik LPG',
      fuelLabel: 'LPG',
      isLpg: true,
      maxLevel: monitoringData?.lpg.maxLevel ?? null,
      entries: buildTimeline(
        monitoringData?.lpg.history?.level ?? [],
        monitoringData?.lpg.history?.pressure ?? [],
        monitoringData?.lpg.history?.temperature ?? []
      )
    }
  ];

  return (
    <div className="card mt-20">
      <div className="flex-space-between mb-20" style={{ alignItems: 'center', gap: 10 }}>
        <h3 style={{ margin: 0 }}>Centrum monitoringu PB</h3>
        <div className="row-actions">
          <select
            className="select-field"
            value={period}
            onChange={(e) => setPeriod(e.target.value as '1h' | '24h' | '7d' | '30d')}
          >
            <option value="1h">Ostatnia 1h</option>
            <option value="24h">Ostatnie 24h</option>
            <option value="7d">Ostatnie 7 dni</option>
            <option value="30d">Ostatnie 30 dni</option>
          </select>
          <button onClick={() => fetchMonitoring(period)} className="btn btn-dark">Odśwież</button>
        </div>
      </div>

      {monitoringData?.alerts && monitoringData.alerts.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          {monitoringData.alerts.map((al, idx) => (
            <div key={idx} className="alert-box">⚠️ {al}</div>
          ))}
        </div>
      )}

      {monitoringConfig && (
        <div className="data-box mb-20">
          <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>Konfiguracja monitoringu</h4>
          <div className="grid-responsive">
            <div>
              <label>Częstotliwość zapisu (minuty)</label>
              <input
                type="number"
                className="input-field"
                min={1}
                value={Math.max(1, Math.round((monitoringConfig.samplingIntervalSec || 60) / 60))}
                onChange={(e) => onMonitoringConfigChange?.('samplingIntervalSec', Math.max(1, Number(e.target.value) || 1) * 60)}
                disabled={!canManageConfig}
              />
            </div>
            <div>
              <label>Niski poziom paliwa (%)</label>
              <input
                type="number"
                className="input-field"
                min={0}
                max={100}
                value={monitoringConfig.fuelLowLevelPercent}
                onChange={(e) => onMonitoringConfigChange?.('fuelLowLevelPercent', Number(e.target.value))}
                disabled={!canManageConfig}
              />
            </div>
            <div>
              <label>Maks. ciśnienie paliw (bar)</label>
              <input
                type="number"
                className="input-field"
                min={0}
                step="0.1"
                value={monitoringConfig.fuelMaxPressureBar}
                onChange={(e) => onMonitoringConfigChange?.('fuelMaxPressureBar', Number(e.target.value))}
                disabled={!canManageConfig}
              />
            </div>
            <div>
              <label>Maks. temperatura paliw (°C)</label>
              <input
                type="number"
                className="input-field"
                step="0.1"
                value={monitoringConfig.fuelMaxTempC}
                onChange={(e) => onMonitoringConfigChange?.('fuelMaxTempC', Number(e.target.value))}
                disabled={!canManageConfig}
              />
            </div>
            <div>
              <label>Niski poziom LPG (%)</label>
              <input
                type="number"
                className="input-field"
                min={0}
                max={100}
                value={monitoringConfig.lpgLowLevelPercent}
                onChange={(e) => onMonitoringConfigChange?.('lpgLowLevelPercent', Number(e.target.value))}
                disabled={!canManageConfig}
              />
            </div>
            <div>
              <label>Maks. ciśnienie LPG (bar)</label>
              <input
                type="number"
                className="input-field"
                min={0}
                step="0.1"
                value={monitoringConfig.lpgMaxPressureBar}
                onChange={(e) => onMonitoringConfigChange?.('lpgMaxPressureBar', Number(e.target.value))}
                disabled={!canManageConfig}
              />
            </div>
            <div>
              <label>Maks. temperatura LPG (°C)</label>
              <input
                type="number"
                className="input-field"
                step="0.1"
                value={monitoringConfig.lpgMaxTempC}
                onChange={(e) => onMonitoringConfigChange?.('lpgMaxTempC', Number(e.target.value))}
                disabled={!canManageConfig}
              />
            </div>
          </div>
          {canManageConfig && (
            <button type="button" className="btn btn-primary mt-10" onClick={onSaveMonitoringConfig}>
              Zapisz konfigurację monitoringu
            </button>
          )}
        </div>
      )}

      <h4 style={{ margin: '0 0 8px 0', color: '#334155' }}>Aktualne wartości</h4>
      <p className="item-meta mb-20">Podgląd bieżących odczytów zbiorników paliwa i instalacji LPG.</p>
      <div className="grid-responsive mb-20">
        {fuelTanks.map((fuel, idx) => (
          <div key={fuel.id} className="data-box">
            {(() => {
              const currentAlert = evaluateCardAlert({
                level: toNumberOrNull(fuel.tankLevel),
                maxLevel: toNumberOrNull(fuel.maxLevel),
                pressure: toNumberOrNull(fuel.pressure),
                temperature: toNumberOrNull(fuel.temperature),
                isLpg: false,
                config: monitoringConfig
              });
              return (
                <>
                  <h4 style={{ margin: '0 0 8px 0', color: '#475569' }}>Zbiornik {idx + 1}</h4>
                  <p className="item-meta" style={{ marginBottom: 6 }}><strong>Paliwo:</strong> {fuel.type}</p>
                  <p className={`item-meta ${currentAlert.levelAlert ? 'text-danger' : ''}`}><strong>Poziom:</strong> {fuel.tankLevel} / {fuel.maxLevel} L ({fuel.percentage ?? '--'}%)</p>
                  <p className={`item-meta ${currentAlert.pressureAlert ? 'text-danger' : ''}`}><strong>Ciśnienie nad lustrem:</strong> {fuel.pressure !== null && fuel.pressure !== undefined ? `${Number(fuel.pressure).toFixed(2)} bar` : '--'}</p>
                  <p className={`item-meta ${currentAlert.temperatureAlert ? 'text-danger' : ''}`}><strong>Temperatura:</strong> {fuel.temperature !== null && fuel.temperature !== undefined ? `${Number(fuel.temperature).toFixed(2)} °C` : '--'}</p>
                  <p className="item-meta" style={{ marginTop: 8 }}>
                    <strong>Status:</strong>{' '}
                    <span className={`status-badge ${currentAlert.status === 'OK' ? 'badge-success' : 'badge-danger'}`}>
                      {currentAlert.status}
                    </span>
                  </p>
                </>
              );
            })()}
          </div>
        ))}
        <div className="data-box">
          {(() => {
            const lpgAlert = evaluateCardAlert({
              level: toNumberOrNull(monitoringData?.lpg.level),
              maxLevel: toNumberOrNull(monitoringData?.lpg.maxLevel),
              pressure: toNumberOrNull(monitoringData?.lpg.pressure),
              temperature: toNumberOrNull(monitoringData?.lpg.temp),
              isLpg: true,
              config: monitoringConfig
            });
            return (
              <>
                <h4 style={{ margin: '0 0 8px 0', color: '#475569' }}>LPG</h4>
                <p className={`item-meta ${lpgAlert.levelAlert ? 'text-danger' : ''}`}><strong>Poziom LPG:</strong> {monitoringData?.lpg.level ?? '--'} / {monitoringData?.lpg.maxLevel ?? '--'} L ({monitoringData?.lpg.percentage ?? '--'}%)</p>
                <p className={`item-meta ${lpgAlert.pressureAlert ? 'text-danger' : ''}`}><strong>Ciśnienie LPG:</strong> {monitoringData?.lpg.pressure !== null && monitoringData?.lpg.pressure !== undefined ? `${Number(monitoringData.lpg.pressure).toFixed(2)} bar` : '--'}</p>
                <p className={`item-meta ${lpgAlert.temperatureAlert ? 'text-danger' : ''}`}><strong>Temperatura LPG:</strong> {monitoringData?.lpg.temp !== null && monitoringData?.lpg.temp !== undefined ? `${Number(monitoringData.lpg.temp).toFixed(2)} °C` : '--'}</p>
                <p className="item-meta" style={{ marginTop: 8 }}>
                  <strong>Status:</strong>{' '}
                  <span className={`status-badge ${lpgAlert.status === 'OK' ? 'badge-success' : 'badge-danger'}`}>
                    {lpgAlert.status}
                  </span>
                </p>
              </>
            );
          })()}
        </div>
      </div>

      <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>Przebiegi czasowe (wybrany okres)</h4>
      <div className="grid-responsive">
        {historyColumns.map((column) => (
          <div key={column.key} className="data-box">
            <h4 style={{ margin: '0 0 8px 0', color: '#334155' }}>{column.title}</h4>
            <p className="item-meta" style={{ marginBottom: 10 }}><strong>Paliwo:</strong> {column.fuelLabel}</p>
            {column.entries.length === 0 ? (
              <p className="item-meta">Brak danych w wybranym okresie.</p>
            ) : (
              <div className="list-grid">
                {column.entries.map((entry) => (
                  <div key={`${column.key}-${entry.timestamp}`} className="data-box" style={{ background: 'rgba(255,255,255,0.85)' }}>
                    {(() => {
                      const entryAlert = evaluateCardAlert({
                        level: toNumberOrNull(entry.level),
                        maxLevel: toNumberOrNull(column.maxLevel),
                        pressure: toNumberOrNull(entry.pressure),
                        temperature: toNumberOrNull(entry.temperature),
                        isLpg: column.isLpg,
                        config: monitoringConfig
                      });
                      return (
                        <>
                          <p className="item-meta"><strong>Data/godzina:</strong> {toLabelTime(entry.timestamp)}</p>
                          <p className={`item-meta ${entryAlert.levelAlert ? 'text-danger' : ''}`}><strong>Poziom:</strong> {entry.level !== undefined ? `${entry.level.toFixed(2)} L` : '--'}</p>
                          <p className={`item-meta ${entryAlert.pressureAlert ? 'text-danger' : ''}`}><strong>Ciśnienie:</strong> {entry.pressure !== undefined ? `${entry.pressure.toFixed(2)} bar` : '--'}</p>
                          <p className={`item-meta ${entryAlert.temperatureAlert ? 'text-danger' : ''}`}><strong>Temperatura:</strong> {entry.temperature !== undefined ? `${entry.temperature.toFixed(2)} °C` : '--'}</p>
                          <p className="item-meta" style={{ marginTop: 8 }}>
                            <strong>Status:</strong>{' '}
                            <span className={`status-badge ${entryAlert.status === 'OK' ? 'badge-success' : 'badge-danger'}`}>
                              {entryAlert.status}
                            </span>
                          </p>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};