import FitParser from 'fit-file-parser';
import axios from 'axios';
import { DateTime } from 'luxon';
import { DATA_TYPE, SERIE_TYPE } from '#constants/serie.constants';
import { encodeFlatTimestampPairs } from '#utils/series';
import { isNil } from '#utils/boolean';
import logger from '@adonisjs/core/services/logger';
const isValidLatitude = (value) => value >= -90 && value <= 90;
const isValidLongitude = (value) => value >= -180 && value <= 180;
const toFiniteNumber = (value) => {
    if (isNil(value))
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};
const toUnixSeconds = (timestamp) => {
    if (isNil(timestamp))
        return undefined;
    if (typeof timestamp === 'number') {
        return timestamp > 1e12 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
    }
    if (timestamp instanceof Date) {
        const ms = timestamp.getTime();
        return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
    }
    const dt = DateTime.fromISO(timestamp, { setZone: true });
    if (dt.isValid)
        return Math.floor(dt.toSeconds());
    const ms = Date.parse(timestamp);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
};
export const mapFitRecordToSample = (record) => {
    const timestampSeconds = toUnixSeconds(record.timestamp);
    if (timestampSeconds === undefined)
        return null;
    const latitude = toFiniteNumber(record.position_lat);
    const longitude = toFiniteNumber(record.position_long);
    const hasValidGps = latitude !== undefined &&
        longitude !== undefined &&
        isValidLatitude(latitude) &&
        isValidLongitude(longitude) &&
        !(latitude === 0 && longitude === 0);
    return {
        timestampSeconds,
        elevationInMeters: toFiniteNumber(record.enhanced_altitude ?? record.altitude),
        heartRate: toFiniteNumber(record.heart_rate),
        speedMetersPerSecond: toFiniteNumber(record.enhanced_speed ?? record.speed),
        totalDistanceInMeters: toFiniteNumber(record.distance),
        powerInWatts: toFiniteNumber(record.power),
        bikeCadenceInRPM: toFiniteNumber(record.cadence),
        airTemperatureCelcius: toFiniteNumber(record.temperature),
        latitude: hasValidGps ? latitude : undefined,
        longitude: hasValidGps ? longitude : undefined,
    };
};
export const parseFitBufferToSamples = async (content) => {
    const fitParser = new FitParser({
        force: true,
        speedUnit: 'm/s',
        lengthUnit: 'm',
        temperatureUnit: 'celsius',
        mode: 'list',
    });
    const parsed = await fitParser.parseAsync(content);
    const records = (parsed.records ?? []);
    return records
        .map(mapFitRecordToSample)
        .filter((sample) => sample !== null);
};
export const downloadFitFile = async (fitUrl) => {
    const { data } = await axios.get(fitUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
    });
    return Buffer.from(data);
};
export const downloadAndParseFitSamples = async (fitUrl) => {
    try {
        const buffer = await downloadFitFile(fitUrl);
        return await parseFitBufferToSamples(buffer);
    }
    catch (error) {
        logger.warn({ err: error, fitUrl }, 'Failed to download/parse FIT file');
        return [];
    }
};
const buildPairs = (samples, selector) => {
    return samples.flatMap((sample) => {
        const value = selector(sample);
        if (isNil(value) || !Number.isFinite(value))
            return [];
        return [sample.timestampSeconds, value];
    });
};
export const buildSeriesFromFitSamples = (samples) => {
    if (samples.length === 0)
        return [];
    const seriesConfigs = [
        {
            type: SERIE_TYPE.ELEVATION_IN_METERS,
            data: buildPairs(samples, (s) => s.elevationInMeters),
            dataType: DATA_TYPE.FLOAT,
        },
        {
            type: SERIE_TYPE.AIR_TEMPERATURE_CELSIUS,
            data: buildPairs(samples, (s) => s.airTemperatureCelcius),
            dataType: DATA_TYPE.FLOAT,
        },
        {
            type: SERIE_TYPE.HEART_RATE,
            data: buildPairs(samples, (s) => s.heartRate),
            dataType: DATA_TYPE.UNSIGNED,
        },
        {
            type: SERIE_TYPE.SPEED_METERS_PER_SECOND,
            data: buildPairs(samples, (s) => s.speedMetersPerSecond),
            dataType: DATA_TYPE.FLOAT,
        },
        {
            type: SERIE_TYPE.TOTAL_DISTANCE_IN_METERS,
            data: buildPairs(samples, (s) => s.totalDistanceInMeters),
            dataType: DATA_TYPE.FLOAT,
        },
        {
            type: SERIE_TYPE.POWER_IN_WATTS,
            data: buildPairs(samples, (s) => s.powerInWatts),
            dataType: DATA_TYPE.FLOAT,
        },
        {
            type: SERIE_TYPE.BIKE_CADENCE_IN_RPM,
            data: buildPairs(samples, (s) => s.bikeCadenceInRPM),
            dataType: DATA_TYPE.FLOAT,
        },
        {
            type: SERIE_TYPE.LATITUDE,
            data: buildPairs(samples, (s) => s.latitude),
            dataType: DATA_TYPE.FLOAT,
        },
        {
            type: SERIE_TYPE.LONGITUDE,
            data: buildPairs(samples, (s) => s.longitude),
            dataType: DATA_TYPE.FLOAT,
        },
    ];
    return seriesConfigs
        .filter((config) => config.data.length > 0)
        .map((serie) => ({
        type: serie.type,
        dataEncoded: encodeFlatTimestampPairs(serie.data, serie.type),
        dataType: serie.dataType,
    }));
};
//# sourceMappingURL=fit.js.map