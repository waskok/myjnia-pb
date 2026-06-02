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

export function PublicPricing() {
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

  return (
    <div className="panel-content">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cennik</h3>

        {error && <div className="alert-box alert-danger mb-15">{error}</div>}

        <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <section>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Paliwa</h4>
            <div className="list-grid">
              {sortedFuels.map((f) => (
                <article key={f.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{f.type}</p>
                  </div>
                  <div className="summary-values">
                    <strong className="price-inline">
                      <span className="price-amount">{Number(f.pricePerLiter).toFixed(2)} zł</span>
                      {loyalty && (
                        <>
                          <span className="price-unit"> lub </span>
                          <span className="points-alt-text">
                            {getFuelPointsRate(f.type, loyalty)} punktów lojalnościowych
                          </span>
                        </>
                      )}
                      <span className="price-unit"> /L</span>
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h4 style={{ margin: '0 0 10px', color: '#334155' }}>Myjnia</h4>
            <div className="list-grid">
              {sortedServices.map((service) => (
                <article key={service.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{service.type}</p>
                  </div>
                  <div className="summary-values">
                    <strong className="price-inline">
                      <span className="price-amount">{Number(service.price).toFixed(2)} zł</span>
                      {service.type.toLowerCase().includes('standard') && (
                        <>
                          <span className="price-unit"> lub </span>
                          <span className="points-alt-text">{loyalty?.pointsPerStandardWash ?? 300} punktów lojalnościowych</span>
                        </>
                      )}
                      {service.type.toLowerCase().includes('wosk') && (
                        <>
                          <span className="price-unit"> lub </span>
                          <span className="points-alt-text">{loyalty?.pointsPerWaxWash ?? 400} punktów lojalnościowych</span>
                        </>
                      )}
                    </strong>
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

