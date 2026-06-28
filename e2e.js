import http from 'k6/http';
import exec from 'k6/execution';
import { check, group, sleep} from 'k6';
import crypto from 'k6/crypto';

const BASE_URL = 'https://quickpizza.grafana.com';
const PASSWORD = __ENV.MY_PIZZA_PASSWORD;
const CSRF_TOKEN = __ENV.MY_CSRF_TOKEN;

/**
 * Utility function for creating randome string
 */
function randomString(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
}

export const options = {
  vus: 2, // Number of virtual users
  duration: '2s', // Test duration
};

/**
 * Performs startup validation and health checks
 * @returns JavaScript Object Literal with checkstatus
 */
export function setup() {
  if (!PASSWORD) {
    exec.test.abort('Startup check failed: PASSWORD environment variable is not set.');
  }

  if (!CSRF_TOKEN) {
    exec.test.abort('Startup check failed: CSRF_TOKEN environment variable is not set.');
  }

  console.log('Startup checks passed!');
  return { checkStatus: 'success' };
}

export default function (data) {

  let userRegistered = false;
  let authToken = null;
  let userUathenticated = false;
  let USERNAME = `user_${randomString(10)}`;

  group('User Registration', function () {


    const registerPayload = JSON.stringify({
      username: USERNAME,
      password: PASSWORD
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `csrf_token=${CSRF_TOKEN};`,
      },
    };

    const regResponse = http.post(`${BASE_URL}/api/users`, registerPayload, params);

    userRegistered = check(regResponse, {
      'registration status is 201': (r) => r.status === 201,
    });

    if (!userRegistered) {
      console.error(`User registration failed with status ${regResponse.status} - ${regResponse.body}`);

      // const authToken = regResponse.json('token');
    } else {
      console.log(`User registered successfully with status ${regResponse.status}`);
      console.log(`user body: ${regResponse.body}`);
    }
  });

  group('User Login', function () {

    const baseLoginUrl = `${BASE_URL}/api/users/token/login`;
    const queryParams = 'set_cookie=true';
    const loginUrl = `${baseLoginUrl}?${queryParams}`;

    const loginPayload = JSON.stringify({
      username: USERNAME,
      password: PASSWORD,
      csrf: CSRF_TOKEN
    });

    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `csrf_token=${CSRF_TOKEN};`,
      },
    };

    const loginResponse = http.post(`${loginUrl}`, loginPayload, loginParams);

    userUathenticated = check(loginResponse, {
      'login status is 200': (response) => response.status === 200,
      'login response contains token': (response) => response.json('token') !== undefined,
      'token is valid string': (response) => response.json('token').length > 4,
    });

    if (userUathenticated) {
      authToken = loginResponse.json('token');
      console.log(`User Authenticated successfully: ${USERNAME}`);
    } else {
      console.log(`User Authenticated failed: ${USERNAME} - ${loginResponse.body}`);
    }

  });

  sleep(1); // Simulate user think time

}
