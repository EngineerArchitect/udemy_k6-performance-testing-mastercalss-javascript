import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const pizzaWaitingTrend = new Trend('waiting_time_pizza');
const pizzaRequestTrend = new Trend('request_time_pizza');
const apiWaitingTrend = new Trend('waiting_time_api');

export const options = {

    stages: [
        { duration: '1s', target: 2 },  // Ramp up to 2 VU over 4 seconds
        { duration: '2s', target: 2 },  // Ramps up from 2 VUs to 5 VUs over 5 seconds
        { duration: '1s', target: 0 },  // Ramp down to 0 VU over 3 seconds
    ],

    thresholds: {
        http_req_duration: ['p(95) < 400'],
        http_req_failed: ['rate < 0.1'],
        checks: ['rate > 0.9'],                              // More than 90% of checks must pass
        'http_req_duration{name:QuickPizza}': ['avg < 400'], // Average response time should be less than 400ms
        'http_req_duration{name:API}': ['avg < 300'],        // Average response time should be less than 300ms
        'http_req_failed{name:API}': ['rate < 0.1'],         // Failure rate should be less than 10%
        'waiting_time_pizza': ['p(95) < 400'],               // Average response time for pizza requests should be less than 400ms
        'request_time_pizza': ['p(95) < 400'],               // Average request time for pizza requests should be less than 400ms
        'waiting_time_api': ['p(95) < 400'],                 // Average response time for API requests should be less than 400ms
    },

};

export default function test1() {
    const response = http.get("https://quickpizza.grafana.com", {
        tags: { name: "QuickPizza" }, // Add a custom tag to the request
    });

    // Track the waiting metric
    pizzaWaitingTrend.add(response.timings.waiting);

    // Track the request metric
    pizzaRequestTrend.add(response.timings.sending);

    check(response, {
        'status is 200': (r) => r.status === 200,
        // 'page contains pizza': (r) => r.body.includes("pizza"),
    });

    const apiResponse = http.get("https://quickpizza.grafana.com/api/quotes", {
        tags: { name: "API" }, // Add a custom tag to the request
    });

    // Track the waiting metric for the API
    apiWaitingTrend.add(apiResponse.timings.waiting);

    sleep(1);
}