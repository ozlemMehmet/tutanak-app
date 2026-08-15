// InlineFieldError (design.md §4.5 `Input` error durumu + §5 form hata bildirimi).
import { render, screen } from '@testing-library/react';
import { InlineFieldError } from './InlineFieldError';

describe('InlineFieldError', () => {
  it('hata mesajini verilen kimlikle render eder (alan `aria-describedby` ile baglanabilsin)', () => {
    render(<InlineFieldError id="eposta-hatasi" message="bu e-posta zaten kayitli" />);

    const error = screen.getByText('bu e-posta zaten kayitli');
    expect(error).toHaveAttribute('id', 'eposta-hatasi');
  });

  it('hatayi nazikce anons eder (aria-live=polite — design.md §5)', () => {
    render(<InlineFieldError id="eposta-hatasi" message="bu e-posta zaten kayitli" />);

    expect(screen.getByText('bu e-posta zaten kayitli')).toHaveAttribute('aria-live', 'polite');
  });

  it('hatayi yalnizca renkle degil, ikon esliginde gosterir (renk korlugu — design.md §5)', () => {
    const { container } = render(<InlineFieldError id="eposta-hatasi" message="gecersiz" />);

    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    // Ikon dekoratiftir: mesaj metni zaten okunur, ekran okuyucu ikonu tekrar etmemeli.
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
