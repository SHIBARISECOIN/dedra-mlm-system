import { fsQuery, getAdminToken } from './index';

export const debugCheckRoute = async (c: any) => {
  const adminToken = await getAdminToken();
  const bs1 = await fsQuery('bonuses', adminToken, [
      { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'rank_matching' } } },
      { fieldFilter: { field: { fieldPath: 'settlementDate' }, op: 'EQUAL', value: { stringValue: '2026-04-13' } } }
  ], 10);
  const bs2 = await fsQuery('bonuses', adminToken, [
      { fieldFilter: { field: { fieldPath: 'type' }, op: 'EQUAL', value: { stringValue: 'rank_bonus' } } },
      { fieldFilter: { field: { fieldPath: 'settlementDate' }, op: 'EQUAL', value: { stringValue: '2026-04-13' } } }
  ], 10);
  return c.json({
    rank_matching_today: bs1.length,
    rank_bonus_today: bs2.length
  });
};
