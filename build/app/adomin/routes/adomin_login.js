import vine, { SimpleMessagesProvider } from '@vinejs/vine';
import { DEFAULT_MESSAGE_PROVIDER_CONFIG } from '#adomin/validation/default_validator';
import User from '#models_pg/user';
const loginSchema = vine.compile(vine.object({
    email: vine.string().trim(),
    password: vine.string().trim(),
}));
const messagesProvider = new SimpleMessagesProvider(DEFAULT_MESSAGE_PROVIDER_CONFIG, {
    password: 'mot de passe',
});
export const adominLogin = async ({ request }) => {
    const { email, password } = await request.validateUsing(loginSchema, { messagesProvider });
    const user = await User.verifyCredentials(email, password);
    const token = await User.accessTokens.create(user);
    return token;
};
//# sourceMappingURL=adomin_login.js.map