import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import crypto from 'k6/crypto';
import exec from 'k6/execution';

const BASE_URL = 'https://quickpizza.grafana.com';
const USERNAME_PREFIX = __ENV.TEST_USER_PREFIX;
const PASSWORD = __ENV.MY_PIZZA_PASSWORD;
const CSRF_TOKEN = `${randomString(20)}`;

const authenticationRate = new Rate('authentication_rate'); // caclulates a check rate based on 0's and 1's added to it
const successfulOrders = new Counter('successful_orders');

function randomString(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
}

function authParams(authToken, tags = {}) {
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
export function setup() {
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
    'http_req_duration': ['p(95) < 350'],
    'checks': ['rate > 0.9'],                              // More than 90% of checks must pass
    'iteration_duration': ['p(95) < 8000'],

    'authentication_rate': ['rate > 0.9'],
    'successful_orders': ['count > 5'],           // Count occurrences
    
    // HTTP request metrics by name tag
    'http_req_duration{name:userLogin}': ['avg < 350'], 
    'http_req_duration{name:orderCreate}': ['avg < 400'],
    'http_req_duration{name:orderRetrieve}': ['avg < 400'],

    // Group duration metrics
    'group_duration{group:::Order Management}': ['p(95) < 600'],
  },
};

export default function (data) {

  let userRegistered = false;
  let authToken = null;
  let userUathenticated = false;
  let USERNAME = `${USERNAME_PREFIX}_${randomString(10)}`;
  let orderCreated = false;
  let orderId = null;

  console.log(`User name: ${USERNAME}`);

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
      tags: {
        group: 'User Registration',
        operation: 'user-login',
        name: "userLogin"
      }
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
      authenticationRate.add(1); // Add 1 if pass
      authToken = loginResponse.json('token');
      console.log(`User Authenticated successfully: ${USERNAME}`);
    } else {
      authenticationRate.add(0); // Add 0 if pass
      console.log(`User Authenticated failed: ${USERNAME} - ${loginResponse.body}`);
    }
  });

  group('Order Management', function () {
    const createParams = authParams(CSRF_TOKEN, {name: 'orderCreate'});

    const orderPayload = {
      maxCaloriesPerSlice: 1000,
      mustBeVegetarian: true,
      excludedIngredients: [],
      excludedTools: [
        "Pizza cutter"
      ],
      maxNumberOfToppings: 9,
      minNumberOfToppings: 2,
      customName: "hello"
    };

    const orderResponse = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(orderPayload), createParams);

    orderCreated = check(orderResponse, {
      'order creation status is 200': (r) => r.status === 200,
      'order contains id': (r) => r.json('pizza.id') !== undefined,
      'order name matches': (r) => r.json('pizza.name') === orderPayload.customName
    });

    if (orderCreated) {
      successfulOrders.add(1);
      orderId = orderResponse.json('pizza.id');
      console.log(`📦 Order created successfully: ${orderId}`);
    } else {
      console.error(`❌ Order creation failed: ${orderResponse.status} - ${orderResponse.body}`);
      return; // Exit early if order creation fails
    }

    const retrieveParams = authParams(CSRF_TOKEN, {name: 'orderRetrieve'});
    const retrieveOrderResponse = http.get(`${BASE_URL}/api/pizza/${orderId}`, retrieveParams);

    const orderRetrieved = check(retrieveOrderResponse, {
      'order creation status is 200': (r) => r.status === 200,
      'order contains id': (r) => r.json('id') === orderId,
      'order name matches': (r) => r.json('name') === orderPayload.customName
    });

    if (orderRetrieved) {
      console.log(`📦 Order retrieved successfully: ${orderId}`);
    } else {
      console.error(`❌ Order retrieved failed: ${orderRetrieved.status} - ${orderRetrieved.body}`);
    }

  });

  sleep(0.5); // Simulate user think time

}
