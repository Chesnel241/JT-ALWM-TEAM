const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg('input.webm')
  .audioFilters('highpass=f=80,acompressor=threshold=0.1:ratio=4:attack=5:release=100,treble=g=2:f=4000,loudnorm=I=-14:TP=-1.5:LRA=11')
  .outputOptions('-b:a', '192k')
  .toFormat('mp3')
  .on('start', console.log)
  .on('end', () => console.log('Done'))
  .on('error', console.error)
  .save('output.mp3');
