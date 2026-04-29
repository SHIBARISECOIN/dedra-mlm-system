import { Hono } from 'hono';
import { fsQuery, firestoreDocToObj } from './index';

export const debugCheckRoute2 = new Hono();
debugCheckRoute2.get('/', async (c) => {
  const { env } = c;
  const rawDocs = await fsQuery('transactions', env.SERVICE_ACCOUNT_JSON, [], 100);
  const docs = rawDocs.map((d: any) => d.document ? firestoreDocToObj(d.document) : null).filter(Boolean);
  return c.json({ total: docs.length, types: [...new Set(docs.map((d:any)=>d.type))] });
});
