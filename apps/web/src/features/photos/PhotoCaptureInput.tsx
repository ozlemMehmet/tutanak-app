// Fotograf ekleme girisi (T-006 kabul kriteri 7 / design.md → `CameraInput`):
// mobil tarayicida `capture="environment"` cihazin ARKA kamerasini dogrudan acar,
// cekilen kare once onizlenir, kullanici "Yukle" dedikten sonra sunucuya gonderilir.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

interface PhotoCaptureInputProps {
  /** Yukleme isini ust bilesen yapar; hata firlatilirsa onizleme KORUNUR (tekrar denenebilir). */
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  disabled?: boolean;
}

interface CapturedFrame {
  file: File;
  previewUrl: string;
}

export function PhotoCaptureInput({
  onUpload,
  isUploading,
  disabled = false,
}: PhotoCaptureInputProps): React.JSX.Element {
  const [captured, setCaptured] = useState<CapturedFrame | null>(null);
  // Bilesen sokulurken serbest birakilacak URL; render'dan bagimsiz olarak izlenir.
  const previewUrlRef = useRef<string | null>(null);

  const releasePreview = useCallback((): void => {
    if (previewUrlRef.current !== null) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  const handleCapture = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // Kullanici kamerayi acip vazgecerse dosya gelmez; onizleme acilmaz.
    if (file === undefined) {
      return;
    }
    releasePreview();
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setCaptured({ file, previewUrl });
    // Ayni kare tekrar secilebilsin diye giris sifirlanir (aksi halde `change` tetiklenmez).
    event.target.value = '';
  };

  const discard = (): void => {
    releasePreview();
    setCaptured(null);
  };

  const submit = async (): Promise<void> => {
    if (captured === null) {
      return;
    }
    try {
      await onUpload(captured.file);
      discard();
    } catch {
      // Hata mesajini ust bilesen gosterir; kare ekranda kalir ki kullanici tekrar deneyebilsin.
    }
  };

  return (
    <div className="photo-capture">
      <label className="photo-capture__trigger">
        Fotograf Ekle
        <input
          className="photo-capture__input"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled || isUploading}
          onChange={handleCapture}
        />
      </label>

      {captured !== null && (
        <div className="photo-capture__preview">
          <img src={captured.previewUrl} alt="Cekilen fotografin onizlemesi" />
          <div className="photo-capture__actions">
            <button
              type="button"
              className="button button--primary"
              disabled={isUploading}
              onClick={() => {
                void submit();
              }}
            >
              {isUploading ? 'Yukleniyor...' : 'Yukle'}
            </button>
            <button
              type="button"
              className="button button--ghost"
              disabled={isUploading}
              onClick={discard}
            >
              Vazgec
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
