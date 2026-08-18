// POST /reports/{reportId}/photos (fotograf ekleme + sunucu damgasi) ve
// GET /reports/{reportId}/photos (damgalariyla listeleme) — api-contract.yaml: T-006.
//
// GOVDE KURALI (CLAUDE.md §3.7 istisna 1): multipart govdede `file` DISINDAKI TUM ALANLAR
// SESSIZCE YOK SAYILIR. Uygulamasi: govde icin DTO TANIMLANMAZ ve @Body() KULLANILMAZ;
// boylece global ValidationPipe'in `forbidNonWhitelisted` kurali bu route'ta devreye
// girmez, ek alan 400 uretmez ve `capturedAt` dahil hicbir istemci tarihi okunmaz.
//
// GUNCELLEME ROTASI YOKTUR (T-006 kabul kriteri 4): damga yalnizca olusturma aninda
// sunucuda atanir; PATCH/PUT/DELETE handler'i bilincli olarak yazilmamistir.

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ValidationError } from '../../common/errors/app-error';
import type { PhotoDto } from './dto/photo.dto';
import { PhotoUploadLimitInterceptor } from './photo-upload-limit.interceptor';
import { PhotosService } from './photos.service';

/** Multipart alan adi sozlesmede `file` olarak tanimlidir. */
const FILE_FIELD = 'file';

@Controller('reports/:reportId/photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // Sira onemli: boyut sinirini ceviren interceptor, dosyayi okuyan interceptor'in DISINDA olmali.
  @UseInterceptors(PhotoUploadLimitInterceptor, FileInterceptor(FILE_FIELD))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PhotoDto> {
    if (file === undefined) {
      throw new ValidationError('Yüklenecek fotoğraf bulunamadı.', [
        { field: FILE_FIELD, message: 'fotoğraf zorunludur' },
      ]);
    }
    return this.photosService.addPhoto(reportId, user.userId, { buffer: file.buffer });
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
  ): Promise<PhotoDto[]> {
    return this.photosService.listPhotos(reportId, user.userId);
  }
}
