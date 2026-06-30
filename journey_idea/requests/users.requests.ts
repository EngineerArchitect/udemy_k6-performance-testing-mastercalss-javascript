// requests/users.requests.ts
import http from 'k6/http';
import { check } from 'k6';

export function getUserProfile(baseUrl: string, token: string) {
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  };

  const res = http.get(`${baseUrl}/users/profile`, params);

  // Best Practice: Always attach a basic check to individual requests
  check(res, {
    'get profile status is 200': (r) => r.status === 200,
    'profile body has data': (r) => r.json('data') !== undefined,
  });

  return res;
}