import * as crypto from 'crypto';

const key = crypto.randomBytes(32).toString('hex'); // 256-bit key = 32 bytes
const iv = crypto.randomBytes(16).toString('hex');  // 128-bit IV = 16 bytes

console.log('AES_KEY=' + key);
console.log('AES_IV=' + iv);