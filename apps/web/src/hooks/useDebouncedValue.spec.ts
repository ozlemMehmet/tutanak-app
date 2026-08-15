// Debounce hook'u (T-021 kriter 2): arama kutusu her tus vurusunda istek yapmaz.
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ilk deger gecikmeden dondurulur', () => {
    const { result } = renderHook(() => useDebouncedValue('kapi', 400));

    expect(result.current).toBe('kapi');
  });

  it('gecikme dolmadan yeni deger dondurulmez', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: '' },
    });

    rerender({ value: 'kap' });
    act(() => {
      jest.advanceTimersByTime(399);
    });

    expect(result.current).toBe('');
  });

  it('gecikme dolunca son deger dondurulur', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: '' },
    });

    rerender({ value: 'kap' });
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current).toBe('kap');
  });

  it('gecikme icinde gelen ara degerler atlanir, yalnizca sonuncusu yayinlanir', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: '' },
    });

    rerender({ value: 'k' });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    rerender({ value: 'ka' });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    rerender({ value: 'kap' });
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current).toBe('kap');
  });

  it('bekleyen zamanlayici cozulmeden bilesen kaldirilirsa hata uretmez', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: '' },
    });

    rerender({ value: 'kap' });
    unmount();

    expect(() => {
      jest.advanceTimersByTime(400);
    }).not.toThrow();
  });
});
