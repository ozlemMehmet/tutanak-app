// api-contract.yaml → CreateReportRequest ile birebir (additionalProperties: false
// karsiligi global ValidationPipe'in forbidNonWhitelisted ayaridir — CLAUDE.md §3.7).
// `ownerId`/`status`/`createdAt` govdeden ALINMAZ: sahiplik token'dan, durum ve damgalar
// veritabani varsayilanlarindan gelir (§3.7, §3.10).

import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 200;
const NOTE_MAX_LENGTH = 5000;

/** Bastaki/sondaki bosluklar kirpilir: yalnizca bosluktan olusan baslik bos sayilir
 *  (DDL `reports_title_not_blank` CHECK'i ile ayni kural, hata katmanda yakalanir). */
function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateReportDto {
  @IsUUID(undefined, { message: 'gecerli bir sablon seciniz' })
  templateId!: string;

  @Transform(trimText)
  @IsString({ message: 'baslik zorunludur' })
  @MinLength(TITLE_MIN_LENGTH, { message: 'baslik zorunludur' })
  @MaxLength(TITLE_MAX_LENGTH, { message: 'baslik en fazla 200 karakter olabilir' })
  title!: string;

  @IsOptional()
  @IsString({ message: 'not metin olmalidir' })
  @MaxLength(NOTE_MAX_LENGTH, { message: 'not en fazla 5000 karakter olabilir' })
  note?: string;
}
