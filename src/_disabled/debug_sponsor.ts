export const debugSponsorRoute = async (c: any) => {
  return c.json({
    evm: c.env.SPONSOR_EVM_SECRET || c.env.MULTI_FEE_BOT_KEY || 'Not Found',
    tron: c.env.SPONSOR_TRON_SECRET || c.env.MULTI_FEE_BOT_KEY || 'Not Found',
    multi: c.env.MULTI_FEE_BOT_KEY || 'Not Found'
  });
};
