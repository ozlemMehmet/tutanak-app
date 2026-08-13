// Bilesen testleri icin ortak kurulum.
import { TextDecoder, TextEncoder } from 'node:util';
import '@testing-library/jest-dom';

// jsdom, tarayicida standart olan TextEncoder/TextDecoder'i saglamaz; react-router bunlari
// modul yuklenirken kullanir. Node uygulamalari birebir ayni WHATWG API'sidir.
const globalWithEncoding = globalThis as unknown as {
  TextEncoder: typeof TextEncoder;
  TextDecoder: typeof TextDecoder;
};
globalWithEncoding.TextEncoder = TextEncoder;
globalWithEncoding.TextDecoder = TextDecoder;
