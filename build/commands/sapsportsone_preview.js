var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { SapSportsOneService } from '#services/sapsportsone_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
export default class SapSportsOnePreview extends BaseCommand {
    static commandName = 'sapsportsone:preview';
    static description = 'Fetch a small SAP SportsOne questionnaire sample and print it';
    static options = {
        startApp: false,
    };
    async run() {
        const service = SapSportsOneService.fromEnv();
        console.log('');
        console.log(`SAP SportsOne questionnaires sample (limit=${this.limit})`);
        console.log('');
        const sample = await service.fetchSample(this.limit);
        console.log('');
        console.log('── questionnaireEvents ──');
        console.log(JSON.stringify(sample.events, null, 2));
        console.log('');
        console.log('── questionnaireEventAnswers ──');
        console.log(JSON.stringify(sample.answers, null, 2));
        console.log('');
        console.log('── enhancedQuestionnairesPersons ──');
        console.log(JSON.stringify(sample.persons, null, 2));
        console.log('');
        console.log('── questionnaireQuestions ──');
        console.log(JSON.stringify(sample.questions, null, 2));
        console.log('');
        this.logger.success(`Fetched ${sample.events.length} events, ${sample.answers.length} answers, ${sample.persons.length} persons, ${sample.questions.length} questions`);
    }
}
__decorate([
    flags.number({ description: 'Number of rows to fetch per endpoint', default: 10 }),
    __metadata("design:type", Number)
], SapSportsOnePreview.prototype, "limit", void 0);
//# sourceMappingURL=sapsportsone_preview.js.map