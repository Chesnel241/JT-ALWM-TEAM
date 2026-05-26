import https from 'https';

const data = JSON.stringify({ clips: [{ filename: 'test.mp4' }] });

const req = https.request({
  hostname: 'jt-alwm-backend.onrender.com',
  path: '/api/editor/concat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', responseData));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
