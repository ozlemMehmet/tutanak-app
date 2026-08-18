// wa.me URL kurucu (CLAUDE.md §7 Builder satiri; architecture.md: WhatsApp bir entegrasyon
// DEGILDIR — sunucu cagrisi yok, saf URL uretimi). Sunucudan gonderim olmadigi icin bu URL
// teslim kaydi URETMEZ (api-contract ShareDelivery.channel aciklamasi).

const WHATSAPP_SHARE_BASE_URL = 'https://wa.me/';

/** Paylasim linkini iceren, onceden doldurulmus WhatsApp paylasma URL'si (T-008 kriter 5). */
export function buildWhatsAppShareUrl(shareUrl: string): string {
  const text = `Emlak teslim tutanağını görüntülemek ve onaylamak için: ${shareUrl}`;
  return `${WHATSAPP_SHARE_BASE_URL}?text=${encodeURIComponent(text)}`;
}
