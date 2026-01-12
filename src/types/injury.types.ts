export type APIInjuryZone =
  | "head"
  | "zone_1"
  | "zone_1a"
  | "zone_1b"
  | "zone_2"
  | "zone_2a"
  | "zone_2b"
  | "zone_3"
  | "zone_3a"
  | "zone_3b"
  | "zone_4"
  | "zone_4a"
  | "zone_4b"
  | "zone_5a"
  | "zone_5b"
  | "zone_6a"
  | "zone_6b";

export interface ZoneType {
  id: number;
  side: "front" | "back";
  name: APIInjuryZone;
}

export interface InjuryType {
  id: number;
  nameFr: string;
  nameEn: string;
  category: {
    id: number;
    nameFr: string;
    nameEn: string;
    zone: ZoneType;
  };
}

export interface APIInjury {
  id: number;
  dateOfInjury: string;
  levelOfPainToday: number;
  injuryType: InjuryType;
}

export interface APIDiscomfort {
  id: number;
  dateOfDiscomfort: string | null;
  levelOfPainToday: number | null;
  during: "activity" | "always" | null;
  locationId: number;
  location: {
    id: number;
    nameFr: string;
    nameEn: string;
    zoneId: number;
    zone: ZoneType;
  };
}

export type Pain = {
  dateOfDiscomfort: string;
  during: "always" | "activity" | "rest";
  levelOfPainToday: number;
  location: string;
  zone: ZoneType;
};

export type MannequinDisplayType = "physicalPains" | "injuryHistory";
