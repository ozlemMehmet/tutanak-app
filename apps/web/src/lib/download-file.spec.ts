import { saveBlobAsFile } from './download-file';

describe('saveBlobAsFile', () => {
  const OBJECT_URL = 'blob:tutanak-pdf';
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;

  beforeEach(() => {
    createObjectURL = jest.fn().mockReturnValue(OBJECT_URL);
    revokeObjectURL = jest.fn();
    // jsdom object URL API'sini saglamaz; indirme yolu icin sozlesme kadari sahtelenir.
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
  });

  it('blob"u indirilebilir dosya olarak kullaniciya sunar', () => {
    const clicked: HTMLAnchorElement[] = [];
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function mockClick(this: HTMLAnchorElement) {
        clicked.push(this);
      });
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });

    saveBlobAsFile(blob, 'tutanak-r-1.pdf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe('tutanak-r-1.pdf');
    expect(clicked[0]?.href).toContain(OBJECT_URL);
    click.mockRestore();
  });

  it('indirme sonrasi object URL"i serbest birakir ve DOM"da artik birakmaz', () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      /* tarayici indirmesi jsdom"da tetiklenmez */
    });

    saveBlobAsFile(new Blob(['%PDF-1.7']), 'tutanak-r-1.pdf');

    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
    expect(document.querySelectorAll('a')).toHaveLength(0);
    click.mockRestore();
  });
});
