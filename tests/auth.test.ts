import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/hash';

describe('Auth – password hashing', () => {
    it('hashes and verifies a password correctly', async () => {
        const password = 'SuperSecret123!';
        const hash = await hashPassword(password);

        expect(hash).not.toBe(password);
        expect(hash.length).toBeGreaterThan(20);

        const isValid = await verifyPassword(password, hash);
        expect(isValid).toBe(true);
    });

    it('fails to verify an incorrect password', async () => {
        const password = 'correct_pass';
        const hash = await hashPassword(password);

        const isValid = await verifyPassword('wrong_pass', hash);
        expect(isValid).toBe(false);
    });

    it('returns false for invalid hash formats', async () => {
        const isValid = await verifyPassword('pass', 'not-a-hash');
        expect(isValid).toBe(false);
    });
});
