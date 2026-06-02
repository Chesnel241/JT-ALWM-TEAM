const fs = require('fs');
const path = require('path');

const patches = [
  'C:\\Users\\ekogh\\.gemini\\antigravity\\brain\\2d437e88-fee5-45d9-9cf8-9c8060afd776\\patch_package.json',
  'C:\\Users\\ekogh\\.gemini\\antigravity\\brain\\2d437e88-fee5-45d9-9cf8-9c8060afd776\\patch_uploads.json',
  'C:\\Users\\ekogh\\.gemini\\antigravity\\brain\\2d437e88-fee5-45d9-9cf8-9c8060afd776\\patch_store.json'
];

for (const p of patches) {
  const patchContent = JSON.parse(fs.readFileSync(p, 'utf8'));
  const targetFile = path.resolve('C:\\Users\\ekogh\\Downloads\\JT-ALWM-TEAM-master', patchContent.TargetFile);
  let fileContent = fs.readFileSync(targetFile, 'utf8');

  // We need to apply chunks from bottom to top (highest line number first) to not break offsets if we were using line numbers.
  // But wait, the json gives TargetContent, so we can just replace that string exactly.
  // Let's iterate and replace.
  for (const chunk of patchContent.ReplacementChunks) {
    if (fileContent.includes(chunk.TargetContent)) {
      fileContent = fileContent.replace(chunk.TargetContent, chunk.ReplacementContent);
      console.log(`Successfully replaced chunk in ${patchContent.TargetFile}`);
    } else {
      console.error(`Failed to find TargetContent in ${patchContent.TargetFile}`);
      console.error(`TARGET: ${chunk.TargetContent.substring(0, 50)}...`);
    }
  }

  fs.writeFileSync(targetFile, fileContent, 'utf8');
}
