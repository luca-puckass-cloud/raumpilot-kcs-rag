import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getPermittedRequest } from '../src/case-access.mjs';
const data = JSON.parse(await readFile(new URL('../data/demo.json', import.meta.url)));

test('permitted case distinguishes received from customer-visible offers', () => {
  const result = getPermittedRequest(data, 'user-lena', 'RFP-1042');
  assert.equal(result.ok, true);
  assert.equal(result.request.responses_received, 2);
  assert.equal(result.request.visible_offers, 0);
  assert.equal(result.request.booking_reference, null);
  assert.equal('company_id' in result.request, false);
  assert.equal('allowed_user_ids' in result.request, false);
});
test('foreign company, unshared same-company request and missing ID expose identical failure', () => {
  const expected = { ok: false, code: 'REQUEST_NOT_ACCESSIBLE' };
  for (const [user,id] of [['user-lena','RFP-2042'],['user-lena','RFP-1045'],['user-lena','RFP-0000'],['unknown','RFP-1042']]) {
    assert.deepEqual(getPermittedRequest(data,user,id), expected);
  }
});
test('fixture references and status relationships remain consistent', () => {
  assert.equal(data.fictional, true);
  const companies = new Set(data.companies.map(c => c.id));
  const users = new Map(data.users.map(u => [u.id,u]));
  const states = new Set(['draft','awaiting_responses','offers_available','booking_pending','booking_confirmed','cancelled']);
  assert.equal(new Set(data.requests.map(r => r.id)).size, data.requests.length);
  for (const request of data.requests) {
    assert.ok(companies.has(request.company_id));
    assert.ok(states.has(request.status));
    assert.equal(request.responses_received,request.offers.length);
    assert.ok(request.responses_received <= request.hotels_contacted);
    for (const userId of request.allowed_user_ids) assert.equal(users.get(userId)?.company_id,request.company_id);
    if (request.status === 'booking_confirmed') assert.ok(request.booking_reference);
    if (request.status === 'offers_available') assert.ok(request.offers.some(o=>o.customer_visible));
  }
});
test('article metadata points to readable, versioned source articles', async () => {
  const articles = JSON.parse(await readFile(new URL('../data/articles.json', import.meta.url)));
  for (const article of articles) {
    assert.equal(article.state, 'approved');
    assert.equal(article.audience, 'customer');
    const source = await readFile(new URL('../'+article.path, import.meta.url), 'utf8');
    assert.ok(source.includes(article.id));
    assert.ok(source.includes(article.version));
  }
});
