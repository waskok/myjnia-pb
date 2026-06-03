import { describe, expect, it, vi } from 'vitest';

const saveMock = vi.fn();

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFont = vi.fn();
    setFontSize = vi.fn();
    text = vi.fn();
    rect = vi.fn();
    save = saveMock;
  }
  return { jsPDF: MockJsPDF };
});

import { toPdfText, downloadInvoicePdf, type GeneratedInvoice } from './pdfGenerator';

const sampleInvoice: GeneratedInvoice = {
  number: 'FV/2026/1',
  issueDate: '2026-06-01T12:00:00.000Z',
  amount: 123,
  paymentMethod: 'Karta',
  quantity: 10,
  fuelType: 'E95',
  unitPrice: 6.39,
  buyer: {
    name: 'Jan Kowalski',
    address: 'ul. Testowa 1, Kraków',
    email: 'jan@example.com',
    phone: '600100200',
    type: 'individual',
    identifiers: { pesel: '90010112345' },
  },
};

describe('pdfGenerator', () => {
  it('toPdfText zamienia polskie znaki na ASCII', () => {
    expect(toPdfText('Kraków, Łódź, śćż')).toBe('Krakow, Lodz, scz');
  });

  it('toPdfText zostawia znaki bez ogonków', () => {
    expect(toPdfText('Myjnia PB')).toBe('Myjnia PB');
  });

  it('downloadInvoicePdf generuje plik PDF', () => {
    saveMock.mockClear();
    downloadInvoicePdf(sampleInvoice);
    expect(saveMock).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/));
  });
});
