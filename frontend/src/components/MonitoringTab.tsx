import React from 'react';
import type { MonitoringData } from '../types';

interface Props {
  monitoringData: MonitoringData | null;
  fetchMonitoring: () => void;
}

export const MonitoringTab: React.FC<Props> = ({ monitoringData, fetchMonitoring }) => (
  <div className="card mt-20">
    <div className="flex-space-between mb-20" style={{ alignItems: 'center' }}>
      <h3 style={{ margin: 0 }}>Centrum monitoringu PB</h3>
      <button onClick={fetchMonitoring} className="btn btn-dark">🔄 Odśwież odczyty</button>
    </div>

    {monitoringData?.alerts && monitoringData.alerts.length > 0 && (
      <div style={{ marginBottom: '25px' }}>
        {monitoringData.alerts.map((al, idx) => (
          <div key={idx} className="alert-box">⚠️ {al}</div>
        ))}
      </div>
    )}

    <div className="grid-responsive">
      {monitoringData?.fuels.map(f => (
        <div key={f.id} className="data-box">
          <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>Zbiornik {f.type}</h4>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#0f172a' }}>
            {f.tankLevel} L <span style={{fontSize:'14px', fontWeight:'normal', color: '#64748b'}}>z {f.maxLevel} L</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${f.percentage}%`, backgroundColor: Number(f.percentage) < 20 ? '#ef4444' : '#10b981' }}></div>
          </div>
        </div>
      ))}
      <div className="monitoring-bottom-grid">
        <div className="data-box">
          <h4 style={{ color: '#d97706', margin: '0 0 15px 0' }}>Kamery Myjni (CCTV)</h4>
          <ul className="list-unstyled">
            {monitoringData?.carWash.map(bay => (
              <li key={bay.bay} style={{ marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <span>Stanowisko {bay.bay}:</span>
                <span style={{ color: bay.occupied ? '#ef4444' : '#10b981', fontWeight: 'bold', marginLeft: '10px' }}>
                  {bay.occupied ? 'Zajęte' : 'Wolne'}
                </span>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '5px' }}>📹 Status: {bay.camera}</div>
              </li>
            ))}
          </ul>
        </div>

        {monitoringData?.lpg && (
          <div className="data-box">
            <h4 style={{ color: '#0284c7', margin: '0 0 15px 0' }}>Instalacja LPG</h4>
            <div style={{ marginBottom: '8px' }}><strong>Ciśnienie:</strong> {monitoringData.lpg.pressure} bar</div>
            <div><strong>Temperatura:</strong> {monitoringData.lpg.temp} °C</div>
          </div>
        )}
      </div>
    </div>
  </div>
);