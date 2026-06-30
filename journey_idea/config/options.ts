export const k6TestOptions = {
  scenarios: {
    // Scenario A: Simulates user checkout flows with ramping load
    checkout_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },  // Ramp up
        { duration: '10m', target: 50 }, // Sustain/Soak
        { duration: '2m', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'runCheckout', // Matches the exported function name in main.ts
    },
    // Scenario B: Simulates persistent background catalog browsing
    browse_flow: {
      executor: 'constant-vus',
      vus: 100,
      duration: '14m',
      exec: 'runBrowse', // Matches the exported function name in main.ts
    },
  },
  
  // Global performance quality gates (Pass/Fail criteria for your pipeline)
  thresholds: {
    http_req_failed: ['rate<0.01'],      // Error rate must be under 1%
    http_req_duration: ['p(95)<500'],    // 95% of requests must respond under 500ms
    'http_req_duration{scenario:checkout_flow}': ['p(95)<800'], // Stricter custom SLA for checkout
  },
};