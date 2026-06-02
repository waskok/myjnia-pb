import { useEffect, useMemo, useState } from 'react';
import type { Fuel, WashService } from '../types';

export function PublicPricing() {
  const [fuels, setFuels] = useState<Fuel[]>([]);
  const [services, setServices] = useState<WashService[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError('');
      try {
        const [fuelsRes, servicesRes] = await Promise.all([
          fetch('http://localhost:5000/api/fuels'),
          fetch('http://localhost:5000/api/services'),
        ]);

        const fuelsJson = await fuelsRes.json();
        const servicesJson = await servicesRes.json();

        if (!fuelsRes.ok) throw new Error(fuelsJson?.error || 'Nie udało się pobrać paliw.');
        if (!servicesRes.ok) throw new Error(servicesJson?.error || 'Nie udało się pobrać usług.');

        if (cancelled) return;
        setFuels(fuelsJson as Fuel[]);
        setServices(servicesJson as WashService[]);
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
                      <span className="price-unit">/L</span>
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

