import { Langfuse } from 'langfuse';
import env from '#start/env';
const langfuse = new Langfuse({
    secretKey: env.get('LANGFUSE_SECRET_KEY'),
    publicKey: env.get('LANGFUSE_PUBLIC_KEY'),
    baseUrl: env.get('LANGFUSE_HOST'),
});
export default langfuse;
//# sourceMappingURL=langfuse_client.js.map