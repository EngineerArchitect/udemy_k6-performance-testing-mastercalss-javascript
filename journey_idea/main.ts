// main.ts
import { k6TestOptions } from './config/options.ts';
import { checkoutJourney } from './journeys/checkout.journey.ts';
// import { browseJourney } from './journeys/browse.journey.ts';

// 1. CRITICAL: k6 looks specifically for an exported variable named 'options'
export const options = k6TestOptions;

const BASE_URL = __ENV.BASE_URL || 'https://api.example.com';

// 2. Scenario Target A: This matches exec: 'runCheckout' from options.ts
export function runCheckout() {
  checkoutJourney(BASE_URL);
}

// 3. Scenario Target B: This matches exec: 'runBrowse' from options.ts
export function runBrowse() {
//   browseJourney(BASE_URL);
}

/*
# Run ONLY the checkout scenario, ignoring the browse flow completely
k6 run --scenario checkout_flow main.js

# Globally scale down the execution times for a quick sanity/smoke check
k6 run --duration 1m main.js
*/
