'use strict';

process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'test-key-id';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test-key-secret';

const assert = require('node:assert/strict');
const { afterEach, describe, it, mock } = require('node:test');
const Razorpay = require('razorpay');

const { Wallet } = require('../src/models');

function loadWalletService() {
  delete require.cache[require.resolve('../src/services/wallet.service')];
  return require('../src/services/wallet.service');
}

afterEach(() => {
  mock.restoreAll();
  delete require.cache[require.resolve('../src/services/wallet.service')];
});

describe('wallet-service recharge', () => {
  it('keeps Razorpay receipt values within the provider limit when creating recharge orders', async () => {
    const userId = '5256f8d9-7e9f-4d50-a2ca-13899c08d3dd';
    const walletService = loadWalletService();
    const existingWallet = {
      id: 'wallet-1',
      user_id: userId,
      currency: 'INR',
    };
    let capturedOrderPayload = null;

    mock.method(Wallet, 'findOne', async ({ where }) => {
      assert.equal(where.user_id, userId);
      return existingWallet;
    });
    mock.method(Wallet, 'create', async () => {
      throw new Error('Wallet.create should not be called when the wallet already exists');
    });
    mock.method(Razorpay.prototype, 'addResources', function addResources() {
      this.orders = {
        create: async (payload) => {
          capturedOrderPayload = payload;
          return {
            id: 'order_1',
            amount: payload.amount,
            currency: payload.currency,
          };
        },
      };
    });

    const result = await walletService.initiateRecharge(userId, 50000);

    assert.ok(capturedOrderPayload);
    assert.equal(capturedOrderPayload.currency, 'INR');
    assert.equal(capturedOrderPayload.notes.user_id, userId);
    assert.equal(capturedOrderPayload.notes.wallet_id, 'wallet-1');
    assert.match(capturedOrderPayload.receipt, /^wallet_/);
    assert.ok(capturedOrderPayload.receipt.length <= 40);
    assert.equal(result.order_id, 'order_1');
    assert.equal(result.amount, capturedOrderPayload.amount);
    assert.equal(result.wallet_id, 'wallet-1');
  });
});
