import { useEffect, useMemo, useState } from 'react';
import type { Fuel, WashService } from '../types';
import { api } from '../utils/apiClient';

type PublicLoyaltyProgram = {
  pointsPerE95: number;
  pointsPerE98: number;
  pointsPerDiesel: number;
  pointsPerLpg: number;
  pointsPerStandardWash: number;
  pointsPerWaxWash: number;
  earnPointsPerE95: number;
  earnPointsPerE98: number;
  earnPointsPerDiesel: number;
  earnPointsPerLpg: number;
  earnPointsPerStandardWash: number;
  earnPointsPerWaxWash: number;
};

function getFuelPointsRate(fuelType: string, loyalty: PublicLoyaltyProgram): number {
  const type = fuelType.toUpperCase();
  if (type.includes('LPG')) return loyalty.earnPointsPerLpg;
  if (type.includes('98')) return loyalty.earnPointsPerE98;
  if (type.includes('DIESEL') || type.includes('ON')) return loyalty.earnPointsPerDiesel;
  return loyalty.earnPointsPerE95;
}

export function PublicLoyaltyProgramPage() {
  const [fuels, setFuels] = useState<Fuel[]>([]);
  const [services, setServices] = useState<WashService[]>([]);
  const [loyalty, setLoyalty] = useState<PublicLoyaltyProgram | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError('');
      try {
        const [fuelsRes, servicesRes, loyaltyRes] = await Promise.all([
          api.get('/api/fuels'),
          api.get('/api/services'),
          api.get('/api/loyalty-program'),
        ]);

        const fuelsJson = await fuelsRes.json();
        const servicesJson = await servicesRes.json();
        const loyaltyJson = await loyaltyRes.json();

        if (!fuelsRes.ok) throw new Error(fuelsJson?.error || 'Nie udało się pobrać paliw.');
        if (!servicesRes.ok) throw new Error(servicesJson?.error || 'Nie udało się pobrać usług.');
        if (!loyaltyRes.ok) throw new Error(loyaltyJson?.error || 'Nie udało się pobrać programu lojalnościowego.');

        if (cancelled) return;
        setFuels(fuelsJson as Fuel[]);
        setServices(servicesJson as WashService[]);
        setLoyalty(loyaltyJson as PublicLoyaltyProgram);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Błąd połączenia z serwerem.';
        setError(`❌ ${message}`);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedFuels = useMemo(() => {
    const copy = [...fuels];
    copy.sort((a, b) => a.id - b.id);
    return copy;
  }, [fuels]);

  const sortedServices = useMemo(() => {
    const copy = [...services];
    copy.sort((a, b) => a.type.localeCompare(b.type, 'pl-PL'));
    return copy;
  }, [services]);

  const fuelRates = useMemo(() => {
    if (!loyalty) return [];
    return sortedFuels.map((f) => ({
      id: f.id,
      type: f.type,
      rate: getFuelPointsRate(f.type, loyalty),
    }));
  }, [sortedFuels, loyalty]);

  return (
    <div className="panel-content">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          Program lojalnościowy{' '}
          <span className="text-muted" style={{ fontWeight: 600 }}>
            - Sprawdź, ile punktów lojalnościowych zdobywasz za zakupy paliw i usług myjni.
          </span>
        </h3>

        {error && <div className="alert-box alert-danger mb-15">{error}</div>}

        <div className="list-grid">
          <section>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Paliwa - zdobywanie punktów</h4>
            <div className="grid-responsive mb-20">
              {fuelRates.map((f) => (
                <div key={f.id} className="data-box">
                  <p className="item-title">{f.type}</p>
                  <p className="points-earned-text">+{f.rate} punktów lojalnościowych / litr</p>
                </div>
              ))}
              {fuelRates.length === 0 && (
                <div className="data-box">
                  <p className="item-title">Paliwa</p>
                  <p className="item-meta">Brak paliw do wyświetlenia.</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Usługi myjni - zdobywanie punktów</h4>
            <div className="list-grid">
              {sortedServices.map((service) => (
                <article key={service.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{service.type}</p>
                    <p className="points-earned-text">+{service.loyaltyPoints} punktów lojalnościowych</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

