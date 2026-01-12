export const getAverage = <T, K extends keyof T>(data: T[], key: K) => {
  return data.reduce((acc, day) => acc + +day[key], 0) / data.length;
};
