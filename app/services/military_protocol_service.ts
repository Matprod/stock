import * as fs from "fs";

export interface MilitaryProtocol {
	id: string;
	title: string;
	instruction: string;
	category: string;
	subcategory: string;
	confidence?: number;
	parameters?: Record<string, any>;
	page_number?: number;
}

export interface MilitaryProtocolResult {
	query: string;
	matchedProtocols: [MilitaryProtocol, number][];
}

class IntelligentProtocolMatcher {
	private synonyms: Record<string, string[]> = {
		force: [
			"puissance",
			"strength",
			"musculation",
			"renforcement",
			"robustesse",
			"solidité",
		],
		endurance: [
			"cardio",
			"aérobie",
			"stamina",
			"résistance",
			"souffle",
			"capacité",
		],
		récupération: ["repos", "régénération", "restauration", "récup", "détente"],
		hydratation: ["eau", "boisson", "liquide", "boire", "hydrique"],
		entraînement: ["training", "exercice", "séance", "workout", "pratique"],
		améliorer: [
			"développer",
			"augmenter",
			"optimiser",
			"perfectionner",
			"progresser",
		],
		vitesse: ["rapidité", "vélocité", "sprint", "accélération"],
		souplesse: ["flexibilité", "mobilité", "étirement", "stretching"],
		nutrition: ["alimentation", "nourriture", "diététique", "régime"],
		fatigue: ["épuisement", "lassitude", "surmenage", "overtraining"],
	};

	private contextPatterns: Record<string, any> = {
		strength_training: {
			primary: [/\b(?:force|musculation|renforcement|puissance)\b/],
			secondary: [/\b(?:poids|charges|haltères|1-?rm|répétitions)\b/],
			context: [/\b(?:muscle|fort|solide|robuste)\b/],
			anti_patterns: [/\b(?:mental|psychologique|caractère|volonté)\b/],
		},
		cardio_endurance: {
			primary: [/\b(?:cardio|endurance|aérobie|course|running)\b/],
			secondary: [/\b(?:vma|vo2|souffle|respiration|marathon)\b/],
			context: [/\b(?:courir|essoufflement|stamina)\b/],
			anti_patterns: [/\b(?:musculation|poids|force)\b/],
		},
		recovery_rest: {
			primary: [/\b(?:récupération|repos|sommeil|fatigue)\b/],
			secondary: [/\b(?:massage|étirement|relaxation|sieste)\b/],
			context: [/\b(?:fatigué|épuisé|reposé|frais)\b/],
			anti_patterns: [],
		},
		hydration_nutrition: {
			primary: [/\b(?:hydratation|eau|nutrition|alimentation)\b/],
			secondary: [/\b(?:boire|manger|boisson|repas|calories)\b/],
			context: [/\b(?:soif|faim|énergie)\b/],
			anti_patterns: [],
		},
	};

	private scoringWeights: Record<string, number> = {
		semantic_similarity: 0.4, // 40% - Similarité sémantique
		synonym_match: 0.25, // 25% - Correspondance synonymes
		context_pattern: 0.2, // 20% - Patterns contextuels
		category_relevance: 0.1, // 10% - Pertinence catégorie
		confidence_boost: 0.05, // 5% - Boost confiance protocole
	};

	intelligentProtocolMatching(
		query: string,
		protocols: MilitaryProtocol[],
	): [MilitaryProtocol, number][] {
		const scoredProtocols: [MilitaryProtocol, number][] = [];

		const processedQuery = this.preprocessQuery(query);
		for (const protocol of protocols) {
			const totalScore = this.calculateHybridScore(
				processedQuery,
				protocol,
				query,
			);
			scoredProtocols.push([protocol, totalScore]);
		}

		return scoredProtocols.sort((a, b) => b[1] - a[1]);
	}

	private preprocessQuery(query: string): any {
		const queryLower = query.toLowerCase();

		const words = new Set(queryLower.match(/\b[\p{L}\p{N}_]+\b/gu) || []);

		const extendedWords = new Set(words);
		for (const word of words) {
			for (const [key, synonyms] of Object.entries(this.synonyms)) {
				if (word === key || synonyms.includes(word)) {
					synonyms.forEach((syn) => extendedWords.add(syn));
					extendedWords.add(key);
				}
			}
		}

		const contextScores: Record<string, number> = {};
		for (const [context, patterns] of Object.entries(this.contextPatterns)) {
			let score = 0.0;

			for (const pattern of patterns.primary) {
				const matches = queryLower.match(pattern);
				score += (matches ? matches.length : 0) * 3.0;
			}

			for (const pattern of patterns.secondary) {
				const matches = queryLower.match(pattern);
				score += (matches ? matches.length : 0) * 1.5;
			}

			for (const pattern of patterns.context) {
				const matches = queryLower.match(pattern);
				score += (matches ? matches.length : 0) * 1.0;
			}

			for (const pattern of patterns.anti_patterns) {
				const matches = queryLower.match(pattern);
				score -= (matches ? matches.length : 0) * 2.0;
			}

			contextScores[context] = Math.max(0, score);
		}

		const contextEntries = Object.entries(contextScores);
		const primaryContext =
			contextEntries.length > 0
				? contextEntries.reduce((a, b) =>
						contextScores[a[0]] > contextScores[b[0]] ? a : b,
					)[0]
				: null;
		return {
			original: query,
			words: Array.from(words),
			extendedWords: Array.from(extendedWords),
			contextScores,
			primaryContext,
		};
	}

	private calculateHybridScore(
		processedQuery: any,
		protocol: MilitaryProtocol,
		_originalQuery: string,
	): number {
		const protocolText =
			`${protocol.title} ${protocol.instruction}`.toLowerCase();
		const protocolWords = new Set(protocolText.match(/\b\w+\b/g) || []);
		const semanticScore = this.calculateSemanticSimilarity(
			processedQuery.extendedWords,
			Array.from(protocolWords),
		);

		const synonymScore = this.calculateSynonymMatch(
			processedQuery.words,
			Array.from(protocolWords),
		);

		const contextScore = this.calculateContextPatternScore(
			processedQuery,
			protocol,
		);

		const categoryScore = this.calculateCategoryRelevance(
			processedQuery,
			protocol,
		);

		const confidenceScore = protocol.confidence || 0.5;
		const finalScore =
			semanticScore * this.scoringWeights.semantic_similarity +
			synonymScore * this.scoringWeights.synonym_match +
			contextScore * this.scoringWeights.context_pattern +
			categoryScore * this.scoringWeights.category_relevance +
			confidenceScore * this.scoringWeights.confidence_boost;

		return Math.min(finalScore, 1.0); // Cap à 1.0
	}

	private calculateSemanticSimilarity(
		queryWords: string[],
		protocolWords: string[],
	): number {
		if (queryWords.length === 0 || protocolWords.length === 0) {
			return 0.0;
		}

		const querySet = new Set(queryWords);
		const protocolSet = new Set(protocolWords);

		const intersection = new Set(
			[...querySet].filter((x) => protocolSet.has(x)),
		);
		const union = new Set([...querySet, ...protocolSet]);

		const jaccard = intersection.size / union.size;

		const importantWords = new Set([
			"force",
			"endurance",
			"récupération",
			"hydratation",
			"entraînement",
		]);
		const importantMatches = [...intersection].filter((word) =>
			importantWords.has(word),
		).length;
		const importanceBoost = importantMatches * 0.1;

		return Math.min(jaccard + importanceBoost, 1.0);
	}

	private calculateSynonymMatch(
		queryWords: string[],
		protocolWords: string[],
	): number {
		let synonymMatches = 0;
		const totalQueryWords = queryWords.length;

		if (totalQueryWords === 0) {
			return 0.0;
		}

		for (const queryWord of queryWords) {
			for (const [key, synonyms] of Object.entries(this.synonyms)) {
				if (queryWord === key || synonyms.includes(queryWord)) {
					if (
						protocolWords.includes(key) ||
						synonyms.some((syn) => protocolWords.includes(syn))
					) {
						synonymMatches++;
						break;
					}
				}
			}
		}

		return synonymMatches / totalQueryWords;
	}

	private calculateContextPatternScore(
		processedQuery: any,
		protocol: MilitaryProtocol,
	): number {
		if (!processedQuery.primaryContext) {
			return 0.0;
		}

		const primaryContext = processedQuery.primaryContext;
		const contextStrength = processedQuery.contextScores[primaryContext];

		const contextCategoryMapping: Record<string, string[]> = {
			strength_training: ["training/strength", "strength"],
			cardio_endurance: ["training/cardio", "training/endurance"],
			recovery_rest: ["recovery", "recovery/rest"],
			hydration_nutrition: [
				"nutrition",
				"training/hydration",
				"nutrition/hydration",
			],
		};

		const protocolCategory = `${protocol.category}/${protocol.subcategory}`;

		if (primaryContext in contextCategoryMapping) {
			const expectedCategories = contextCategoryMapping[primaryContext];
			if (expectedCategories.some((cat) => protocolCategory.includes(cat))) {
				return Math.min(contextStrength / 10.0, 1.0);
			}
		}

		return 0.0;
	}

	private calculateCategoryRelevance(
		processedQuery: any,
		protocol: MilitaryProtocol,
	): number {
		const category = protocol.category;

		const categoryKeywords: Record<string, string[]> = {
			training: ["entraînement", "exercice", "séance", "workout"],
			nutrition: ["nutrition", "alimentation", "hydratation", "eau"],
			recovery: ["récupération", "repos", "sommeil", "fatigue"],
			safety: ["sécurité", "prévention", "risque", "blessure"],
			medical: ["médical", "santé", "soins", "traitement"],
		};

		const queryWords = processedQuery.words;

		if (category in categoryKeywords) {
			const keywords = categoryKeywords[category];
			const matches = queryWords.filter((w: string) =>
				keywords.includes(w),
			).length;
			return Math.min(matches / keywords.length, 1.0);
		}

		return 0.0;
	}
}

export default class MilitaryProtocolService {
	private intelligentMatcher: IntelligentProtocolMatcher;
	private protocols: MilitaryProtocol[] | null = null;
	private readonly protocolsPath: string;

	constructor(
		protocolsPath: string = "all_military_protocols_COMPLETE_REAL.json",
	) {
		this.protocolsPath = protocolsPath;
		this.intelligentMatcher = new IntelligentProtocolMatcher();
	}

	private async loadProtocols(): Promise<MilitaryProtocol[]> {
		if (this.protocols) {
			return this.protocols;
		}

		try {
			const data = JSON.parse(fs.readFileSync(this.protocolsPath, "utf8"));
			this.protocols = data;
			return this.protocols!;
		} catch (error) {
			console.error("Error loading military protocols:", error);
			throw new Error("Failed to load military protocols");
		}
	}

	async processQuery(query: string): Promise<MilitaryProtocolResult> {
		try {
			const protocols = await this.loadProtocols();

			const matchedProtocols =
				this.intelligentMatcher.intelligentProtocolMatching(query, protocols);

			return {
				query,
				matchedProtocols: matchedProtocols.slice(0, 10),
			};
		} catch (error) {
			console.error("Error processing query with military protocols:", error);
			throw new Error("Failed to process query with military protocols");
		}
	}
}
