// Entity -> DTO donusumu (CLAUDE.md §3.5): onay yanitinin govdesi YALNIZCA burada kurulur.
import { toApprovalDto } from './approval.mapper';

const APPROVAL = {
  id: '66666666-6666-4666-8666-666666666666',
  approverEmail: 'kiraci@ornek.test',
  approvedAt: new Date('2026-08-15T09:30:00.000Z'),
};

describe('toApprovalDto', () => {
  it('sozlesmedeki Approval alanlarini (id, approverEmail, approvedAt) doner', () => {
    expect(toApprovalDto(APPROVAL)).toEqual({
      id: APPROVAL.id,
      approverEmail: 'kiraci@ornek.test',
      approvedAt: '2026-08-15T09:30:00.000Z',
    });
  });

  it('zaman damgasini ISO 8601 metnine cevirir (sozlesme: format date-time)', () => {
    expect(toApprovalDto(APPROVAL).approvedAt).toBe(APPROVAL.approvedAt.toISOString());
  });

  it('ic alanlari (reportId, shareLinkId, ipAddress) yanit govdesine tasimaz', () => {
    const dto = toApprovalDto({
      ...APPROVAL,
      // Kaydin tasidigi ek alanlar mapper'in beyaz listesine giremez.
      ...({ reportId: 'r', shareLinkId: 's', ipAddress: '10.0.0.1' } as object),
    });

    expect(Object.keys(dto).sort()).toEqual(['approvedAt', 'approverEmail', 'id']);
  });
});
