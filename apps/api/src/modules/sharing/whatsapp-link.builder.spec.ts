// T-008 kabul kriteri 5: paylasim linkini iceren onceden doldurulmus wa.me URL'si.
// Saf fonksiyon — birim test SART (CLAUDE.md §8.1).
import { buildWhatsAppShareUrl } from './whatsapp-link.builder';

const SHARE_URL = 'https://app.example.com/t/AbC123_-xyz';

describe('buildWhatsAppShareUrl', () => {
  it('wa.me tabanli bir URL uretir', () => {
    const url = new URL(buildWhatsAppShareUrl(SHARE_URL));

    expect(url.origin).toBe('https://wa.me');
  });

  it('onceden doldurulmus metin paylasim linkini icerir', () => {
    const url = new URL(buildWhatsAppShareUrl(SHARE_URL));

    expect(url.searchParams.get('text')).toContain(SHARE_URL);
  });

  it('metni URL icine kacisli (percent-encoded) gomer', () => {
    const raw = buildWhatsAppShareUrl(SHARE_URL);

    // Ham URL, metindeki ':' ve '/' karakterlerini kacisli tasimalidir; aksi halde
    // WhatsApp metni link sinirinda keser.
    const [, query = ''] = raw.split('?text=');
    expect(query).not.toContain(':');
    expect(query).not.toContain('/');
  });
});
