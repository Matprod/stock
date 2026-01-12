export interface IGenerateResponse {
  discussionId: number;
  response: string;
  questions: Array<IChatBotQuestion>;
}

export interface IChatBotQuestion {
  id: number;
  title: string;
  question: string;
}

export interface IQuestionsResponse {
  questions: IChatBotQuestion[];
}

export interface IChatbotReport {
  id: number;
  dayId: number;
  category: 'performance' | 'injury';
  reportMessage: string;
  scoreAtGeneration: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IChatbotReportResponse {
  report: IChatbotReport | null;
}
