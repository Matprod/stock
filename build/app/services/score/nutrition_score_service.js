import { DateTime } from 'luxon';
export default class NutritionScoreService {
    async calculateNutritionScore(data, athlete, date) {
        const { days } = data;
        const { age, gender, heightCm, weightKg } = athlete;
        const sortedDays = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
        const targetDate = DateTime.fromFormat(date, 'yyyy-MM-dd').toJSDate();
        const currentDay = sortedDays.find((day) => day.date.getTime() === targetDate.getTime());
        if (!currentDay) {
            throw new Error(`No data found for date 2 ${date}`);
        }
        const { nutrition } = currentDay;
        if (!nutrition.hasNutrition) {
            return null;
        }
        const last7days = sortedDays.filter((day) => {
            const dayDate = new Date(day.date);
            const diffTime = Math.abs(targetDate.getTime() - dayDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 6;
        });
        const { totalDuration7Days, effortNutrition7Days, numDaysEffort, fat7Days, proteins7Days, carbs7Days, vitaminC7Days, vitaminE7Days, vitaminD7Days, magnesium7Days, potassium7Days, calcium7Days, chloride7Days, sodium7Days, zinc7Days, iron7Days, cholesterol7Days, numDaysNutrition, fatsConsumption, proteinsConsumption, carbsConsumption, FBLipides7, FHLipides7, FBGlucides7, FHGlucides7, FBProteins7, FHProteins7, } = last7days.reduce((acc, day) => {
            if (day.date.getTime() === targetDate.getTime())
                return acc;
            const { hasActivities, totalDuration, hasNutrition, total, insights, } = day.nutrition;
            if (hasActivities) {
                acc.totalDuration7Days += totalDuration || 0;
                if (day.nutrition.effortNutriScore) {
                    acc.effortNutrition7Days += day.nutrition.effortNutriScore;
                    acc.numDaysEffort++;
                }
            }
            if (hasNutrition) {
                acc.numDaysNutrition++;
                acc.fat7Days += total?.fatG || 0;
                acc.proteins7Days += total?.proteinsG || 0;
                acc.carbs7Days += total?.carbohydrateG || 0;
                acc.vitaminC7Days += total?.vitaminCMg || 0;
                acc.vitaminE7Days += total?.vitaminEMg || 0;
                acc.vitaminD7Days += total?.vitaminDMicrog || 0;
                acc.magnesium7Days += total?.magnesiumMg || 0;
                acc.potassium7Days += total?.potassiumMg || 0;
                acc.calcium7Days += total?.calciumMg || 0;
                acc.chloride7Days += total?.chlorideMg || 0;
                acc.sodium7Days += total?.sodiumMg || 0;
                acc.zinc7Days += total?.zincMg || 0;
                acc.iron7Days += total?.ironMg || 0;
                acc.cholesterol7Days += total?.cholesterolMg || 0;
                acc.FBLipides7 += insights?.lipides?.min || 0;
                acc.FHLipides7 += insights?.lipides?.max || 0;
                acc.FBGlucides7 += insights?.glucides?.min || 0;
                acc.FHGlucides7 += insights?.glucides?.max || 0;
                acc.FBProteins7 += insights?.proteines?.min || 0;
                acc.FHProteins7 += insights?.proteines?.max || 0;
                acc.fatsConsumption.push(total?.fatG || 0);
                acc.proteinsConsumption.push(total?.proteinsG || 0);
                acc.carbsConsumption.push(total?.carbohydrateG || 0);
            }
            return acc;
        }, {
            totalDuration7Days: currentDay.nutrition.totalDuration || 0,
            effortNutrition7Days: 0,
            numDaysEffort: 1,
            fat7Days: currentDay.nutrition.total?.fatG || 0,
            proteins7Days: currentDay.nutrition.total?.proteinsG || 0,
            carbs7Days: currentDay.nutrition.total?.carbohydrateG || 0,
            vitaminC7Days: currentDay.nutrition.total?.vitaminCMg || 0,
            vitaminE7Days: currentDay.nutrition.total?.vitaminEMg || 0,
            vitaminD7Days: currentDay.nutrition.total?.vitaminDMicrog || 0,
            magnesium7Days: currentDay.nutrition.total?.magnesiumMg || 0,
            potassium7Days: currentDay.nutrition.total?.potassiumMg || 0,
            calcium7Days: currentDay.nutrition.total?.calciumMg || 0,
            chloride7Days: currentDay.nutrition.total?.chlorideMg || 0,
            sodium7Days: currentDay.nutrition.total?.sodiumMg || 0,
            zinc7Days: currentDay.nutrition.total?.zincMg || 0,
            iron7Days: currentDay.nutrition.total?.ironMg || 0,
            cholesterol7Days: currentDay.nutrition.total?.cholesterolMg || 0,
            numDaysNutrition: currentDay.nutrition.hasNutrition ? 1 : 0,
            fatsConsumption: [currentDay.nutrition.total?.fatG || 0],
            proteinsConsumption: [currentDay.nutrition.total?.proteinsG || 0],
            carbsConsumption: [currentDay.nutrition.total?.carbohydrateG || 0],
            FBLipides7: currentDay.nutrition.insights?.lipides?.min || 0,
            FHLipides7: currentDay.nutrition.insights?.lipides?.max || 0,
            FBGlucides7: currentDay.nutrition.insights?.glucides?.min || 0,
            FHGlucides7: currentDay.nutrition.insights?.glucides?.max || 0,
            FBProteins7: currentDay.nutrition.insights?.proteines?.min || 0,
            FHProteins7: currentDay.nutrition.insights?.proteines?.max || 0,
        });
        const fatToday = nutrition.total?.fatG || 0;
        const proteinsToday = nutrition.total?.proteinsG || 0;
        const carbsToday = nutrition.total?.carbohydrateG || 0;
        const vitaminCToday = nutrition.total?.vitaminCMg || 0;
        const vitaminEToday = nutrition.total?.vitaminEMg || 0;
        const vitaminDToday = nutrition.total?.vitaminDMicrog || 0;
        const magnesiumToday = nutrition.total?.magnesiumMg || 0;
        const potassiumToday = nutrition.total?.potassiumMg || 0;
        const calciumToday = nutrition.total?.calciumMg || 0;
        const chlorideToday = nutrition.total?.chlorideMg || 0;
        const sodiumToday = nutrition.total?.sodiumMg || 0;
        const zincToday = nutrition.total?.zincMg || 0;
        const ironToday = nutrition.total?.ironMg || 0;
        const avgFat = numDaysNutrition > 0 ? fat7Days / numDaysNutrition : 0;
        const avgProteins = numDaysNutrition > 0 ? proteins7Days / numDaysNutrition : 0;
        const avgCarbs = numDaysNutrition > 0 ? carbs7Days / numDaysNutrition : 0;
        const avgVitaminC = numDaysNutrition > 0 ? vitaminC7Days / numDaysNutrition : 0;
        const avgVitaminE = numDaysNutrition > 0 ? vitaminE7Days / numDaysNutrition : 0;
        const avgVitaminD = numDaysNutrition > 0 ? vitaminD7Days / numDaysNutrition : 0;
        const avgMagnesium = numDaysNutrition > 0 ? magnesium7Days / numDaysNutrition : 0;
        const avgPotassium = numDaysNutrition > 0 ? potassium7Days / numDaysNutrition : 0;
        const avgCalcium = numDaysNutrition > 0 ? calcium7Days / numDaysNutrition : 0;
        const avgChloride = numDaysNutrition > 0 ? chloride7Days / numDaysNutrition : 0;
        const avgSodium = numDaysNutrition > 0 ? sodium7Days / numDaysNutrition : 0;
        const avgZinc = numDaysNutrition > 0 ? zinc7Days / numDaysNutrition : 0;
        const avgIron = numDaysNutrition > 0 ? iron7Days / numDaysNutrition : 0;
        const avgFBLipides7 = numDaysNutrition > 0 ? FBLipides7 / numDaysNutrition : 0;
        const avgFHLipides7 = numDaysNutrition > 0 ? FHLipides7 / numDaysNutrition : 0;
        const avgFBGlucides7 = numDaysNutrition > 0 ? FBGlucides7 / numDaysNutrition : 0;
        const avgFHGlucides7 = numDaysNutrition > 0 ? FHGlucides7 / numDaysNutrition : 0;
        const avgFBProteins7 = numDaysNutrition > 0 ? FBProteins7 / numDaysNutrition : 0;
        const avgFHProteins7 = numDaysNutrition > 0 ? FHProteins7 / numDaysNutrition : 0;
        const FBLipidesToday = nutrition.insights?.lipides?.min || 0;
        const FHLipidesToday = nutrition.insights?.lipides?.max || 0;
        const FBGlucidesToday = nutrition.insights?.glucides?.min || 0;
        const FHGlucidesToday = nutrition.insights?.glucides?.max || 0;
        const FBProteinsToday = nutrition.insights?.proteines?.min || 0;
        const FHProteinsToday = nutrition.insights?.proteines?.max || 0;
        const { avgEffortNutrition, effortNutritionScore } = this.calculateEffortNutritionMetrics(nutrition, effortNutrition7Days, numDaysEffort);
        const { score: carboScore, scoreToday: carboScoreToday, position: carboPosition, position7: carboPosition7, } = this.getMacrosScore(avgCarbs, carbsToday, avgFBGlucides7, avgFHGlucides7, nutrition.insights?.glucides?.min || 0, nutrition.insights?.glucides?.max || 0);
        const { score: fatScore, scoreToday: fatScoreToday, position: fatPosition, position7: fatPosition7, } = this.getMacrosScore(avgFat, fatToday, avgFBLipides7, avgFHLipides7, FBLipidesToday, FHLipidesToday);
        const { score: proteinScore, scoreToday: proteinScoreToday, position: proteinPosition, position7: proteinPosition7, } = this.getMacrosScore(avgProteins, proteinsToday, avgFBProteins7, avgFHProteins7, FBProteinsToday, FHProteinsToday);
        const [repartitionScore, repartitionPosition] = this.handleRepartitionData(carboPosition, fatPosition, proteinPosition);
        const { microScore, below7List, above7List, good7List, goodTodayList, belowTodayList, cholLevel, } = this.handleMicrosData(gender, age || 0, weightKg || 0, heightCm || 0, totalDuration7Days, vitaminCToday || 0, avgVitaminC, vitaminEToday || 0, avgVitaminE, vitaminDToday || 0, avgVitaminD, magnesiumToday || 0, avgMagnesium, potassiumToday || 0, avgPotassium, calciumToday || 0, avgCalcium, chlorideToday || 0, avgChloride, sodiumToday || 0, avgSodium, zincToday || 0, avgZinc, ironToday || 0, avgIron, cholesterol7Days);
        const effortHours = nutrition.totalDuration ? nutrition.totalDuration / 3600000000 : 0;
        return {
            fatsConsumption,
            proteinsConsumption,
            carbsConsumption,
            below7List,
            good7List,
            above7List,
            goodTodayList,
            belowTodayList,
            cholLevel,
            effortHours: effortHours || 0,
            carbohydratesToday: carbsToday,
            fbGlucides: FBGlucidesToday,
            fhGlucides: FHGlucidesToday,
            fbGlucides7: avgFBGlucides7,
            fhGlucides7: avgFHGlucides7,
            avgCarbohydrate: avgCarbs,
            carboScore,
            carboScoreToday,
            carboPosition,
            carboPosition7,
            repartitionScore,
            repartitionPosition,
            fatsToday: fatToday,
            fbLipides: FBLipidesToday,
            fhLipides: FHLipidesToday,
            fbLipides7: avgFBLipides7,
            fhLipides7: avgFHLipides7,
            fatScore,
            fatScoreToday,
            fatPosition,
            fatPosition7,
            avgFat,
            proteinsToday: proteinsToday,
            fbProteins: FBProteinsToday,
            fhProteins: FHProteinsToday,
            fbProteins7: avgFBProteins7,
            fhProteins7: avgFHProteins7,
            proteinScore,
            proteinScoreToday,
            proteinPosition,
            proteinPosition7,
            avgProtein: avgProteins,
            vitaminCToday,
            vitaminEToday,
            vitaminDToday,
            magnesiumToday,
            potassiumToday,
            calciumToday,
            chlorideToday,
            sodiumToday,
            zincToday,
            ironToday,
            avgVitaminC,
            avgVitaminE,
            avgVitaminD,
            avgMagnesium,
            avgPotassium,
            avgCalcium,
            avgChloride,
            avgSodium,
            avgZinc,
            avgIron,
            microScore,
            effortnutriScore: effortNutritionScore || 0,
            avgEffortNutri: avgEffortNutrition || 0,
        };
    }
    calculateEffortNutritionMetrics(currentData, effortNutrition7Days, numDaysEffort) {
        const { hasActivities, insights } = currentData;
        if (!hasActivities || !insights?.nutri_score) {
            return {
                effortNutritionScore: null,
                avgEffortNutrition: null,
            };
        }
        return this.handleEffortNutritionData(currentData, effortNutrition7Days, numDaysEffort);
    }
    handleEffortNutritionData(currentData, effortNutrition7Days, numDaysEffort) {
        const { hasActivities, insights } = currentData;
        const glucidesConsommesTotal = insights?.nutri_score?.glucides_consommes_total || 0;
        const minNecessary = insights?.nutri_score?.min_necessary || 0;
        if (hasActivities && insights?.nutri_score) {
            const effortNutritionList = [];
            effortNutritionList.push(glucidesConsommesTotal >= 0.6 * minNecessary ? 1 : 0);
            effortNutritionList.push(glucidesConsommesTotal >= 0.8 * minNecessary ? 1 : 0);
            effortNutritionList.push(glucidesConsommesTotal >= minNecessary ? 1 : 0);
            const effortNutritionToday = (effortNutritionList.reduce((sum, val) => sum + val, 0) * 100) / effortNutritionList.length;
            const effortNutrition = (effortNutritionToday + effortNutrition7Days) / (numDaysEffort + 1);
            return {
                effortNutritionScore: effortNutritionToday,
                avgEffortNutrition: effortNutrition,
            };
        }
        return {
            effortNutritionScore: null,
            avgEffortNutrition: numDaysEffort > 0 ? effortNutrition7Days / numDaysEffort : effortNutrition7Days,
        };
    }
    getMacrosScore(macroAvg7, consumptionToday, FB7, FH7, FB, FH) {
        const macroList = [];
        const macroListToday = [];
        let position = '';
        let position7 = '';
        if (macroAvg7 < FB7) {
            position7 = 'below';
        }
        else if (macroAvg7 > FH7) {
            position7 = 'above';
        }
        else if (FB7 < macroAvg7 && macroAvg7 < FH7) {
            position7 = 'in';
        }
        if (consumptionToday < FB) {
            position = 'below';
        }
        else if (consumptionToday > FH) {
            position = 'above';
        }
        else if (FB < consumptionToday && consumptionToday < FH) {
            position = 'in';
        }
        if (FB7 < macroAvg7 && macroAvg7 < FH7) {
            macroList.push(1);
        }
        else {
            macroList.push(0);
        }
        if (0.9 * FB7 < macroAvg7 && macroAvg7 < 1.15 * FH7) {
            macroList.push(1);
        }
        else {
            macroList.push(0);
        }
        if (0.8 * FB7 < macroAvg7 && macroAvg7 < 1.3 * FH7) {
            macroList.push(1);
        }
        else {
            macroList.push(0);
        }
        if (0.7 * FB7 < macroAvg7 && macroAvg7 < 1.45 * FH7) {
            macroList.push(1);
        }
        else {
            macroList.push(0);
        }
        if (0.6 * FB7 < macroAvg7 && macroAvg7 < 1.6 * FH7) {
            macroList.push(1);
        }
        else {
            macroList.push(0);
        }
        if (0.5 * FB7 < macroAvg7 && macroAvg7 < 1.75 * FH7) {
            macroList.push(1);
        }
        else {
            macroList.push(0);
        }
        if (0.4 * FB7 < macroAvg7 && macroAvg7 < 1.9 * FH7) {
            macroList.push(1);
        }
        else {
            macroList.push(0);
        }
        if (FB < consumptionToday && consumptionToday < FH) {
            macroListToday.push(1);
        }
        else {
            macroListToday.push(0);
        }
        if (0.9 * FB < consumptionToday && consumptionToday < 1.15 * FH) {
            macroListToday.push(1);
        }
        else {
            macroListToday.push(0);
        }
        if (0.8 * FB < consumptionToday && consumptionToday < 1.3 * FH) {
            macroListToday.push(1);
        }
        else {
            macroListToday.push(0);
        }
        if (0.7 * FB < consumptionToday && consumptionToday < 1.45 * FH) {
            macroListToday.push(1);
        }
        else {
            macroListToday.push(0);
        }
        if (0.6 * FB < consumptionToday && consumptionToday < 1.6 * FH) {
            macroListToday.push(1);
        }
        else {
            macroListToday.push(0);
        }
        if (0.5 * FB < consumptionToday && consumptionToday < 1.75 * FH) {
            macroListToday.push(1);
        }
        else {
            macroListToday.push(0);
        }
        if (0.4 * FB < consumptionToday && consumptionToday < 1.9 * FH) {
            macroListToday.push(1);
        }
        else {
            macroListToday.push(0);
        }
        const macros = (macroList.reduce((sum, val) => sum + val, 0) * 100) / macroList.length;
        const macrosToday = (macroListToday.reduce((sum, val) => sum + val, 0) * 100) / macroListToday.length;
        return {
            score: macros,
            scoreToday: macrosToday,
            position,
            position7,
        };
    }
    handleRepartitionData(glucidesRep, lipidesRep, proteinsRep) {
        const repartitionList = [];
        if (glucidesRep === 'in' && lipidesRep === 'in' && proteinsRep === 'in') {
            repartitionList.push(1);
        }
        else {
            repartitionList.push(0);
        }
        if (glucidesRep === 'in' || lipidesRep === 'in' || proteinsRep === 'in') {
            repartitionList.push(1);
        }
        else {
            repartitionList.push(0);
        }
        const repartitionToday = (repartitionList.reduce((sum, val) => sum + val, 0) * 100) / repartitionList.length;
        const repartition = repartitionToday;
        let repartitionPosition = '';
        if ((glucidesRep === 'below' || lipidesRep === 'below' || proteinsRep === 'below') &&
            !(glucidesRep === 'above' || lipidesRep === 'above' || proteinsRep === 'above')) {
            repartitionPosition = '1 below';
        }
        else if ((glucidesRep === 'above' || lipidesRep === 'above' || proteinsRep === 'above') &&
            !(glucidesRep === 'below' || lipidesRep === 'below' || proteinsRep === 'below')) {
            repartitionPosition = '1 above';
        }
        else if ((glucidesRep === 'below' && lipidesRep === 'above') ||
            (glucidesRep === 'below' && proteinsRep === 'above') ||
            (lipidesRep === 'below' && proteinsRep === 'above') ||
            (lipidesRep === 'below' && glucidesRep === 'above') ||
            (proteinsRep === 'below' && glucidesRep === 'above') ||
            (proteinsRep === 'below' && lipidesRep === 'above')) {
            repartitionPosition = '1 below 1 above';
        }
        return [repartition, repartitionPosition];
    }
    handleMicrosData(gender, age, weight, height, totalDuration7days, vitaminCToday, vitaminC7days, vitaminEToday, vitaminE7days, vitaminDToday, vitaminD7days, magnesiumToday, magnesium7days, potassiumToday, potassium7days, calciumToday, calcium7days, chlorideToday, chloride7days, sodiumToday, sodium7days, zincToday, zinc7days, ironToday, iron7days, cholesterol7days) {
        const microsList = [];
        const below7 = [];
        const above7 = [];
        const good7 = [];
        const goodToday = [];
        const belowToday = [];
        const aboveToday = [];
        if (vitaminC7days > 110) {
            microsList.push(1);
            good7.push('Vitamin C');
        }
        else {
            microsList.push(0);
            below7.push('Vitamin C');
        }
        if (vitaminCToday > 110) {
            goodToday.push('Vitamin C');
        }
        else {
            belowToday.push('Vitamin C');
        }
        if (vitaminE7days > 10 && vitaminE7days < 300) {
            microsList.push(1);
            good7.push('Vitamin E');
        }
        else {
            microsList.push(0);
            below7.push('Vitamin E');
        }
        if (vitaminEToday > 10 && vitaminEToday < 300) {
            goodToday.push('Vitamin E');
        }
        else {
            belowToday.push('Vitamin E');
        }
        if (vitaminD7days > 15 && vitaminD7days < 100) {
            microsList.push(1);
            good7.push('Vitamin D');
        }
        else if (vitaminD7days <= 15) {
            microsList.push(0);
            below7.push('Vitamin D');
        }
        else {
            microsList.push(0);
            above7.push('Vitamin D');
        }
        if (vitaminDToday > 15 && vitaminDToday < 100) {
            goodToday.push('Vitamin D');
        }
        else if (vitaminDToday <= 15) {
            belowToday.push('Vitamin D');
        }
        else {
            aboveToday.push('Vitamin D');
        }
        if (gender === 'Female') {
            if (magnesium7days > 300 && magnesium7days < 350) {
                microsList.push(1);
                good7.push('Magnesium');
            }
            else if (magnesium7days <= 300) {
                microsList.push(0);
                below7.push('Magnesium');
            }
            else {
                microsList.push(0);
                above7.push('Magnesium');
            }
            if (magnesiumToday > 300 && magnesiumToday < 350) {
                goodToday.push('Magnesium');
            }
            else if (magnesiumToday <= 300) {
                belowToday.push('Magnesium');
            }
            else {
                aboveToday.push('Magnesium');
            }
        }
        else if (gender === 'Male') {
            if (magnesium7days > 380 && magnesium7days < 430) {
                microsList.push(1);
                good7.push('Magnesium');
            }
            else if (magnesium7days <= 380) {
                microsList.push(0);
                below7.push('Magnesium');
            }
            else {
                microsList.push(0);
                above7.push('Magnesium');
            }
            if (magnesiumToday > 380 && magnesiumToday < 430) {
                goodToday.push('Magnesium');
            }
            else if (magnesiumToday <= 380) {
                belowToday.push('Magnesium');
            }
            else {
                aboveToday.push('Magnesium');
            }
        }
        if (potassium7days > 3500 && potassium7days < 5000) {
            microsList.push(1);
            good7.push('Potassium');
        }
        else if (potassium7days <= 3500) {
            microsList.push(0);
            below7.push('Potassium');
        }
        else {
            microsList.push(0);
            above7.push('Potassium');
        }
        if (potassiumToday > 3500 && potassiumToday < 5000) {
            goodToday.push('Potassium');
        }
        else if (potassiumToday <= 3500) {
            belowToday.push('Potassium');
        }
        else {
            aboveToday.push('Potassium');
        }
        if (calcium7days > 1200 && calcium7days < 2500) {
            microsList.push(1);
            good7.push('Calcium');
        }
        else if (calcium7days <= 1200) {
            microsList.push(0);
            below7.push('Calcium');
        }
        else {
            microsList.push(0);
            above7.push('Calcium');
        }
        if (calciumToday > 1200 && calciumToday < 2500) {
            goodToday.push('Calcium');
        }
        else if (calciumToday <= 1200) {
            belowToday.push('Calcium');
        }
        else {
            aboveToday.push('Calcium');
        }
        if (chloride7days > 2300) {
            microsList.push(1);
        }
        else {
            microsList.push(0);
        }
        if (chlorideToday > 2300) {
            goodToday.push('Chlore');
        }
        else {
            belowToday.push('Chlore');
        }
        if (sodium7days > 1500 && sodium7days < 2300) {
            microsList.push(1);
            good7.push('Sodium');
        }
        else if (sodium7days <= 1500) {
            microsList.push(0);
            below7.push('Sodium');
        }
        else {
            microsList.push(0);
            above7.push('Sodium');
        }
        if (sodiumToday > 1500 && sodiumToday < 2300) {
            goodToday.push('Sodium');
        }
        else if (sodiumToday <= 1500) {
            belowToday.push('Sodium');
        }
        else {
            aboveToday.push('Sodium');
        }
        if (gender === 'Female') {
            if (zinc7days > 11 && zinc7days < 25) {
                microsList.push(1);
                good7.push('Zinc');
            }
            else if (zinc7days <= 11) {
                microsList.push(0);
                below7.push('Zinc');
            }
            else {
                microsList.push(0);
                above7.push('Zinc');
            }
            if (zincToday > 11 && zincToday < 25) {
                goodToday.push('Zinc');
            }
            else if (zincToday <= 11) {
                belowToday.push('Zinc');
            }
            else {
                aboveToday.push('Zinc');
            }
        }
        else if (gender === 'Male') {
            if (zinc7days > 14 && zinc7days < 25) {
                microsList.push(1);
                good7.push('Zinc');
            }
            else if (zinc7days <= 14) {
                microsList.push(0);
                below7.push('Zinc');
            }
            else {
                microsList.push(0);
                above7.push('Zinc');
            }
            if (zincToday > 14 && zincToday < 25) {
                goodToday.push('Zinc');
            }
            else if (zincToday <= 14) {
                belowToday.push('Zinc');
            }
            else {
                aboveToday.push('Zinc');
            }
        }
        if (gender === 'Female') {
            if (iron7days > 16 && iron7days < 40) {
                microsList.push(1);
                good7.push('Fer');
            }
            else if (iron7days <= 16) {
                microsList.push(0);
                below7.push('Fer');
            }
            else {
                microsList.push(0);
                above7.push('Fer');
            }
            if (ironToday > 16 && ironToday < 40) {
                goodToday.push('Fer');
            }
            else if (ironToday <= 16) {
                belowToday.push('Fer');
            }
            else {
                aboveToday.push('Fer');
            }
        }
        else if (gender === 'Male') {
            if (iron7days > 11 && iron7days < 40) {
                microsList.push(1);
                good7.push('Fer');
            }
            else if (iron7days <= 11) {
                microsList.push(0);
                below7.push('Fer');
            }
            else {
                microsList.push(0);
                above7.push('Fer');
            }
            if (ironToday > 11 && ironToday < 40) {
                goodToday.push('Fer');
            }
            else if (ironToday <= 11) {
                belowToday.push('Fer');
            }
            else {
                aboveToday.push('Fer');
            }
        }
        const totalDurationHours = totalDuration7days / 3600;
        const [minChol, maxChol] = this.getMinMaxCholesterol(age, gender, weight, height, totalDurationHours);
        if (cholesterol7days > minChol && cholesterol7days < maxChol) {
            microsList.push(1);
        }
        else {
            microsList.push(0);
        }
        const cholLevel = cholesterol7days > minChol && cholesterol7days < maxChol ? 'yes' : 'no';
        const micros = (microsList.reduce((sum, val) => sum + val, 0) * 100) / microsList.length;
        return {
            microScore: micros,
            microsList: microsList.map(String),
            below7List: below7,
            above7List: above7,
            good7List: good7,
            goodTodayList: goodToday,
            belowTodayList: belowToday,
            cholLevel,
        };
    }
    getMinMaxCholesterol(age, gender, weight, height, trainingHoursPerWeek) {
        let ageAdjustment = 0;
        if (age < 30) {
            ageAdjustment = 0.05;
        }
        else if (age > 50) {
            ageAdjustment = -0.05;
        }
        const genderAdjustment = gender.toLowerCase() === 'female' ? -0.05 : 0;
        const bmi = weight / (height * height);
        const bmiAdjustment = bmi > 25 ? (bmi - 25) * 0.01 : 0;
        const hoursAdjustment = Math.max(0, trainingHoursPerWeek - 14) * 0.01;
        const recommendedCholesterol = 300 * (1 + ageAdjustment + genderAdjustment + bmiAdjustment + hoursAdjustment);
        const minInterval = recommendedCholesterol * 0.9;
        const maxInterval = recommendedCholesterol * 1.1;
        return [minInterval, maxInterval];
    }
    calculateInjuryNutritionScore({ carboScoreToday, carboScore, fatScoreToday, fatScore, proteinScoreToday, proteinScore, microScore, }) {
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
            carboToday: carboScoreToday,
            carbo7: carboScore,
            fatToday: fatScoreToday,
            fat7: fatScore,
            proteinToday: proteinScoreToday,
            protein7: proteinScore,
            microScore: microScore,
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
//# sourceMappingURL=nutrition_score_service.js.map