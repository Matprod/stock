import { TypeSafeClient, choice, noul } from '@typesafe-ai/sdk';
import env from '#start/env';
export { TypeSafeClient, choice, noul };
let client;
export default class JevService {
    static getClient() {
        const apiKey = env.get('TYPESAFE_API_KEY');
        if (!apiKey)
            return undefined;
        client ??= new TypeSafeClient({ apiKey });
        return client;
    }
    static requireClient() {
        const resolved = JevService.getClient();
        if (!resolved)
            throw new Error('TYPESAFE_API_KEY missing');
        return resolved;
    }
    static isAvailable() {
        return Boolean(env.get('TYPESAFE_API_KEY'));
    }
}
//# sourceMappingURL=jev_service.js.map