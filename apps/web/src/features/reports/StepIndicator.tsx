// StepIndicator — design.md §4.5: yalnizca ReportCreatePage'de kullanilan 2 adimli gosterge.
// Adim degisimi animasyonsuzdur (design.md hareket taban cizgisi).

interface StepIndicatorProps {
  steps: readonly string[];
  /** Sifir tabanli aktif adim; oncesindeki adimlar tamamlanmis sayilir. */
  activeIndex: number;
}

export function StepIndicator({ steps, activeIndex }: StepIndicatorProps): React.JSX.Element {
  return (
    <ol className="step-indicator" aria-label="Tutanak olusturma adimlari">
      {steps.map((step, index) => (
        <li
          key={step}
          className={
            index < activeIndex
              ? 'step-indicator__step step-indicator__step--done'
              : 'step-indicator__step'
          }
          aria-current={index === activeIndex ? 'step' : undefined}
        >
          {`${String(index + 1)}. ${step}`}
        </li>
      ))}
    </ol>
  );
}
