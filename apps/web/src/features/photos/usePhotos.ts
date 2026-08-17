// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); bilesenler veri cekmeyi
// bu hook'lara devreder.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../../api/client';
import { downscalePhotoForUpload } from './downscale-photo';
import type { Photo } from './photos.api';
import { fetchPhotos, uploadPhoto } from './photos.api';

export const photosQueryKey = (reportId: string): readonly string[] => ['photos', reportId];

export function usePhotos(client: ApiClient, reportId: string): UseQueryResult<Photo[]> {
  return useQuery({
    queryKey: photosQueryKey(reportId),
    queryFn: () => fetchPhotos(client, reportId),
  });
}

export function useUploadPhoto(
  client: ApiClient,
  reportId: string,
): UseMutationResult<Photo, unknown, File> {
  const queryClient = useQueryClient();
  return useMutation({
    // Kucultme istegin KENDISINDEN once, bu katmanda yapilir (T-028): `photos.api.ts`
    // sozlesme esleme katmanidir (govdeye yalnizca `file` konur), goruntu isleme oraya
    // ait degildir; bilesende yapilsaydi yeni bir yukleme tetikleyicisi eklendiginde
    // sessizce atlanabilirdi. Basarisizligi yukleme hatasi DEGILDIR: orijinal gonderilir.
    mutationFn: async (file: File) =>
      uploadPhoto(client, reportId, await downscalePhotoForUpload(file)),
    // Damgayi sunucu uretir: yukleme sonrasi liste sunucudan yeniden cekilir,
    // istemcide tahmini bir damga ile iyimser guncelleme YAPILMAZ (CLAUDE.md §3.7).
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: photosQueryKey(reportId) });
    },
  });
}
