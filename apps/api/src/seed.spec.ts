import { BRAZILIAN_CITIES, DEMO_LEADS, buildDemoLeadData } from '../prisma/seed';

describe('Seed Brazilian configuration', () => {
  it('contains 30 demo leads across Brazilian metropolitan cities', () => {
    expect(DEMO_LEADS).toHaveLength(30);

    const portugueseCities = ['Lisboa', 'Porto', 'Braga', 'Faro', 'Aveiro', 'Coimbra'];
    for (const lead of DEMO_LEADS) {
      expect(portugueseCities).not.toContain(lead.city);
      expect(BRAZILIAN_CITIES).toHaveProperty(lead.city);
      expect(BRAZILIAN_CITIES[lead.city]!.state).toBe(lead.state);
    }
  });

  it('buildDemoLeadData generates valid Brazilian coordinates, addresses, and phone numbers', () => {
    for (let index = 0; index < DEMO_LEADS.length; index += 1) {
      const entry = DEMO_LEADS[index]!;
      const cityInfo = BRAZILIAN_CITIES[entry.city]!;
      const data = buildDemoLeadData(entry, index);

      // Country and address
      expect(data.country).toBe('Brasil');
      expect(data.city).toBe(entry.city);
      expect(data.state).toBe(entry.state);
      expect(data.address).toContain('—');
      expect(data.postalCode).toMatch(new RegExp(`^${cityInfo.cepPrefix}-\\d{3}$`));

      // Latitude and longitude within Brazilian territory
      expect(data.latitude).toBeLessThan(5.5);
      expect(data.latitude).toBeGreaterThan(-34.0);
      expect(data.longitude).toBeLessThan(-34.0);
      expect(data.longitude).toBeGreaterThan(-74.0);

      // Phones:
      // When index % 2 === 0: mobile with 9 digits after DDD ('9' + 8 digits) -> +55 + 2 DDD + 9 digits = 14 chars
      // When index % 2 === 1: landline with 8 digits after DDD (2-5 + 7 digits) -> +55 + 2 DDD + 8 digits = 13 chars
      const isMobile = index % 2 === 0;
      if (isMobile) {
        expect(data.phone).toMatch(new RegExp(`^\\+55${cityInfo.ddd}9\\d{8}$`));
        expect(data.phone.length).toBe(14);
        expect(data.whatsapp).toMatch(new RegExp(`^\\+55${cityInfo.ddd}9\\d{8}$`));
        expect(data.whatsapp?.length).toBe(14);
      } else {
        expect(data.phone).toMatch(new RegExp(`^\\+55${cityInfo.ddd}[2-5]\\d{7}$`));
        expect(data.phone.length).toBe(13);
        // Landline only has whatsapp when index % 5 === 0
        if (index % 5 === 0) {
          expect(data.whatsapp).toMatch(new RegExp(`^\\+55${cityInfo.ddd}9\\d{8}$`));
          expect(data.whatsapp?.length).toBe(14);
        } else {
          expect(data.whatsapp).toBeNull();
        }
      }

      if (entry.domain) {
        expect(entry.domain).toMatch(/\.com\.br$/);
      }
    }
  });

  it('preserves test scenarios including missing website and DNC', () => {
    const withoutWebsite = DEMO_LEADS.filter((l) => l.domain === null);
    const withWebsite = DEMO_LEADS.filter((l) => l.domain !== null);
    expect(withoutWebsite.length).toBeGreaterThan(10);
    expect(withWebsite.length).toBeGreaterThan(10);

    const dnc = DEMO_LEADS.find((l) => 'doNotContact' in l && l.doNotContact);
    expect(dnc).toBeDefined();
    expect(dnc?.companyName).toBe('Oficina Auto Ribeiro');

    const dncIndex = DEMO_LEADS.findIndex((l) => 'doNotContact' in l && l.doNotContact);
    const dncData = buildDemoLeadData(DEMO_LEADS[dncIndex]!, dncIndex);
    expect(dncData.doNotContact).toBe(true);
  });

  it('contains brazilianized business names without Portuguese idioms', () => {
    const names = DEMO_LEADS.map((l) => l.companyName);
    expect(names).not.toContain('CrossFit Tejo');
    expect(names).not.toContain('Hostel Baixa Vista');
    expect(names).not.toContain('Barbearia Porto Clássico');
    expect(names).not.toContain('Tasca do Bairro');

    expect(names).toContain('CrossFit Paulistano');
    expect(names).toContain('Hostel Boa Vista');
    expect(names).toContain('Barbearia Paulista Clássica');
    expect(names).toContain('Boteco do Bairro');
    expect(names).toContain('Padaria Forno Antigo');
    expect(names).toContain('Nova Morada Imóveis');
    expect(names).toContain('Mecânica Rápida Sul');
    expect(names).toContain('Farmácia do Largo');
  });
});
