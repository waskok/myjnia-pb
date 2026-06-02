import React, { useMemo, useState } from 'react';
import type { AppLogic } from '../hooks/useAppLogic';
import { MonitoringTab } from './MonitoringTab';
import { OwnerScheduleTab } from './OwnerScheduleTab';
import type { OwnerReportKind, ReportPeriodType } from '../types';
import { jsPDF } from 'jspdf';

export const OwnerPanel: React.FC<AppLogic> = (props) => {
  const {
    activeTab, reportPeriod, setReportPeriod, reportDateStr,
    handleDateChange, fetchReports, fetchWashReports, fetchMonitoringReports, reportData, washReportData, monitoringReportData, fuels, newPrice, setNewPrice, handleUpdatePrice,
    services, newServicePrice, setNewServicePrice, handleUpdateServicePrice,
    loyaltyConfig, handleLoyaltyConfigChange, handleSaveLoyaltyConfig,
    newDelivery, handleDeliveryChange, handleOrderDelivery, deliveries, handleCompleteDelivery,
    newEmployee, setNewEmployee, handleAddEmployee, employees, handleChangeEmployeeLogin, handleChangeEmployeePassword, handleArchiveEmployee, handleRestoreEmployee, customers,
    fetchMonitoring, monitoringData, scheduleYear, scheduleMonth, scheduleData,
    monitoringConfig, handleMonitoringConfigChange, handleSaveMonitoringConfig,
    selectedScheduleDates, scheduleEmployeeId, setScheduleEmployeeId, scheduleStartTime, setScheduleStartTime,
    scheduleEndTime, setScheduleEndTime,
    changeScheduleMonth, handleScheduleMonthInput, toggleScheduleDate, handleSaveSchedule,
    handleDeleteScheduleEntry, setSelectedScheduleDates,
    getMinDateTime,
  } = props;
  const [employeeListFilter, setEmployeeListFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [reportKind, setReportKind] = useState<OwnerReportKind>('sales');
  const filteredEmployees = useMemo(() => {
    if (employeeListFilter === 'active') return employees.filter((emp) => emp.isActive);
    if (employeeListFilter === 'archived') return employees.filter((emp) => !emp.isActive);
    return employees;
  }, [employees, employeeListFilter]);

  const getPeriodLabel = (period: ReportPeriodType) => {
    if (period === 'all') return 'Cały czas';
    if (period === 'daily') return 'Dzienny';
    if (period === 'weekly') return 'Tygodniowy';
    if (period === 'monthly') return 'Miesięczny';
    return 'Roczny';
  };

  const getPeriodDetails = () => {
    if (reportPeriod === 'all') return 'Zakres: wszystkie dostępne dane';
    if (reportPeriod === 'daily') return `Dzień: ${reportDateStr.substring(0, 10)}`;
    if (reportPeriod === 'weekly') return `Tydzień zawierający: ${reportDateStr.substring(0, 10)}`;
    if (reportPeriod === 'monthly') return `Miesiąc: ${reportDateStr.substring(0, 7)}`;
    return `Rok: ${reportDateStr.substring(0, 4)}`;
  };

  const toPdfText = (value: string) => {
    const polishMap: Record<string, string> = {
      ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
      Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
    };
    return value.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => polishMap[char] ?? char);
  };

  const getTransactionAmountLabel = (totalAmount: number, paymentMethod: string, pointsUsed?: number) => {
    if (paymentMethod === 'Punkty') return `-${pointsUsed ?? 0}`;
    return `${totalAmount.toFixed(2)} zł`;
  };
  const formatMonitoringValue = (value: number | null, unit: string) => {
    if (value === null || Number.isNaN(value)) return '-';
    return `${value.toFixed(2)} ${unit}`;
  };

  const handleExportSalesReportPdf = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Raport sprzedazy - Myjnia PB', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(toPdfText(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`), margin, y);
    y += 6;
    doc.text(toPdfText(`Okres: ${getPeriodLabel(reportPeriod)}`), margin, y);
    y += 6;
    doc.text(toPdfText(getPeriodDetails()), margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Podsumowanie', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Utarg: ${reportData.totalRevenue.toFixed(2)} zl`, margin, y);
    y += 6;
    doc.text(`Liczba transakcji: ${reportData.totalCount}`, margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Transakcje', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    reportData.transactions.forEach((t, index) => {
      const customerName = t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : 'Niezarejestrowany';
      const employeeName = `${t.employee.firstName} ${t.employee.lastName}`;
      const amountLabel = t.paymentMethod === 'Punkty' ? `-${t.pointsUsed ?? 0}` : `${t.totalAmount.toFixed(2)} zl`;
      const line = `${index + 1}. ${new Date(t.date).toLocaleString('pl-PL')} | ${amountLabel} | ${t.paymentMethod} | Klient: ${customerName} | Kasjer: ${employeeName}`;
      const wrapped = doc.splitTextToSize(toPdfText(line), maxLineWidth);
      const nextY = y + wrapped.length * 5;
      if (nextY > 285) {
        doc.addPage();
        y = 20;
      }
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 1;
    });

    const safeDatePart = reportDateStr.substring(0, 10).replace(/[^0-9-]/g, '-');
    const fileName = `raport-sprzedaz-${reportPeriod}-${safeDatePart || 'all'}.pdf`;
    doc.save(fileName);
  };

  const handleExportWashReportPdf = () => {
    if (!washReportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Raport myjni - Myjnia PB', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(toPdfText(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`), margin, y);
    y += 6;
    doc.text(toPdfText(`Okres: ${getPeriodLabel(reportPeriod)}`), margin, y);
    y += 6;
    doc.text(toPdfText(getPeriodDetails()), margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Podsumowanie', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Przychod: ${washReportData.totalRevenue.toFixed(2)} zl`, margin, y);
    y += 6;
    doc.text(`Liczba myc: ${washReportData.totalCount}`, margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Zrealizowane mycia', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    washReportData.washes.forEach((entry, index) => {
      const customerName = entry.customer ? `${entry.customer.firstName} ${entry.customer.lastName}` : 'Niezarejestrowany';
      const line = `${index + 1}. ${new Date(entry.date).toLocaleString('pl-PL')} | ${entry.serviceType} | ${entry.servicePrice.toFixed(2)} zl | Klient: ${customerName}`;
      const wrapped = doc.splitTextToSize(toPdfText(line), maxLineWidth);
      const nextY = y + wrapped.length * 5;
      if (nextY > 285) {
        doc.addPage();
        y = 20;
      }
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 1;
    });

    const safeDatePart = reportDateStr.substring(0, 10).replace(/[^0-9-]/g, '-');
    const fileName = `raport-myjnia-${reportPeriod}-${safeDatePart || 'all'}.pdf`;
    doc.save(fileName);
  };

  const handleExportMonitoringReportPdf = () => {
    if (!monitoringReportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Raport monitoringu - Myjnia PB', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(toPdfText(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`), margin, y);
    y += 6;
    doc.text(toPdfText(`Okres: ${getPeriodLabel(reportPeriod)}`), margin, y);
    y += 6;
    doc.text(toPdfText(getPeriodDetails()), margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Podsumowanie', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Liczba odczytow: ${monitoringReportData.totalReadings}`, margin, y);
    y += 6;
    doc.text(`Liczba alertow: ${monitoringReportData.alertEvents}`, margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Historia odczytow', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const groupedByTimestamp = monitoringReportData.readings.reduce<Record<string, typeof monitoringReportData.readings>>(
      (acc, entry) => {
        const date = new Date(entry.createdAt);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(entry);
        return acc;
      },
      {}
    );

    const groupEntries = Object.entries(groupedByTimestamp).sort(
      (a, b) =>
        new Date(b[1][0]?.createdAt ?? '').getTime() - new Date(a[1][0]?.createdAt ?? '').getTime()
    );

    groupEntries.forEach(([_, entries], groupIndex) => {
      const groupDate = entries[0]?.createdAt;
      const headerLine = `${groupIndex + 1}. Data i godzina: ${new Date(groupDate).toLocaleString('pl-PL')}`;
      const wrappedHeader = doc.splitTextToSize(toPdfText(headerLine), maxLineWidth);
      const nextHeaderY = y + wrappedHeader.length * 5;
      if (nextHeaderY > 285) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(wrappedHeader, margin, y);
      y += wrappedHeader.length * 5 + 1;

      doc.setFont('helvetica', 'normal');
      entries
        .slice()
        .sort((a, b) => a.tankLabel.localeCompare(b.tankLabel, 'pl'))
        .forEach((entry) => {
          const levelLabel = entry.level !== null ? `${entry.level.toFixed(2)} L` : '-';
          const pressureLabel = entry.pressure !== null ? `${entry.pressure.toFixed(2)} bar` : '-';
          const temperatureLabel = entry.temperature !== null ? `${entry.temperature.toFixed(2)} C` : '-';
          const line = `- ${entry.tankLabel} | Poziom: ${levelLabel} | Cisnienie: ${pressureLabel} | Temperatura: ${temperatureLabel} | ${entry.alertStatus}`;
          const wrapped = doc.splitTextToSize(toPdfText(line), maxLineWidth);
          const nextY = y + wrapped.length * 5;
          if (nextY > 285) {
            doc.addPage();
            y = 20;
          }
          doc.text(wrapped, margin + 4, y);
          y += wrapped.length * 5 + 1;
        });

      y += 2;
    });

    const safeDatePart = reportDateStr.substring(0, 10).replace(/[^0-9-]/g, '-');
    const fileName = `raport-monitoring-${reportPeriod}-${safeDatePart || 'all'}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="panel-content">

      {activeTab === 'raporty' && (
        <div className="card">
          <div className="flex-space-between mb-20" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>
              {reportKind === 'sales' && 'Raport sprzedaży'}
              {reportKind === 'wash' && 'Raport myjni'}
              {reportKind === 'monitoring' && 'Raport monitoringu'}
            </h3>
            <div className="form-inline">
              <label className="form-label">Typ:</label>
              <select
                className="select-field"
                value={reportKind}
                onChange={e => {
                  const selectedKind = e.target.value as OwnerReportKind;
                  setReportKind(selectedKind);
                  if (selectedKind === 'sales') fetchReports(reportPeriod, reportDateStr);
                  if (selectedKind === 'wash') fetchWashReports(reportPeriod, reportDateStr);
                  if (selectedKind === 'monitoring') fetchMonitoringReports(reportPeriod, reportDateStr);
                }}
              >
                <option value="sales">Sprzedaż</option>
                <option value="wash">Myjnia</option>
                <option value="monitoring">Monitoring</option>
              </select>
              <label className="form-label">Okres:</label>
              <select
                className="select-field"
                value={reportPeriod}
                onChange={e => {
                  const p = e.target.value as ReportPeriodType;
                  setReportPeriod(p);
                  if (reportKind === 'sales') fetchReports(p, reportDateStr);
                  if (reportKind === 'wash') fetchWashReports(p, reportDateStr);
                  if (reportKind === 'monitoring') fetchMonitoringReports(p, reportDateStr);
                }}
              >
                <option value="all">Cały czas</option><option value="daily">Dzienny</option><option value="weekly">Tygodniowy</option><option value="monthly">Miesięczny</option><option value="yearly">Roczny</option>
              </select>
              {reportPeriod === 'daily' && <input type="date" className="input-field" value={reportDateStr.substring(0, 10)} onChange={e => handleDateChange(e.target.value, reportKind)} />}
              {reportPeriod === 'weekly' && <input type="date" className="input-field" value={reportDateStr.substring(0, 10)} onChange={e => handleDateChange(e.target.value, reportKind)} />}
              {reportPeriod === 'monthly' && <input type="month" className="input-field" value={reportDateStr.substring(0, 7)} onChange={e => handleDateChange(e.target.value, reportKind)} />}
              {reportPeriod === 'yearly' && <input type="number" min="2020" max="2100" className="input-field" value={reportDateStr.substring(0, 4)} onChange={e => handleDateChange(e.target.value, reportKind)} />}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (reportKind === 'sales') handleExportSalesReportPdf();
                  if (reportKind === 'wash') handleExportWashReportPdf();
                  if (reportKind === 'monitoring') handleExportMonitoringReportPdf();
                }}
                disabled={
                  (reportKind === 'sales' && !reportData) ||
                  (reportKind === 'wash' && !washReportData) ||
                  (reportKind === 'monitoring' && !monitoringReportData)
                }
              >
                Pobierz PDF
              </button>
            </div>
          </div>
          
          <div className="grid-responsive mb-20">
            <div className="data-box text-center">
              <h4 style={{ margin: 0, color: '#64748b' }}>
                {reportKind === 'sales' && `Utarg (${reportPeriod === 'all' ? 'Ogółem' : 'Wybrany Okres'})`}
                {reportKind === 'wash' && `Przychód myjni (${reportPeriod === 'all' ? 'Ogółem' : 'Wybrany Okres'})`}
                {reportKind === 'monitoring' && 'Liczba odczytów'}
              </h4>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#10b981' }}>
                {reportKind === 'sales' && `${reportData?.totalRevenue.toFixed(2) ?? '0.00'} zł`}
                {reportKind === 'wash' && `${washReportData?.totalRevenue.toFixed(2) ?? '0.00'} zł`}
                {reportKind === 'monitoring' && `${monitoringReportData?.totalReadings ?? 0}`}
              </div>
            </div>
            <div className="data-box text-center">
              <h4 style={{ margin: 0, color: '#64748b' }}>
                {reportKind === 'sales' && 'Liczba transakcji'}
                {reportKind === 'wash' && 'Liczba zrealizowanych myć'}
                {reportKind === 'monitoring' && 'Liczba alertów'}
              </h4>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#0f172a' }}>
                {reportKind === 'sales' && `${reportData?.totalCount ?? 0}`}
                {reportKind === 'wash' && `${washReportData?.totalCount ?? 0}`}
                {reportKind === 'monitoring' && `${monitoringReportData?.alertEvents ?? 0}`}
              </div>
            </div>
          </div>

          {reportKind === 'sales' && (
            <>
              <h3 className="mt-20">Historia transakcji {reportPeriod === 'all' && '(15 najnowszych)'}</h3>
              <div className="list-grid">
                {reportData?.transactions.map(t => (
                  <article key={t.id} className="list-item card-like">
                    <div>
                      <p className="item-title">{new Date(t.date).toLocaleString()}</p>
                      <p className="item-meta">Klient: {t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : 'Niezarejestrowany'}</p>
                      <p className="item-meta">Kasjer: {t.employee.firstName}</p>
                    </div>
                    <div className="summary-values">
                      <strong>{getTransactionAmountLabel(t.totalAmount, t.paymentMethod, t.pointsUsed)}</strong>
                      <span>{t.paymentMethod}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {reportKind === 'wash' && (
            <>
              <h3 className="mt-20">Historia zrealizowanych myć</h3>
              <div className="list-grid">
                {washReportData?.washes.map(entry => (
                  <article key={entry.id} className="list-item card-like">
                    <div>
                      <p className="item-title">{new Date(entry.date).toLocaleString()}</p>
                      <p className="item-meta">Usługa: {entry.serviceType}</p>
                      <p className="item-meta">Klient: {entry.customer ? `${entry.customer.firstName} ${entry.customer.lastName}` : 'Niezarejestrowany'}</p>
                    </div>
                    <div className="summary-values">
                      <strong>{entry.servicePrice.toFixed(2)} zł</strong>
                      <span>{entry.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {reportKind === 'monitoring' && (
            <>
              <h3 className="mt-20">Historia monitoringu (zbiorniki i alerty)</h3>
              <div className="list-grid">
                {monitoringReportData?.readings.map(entry => (
                  <article key={entry.id} className="list-item card-like">
                    <div>
                      <p className="item-title">{entry.tankLabel}</p>
                      <p className="item-meta">Data i godzina: {new Date(entry.createdAt).toLocaleString()}</p>
                      <p className="item-meta">Poziom: {formatMonitoringValue(entry.level, 'L')}</p>
                      <p className="item-meta">Ciśnienie: {formatMonitoringValue(entry.pressure, 'bar')}</p>
                      <p className="item-meta">Temperatura: {formatMonitoringValue(entry.temperature, 'C')}</p>
                    </div>
                    <div className="summary-values">
                      <strong>{entry.alertStatus}</strong>
                      <span>{entry.tank}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'cennik' && (
        <>
          <div className="card">
            <h3>Zarządzanie cenami</h3>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Ceny paliw</h4>
            <div className="list-grid">
              {fuels.map(f => (
                <article key={f.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{f.type}</p>
                    <p className="item-meta">Stan: <span className={f.tankLevel < 1000 ? 'text-danger' : ''}>{f.tankLevel} / {f.maxLevel} L</span></p>
                    <p className="item-meta">Aktualna cena: {f.pricePerLiter} zł/L</p>
                  </div>
                  <div className="row-actions">
                    <input type="number" step="0.01" className="input-field" value={newPrice[f.id] || ''} onChange={(e) => setNewPrice({ ...newPrice, [f.id]: parseFloat(e.target.value) })} />
                    <button onClick={() => handleUpdatePrice(f.id)} className="btn btn-success">Zmień</button>
                  </div>
                </article>
              ))}
            </div>

            <h4 style={{ margin: '16px 0 10px', color: '#334155' }}>Ceny usług myjni</h4>
            <div className="list-grid">
              {services.map(service => (
                <article key={service.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{service.type}</p>
                    <p className="item-meta">Aktualna cena: {service.price.toFixed(2)} zł</p>
                  </div>
                  <div className="row-actions">
                    <input type="number" step="0.01" className="input-field" value={newServicePrice[service.id] || ''} onChange={(e) => setNewServicePrice({ ...newServicePrice, [service.id]: parseFloat(e.target.value) })} />
                    <button onClick={() => handleUpdateServicePrice(service.id)} className="btn btn-success">Zmień</button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Stawki punktów</h3>
            <div className="grid-responsive mb-20">
              <div><label>E95 (punktów / L)</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerE95} onChange={(e) => handleLoyaltyConfigChange('pointsPerE95', Number(e.target.value))} /></div>
              <div><label>E98 (punktów / L)</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerE98} onChange={(e) => handleLoyaltyConfigChange('pointsPerE98', Number(e.target.value))} /></div>
              <div><label>Olej napędowy ON (punktów / L)</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerDiesel} onChange={(e) => handleLoyaltyConfigChange('pointsPerDiesel', Number(e.target.value))} /></div>
              <div><label>LPG (punktów / L)</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerLpg} onChange={(e) => handleLoyaltyConfigChange('pointsPerLpg', Number(e.target.value))} /></div>
            </div>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Koszt usług myjni (pkt)</h4>
            <div className="grid-responsive mb-20">
              <div><label>Koszt: mycie standardowe</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerStandardWash} onChange={(e) => handleLoyaltyConfigChange('pointsPerStandardWash', Number(e.target.value))} /></div>
              <div><label>Koszt: mycie z woskowaniem</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerWaxWash} onChange={(e) => handleLoyaltyConfigChange('pointsPerWaxWash', Number(e.target.value))} /></div>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSaveLoyaltyConfig}>Zapisz stawki punktów</button>
          </div>

          <div className="card">
            <h3>Zdobywanie punktów lojalnościowych</h3>
            <div className="grid-responsive mb-20">
              <div><label>Za 1 litr E95</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerE95} onChange={(e) => handleLoyaltyConfigChange('pointsPerE95', Number(e.target.value))} /></div>
              <div><label>Za 1 litr E98</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerE98} onChange={(e) => handleLoyaltyConfigChange('pointsPerE98', Number(e.target.value))} /></div>
              <div><label>Za 1 litr oleju napędowego ON</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerDiesel} onChange={(e) => handleLoyaltyConfigChange('pointsPerDiesel', Number(e.target.value))} /></div>
              <div><label>Za 1 litr LPG</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerLpg} onChange={(e) => handleLoyaltyConfigChange('pointsPerLpg', Number(e.target.value))} /></div>
            </div>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Za usługi myjni</h4>
            <div className="grid-responsive mb-20">
              <div><label>Za mycie standardowe</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerStandardWash} onChange={(e) => handleLoyaltyConfigChange('pointsPerStandardWash', Number(e.target.value))} /></div>
              <div><label>Za mycie z woskowaniem</label><input type="number" min="0" step="1" className="input-field" value={loyaltyConfig.pointsPerWaxWash} onChange={(e) => handleLoyaltyConfigChange('pointsPerWaxWash', Number(e.target.value))} /></div>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSaveLoyaltyConfig}>Zapisz stawki zyskiwania punktów</button>
          </div>
        </>
      )}

      {activeTab === 'pracownicy' && (
        <>
          <div className="card">
            <h3>Dodaj Pracownika</h3>
            <form onSubmit={handleAddEmployee} className="flex-row" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label>Imię</label><input className="input-field w-full" required value={newEmployee.firstName} onChange={e => setNewEmployee({...newEmployee, firstName: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label>Nazwisko</label><input className="input-field w-full" required value={newEmployee.lastName} onChange={e => setNewEmployee({...newEmployee, lastName: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label>Login</label><input className="input-field w-full" required value={newEmployee.login} onChange={e => setNewEmployee({...newEmployee, login: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label>Hasło</label><input type="password" className="input-field w-full" required value={newEmployee.password} onChange={e => setNewEmployee({...newEmployee, password: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label>Rola</label><select className="select-field w-full" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}><option>Kasjer</option><option>Monitoring</option><option>Obsługa Myjni</option><option>Obsługa dystrybutora LPG</option></select></div>
              <button type="submit" className="btn btn-success">Dodaj</button>
            </form>
          </div>
          
          <div className="card">
            <div className="flex-space-between mb-15" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Lista Pracowników</h3>
              <div className="row-actions">
                <button type="button" className={`tab-btn-large ${employeeListFilter === 'active' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => setEmployeeListFilter('active')}>Aktywni</button>
                <button type="button" className={`tab-btn-large ${employeeListFilter === 'archived' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => setEmployeeListFilter('archived')}>Archiwalni</button>
                <button type="button" className={`tab-btn-large ${employeeListFilter === 'all' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => setEmployeeListFilter('all')}>Wszyscy</button>
              </div>
            </div>
            <div className="list-grid">
              {filteredEmployees.map(emp => (
                <article key={emp.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{emp.firstName} {emp.lastName}</p>
                    <p className="item-meta">Rola: {emp.role}</p>
                    <p className="item-meta">Login: {emp.login}</p>
                    <p className="item-meta">Status: {emp.isActive ? 'Aktywny' : 'Archiwalny'}</p>
                  </div>
                  <div className="row-actions">
                    {emp.isActive && (
                      <>
                        <button onClick={() => handleChangeEmployeeLogin(emp.id, emp.login)} className="btn btn-light">Zmień login</button>
                        <button onClick={() => handleChangeEmployeePassword(emp.id)} className="btn btn-warning">Zmień hasło</button>
                        <button onClick={() => handleArchiveEmployee(emp.id)} className="btn btn-dark">Archiwizuj</button>
                      </>
                    )}
                    {!emp.isActive && (
                      <button onClick={() => handleRestoreEmployee(emp.id)} className="btn btn-success">Przywróć</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

        </>
      )}

      {activeTab === 'dostawy' && (
        <>
          <div className="card">
            <h3>Zarządzanie dostawami</h3>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Aktualny stan paliw</h4>
            <div className="grid-responsive mb-20">
              {fuels.map((fuel) => {
                const fillPercent = fuel.maxLevel > 0 ? (fuel.tankLevel / fuel.maxLevel) * 100 : 0;
                const fillPercentLabel = fillPercent.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                const isLow = fillPercent < 25;
                return (
                  <div key={fuel.id} className="data-box">
                    <p className="item-title">{fuel.type}</p>
                    <p className="item-meta">
                      Stan: <span className={isLow ? 'text-danger' : ''}>{fuel.tankLevel} / {fuel.maxLevel} L</span>
                    </p>
                    <p className="item-meta">Zapełnienie: {fillPercentLabel}%</p>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleOrderDelivery} className="flex-row mb-20" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label>Paliwo</label><select name="fuelId" className="select-field w-full" value={newDelivery.fuelId} onChange={handleDeliveryChange} required><option value="" disabled>Paliwo</option>{fuels.map(f => <option key={f.id} value={f.id}>{f.type}</option>)}</select></div>
              <div style={{ flex: 1 }}><label>Ilość (L)</label><input type="number" name="quantity" className="input-field w-full" value={newDelivery.quantity} onChange={handleDeliveryChange} required /></div>
              <div style={{ flex: 1 }}>
                <label>Dostawca</label>
                <select name="supplier" className="select-field w-full" value={newDelivery.supplier} onChange={handleDeliveryChange} required>
                  <option value="" disabled>Wybierz dostawcę</option>
                  <option value="ORLEN S.A.">ORLEN S.A.</option>
                  <option value="Aramco Fuels Poland">Aramco Fuels Poland</option>
                  <option value="Unimot">Unimot</option>
                  <option value="Transoil">Transoil</option>
                  <option value="Poloil">Poloil</option>
                </select>
              </div>
              <div style={{ flex: 1 }}><label>Data</label><input type="datetime-local" name="deliveryDate" min={getMinDateTime()} className="input-field w-full" value={newDelivery.deliveryDate} onChange={handleDeliveryChange} required /></div>
              <button type="submit" className="btn btn-warning">Zleć dostawę</button>
            </form>
            
            <ul className="list-unstyled list-grid">
              {deliveries.map(d => (
                <li key={d.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{d.fuel.type} - {d.quantity} L</p>
                    <p className="item-meta">Dostawca: {d.supplier}</p>
                    <p className="item-meta">Planowana: {new Date(d.deliveryDate).toLocaleString()}</p>
                    <span className={`status-badge ${d.status === 'Dostarczona' ? 'badge-success' : 'badge-warning'}`}>{d.status}</span>
                  </div>
                  {d.status !== 'Dostarczona' && <button onClick={() => handleCompleteDelivery(d.id)} className="btn btn-primary">Odbierz dostawę</button>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {activeTab === 'klienci' && (
        <div className="card">
          <h3>Baza Zarejestrowanych Klientów</h3>
          <div className="list-grid">
            {customers.map(c => (
              <article key={c.id} className="list-item card-like">
                <div>
                  <p className="item-title">{c.lastName && c.lastName !== '—' ? `${c.firstName} ${c.lastName}` : c.firstName}</p>
                  <p className="item-meta">{c.email}</p>
                  <p className="item-meta">{c.phone}</p>
                </div>
                <span className="status-badge badge-success">{c.loyaltyPoints} pkt</span>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'grafik' && (
        <OwnerScheduleTab
          scheduleYear={scheduleYear}
          scheduleMonth={scheduleMonth}
          scheduleData={scheduleData}
          selectedScheduleDates={selectedScheduleDates}
          scheduleEmployeeId={scheduleEmployeeId}
          setScheduleEmployeeId={setScheduleEmployeeId}
          scheduleStartTime={scheduleStartTime}
          setScheduleStartTime={setScheduleStartTime}
          scheduleEndTime={scheduleEndTime}
          setScheduleEndTime={setScheduleEndTime}
          employees={employees}
          changeScheduleMonth={changeScheduleMonth}
          handleScheduleMonthInput={handleScheduleMonthInput}
          toggleScheduleDate={toggleScheduleDate}
          handleSaveSchedule={handleSaveSchedule}
          handleDeleteScheduleEntry={handleDeleteScheduleEntry}
          setSelectedScheduleDates={setSelectedScheduleDates}
        />
      )}

      {activeTab === 'monitoring' && (
        <MonitoringTab
          monitoringData={monitoringData}
          fetchMonitoring={fetchMonitoring}
          monitoringConfig={monitoringConfig}
          canManageConfig
          onMonitoringConfigChange={handleMonitoringConfigChange}
          onSaveMonitoringConfig={handleSaveMonitoringConfig}
        />
      )}
    </div>
  );
};