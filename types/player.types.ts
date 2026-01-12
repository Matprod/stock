import type { APIDiscomfort, APIInjuryZone } from "./injury.types";
import type { INote } from "./notes";
import type { IFile } from "./file.type";
import type { APIDay } from "./day.types";

export type Optional<T> = T | null | undefined;

export interface Zone {
  id: number;
  side: "front" | "back" | null;
  name: string | APIInjuryZone;
}

export interface Location {
  id: number;
  nameEn: string;
  nameFr: string;
  zone: Zone;
  zoneId: number;
}

export interface APIHealthPain {
  id: number;
  rating: number;
  location: Location;
}

export interface APIHealth {
  id: number;
  energyRating: number | null;
  moodRating: number | null;
  stressRating: number | null;
  pains: Array<APIHealthPain>;
}

export type InjuryContext = "match" | "training" | "other";

export interface APIInjury {
  id: number;
  athleteId: number;
  athlete: IPlayer;
  dateOfInjury: string;
  recoveryDate?: string;
  injuryType: {
    id: number;
    nameFr: string;
    nameEn: string;
    categoryId: number;
    category: {
      id: number;
      nameEn: string;
      nameFr: string;
      zone: Zone;
      zoneId: number;
    };
  };
  levelOfPainToday: number;
  typeOfInjuryId: number;
  context?: InjuryContext;
  note?: string;
}

export interface ISeason {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  clubId: number;
}

export interface IClub {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  sportId: number;
  myCoachClubId: string;
  seasons: Array<ISeason>;
}

export interface IPosition {
  id: number;
  name: string;
}

export interface IPlayer {
  id: number;
  name: string;
  playerPosition?: IPosition;
  age: number;
  height: number;
  weight: number;
  jerseyNumber?: number;
  days: Array<APIDay>;
  discomforts: Array<APIDiscomfort>;
  injuries: Array<APIInjury>;
  club: IClub;
  notes: Array<INote>;
  profilePicture?: IFile;
}

export interface IMinifiedPlayer {
  id: number;
  name: string;
  position: string;
  // jerseyNumber: number | null;
  days: Array<APIDay>;
}

export interface IPhysicalPainsProps {
  discomforts: IPlayer["discomforts"];
  days: APIDay[];
  injuries: APIInjury[];
}

export interface ITeamOverviewPlayer {
  id: number;
  name: string;
  playerPosition: IPosition;
  days: APIDay[];
  injuries: APIInjury[];
  profilePicture?: IFile;
}
