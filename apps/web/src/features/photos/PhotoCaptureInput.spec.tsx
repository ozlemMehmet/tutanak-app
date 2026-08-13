// T-006 kabul kriteri 7: fotograf ekleme arayuzu mobil tarayicida cihaz kamerasini
// DOGRUDAN acan bir giris sunar; cekilen kare onizlenir ve "Yukle" ile sunucuya gonderilir.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoCaptureInput } from './PhotoCaptureInput';

describe('PhotoCaptureInput', () => {
  const OBJECT_URL = 'blob:onizleme-1';
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;

  const capturedFrame = (): File => new File(['kare'], 'kamera.jpg', { type: 'image/jpeg' });

  const cameraInput = (): HTMLInputElement =>
    screen.getByLabelText<HTMLInputElement>('Fotograf Ekle');

  beforeEach(() => {
    createObjectURL = jest.fn().mockReturnValue(OBJECT_URL);
    revokeObjectURL = jest.fn();
    // jsdom object URL uretmez; onizleme davranisi bu sahtelerle dogrulanir.
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
  });

  it('kamera girisi accept="image/*" ve capture="environment" ile cihaz kamerasini acar', () => {
    render(<PhotoCaptureInput onUpload={jest.fn()} isUploading={false} />);

    const input = cameraInput();
    expect(input.type).toBe('file');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('capture', 'environment');
  });

  it('cekilen kare yuklemeden once onizlenir', async () => {
    render(<PhotoCaptureInput onUpload={jest.fn()} isUploading={false} />);

    await userEvent.upload(cameraInput(), capturedFrame());

    const preview = await screen.findByAltText('Cekilen fotografin onizlemesi');
    expect(preview).toHaveAttribute('src', OBJECT_URL);
    expect(screen.getByRole('button', { name: 'Yukle' })).toBeEnabled();
  });

  it('onizleme yokken "Yukle" butonu gosterilmez', () => {
    render(<PhotoCaptureInput onUpload={jest.fn()} isUploading={false} />);

    expect(screen.queryByRole('button', { name: 'Yukle' })).not.toBeInTheDocument();
  });

  it('"Yukle" cekilen kareyi sunucuya gonderir ve onizlemeyi temizler', async () => {
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const frame = capturedFrame();
    render(<PhotoCaptureInput onUpload={onUpload} isUploading={false} />);
    await userEvent.upload(cameraInput(), frame);

    await userEvent.click(screen.getByRole('button', { name: 'Yukle' }));

    expect(onUpload).toHaveBeenCalledWith(frame);
    await waitFor(() => {
      expect(screen.queryByAltText('Cekilen fotografin onizlemesi')).not.toBeInTheDocument();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
  });

  it('yukleme basarisiz olursa onizleme korunur (tekrar denenebilir)', async () => {
    const onUpload = jest.fn().mockRejectedValue(new Error('yukleme basarisiz'));
    render(<PhotoCaptureInput onUpload={onUpload} isUploading={false} />);
    await userEvent.upload(cameraInput(), capturedFrame());

    await userEvent.click(screen.getByRole('button', { name: 'Yukle' }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByAltText('Cekilen fotografin onizlemesi')).toBeInTheDocument();
  });

  it('"Vazgec" onizlemeyi kaldirir ve object URL"i serbest birakir', async () => {
    render(<PhotoCaptureInput onUpload={jest.fn()} isUploading={false} />);
    await userEvent.upload(cameraInput(), capturedFrame());

    await userEvent.click(screen.getByRole('button', { name: 'Vazgec' }));

    expect(screen.queryByAltText('Cekilen fotografin onizlemesi')).not.toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
  });

  it('yukleme surerken butonlar devre disi kalir ve durum metni gosterilir', async () => {
    const { rerender } = render(<PhotoCaptureInput onUpload={jest.fn()} isUploading={false} />);
    await userEvent.upload(cameraInput(), capturedFrame());

    rerender(<PhotoCaptureInput onUpload={jest.fn()} isUploading />);

    expect(screen.getByRole('button', { name: 'Yukleniyor...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vazgec' })).toBeDisabled();
  });

  it('devre disi birakildiginda kamera girisi kullanilamaz', () => {
    render(<PhotoCaptureInput onUpload={jest.fn()} isUploading={false} disabled />);

    expect(cameraInput()).toBeDisabled();
  });

  it('dosya secimi iptal edilirse onizleme acilmaz', async () => {
    render(<PhotoCaptureInput onUpload={jest.fn()} isUploading={false} />);

    await userEvent.upload(cameraInput(), []);

    expect(screen.queryByAltText('Cekilen fotografin onizlemesi')).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
