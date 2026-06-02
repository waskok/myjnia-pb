import { useEffect, useMemo, useState } from 'react';
import type { Fuel, WashService } from '../types';

type PublicLoyaltyProgram = {
  pointsPerE95: number;
  pointsPerE98: number;
  pointsPerDiesel: number;
  pointsPerLpg: number;
  pointsPerStandardWash: number;
  pointsPerWaxWash: number;
};

function getFuelPointsRate(fuelType: string, loyalty: PublicLoyaltyProgram): number {
  const type = fuelType.toUpperCase();
  if (type.includes('LPG')) return loyalty.pointsPerLpg;
  if (type.includes('98')) return loyalty.pointsPerE98;
  if (type.includes('DIESEL') || type.includes('ON')) return loyalty.pointsPerDiesel;
  return loyalty.pointsPerE95;
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
          fetch('http://localhost:5000/api/fuels'),
          fetch('http://localhost:5000/api/services'),
          fetch('http://localhost:5000/api/loyalty-program'),
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
            - Tu sprawdzisz ile punktów zdobywasz oraz ile punktów potrzeba na wybrane produkty/usługi.
          </span>
        </h3>

        {error && <div className="alert-box alert-danger mb-15">{error}</div>}

        <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <section>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Zdobywanie punktów</h4>

            <div className="grid-responsive mb-20">
              {fuelRates.map((f) => (
                <div key={f.id} className="data-box">
                  <p className="item-title">{f.type}</p>
                  <p className="item-meta">{loyalty ? `${f.rate} pkt/L` : '—'}</p>
                </div>
              ))}
              {fuelRates.length === 0 && (
                <div className="data-box">
                  <p className="item-title">Paliwa</p>
                  <p className="item-meta">{loyalty ? 'Brak paliw do wyświetlenia.' : '—'}</p>
                </div>
              )}
            </div>

            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Punkty za usługi myjni</h4>
            <div className="list-grid">
              {sortedServices.map((service) => (
                <article key={service.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{service.type}</p>
                    <p className="item-meta">Zdobywasz: +{service.loyaltyPoints} pkt</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Wydawanie punktów</h4>

            <div className="grid-responsive mb-20">
              <div className="data-box">
                <p className="item-title">Paliwo (płatność punktami)</p>
                <p className="item-meta">Koszt = litry × stawka pkt/L (wg typu paliwa)</p>
              </div>
              <div className="data-box">
                <p className="item-title">Mycie standard</p>
                <p className="item-meta">{loyalty ? `${loyalty.pointsPerStandardWash} pkt` : '—'}</p>
              </div>
              <div className="data-box">
                <p className="item-title">Mycie z woskiem</p>
                <p className="item-meta">{loyalty ? `${loyalty.pointsPerWaxWash} pkt` : '—'}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

