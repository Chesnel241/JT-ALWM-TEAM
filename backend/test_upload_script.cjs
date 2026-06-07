const fs = require('fs');
const http = require('http');

const boundary = '--------------------------123456789012345678901234';
const bodyStart = Buffer.from(
  '--' + boundary + '\r\n' +
  'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n' +
  'Content-Type: text/plain\r\n\r\n' +
  'hello world\r\n' +
  '--' + boundary + '--\r\n'
);

const req = http.request({
  hostname: 'localhost',
  port: 3010, // Assuming backend is on port 3010 or 3000, let's use 3010 which is the default port in backend.log
  path: '/api/uploads/semaine-en-cours/cg?reportage=Reportage%20Assembl%C3%A9',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': bodyStart.length,
    'X-Admin-Password': 'admin'
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});

req.on('error', e => console.error(e));
req.write(bodyStart);
req.end();
