var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, belongsTo, column, computed } from '@adonisjs/lucid/orm';
import Day from '#models/day';
export default class DailyAverage extends BaseModel {
    static table = 'base_athletedayavg';
    get nutriScore() {
        const weights = {
            carboToday: 0.35 * 0.65,
            carbo7: 0.35 * 0.35,
            fatToday: 0.15 * 0.65,
            fat7: 0.15 * 0.35,
            proteinToday: 0.35 * 0.65,
            protein7: 0.35 * 0.35,
            microScore: 0.15,
        };
        const scores = {
            carboToday: this.carboScoreToday,
            carbo7: this.carboScore,
            fatToday: this.fatScoreToday,
            fat7: this.fatScore,
            proteinToday: this.proteinScoreToday,
            protein7: this.proteinScore,
            microScore: this.microScore,
        };
        const validScores = {};
        for (const [key, value] of Object.entries(scores)) {
            if (value !== null && value !== undefined) {
                validScores[key] = value;
            }
        }
        if (Object.keys(validScores).length === 0) {
            return null;
        }
        const validWeights = {};
        let weightSum = 0;
        for (const key of Object.keys(validScores)) {
            validWeights[key] = weights[key];
            weightSum += validWeights[key];
        }
        return Object.entries(validScores).reduce((sum, [key, value]) => sum + value * (validWeights[key] / weightSum), 0);
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], DailyAverage.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "carboScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "carboScoreToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "carboPosition", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fatScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fatScoreToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fatPosition", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "proteinScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "proteinScoreToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "proteinPosition", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaCarbohydrate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgFat", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgProtein", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgCarbohydrate", void 0);
__decorate([
    column({ columnName: 'vitaminc_today' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "vitaminCToday", void 0);
__decorate([
    column({ columnName: 'vitaminE_today' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "vitaminEToday", void 0);
__decorate([
    column({ columnName: 'vitaminD_today' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "vitaminDToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "magnesiumToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "potassiumToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "calciumToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "chlorideToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "sodiumToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "zincToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ironToday", void 0);
__decorate([
    column({ columnName: 'avg_vitaminc' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgVitaminC", void 0);
__decorate([
    column({ columnName: 'avg_vitaminE' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgVitaminE", void 0);
__decorate([
    column({ columnName: 'avg_vitaminD' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgVitaminD", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgMagnesium", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgPotassium", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgCalcium", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgChloride", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgSodium", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgZinc", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgIron", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "microScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "effortnutriScore", void 0);
__decorate([
    column({ columnName: 'avg_effortnutri' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgEffortNutri", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "quantityScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaQuantity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "qualityScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaQuality", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "sleepQualityVariability", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "variabilityQuantityScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "variabilityBedtimeScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "variabilityQuantityToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "quantitySleptLast10days", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaSymptoms", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "symptomsScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaOutactiPains", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "outactiDouleurScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaActiPains", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "actiDouleurScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgRelax", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgMood", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgEnergy", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "relaxScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "moodScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "energyScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "repartitionScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "repartitionPosition", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "good7List", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "below7List", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "above7List", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "goodTodayList", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "belowTodayList", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "cholLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "base1", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "base2", void 0);
__decorate([
    column({ columnName: 'CE_mean' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ceMean", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ceMeanPosition", void 0);
__decorate([
    column({ columnName: 'CE_var' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ceVar", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "frequency", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "affutage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "forme", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "charge", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "effortHours", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "formeToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "carbohydratesToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fbGlucides", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fhGlucides", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fbGlucides7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fhGlucides7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fatsToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fbLipides", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fhLipides", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fbLipides7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fhLipides7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "proteinsToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fbProteins", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fhProteins", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fbProteins7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fhProteins7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "energyToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "moodToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "relaxToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "qualityToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "quantityToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "activitiesSummary", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "varCEValue", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "proteinsConsumption", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fatsConsumption", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "carbsConsumption", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "avgTrainingLoadsList", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "numActivitiesWithTrainingLoad", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "trainingLoads", void 0);
__decorate([
    column({ columnName: 'mean_CEs' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "meanCEs", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "higher60Proportion", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "lower40Proportion", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "frequencyLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "actiDouleurMax", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "outactiDouleurMax", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "symptomMax", void 0);
__decorate([
    column({ columnName: 'number_acti7' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "numberActi7", void 0);
__decorate([
    column({ columnName: 'mean_acti_3w' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "meanActi3w", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "carboPosition7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "fatPosition7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "proteinPosition7", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "numPast10Sleeps", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaSleepEfficiency", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaSleepConsistency", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaRestorative", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaRepartition", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ratioSleepQuantityBaselineEwma", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ratioSleepQuantityBaselineToday", void 0);
__decorate([
    column({ columnName: 'acwr_CEs' }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "acwrCEs", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "acwrLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "acwrFinalScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "recoveryScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "recoveryLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "recoveryFinalScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "recoveryScoreToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "efficiencyScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "efficiencyToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "consistencyScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "bedtimeConsistencyScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "consistencyToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "restorativeScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "restorativeToday", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "debtScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "sleepDebt", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "travelFatigue", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "travelFatigueScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "hrvScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaHrv", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "hrvFH", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "hrvFB", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "rhrScore", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "ewmaRhr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "rhrFH", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "rhrFB", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], DailyAverage.prototype, "sleepQuantityScore", void 0);
__decorate([
    column({ consume: (value) => (value ? parseFloat(value) : null) }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "trainingLoad", void 0);
__decorate([
    column({ consume: (value) => (value ? parseFloat(value) : null) }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "trainingLoadHighIntensity", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], DailyAverage.prototype, "athleteDayId", void 0);
__decorate([
    belongsTo(() => Day, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], DailyAverage.prototype, "day", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], DailyAverage.prototype, "nutriScore", null);
//# sourceMappingURL=daily_average.js.map