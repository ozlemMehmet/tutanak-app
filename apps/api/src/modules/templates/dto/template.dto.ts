// Yanit tipi — api-contract.yaml → Template ile birebir.

export interface TemplateDto {
  id: string;
  /**
   * Stabil makine adi; sozlesmede move_in_out | meter_fixture | periodic_check enum'u
   * olarak tanimlidir. Deger kumesini seed (T-002) belirler, sutun tipi `text`tir —
   * bu yuzden burada birlesim tipi yerine `string` tasinir (yanlis daralma yapilmaz).
   */
  code: string;
  name: string;
  description: string;
}
