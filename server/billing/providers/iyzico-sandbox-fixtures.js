/**
 * Iyzico sandbox-only test fixtures.
 * Official CF sample values come from iyzico Python SDK sample
 * (samples/initialize_checkout_form.py). Not real personal PII.
 * Never apply these on production checkout paths.
 */

/** Official iyzico sample identityNumber (docs / PHP / Python SDK samples). */
export const SANDBOX_TEST_IDENTITY_NUMBER = '74300864791';

/**
 * Synthetic TR address block for sandbox CF initialize.
 * city / country / zipCode stay mutually consistent (Istanbul / Turkey / 34732).
 */
export const SANDBOX_TEST_ADDRESS = Object.freeze({
  registrationAddress: 'Caferaga Mah. Moda Cad. No:10 Daire:4',
  city: 'Istanbul',
  country: 'Turkey',
  zipCode: '34732',
  contactName: 'Sandbox Alici',
  address: 'Caferaga Mah. Moda Cad. No:10 Daire:4',
});

/**
 * Official Python SDK CF initialize sample address (iyzico sample, not a real user).
 * @see https://github.com/iyzico/iyzipay-python/blob/master/samples/initialize_checkout_form.py
 */
export const OFFICIAL_SAMPLE_ADDRESS = Object.freeze({
  contactName: 'Jane Doe',
  city: 'Istanbul',
  country: 'Turkey',
  address: 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
  zipCode: '34732',
});

/**
 * Build request body matching official iyzico Python CF sample as closely as possible.
 * Only `callbackUrl` is merchant-specific (must be this merchant's HTTPS callback).
 *
 * @param {{ callbackUrl: string }} opts
 */
export function buildOfficialPythonCfSampleRequest(opts) {
  const callbackUrl = String(opts?.callbackUrl || '').trim();
  const buyer = {
    id: 'BY789',
    name: 'John',
    surname: 'Doe',
    gsmNumber: '+905350000000',
    email: 'email@email.com',
    identityNumber: SANDBOX_TEST_IDENTITY_NUMBER,
    lastLoginDate: '2015-10-05 12:43:35',
    registrationDate: '2013-04-21 15:12:09',
    registrationAddress: 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
    ip: '85.34.78.112',
    city: 'Istanbul',
    country: 'Turkey',
    zipCode: '34732',
  };

  const address = { ...OFFICIAL_SAMPLE_ADDRESS };

  return {
    locale: 'tr',
    conversationId: '123456789',
    price: '1',
    paidPrice: '1.2',
    currency: 'TRY',
    basketId: 'B67832',
    paymentGroup: 'PRODUCT',
    callbackUrl,
    enabledInstallments: ['2', '3', '6', '9'],
    buyer,
    shippingAddress: address,
    billingAddress: { ...address },
    basketItems: [
      {
        id: 'BI101',
        name: 'Binocular',
        category1: 'Collectibles',
        category2: 'Accessories',
        itemType: 'PHYSICAL',
        price: '0.3',
      },
      {
        id: 'BI102',
        name: 'Game code',
        category1: 'Game',
        category2: 'Online Game Items',
        itemType: 'VIRTUAL',
        price: '0.5',
      },
      {
        id: 'BI103',
        name: 'Usb',
        category1: 'Electronics',
        category2: 'Usb / Cable',
        itemType: 'PHYSICAL',
        price: '0.2',
      },
    ],
  };
}
