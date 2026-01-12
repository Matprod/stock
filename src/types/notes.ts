export interface INote {
  id: number;
  noteDate: string;
  content: string;
}

export interface INoteWithAthlete extends INote {
  athleteName: string;
  athleteId: number;
} 