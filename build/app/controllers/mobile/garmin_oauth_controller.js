import env from '#start/env';
import axios from 'axios';
import crypto from 'node:crypto';
import AthleteService from '#services/athlete_service';
import AthleteProvider from '#models_pg/athlete_provider';
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import { garminTokenQuerySchema } from '#schemas/mobile/garmin';
import { GarminService } from '#services/garmin_service';
function percentEncode(str) {
    return encodeURIComponent(str)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
}
function generateOAuthSignature(method, url, params, oauthParams, consumerSecret, tokenSecret) {
    const allParams = { ...params, ...oauthParams };
    const sortedKeys = Object.keys(allParams).sort();
    const normalizedParams = sortedKeys
        .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
        .join('&');
    const signatureBaseString = [
        method.toUpperCase(),
        percentEncode(url),
        percentEncode(normalizedParams),
    ].join('&');
    const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
    return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
}
function buildOAuthHeader(method, url, params, consumerKey, consumerSecret, token, tokenSecret, extraOauthParams = {}) {
    const oauthParams = {
        oauth_consumer_key: consumerKey,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_version: '1.0',
        ...extraOauthParams,
    };
    if (token)
        oauthParams.oauth_token = token;
    oauthParams.oauth_signature = generateOAuthSignature(method, url, params, oauthParams, consumerSecret, tokenSecret);
    return ('OAuth ' +
        Object.keys(oauthParams)
            .sort()
            .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
            .join(', '));
}
function parseOAuthTokenResponse(body) {
    const params = new URLSearchParams(body);
    const out = {};
    for (const [k, v] of params.entries())
        out[k] = v;
    return out;
}
export default class GarminOauthController {
    athleteService;
    garminService;
    constructor() {
        this.athleteService = new AthleteService();
        this.garminService = new GarminService();
    }
    async authorize({ response }) {
        try {
            const consumerKey = env.get('GARMIN_CONSUMER_KEY');
            const consumerSecret = env.get('GARMIN_CONSUMER_SECRET');
            const requestTokenUrl = 'https://connectapi.garmin.com/oauth-service/oauth/request_token';
            const authHeader = buildOAuthHeader('POST', requestTokenUrl, {}, consumerKey, consumerSecret, null, '', { oauth_callback: 'oob' });
            const tokenRes = await axios.post(requestTokenUrl, null, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                responseType: 'text',
            });
            const tokenData = parseOAuthTokenResponse(String(tokenRes.data));
            const request_token = tokenData.oauth_token;
            const request_token_secret = tokenData.oauth_token_secret;
            if (!request_token || !request_token_secret) {
                return response.internalServerError({ message: 'Failed to fetch request token', tokenData });
            }
            const authorization_url = `https://connect.garmin.com/oauthConfirm?oauth_token=${encodeURIComponent(request_token)}`;
            return response.json({
                authorization_url,
                request_token,
                request_token_secret,
            });
        }
        catch (e) {
            console.error('GarminOauthController.authorize error', e);
            return response.internalServerError({
                message: e instanceof Error ? e.message : 'An error occurred.',
            });
        }
    }
    async token({ request, response, athlete }) {
        try {
            const { request_token, request_token_secret, code } = await garminTokenQuerySchema.validate(request.qs());
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord)
                return response.notFound({ message: 'Athlete not found' });
            const consumerKey = env.get('GARMIN_CONSUMER_KEY');
            const consumerSecret = env.get('GARMIN_CONSUMER_SECRET');
            const accessTokenUrl = 'https://connectapi.garmin.com/oauth-service/oauth/access_token';
            const authHeader = buildOAuthHeader('POST', accessTokenUrl, {}, consumerKey, consumerSecret, request_token, request_token_secret, { oauth_verifier: code });
            const tokenRes = await axios.post(accessTokenUrl, null, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                responseType: 'text',
            });
            const tokenData = parseOAuthTokenResponse(String(tokenRes.data));
            const access_token = tokenData.oauth_token;
            const access_token_secret = tokenData.oauth_token_secret;
            if (!access_token || !access_token_secret) {
                return response.internalServerError({ message: 'Failed to fetch access token', tokenData });
            }
            const userIdUrl = 'https://apis.garmin.com/wellness-api/rest/user/id';
            const userIdHeader = buildOAuthHeader('GET', userIdUrl, {}, consumerKey, consumerSecret, access_token, access_token_secret);
            const userIdRes = await axios.get(userIdUrl, {
                headers: { 'Authorization': userIdHeader, 'Content-Type': 'application/json' },
            });
            const garmin_user_id = userIdRes.status === 200 ? (userIdRes.data?.userId ?? null) : null;
            const details = (await AthleteProvider.query()
                .where('athleteId', athleteRecord.id)
                .where('provider', ATHLETE_PROVIDER_TYPES.GARMIN)
                .first()) ??
                (await AthleteProvider.create({
                    athleteId: athleteRecord.id,
                    provider: ATHLETE_PROVIDER_TYPES.GARMIN,
                }));
            details.accessToken = access_token;
            details.accessTokenSecret = access_token_secret;
            details.providerAthleteId = garmin_user_id;
            await details.save();
            if (garmin_user_id) {
                try {
                    await Promise.all([
                        this.garminService.backfillActivities(garmin_user_id),
                        this.garminService.backfillSleeps(garmin_user_id),
                    ]);
                }
                catch (e) {
                    console.error('Backfill after Garmin connection failed (non-blocking)', e);
                }
            }
            return response.json({
                access_token,
                access_token_secret,
                garmin_user_id,
            });
        }
        catch (e) {
            console.error('GarminOauthController.token error', e);
            return response.internalServerError({
                message: e instanceof Error ? e.message : 'An error occurred.',
            });
        }
    }
    async disconnect({ response, athlete }) {
        try {
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord)
                return response.notFound({ message: 'Athlete not found' });
            const garminProvider = await AthleteProvider.query()
                .where('athleteId', athleteRecord.id)
                .where('provider', ATHLETE_PROVIDER_TYPES.GARMIN)
                .first();
            if (garminProvider) {
                await garminProvider.delete();
            }
            return response.json({ message: 'Garmin disconnected successfully' });
        }
        catch (e) {
            console.error('GarminOauthController.disconnect error', e);
            return response.internalServerError({
                message: e instanceof Error ? e.message : 'An error occurred.',
            });
        }
    }
}
//# sourceMappingURL=garmin_oauth_controller.js.map