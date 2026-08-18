// api-contract.yaml → GET /reports sorgu parametreleri (q, page, pageSize) ile birebir.
// Sorgu da govde gibi katidir: sozlesmede tanimsiz bir parametre global ValidationPipe'in
// forbidNonWhitelisted ayari ile 400 VALIDATION_ERROR uretir (CLAUDE.md §3.7).

import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Sozlesmedeki varsayilanlar; sorgu parametresi gelmezse bunlar uygulanir. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

const MIN_PAGE = 1;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 50;
const SEARCH_TERM_MAX_LENGTH = 100;

/**
 * Terim kirpilir; bostan olusan deger filtre SAYILMAZ (sozlesme: "bos birakilirsa filtre
 * uygulanmaz") — `undefined`'a cevrilerek `@IsOptional` yoluna dusurulur.
 */
function trimSearchTerm({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class ListReportsQueryDto {
  @IsOptional()
  @Transform(trimSearchTerm)
  @IsString({ message: 'arama terimi metin olmalıdır' })
  @MaxLength(SEARCH_TERM_MAX_LENGTH, { message: 'arama terimi en fazla 100 karakter olabilir' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sayfa numarası tam sayı olmalıdır' })
  @Min(MIN_PAGE, { message: 'sayfa numarası en az 1 olmalıdır' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sayfa boyutu tam sayı olmalıdır' })
  @Min(MIN_PAGE_SIZE, { message: 'sayfa boyutu en az 1 olmalıdır' })
  @Max(MAX_PAGE_SIZE, { message: 'sayfa boyutu en fazla 50 olabilir' })
  pageSize?: number;
}
