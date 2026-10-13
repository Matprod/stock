import crypto from 'crypto';
export function verifyDjangoPassword(plainPassword, djangoHash) {
    const [algorithm, iterationsStr, salt, hash] = djangoHash.split('$');
    if (algorithm !== 'pbkdf2_sha256') {
        throw new Error('Unsupported algorithm');
    }
    const iterations = parseInt(iterationsStr, 10);
    const derivedKey = crypto.pbkdf2Sync(plainPassword, salt, iterations, 32, 'sha256');
    const computedHash = derivedKey.toString('base64');
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
}
//# sourceMappingURL=verifiy_django_password.js.map