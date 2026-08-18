// H-003: `pending` abonelikte sinirli sureli YOKLAMA (polling) davranisi. Tetikleyici
// bazli testler (`?checkout=return`, `visibilitychange`) ve kullaniciya gorunen metinler
// SubscriptionPage.spec.tsx'tedir; burada yoklama zamanlamasinin degismezleri dogrulanir.
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  SUBSCRIPTION_POLL_DELAYS_MS,
  useSubscriptionAutoRefresh,
} from './useSubscriptionAutoRefresh';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <MemoryRouter initialEntries={['/subscription']}>{children}</MemoryRouter>;
}

const totalBudgetMs = SUBSCRIPTION_POLL_DELAYS_MS.reduce((sum, delay) => sum + delay, 0);

/**
 * Yoklamanin tamamini kosar. Her adim bir oncekinin tazelemesi oturduktan SONRA
 * planlandigi icin butce tek hamlede ilerletilemez; adimlar sirayla kosulur.
 */
function runWholePollSchedule(): void {
  SUBSCRIPTION_POLL_DELAYS_MS.forEach((delay) => {
    act(() => {
      jest.advanceTimersByTime(delay);
    });
  });
}

describe('useSubscriptionAutoRefresh yoklama zamanlamasi', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('yoklama araliklari artandir ve ilk aralik birkac saniyedir (kriter 3)', () => {
    const [first] = SUBSCRIPTION_POLL_DELAYS_MS;

    expect(first).toBeGreaterThanOrEqual(2000);
    expect(first).toBeLessThanOrEqual(5000);
    SUBSCRIPTION_POLL_DELAYS_MS.forEach((delay, index) => {
      if (index === 0) {
        return;
      }
      expect(delay).toBeGreaterThanOrEqual(SUBSCRIPTION_POLL_DELAYS_MS[index - 1] ?? 0);
    });
  });

  it('yoklama toplam butcesi makul bir ust sinirdadir (60-90 sn, kriter 3)', () => {
    expect(totalBudgetMs).toBeGreaterThanOrEqual(60_000);
    expect(totalBudgetMs).toBeLessThanOrEqual(90_000);
  });

  it('abonelik pending degilken hic yoklama yapmaz (kriter 3)', () => {
    const refresh = jest.fn();
    renderHook(() => useSubscriptionAutoRefresh(refresh, false), { wrapper });
    refresh.mockClear();

    act(() => {
      jest.advanceTimersByTime(totalBudgetMs * 2);
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('pending iken her aralik sonunda tam bir kez tazeleme cagirir (kriter 3)', () => {
    const refresh = jest.fn();
    renderHook(() => useSubscriptionAutoRefresh(refresh, true), { wrapper });
    refresh.mockClear();

    const [first, second] = SUBSCRIPTION_POLL_DELAYS_MS;
    act(() => {
      jest.advanceTimersByTime((first ?? 0) - 1);
    });
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(second ?? 0);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('pending bittiginde yoklama durur, ek tazeleme cagirmaz (kriter 3)', () => {
    const refresh = jest.fn();
    const { rerender } = renderHook(
      ({ isAwaitingPayment }: { isAwaitingPayment: boolean }) =>
        useSubscriptionAutoRefresh(refresh, isAwaitingPayment),
      { wrapper, initialProps: { isAwaitingPayment: true } },
    );

    act(() => {
      jest.advanceTimersByTime(SUBSCRIPTION_POLL_DELAYS_MS[0] ?? 0);
    });
    rerender({ isAwaitingPayment: false });
    refresh.mockClear();

    act(() => {
      jest.advanceTimersByTime(totalBudgetMs * 2);
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('ust sinira ulasinca isPollExhausted doner ve yeni cagri yapmaz (kriter 3-4)', () => {
    const refresh = jest.fn();
    const { result } = renderHook(() => useSubscriptionAutoRefresh(refresh, true), { wrapper });
    refresh.mockClear();

    expect(result.current.isPollExhausted).toBe(false);

    runWholePollSchedule();
    expect(refresh).toHaveBeenCalledTimes(SUBSCRIPTION_POLL_DELAYS_MS.length);
    expect(result.current.isPollExhausted).toBe(true);

    act(() => {
      jest.advanceTimersByTime(totalBudgetMs * 2);
    });
    expect(refresh).toHaveBeenCalledTimes(SUBSCRIPTION_POLL_DELAYS_MS.length);
  });

  it('yoklama tukendikten sonra abonelik yeniden pending olursa yoklama bastan baslar (sinir durumu)', () => {
    const refresh = jest.fn();
    const { result, rerender } = renderHook(
      ({ isAwaitingPayment }: { isAwaitingPayment: boolean }) =>
        useSubscriptionAutoRefresh(refresh, isAwaitingPayment),
      { wrapper, initialProps: { isAwaitingPayment: true } },
    );

    runWholePollSchedule();
    expect(result.current.isPollExhausted).toBe(true);

    rerender({ isAwaitingPayment: false });
    expect(result.current.isPollExhausted).toBe(false);

    rerender({ isAwaitingPayment: true });
    refresh.mockClear();
    act(() => {
      jest.advanceTimersByTime(SUBSCRIPTION_POLL_DELAYS_MS[0] ?? 0);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
