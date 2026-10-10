import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actor = JSON.parse(readFileSync('.actor/actor.json', 'utf8'));
const input = JSON.parse(readFileSync('INPUT_SCHEMA.json', 'utf8'));

test('keeps public pricing and low-cost defaults aligned', () => {
    const events = actor.pricingInfo.pricingPerEvent.actorChargeEvents;
    assert.equal(events['quote-scraped'].eventPriceUsd, 0.002);
    assert.equal(events['apify-actor-start'].eventPriceUsd, 0.00005);
    assert.equal(actor.defaultRunOptions.memoryMbytes, 256);
    assert.equal(actor.defaultRunOptions.build, 'latest');
});

test('publishes the recurring watchlist controls used by the runtime', () => {
    assert.equal(input.properties.trackChanges.default, true);
    assert.equal(input.properties.monitorName.default, 'us-market-watchlist');
    assert.equal(input.properties.observationHistoryLimit.maximum, 50);
    assert.equal(input.properties.proxyConfiguration.default.useApifyProxy, false);
});
