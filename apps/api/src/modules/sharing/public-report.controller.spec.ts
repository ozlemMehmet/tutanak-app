// Controller yalnizca HTTP baglama + servis cagirma yapar (CLAUDE.md §3.1). Bu dosya
// ayrica T-009'un iki yapisal kriterini dogrular: route kimlik dogrulamasi ISTEMEZ
// (@Public — kriter 4) ve modulde YAZMA handler'i YOKTUR (kriter 3).
import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { PublicReportController } from './public-report.controller';
import type { PublicReportService } from './public-report.service';

const TOKEN = 'gecerli-token_gecerli-token_gecerli-token_g';

/** Handler'i tanimlayicidan okur: metod referansini dogrudan tasimadan metadata sorgulanir. */
function handlerOf(name: string): object {
  return Object.getOwnPropertyDescriptor(PublicReportController.prototype, name)?.value as object;
}

describe('PublicReportController', () => {
  it('istegi servise token ile devreder ve yanitini oldugu gibi doner', async () => {
    const view = { title: 'Tutanak' };
    const viewByShareToken = jest.fn().mockResolvedValue(view);
    const controller = new PublicReportController({
      viewByShareToken,
    } as unknown as PublicReportService);

    await expect(controller.view(TOKEN)).resolves.toBe(view);
    expect(viewByShareToken).toHaveBeenCalledWith(TOKEN);
  });

  it('goruntuleme handler @Public isaretlidir: oturum/hesap adimi gerektirmez (kriter 4)', () => {
    const isPublic: unknown = Reflect.getMetadata(IS_PUBLIC_KEY, handlerOf('view'));

    expect(isPublic).toBe(true);
  });

  it('salt-okunurdur: sinifta GET disinda hicbir HTTP metodu tanimlanmaz (kriter 3)', () => {
    const handlerNames = Object.getOwnPropertyNames(PublicReportController.prototype).filter(
      (name) => name !== 'constructor',
    );
    const methods = handlerNames.map(
      (name): unknown => Reflect.getMetadata('method', handlerOf(name)) as unknown,
    );

    // Nest RequestMethod.GET = 0; yazma metodlari (POST=1, PUT=2, DELETE=3, PATCH=4) yok.
    expect(handlerNames).toEqual(['view']);
    expect(methods).toEqual([0]);
  });
});
