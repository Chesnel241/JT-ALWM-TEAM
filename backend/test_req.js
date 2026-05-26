import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/editor/concat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-App-Password': 'test'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data));
});

req.on('error', e => console.error(e));
req.write(JSON.stringify({ clips: [{ filename: 'test.mp4' }] }));
req.end();
