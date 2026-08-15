// Controller yalnizca HTTP baglama + servis cagirma yapar (CLAUDE.md §3.1). Onay route'u
// kimlik dogrulamasi ISTEMEZ (@Public — kiracinin hesabi yoktur) ve 201 doner.
import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ApprovalsController } from './approvals.controller';
import type { ApprovalsService } from './approvals.service';

const TOKEN = 'gecerli-token_gecerli-token_gecerli-token_g';
const APPROVER_EMAIL = 'kiraci@ornek.test';

function handlerOf(name: string): object {
  return Object.getOwnPropertyDescriptor(ApprovalsController.prototype, name)?.value as object;
}

describe('ApprovalsController', () => {
  it('istegi servise token ve e-posta ile devreder, yanitini oldugu gibi doner', async () => {
    const approval = { id: 'onay-1', approverEmail: APPROVER_EMAIL, approvedAt: '2026-08-15' };
    const approveByShareToken = jest.fn().mockResolvedValue(approval);
    const controller = new ApprovalsController({
      approveByShareToken,
    } as unknown as ApprovalsService);

    await expect(controller.approve(TOKEN, { approverEmail: APPROVER_EMAIL })).resolves.toBe(
      approval,
    );
    expect(approveByShareToken).toHaveBeenCalledWith(TOKEN, APPROVER_EMAIL);
  });

  it('onay handler @Public isaretlidir: kiraci oturum acmadan onaylayabilir', () => {
    const isPublic: unknown = Reflect.getMetadata(IS_PUBLIC_KEY, handlerOf('approve'));

    expect(isPublic).toBe(true);
  });

  it('basarili onay 201 doner (sozlesme: 201 Approval)', () => {
    const status: unknown = Reflect.getMetadata('__httpCode__', handlerOf('approve'));

    expect(status).toBe(201);
  });
});
