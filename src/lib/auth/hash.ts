import argon2 from 'argon2';

export async function hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    try {
        return await argon2.verify(hash, plain);
    } catch {
        return false;
    }
}
