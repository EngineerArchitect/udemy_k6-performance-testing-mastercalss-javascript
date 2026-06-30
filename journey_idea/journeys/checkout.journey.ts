// journeys/checkout.journey.ts
import { group, sleep } from 'k6';
import { login } from '../requests/auth.requests.ts';
import { getUserProfile } from '../requests/users.requests.ts';

export function checkoutJourney(baseUrl: string) {
  let authToken = '';

  // Use group() to isolate specific steps visually in k6 metrics summaries
  group('01_Login', function () {
    const loginRes = login(baseUrl, 'test_user', 'password123');
    authToken = loginRes.json('token') as string;
  });

  // Dynamic pacing/think time mimicking a real user action pause
  sleep(Math.random() * 2 + 1); 

  group('02_View Profile', function () {
    if (authToken) {
      getUserProfile(baseUrl, authToken);
    }
  });

  sleep(Math.random() * 3 + 2);
}
