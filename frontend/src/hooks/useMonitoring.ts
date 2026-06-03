import { useState } from 'react';
import { api } from '../utils/apiClient';
import type { MonitoringData, MonitoringConfig } from '../types';

export const useMonitoring = (setMessage: (msg: string) => void) => {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [monitoringConfig, setMonitoringConfig] = useState<MonitoringConfig>({
    samplingIntervalSec: 300,
    fuelLowLevelPercent: 20,
    fuelMaxPressureBar: 2.5,
    fuelMaxTempC: 35,
    lpgLowLevelPercent: 20,
    lpgMaxPressureBar: 14,
    lpgMaxTempC: 30,
  });

  const fetchMonitoring = async (period: '1h' | '24h' | '7d' | '30d' = '24h') => {
    const res = await api.get(`/api/monitoring?period=${period}`);
    if (!res.ok) return;
    const data = (await res.json()) as MonitoringData;
    setMonitoringData(data);
    if (data.config) setMonitoringConfig(data.config);
  };

  const handleMonitoringConfigChange = (key: keyof MonitoringConfig, value: number) => {
    setMonitoringConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveMonitoringConfig = async () => {
    const payload = {
      samplingIntervalSec: Math.max(15, Math.floor(monitoringConfig.samplingIntervalSec || 0)),
      fuelLowLevelPercent: Math.max(0, Number(monitoringConfig.fuelLowLevelPercent || 0)),
      fuelMaxPressureBar: Math.max(0, Number(monitoringConfig.fuelMaxPressureBar || 0)),
      fuelMaxTempC: Math.max(-50, Number(monitoringConfig.fuelMaxTempC || 0)),
      lpgLowLevelPercent: Math.max(0, Number(monitoringConfig.lpgLowLevelPercent || 0)),
      lpgMaxPressureBar: Math.max(0, Number(monitoringConfig.lpgMaxPressureBar || 0)),
      lpgMaxTempC: Math.max(-50, Number(monitoringConfig.lpgMaxTempC || 0)),
    };
    const res = await api.patch('/api/monitoring/config', payload);
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setMessage('✅ ' + (data.message ?? 'Zaktualizowano konfigurację monitoringu.'));
      await fetchMonitoring();
    } else {
      setMessage('❌ ' + (data.error ?? 'Nie udało się zaktualizować konfiguracji monitoringu.'));
    }
  };

  return {
    monitoringData,
    monitoringConfig,
    fetchMonitoring,
    handleMonitoringConfigChange,
    handleSaveMonitoringConfig,
  };
};
