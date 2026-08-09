#!/usr/bin/env node
/**
 * IYZWSv2 canonicalization regression tests — no network, no real secrets.
 * Run: node scripts/test-iyzico-auth.mjs
 */
import { createHmac } from 'crypto';
import {
  canonicalizeIyzicoSignedPath,
  canonicalizeIyzicoSignedBody,
  buildIyzicoV2Auth,
  buildIyzicoAuthorizationHeader,
  IYZICO_CLIENT_VERSION_HEADER,
} from '../server/billing/providers/iyzico.js';

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}`);
  }
}

/** Mirror of official iyzipay-node utils.generateHashV2 / Authorization (test doubles only). */
function officialSdkAuthorization(apiKey, secretKey, uri, bodyObj, randomKey) {
  const signature = createHmac('sha256', secretKey)
    .update(randomKey + uri + JSON.stringify(bodyObj))
    .digest('hex');
  const authorizationParams = [
    `apiKey:${apiKey}`,
    `randomKey:${randomKey}`,
    `signature:${signature}`,
  ].join('&');
  return {
    signature,
    authorization: `IYZWSv2 ${Buffer.from(authorizationParams).toString('base64')}`,
    canonicalInput: randomKey + uri + JSON.stringify(bodyObj),
  };
}

const TEST_API = 'test-api-key';
const TEST_SECRET = 'test-secret-key';
const FIXED_RND = 'fixed-random-key-001';

// GET + query → pathname only
ok(
  'GET query stripped from signed path',
  canonicalizeIyzicoSignedPath('/v2/subscription/products?page=1&count=10') ===
    '/v2/subscription/products',
);
ok(
  'full URL query stripped',
  canonicalizeIyzicoSignedPath(
    'https://sandbox-api.iyzipay.com/v2/subscription/products?page=1&count=10',
  ) === '/v2/subscription/products',
);

// empty body → "{}"
ok('empty string body → {}', canonicalizeIyzicoSignedBody('') === '{}');
ok('null body → {}', canonicalizeIyzicoSignedBody(null) === '{}');
ok('undefined body → {}', canonicalizeIyzicoSignedBody(undefined) === '{}');
ok('empty object → {}', canonicalizeIyzicoSignedBody({}) === '{}');

// POST JSON body canonicalization
const postObj = { locale: 'tr', price: '1.00' };
const postStr = JSON.stringify(postObj);
ok('object body JSON', canonicalizeIyzicoSignedBody(postObj) === postStr);
ok('string body passthrough', canonicalizeIyzicoSignedBody(postStr) === postStr);

// hex signature + SDK auth payload parity
const getAuth = buildIyzicoV2Auth(
  TEST_API,
  TEST_SECRET,
  '/v2/subscription/products?page=1&count=10',
  {},
  { randomKey: FIXED_RND },
);
const sdkGet = officialSdkAuthorization(
  TEST_API,
  TEST_SECRET,
  '/v2/subscription/products',
  {},
  FIXED_RND,
);
ok('GET signedPath pathname only', getAuth.signedPath === '/v2/subscription/products');
ok('GET canonicalBody {}', getAuth.canonicalBody === '{}');
ok('signature is hex', /^[0-9a-f]+$/i.test(getAuth.signature) && getAuth.signature.length === 64);
ok('GET signature matches official SDK', getAuth.signature === sdkGet.signature);
ok('GET Authorization matches official SDK', getAuth.authorization === sdkGet.authorization);
ok(
  'auth payload decodes to apiKey&randomKey&signature',
  (() => {
    const b64 = getAuth.authorization.replace(/^IYZWSv2\s+/, '');
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    return (
      decoded.startsWith(`apiKey:${TEST_API}&`) &&
      decoded.includes(`&randomKey:${FIXED_RND}&`) &&
      decoded.includes('&signature:') &&
      !decoded.includes(`${TEST_API}:${FIXED_RND}:`) // old Atlas colon-only triple
    );
  })(),
);
ok('x-iyzi-rnd header set', getAuth.headers['x-iyzi-rnd'] === FIXED_RND);
ok(
  'x-iyzi-client-version header set',
  getAuth.headers['x-iyzi-client-version'] === IYZICO_CLIENT_VERSION_HEADER,
);

const postAuth = buildIyzicoV2Auth(
  TEST_API,
  TEST_SECRET,
  '/payment/iyzipos/checkoutform/initialize/auth/ecom',
  postObj,
  { randomKey: FIXED_RND },
);
const sdkPost = officialSdkAuthorization(
  TEST_API,
  TEST_SECRET,
  '/payment/iyzipos/checkoutform/initialize/auth/ecom',
  postObj,
  FIXED_RND,
);
ok('POST signature matches official SDK', postAuth.signature === sdkPost.signature);
ok('POST Authorization matches official SDK', postAuth.authorization === sdkPost.authorization);
ok(
  'buildIyzicoAuthorizationHeader returns Authorization string',
  buildIyzicoAuthorizationHeader(TEST_API, TEST_SECRET, '/x', {}, FIXED_RND).startsWith(
    'IYZWSv2 ',
  ),
);

// Ensure test secrets never appear in printed auth blob beyond controlled TEST_* labels
const dumped = JSON.stringify(getAuth);
ok('no production-looking secret patterns in dump', !/sk_live|sandbox-secret-real/i.test(dumped));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
