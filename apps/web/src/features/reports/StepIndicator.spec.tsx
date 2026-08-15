// StepIndicator — design.md §4.5: yalnizca ReportCreatePage'de kullanilan 2 adimli gosterge.
import { render, screen } from '@testing-library/react';
import { StepIndicator } from './StepIndicator';

const STEPS = ['Sablon secimi', 'Tutanak bilgileri'] as const;

describe('StepIndicator', () => {
  it('tum adimlari sirali liste olarak gosterir', () => {
    render(<StepIndicator steps={STEPS} activeIndex={0} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('1. Sablon secimi');
    expect(items[1]).toHaveTextContent('2. Tutanak bilgileri');
  });

  it('aktif adimi aria-current ile isaretler', () => {
    render(<StepIndicator steps={STEPS} activeIndex={0} />);

    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByRole('listitem')[1]).not.toHaveAttribute('aria-current');
  });

  it('aktif adim ilerledigde isareti tasir ve onceki adimi tamamlanmis sayar', () => {
    render(<StepIndicator steps={STEPS} activeIndex={1} />);

    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]?.className).toContain('step-indicator__step--done');
  });
});
