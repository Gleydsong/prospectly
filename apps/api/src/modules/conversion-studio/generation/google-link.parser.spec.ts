import {
  isAllowedGoogleMapsUrl,
  parseGoogleMapsLink,
} from './google-link.parser';

describe('google-link.parser', () => {
  it('accepts google maps hosts and rejects others', () => {
    expect(isAllowedGoogleMapsUrl('https://maps.google.com/?q=Barbearia')).toBe(true);
    expect(isAllowedGoogleMapsUrl('https://www.google.com/maps/place/Foo')).toBe(true);
    expect(isAllowedGoogleMapsUrl('https://maps.app.goo.gl/abc')).toBe(true);
    expect(isAllowedGoogleMapsUrl('https://evil.example/maps')).toBe(false);
  });

  it('extracts place name, query and place id', () => {
    const parsed = parseGoogleMapsLink(
      'https://www.google.com/maps/place/Barbearia+Nacuca/@-8.0,-34.8,17z/data=!3m1!4b1?place_id=ChIJabc123',
    );
    expect(parsed.placeName).toContain('Barbearia');
    expect(parsed.placeId).toBe('ChIJabc123');
    expect(parsed.latitude).toBe(-8);
    expect(parsed.longitude).toBe(-34.8);
  });
});
