import { check } from 'k6';
import { browser } from 'k6/browser'
import http from 'k6/http';

const BROWSER_USER = __ENV.BROWSER_USER;
const BROWSER_PASSWORD = __ENV.BROWSER_PASSWORD;
const GREEN_TICK = `\x1b[32m✔\x1b[0m`;

export const options = {
    scenarios: {
        ui: {
            executor: 'shared-iterations',
            exec: 'browserTest',
            vus: 2,
            maxDuration: '1m',
            iterations: 3,
            options: {
                browser: {
                    type: 'chromium',
                    headless: false
                },
            },
        },

        backEndStress: {
            executor: 'constant-vus',
            exec: 'backEndStress',
            vus: 10,
            duration: '1m'
        }
    },

    thresholds: {
        checks: ['rate == 1.0'],

        // Core Web Vitals
        'browser_web_vital_fcp': ['p(95)<2100'],    // First Content
        'browser_web_vital_lcp': ['p(95)<2500'],    // Main Content
        'browser_web_vital_cls': ['p(95)<0.1'],     // Layout stability
        'browser_web_vital_ttfb': ['p(95)<3000'],    // Server response

        // Additional metrics
        'browser_web_vital_inp': ['p(95)<200'],     // Input responsiveness
        'browser_http_req_duration' : ['p(95)<3000'],   // Overall Page load
    }
};

export function setup() {

  if (!BROWSER_USER) {
    console.log("setup .env file and run using: \x1b[32m'npm run browser-test'\x1b[0m");
    exec.test.abort('Startup check failed: BROWSER_USER environment variable is not set.');
  }

  if (!BROWSER_PASSWORD) {
    exec.test.abort('Startup check failed: BROWSER_PASSWORD environment variable is not set.');
  }

  console.log('Startup checks passed!');
  return { checkStatus: 'success' };
}

export async function browserTest() {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Use sectorshub browser plugin to make life easier
    await page.goto("https://rahulshettyacademy.com/locatorspractice/");

    console.log('🔒 Filled in credentials...');
    await page.locator("#inputUsername").type(`${BROWSER_USER}`);
    await page.locator("input[placeholder='Password']").type(`${BROWSER_PASSWORD}`);

    console.log('⏳ Attempting to submit form...')
    await page.locator("button[type='submit']").click();

    console.log(`${GREEN_TICK} Navigation completed successfully`);
    await page.waitForTimeout(2000);

    console.log('⏳ Extracting header text...')
    const headerText = await page.locator('h1').first().textContent();
    console.log(`Header Text: ${headerText}`);

    check(headerText, {
        header: (text) => text.includes('Rahul Shetty Academy')
    })

    await page.close();
}

export async function backEndStress() {
    const resp = http.get("https://rahulshettyacademy.com/locatorspractice/");

    check(resp, {
        'status is 200': (r) => r.status === 200
    });
}