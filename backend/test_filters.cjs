const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const cp = require('child_process');

try {
  const result = cp.execSync(`"${ffmpeg.path}" -f lavfi -i sine=frequency=1000:duration=1 -filter:a "afftdn=nf=-25,highpass=f=80,agate=threshold=0.04:ratio=4:attack=2:release=100,acompressor=threshold=0.1:ratio=4:attack=5:release=100,treble=g=2:f=4000,loudnorm=I=-14:TP=-1.5:LRA=11" -f null - 2>&1`);
  console.log('SUCCESS');
} catch(e) {
  console.log('FAILED');
  console.log(e.stdout ? e.stdout.toString() : '');
}
