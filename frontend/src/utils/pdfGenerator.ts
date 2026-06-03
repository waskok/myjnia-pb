import { jsPDF } from 'jspdf';

export type GeneratedInvoice = {
  number: string;
  issueDate: string;
  amount: number;
  paymentMethod: string;
  quantity: number;
  fuelType: string;
  unitPrice: number;
  buyer: {
    name: string;
    address: string;
    email: string;
    phone: string;
    type: 'individual' | 'company';
    identifiers: {
      pesel?: string;
      nip?: string;
      regon?: string;
    };
  };
};

const POLISH_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
};

export function toPdfText(value: string): string {
  return value.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => POLISH_MAP[char] ?? char);
}

function formatMoney(value: number): string {
  return `${value.toFixed(2)} PLN`;
}

export function downloadInvoicePdf(invoice: GeneratedInvoice): void {
  const VAT_RATE = 0.23;
  const grossValue = invoice.amount;
  const netValue = grossValue / (1 + VAT_RATE);
  const vatValue = grossValue - netValue;
  const unitNet = invoice.unitPrice / (1 + VAT_RATE);
  const unitVat = invoice.unitPrice - unitNet;
  const vatPercent = 23;

  const buyerIdentifiers: string[] = [];
  if (invoice.buyer.identifiers.pesel) buyerIdentifiers.push(`PESEL: ${invoice.buyer.identifiers.pesel}`);
  if (invoice.buyer.identifiers.nip) buyerIdentifiers.push(`NIP: ${invoice.buyer.identifiers.nip}`);
  if (invoice.buyer.identifiers.regon) buyerIdentifiers.push(`REGON: ${invoice.buyer.identifiers.regon}`);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 12;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FAKTURA VAT', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(toPdfText(`Numer: ${invoice.number}`), margin, y);
  y += 5;
  doc.text(
    toPdfText(`Data wystawienia: ${new Date(invoice.issueDate).toLocaleString('pl-PL')}`),
    margin,
    y,
  );
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText('Sprzedawca:'), margin, y);
  doc.text(toPdfText('Nabywca:'), 110, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  const sellerLines = [
    'Myjnia PB',
    toPdfText('ul. Jana Pawla II 37, 31-864 Krakow'),
    'Telefon/fax: (070) 012-34-56, (070)-011-22-33',
    'NIP: 123123123',
    'REGON: 938274615',
  ];
  const buyerLines = [
    toPdfText(invoice.buyer.name),
    toPdfText(invoice.buyer.address),
    toPdfText(`Email: ${invoice.buyer.email}`),
    toPdfText(`Telefon: ${invoice.buyer.phone}`),
    ...buyerIdentifiers.map(toPdfText),
  ];

  sellerLines.forEach((line, idx) => doc.text(line, margin, y + idx * 5));
  buyerLines.forEach((line, idx) => doc.text(line, 110, y + idx * 5));
  y += Math.max(sellerLines.length, buyerLines.length) * 5 + 6;

  const colWidths = [10, 56, 18, 30, 14, 28, 30];
  const headers = ['Lp', 'Nazwa', 'Ilosc', 'Cena netto', 'VAT', 'Kwota VAT', 'Wartosc brutto'];
  const row = [
    '1',
    toPdfText(`Paliwo ${invoice.fuelType}`),
    `${invoice.quantity.toFixed(2)} L`,
    formatMoney(unitNet * invoice.quantity),
    `${vatPercent}%`,
    formatMoney(unitVat * invoice.quantity),
    formatMoney(grossValue),
  ];

  const drawRow = (startY: number, values: string[], bold = false): number => {
    let x = margin;
    const rowHeight = 8;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    for (let i = 0; i < colWidths.length; i += 1) {
      const width = colWidths[i] ?? 0;
      const value = values[i] ?? '';
      doc.rect(x, startY, width, rowHeight);
      const align: 'left' | 'right' = i >= 2 ? 'right' : 'left';
      doc.text(value, align === 'right' ? x + width - 1.5 : x + 1.5, startY + 5.2, { align });
      x += width;
    }
    return startY + rowHeight;
  };

  y = drawRow(y, headers, true);
  y = drawRow(y, row, false);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText(`Razem netto: ${formatMoney(netValue)}`), 128, y);
  y += 5;
  doc.text(toPdfText(`Razem VAT (${vatPercent}%): ${formatMoney(vatValue)}`), 128, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(toPdfText(`Do zaplaty (brutto): ${formatMoney(grossValue)}`), 128, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(toPdfText(`Metoda platnosci: ${invoice.paymentMethod}`), 128, y);

  doc.save(`${invoice.number.replace(/[/\\]/g, '-')}.pdf`);
}
