import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. Define your test configurations & performance goals
export const options = {
  vus: 1,           // Number of concurrent virtual users
  duration: '5s',   // Test execution window duration
  thresholds: {
    http_req_failed: ['rate<0.01'], // Fail test if error rate exceeds 1%
    "http_req_duration": ["p(90)<3000", "p(95)<4000"],
    "checks": ["rate>0.90"],
  },
};

export default function () {
  const url = 'https://www.libraryinformationsystem.org/Services/SoapService.svc';

  // The precise XML envelope payload payload text string matching your request
  const payload = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://www.inflectra.com/LibraryInformationSystem/Services/">
   <soapenv:Header/>
   <soapenv:Body>
      <ser:Connection_Authenticate>
         <ser:userName>XXXXX</ser:userName>
         <ser:password>XXXXX</ser:password>
      </ser:Connection_Authenticate>
   </soapenv:Body>
</soapenv:Envelope>`;

  // 2. Map mandatory HTTP content and Action headers explicitly
  const params = {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"http://www.inflectra.com/LibraryInformationSystem/Services/ISoapService/Connection_Authenticate"',
    },
  };

  // 3. Fire the execution payload
  const response = http.post(url, payload, params);

  // 4. Validate response data integrity
  check(response, {
    'status is 200': (r) => r.status === 200,
    'body contains LoginResult': (r) => r.body.includes('Connection_AuthenticateResult') || r.body.includes('true'),
  });

  sleep(1); // Introduce a slight pacing delay between execution cycles
}