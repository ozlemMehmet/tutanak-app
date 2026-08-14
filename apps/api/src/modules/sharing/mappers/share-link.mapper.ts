// Entity -> DTO donusumu (CLAUDE.md §3.5, §7 Mapper): ic kimlikler (share_links.id,
// report_id, provider_message_id) yanit govdesine sizmaz. URL burada tek noktada kurulur:
// `<PUBLIC_APP_URL>/t/<token>` — kimlik dogrulamasi gerektirmeyen genel bicim (T-008 kriter 2).

import type { ShareDeliveryDto, ShareLinkDto } from '../dto/share-link.dto';
import type { ShareDeliveryRecord, ShareLinkRecord } from '../sharing.repository';
import { buildWhatsAppShareUrl } from '../whatsapp-link.builder';

export function buildShareUrl(publicAppUrl: string, token: string): string {
  return `${publicAppUrl.replace(/\/+$/, '')}/t/${token}`;
}

export function toShareLinkDto(link: ShareLinkRecord, publicAppUrl: string): ShareLinkDto {
  const url = buildShareUrl(publicAppUrl, link.token);
  return {
    token: link.token,
    url,
    whatsAppUrl: buildWhatsAppShareUrl(url),
    createdAt: link.createdAt.toISOString(),
  };
}

export function toShareDeliveryDto(delivery: ShareDeliveryRecord): ShareDeliveryDto {
  return {
    id: delivery.id,
    channel: delivery.channel,
    recipientEmail: delivery.recipientEmail,
    status: delivery.status,
    errorMessage: delivery.errorMessage,
    createdAt: delivery.createdAt.toISOString(),
  };
}
