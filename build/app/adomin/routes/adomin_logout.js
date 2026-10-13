import User from '#models_pg/user';
export const adominLogout = async ({ auth }) => {
    const user = auth.user;
    if (!user)
        return { message: 'Au revoir !' };
    const currentToken = auth.user.currentAccessToken;
    await User.accessTokens.delete(user, currentToken.identifier);
    return { message: 'Au revoir !' };
};
//# sourceMappingURL=adomin_logout.js.map