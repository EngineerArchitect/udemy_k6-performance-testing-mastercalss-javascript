import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import crypto from 'k6/crypto';
import exec from 'k6/execution';

// Type definitions
interface AuthParams {
  headers: {
    'Content-Type': string;
    'Authorization'?: string;
    'Cookie': string;
  };
  tags?: {
    [key: string]: string;
  };
}

interface OrderPayload {
  maxCaloriesPerSlice: number;
  mustBeVegetarian: boolean;
  excludedIngredients: string[];
  excludedTools: string[];
  maxNumberOfToppings: number;
  minNumberOfToppings: number;
  customName: string;
}

interface PizzaResponse {
  pizza: {
    id: string;
    name: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface SetupResponse {
  checkStatus: string;
}

// Constants
const BASE_URL: string = 'https://quickpizza.grafana.com';
const USERNAME_PREFIX: string = __ENV.TEST_USER_PREFIX || '';
const PASSWORD: string = __ENV.MY_PIZZA_PASSWORD || '';
const CSRF_TOKEN: string = randomString(20);

// Metrics
const authenticationRate = new Rate('authentication_rate');
const successfulOrders = new Counter('successful_orders');

/**
 * Generates a random string of specified length
 * @param length - The length of the random string to generate
 * @returns A random alphanumeric string
 */
function randomString(length: number): string {
  const charset: string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
}

/**
 * Creates authentication parameters for API requests
 * @param authToken - The authentication token
 * @param tags - Optional tags for metrics
 * @returns Authentication parameters object
 */
function authParams(authToken: string, tags: { [key: string]: string } = {}): AuthParams {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Cookie': `csrf_token=${CSRF_TOKEN};`,
    },
    tags: {
      ...tags
    }
  };
}

/**
 * Performs startup validation and health checks
 * @returns JavaScript Object Literal with checkstatus
 */
export function setup(): SetupResponse {
  if (!PASSWORD) {
    exec.test.abort('Startup check failed: PASSWORD environment variable is not set.');
  }

  if (!USERNAME_PREFIX) {
    exec.test.abort('Startup check failed: TEST_USER_PREFIX environment variable is not set.');
  }

  console.log('Startup checks passed!');
  return { checkStatus: 'success' };
}

export const options = {
  stages: [
    { duration: '5s', target: 2 },
    { duration: '5s', target: 4 },
    { duration: '3s', target: 0 },
  ],

  thresholds: {
    'http_req_duration': ['p(95) < 400'],
    'checks': ['rate > 0.9'],
    'iteration_duration': ['p(95) < 8000'],

    'authentication_rate': ['rate > 0.9'],
    'successful_orders': ['count > 5'],

    'http_req_duration{name:userLogin}': ['avg < 400'],
    'http_req_duration{name:orderCreate}': ['avg < 400'],
    'http_req_duration{name:orderRetrieve}': ['avg < 400'],

    'group_duration{group:::Order Management}': ['p(95) < 600'],
  },
};

export default function (data: SetupResponse): void {
  let userRegistered: boolean = false;
  let authToken: string | null = null;
  let userAuthenticated: boolean = false;
  const USERNAME: string = `${USERNAME_PREFIX}_${randomString(10)}`;
  let orderCreated: boolean = false;
  let orderId: string | null = null;

  console.log(`User name: ${USERNAME}`);

  group('User Registration', function (): void {
    const registerPayload: string = JSON.stringify({
      username: USERNAME,
      password: PASSWORD
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `csrf_token=${CSRF_TOKEN};`,
      },
      tags: {
        group: 'User Registration',
        operation: 'user-login',
        name: 'userLogin'
      }
    };

    const regResponse = http.post(`${BASE_URL}/api/users`, registerPayload, params);

    userRegistered = check(regResponse, {
      'registration status is 201': (r) => r.status === 201,
    });

    if (!userRegistered) {
      console.error(`User registration failed with status ${regResponse.status} - ${regResponse.body}`);
    } else {
      console.log(`User registered successfully with status ${regResponse.status}`);
      console.log(`user body: ${regResponse.body}`);
    }
  });

  group('User Login', function (): void {
    const baseLoginUrl: string = `${BASE_URL}/api/users/token/login`;
    const queryParams: string = 'set_cookie=true';
    const loginUrl: string = `${baseLoginUrl}?${queryParams}`;

    const loginPayload: string = JSON.stringify({
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

    const loginResponse = http.post(loginUrl, loginPayload, loginParams);

    userAuthenticated = check(loginResponse, {
      'login status is 200': (response) => response.status === 200,
      'login response contains token': (response) => response.json('token') !== undefined,
      'token is valid string': (response) => (response.json('token') as string)?.length > 4,
    });

    if (userAuthenticated) {
      authenticationRate.add(1);
      authToken = loginResponse.json('token') as string;
      console.log(`User Authenticated successfully: ${USERNAME}`);
    } else {
      authenticationRate.add(0);
      console.log(`User Authenticated failed: ${USERNAME} - ${loginResponse.body}`);
    }
  });

  group('Order Management', function (): void {
    const createParams = authParams(CSRF_TOKEN, { name: 'orderCreate' });

    const orderPayload: OrderPayload = {
      maxCaloriesPerSlice: 1000,
      mustBeVegetarian: true,
      excludedIngredients: [],
      excludedTools: [
        'Pizza cutter'
      ],
      maxNumberOfToppings: 9,
      minNumberOfToppings: 2,
      customName: 'hello'
    };

    const orderResponse = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(orderPayload), createParams);

    orderCreated = check(orderResponse, {
      'order creation status is 200': (r) => r.status === 200,
      'order contains id': (r) => (r.json() as PizzaResponse).pizza?.id !== undefined,
      'order name matches': (r) => (r.json() as PizzaResponse).pizza?.name === orderPayload.customName
    });

    if (orderCreated) {
      successfulOrders.add(1);
      const responseJson = orderResponse.json() as PizzaResponse;
      orderId = responseJson.pizza?.id || null;
      console.log(`📦 Order created successfully: ${orderId}`);
    } else {
      console.error(`❌ Order creation failed: ${orderResponse.status} - ${orderResponse.body}`);
      return;
    }

    const retrieveParams = authParams(CSRF_TOKEN, { name: 'orderRetrieve' });
    const retrieveOrderResponse = http.get(`${BASE_URL}/api/pizza/${orderId}`, retrieveParams);

    const orderRetrieved = check(retrieveOrderResponse, {
      'order creation status is 200': (r) => r.status === 200,
      'order contains id': (r) => (r.json() as { id: string }).id === orderId,
      'order name matches': (r) => (r.json() as { name: string }).name === orderPayload.customName
    });

    if (orderRetrieved) {
      console.log(`📦 Order retrieved successfully: ${orderId}`);
    } else {
      console.error(`❌ Order retrieval failed: ${retrieveOrderResponse.status} - ${retrieveOrderResponse.body}`);
    }
  });

  sleep(0.5);
}