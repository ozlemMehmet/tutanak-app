// Controller yalnizca HTTP baglama + servis cagirma yapar (CLAUDE.md §3.1);
// kimlik token'dan alinir, govdeden/parametreden kullanici kimligi OKUNMAZ.
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { ShareLinkService } from './share-link.service';
import { SharingController } from './sharing.controller';

const USER: AuthenticatedUser = {
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'kaan@ornek.test',
};
const REPORT_ID = '22222222-2222-4222-8222-222222222222';

describe('SharingController', () => {
  it('POST /reports/{id}/share-link istegini token sahibinin kimligiyle servise iletir', async () => {
    const issueShareLink = jest.fn().mockResolvedValue({ token: 't' });
    const controller = new SharingController({ issueShareLink } as unknown as ShareLinkService);

    await controller.create(USER, REPORT_ID);

    expect(issueShareLink).toHaveBeenCalledWith(REPORT_ID, USER.userId);
  });

  it('GET /reports/{id}/share-link istegini servise iletir', async () => {
    const getShareLink = jest.fn().mockResolvedValue({ token: 't' });
    const controller = new SharingController({ getShareLink } as unknown as ShareLinkService);

    await controller.get(USER, REPORT_ID);

    expect(getShareLink).toHaveBeenCalledWith(REPORT_ID, USER.userId);
  });

  it('POST .../email istegini alici adresiyle servise iletir', async () => {
    const sendShareEmail = jest.fn().mockResolvedValue({ status: 'sent' });
    const controller = new SharingController({ sendShareEmail } as unknown as ShareLinkService);

    await controller.sendEmail(USER, REPORT_ID, { recipientEmail: 'kiraci@ornek.test' });

    expect(sendShareEmail).toHaveBeenCalledWith(REPORT_ID, USER.userId, 'kiraci@ornek.test');
  });
});
