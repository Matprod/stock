import env from '#start/env'
import Groq from 'groq-sdk'
import sharp from 'sharp'
import axios from 'axios'

type FoodItemRecognition = {
  name: string
  portion: number
}

type FoodItemNutrition = FoodItemRecognition & {
  nutrition_per_100g: Record<string, number | null | undefined>
}

function normalizeAcceptLanguage(raw: string | null | undefined): 'fr' | 'en' {
  const first = (raw ?? '').split(',')[0]?.trim().toLowerCase()
  if (first.startsWith('fr')) return 'fr'
  return 'en'
}

function stripCodeFences(s: string): string {
  const trimmed = s.trim()
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/```$/, '')
      .trim()
  }
  return trimmed
}

export default class FoodAIService {
  private readonly groq: Groq
  private readonly groqModelVision = 'qwen/qwen3.6-27b'
  private readonly groqModelText = 'qwen/qwen3.6-27b'

  constructor() {
    this.groq = new Groq({ apiKey: env.get('GROQ_API_KEY') })
  }

  public getLanguageFromHeader(acceptLanguage: string | null | undefined) {
    return normalizeAcceptLanguage(acceptLanguage)
  }

  private async maybeResizeJpeg(input: Buffer): Promise<Buffer> {
    const sizeMb = input.byteLength / (1024 * 1024)
    if (sizeMb < 20) return input

    // Rough equivalent of PIL resize(0.7) + quality 85 in the Django code.
    const image = sharp(input, { failOnError: false })
    const meta = await image.metadata()
    const width = meta.width ? Math.max(1, Math.floor(meta.width * 0.7)) : undefined
    const height = meta.height ? Math.max(1, Math.floor(meta.height * 0.7)) : undefined

    return await image.resize(width, height, { fit: 'fill' }).jpeg({ quality: 85 }).toBuffer()
  }

  private parseJsonArray<T = unknown>(raw: string): T[] | null {
    if (!raw || !raw.trim()) return null
    let cleaned = raw
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
      .replace(/<think>[\s\S]*$/gi, '')
      .replace(/<reasoning>[\s\S]*$/gi, '')
      .replace(/<analysis>[\s\S]*$/gi, '')
      .trim()
    cleaned = stripCodeFences(cleaned)
    cleaned = cleaned.replace(/'/g, '"')

    try {
      const parsed = JSON.parse(cleaned)
      return Array.isArray(parsed) ? (parsed as T[]) : null
    } catch {
      // ignore
    }

    const matches = cleaned.match(/\[[\s\S]*\]/g)
    if (matches) {
      for (let i = matches.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(matches[i])
          if (Array.isArray(parsed)) return parsed as T[]
        } catch {
          // ignore
        }
      }
    }

    return null
  }

  private getFoodRecognitionPrompt(language: 'fr' | 'en') {
    return `
You are a food recognition expert. Your task is to analyze the food image and identify ALL food items and their portion sizes.

For each food item, return its name and estimate the portion size in grams.

Return a JSON array of objects, where each object represents a separate food item with this exact structure:
[
  {
    "name": "Food name",
    "portion": portion_size_in_grams
  }
]

Guidelines:
- Identify ALL visible food items in the image
- Always return a valid JSON array.
- Don't give any other information than the JSON.
- Provide realistic portion size estimates in grams
- Use common food names that users would recognize
- Return an empty array if no food items are detected
- Respond in ${language === 'fr' ? 'French' : 'English'}.
`.trim()
  }

  private getNutritionAnalysisPrompt(items: FoodItemRecognition[], language: 'fr' | 'en') {
    const lines = items.map((i) => `- ${i.name}: ${i.portion}g`).join('\n')

    return `
You are a nutrition analysis expert. Based on the following confirmed food items and their portions, provide detailed nutritional information.

Food items to analyze:
${lines}

For each food item, return detailed nutritional information per 100g in this exact JSON structure:
[
  {
    "name": "Food name",
    "portion": portion_size_in_grams,
    "nutrition_per_100g": {
      "energy_kcal": value,
      "water_g": value,
      "proteins_g": value,
      "carbohydrate_g": value,
      "fat_g": value,
      "fibres_g": value,
      "sugars_g": value,
      "sodium_mg": value,
      "gluten_g": value,
      "starch_g": value,
      "alcohol_g": value,
      "FA_saturated_g": value,
      "FA_mono_g": value,
      "FA_poly_g": value,
      "FA_181_g": value,
      "FA_182_g": value,
      "cholesterol_mg": value,
      "salt_g": value,
      "calcium_mg": value,
      "chloride_mg": value,
      "copper_mg": value,
      "iron_mg": value,
      "iodine_microg": value,
      "magnesium_mg": value,
      "manganese_mg": value,
      "phosphorus_mg": value,
      "potassium_mg": value,
      "selenium_microg": value,
      "zinc_mg": value,
      "vitamin_D_microg": value,
      "vitamin_E_mg": value,
      "vitamin_C_mg": value,
      "vitamin_B1_mg": value,
      "vitamin_B2_mg": value,
      "vitamin_B3_mg": value,
      "vitamin_B5_mg": value,
      "vitamin_B6_mg": value,
      "vitamin_B9_microg": value,
      "vitamin_B12_microg": value,
      "fructose_g": value,
      "glucose_g": value,
      "lactose_g": value,
      "maltose_g": value,
      "sucrose_g": value
    }
  }
]

Guidelines:
- Always return a valid JSON array.
- Don't give any other information than the JSON.
- If uncertain about specific values, make reasonable estimates
- Respond in ${language === 'fr' ? 'French' : 'English'}.
`.trim()
  }

  private async groqVision(prompt: string, base64Jpeg: string): Promise<string> {
    const response = await this.groq.chat.completions.create({
      model: this.groqModelVision,
      max_tokens: 8000,
      temperature: 0,
      reasoning_effort: 'none',
      messages: [
        {
          role: 'system',
          content:
            'You are a food analysis expert. Do not use <think>, reasoning, or explanations. Output only a valid JSON array.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` },
            },
          ],
        },
      ],
    } as any)
    const content = response.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('Empty response from Groq')
    return content
  }

  private async groqText(prompt: string): Promise<string> {
    const response = await this.groq.chat.completions.create({
      model: this.groqModelText,
      temperature: 0,
      max_tokens: 16000,
      reasoning_effort: 'none',
      messages: [
        {
          role: 'system',
          content:
            'You are a nutrition analysis expert. Do not use <think>, reasoning, or explanations. Output only a valid JSON array.',
        },
        { role: 'user', content: prompt },
      ],
    } as any)
    const content = response.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('Empty response from Groq')
    return content
  }

  private async geminiChatCompletions(body: any): Promise<string> {
    const key = env.get('GEMINI_API_KEY')
    const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    const res = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    })
    const content = res.data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Empty response from Gemini')
    }
    return content.trim()
  }

  private async geminiVision(
    prompt: string,
    base64Jpeg: string,
    athleteId: string
  ): Promise<string> {
    // TODO refacto: constant 630 was a number
    const model = athleteId === '630' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash'
    return await this.geminiChatCompletions({
      model,
      max_tokens: 6000,
      messages: [
        {
          role: 'system',
          content:
            'You are a food analysis expert. Always provide your best estimate, and only output the requested JSON.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` },
            },
          ],
        },
      ],
    })
  }

  private async geminiText(prompt: string): Promise<string> {
    return await this.geminiChatCompletions({
      model: 'gemini-2.5-flash-lite',
      max_tokens: 10_000,
      messages: [
        {
          role: 'system',
          content:
            'You are a nutrition analysis expert. Always provide your best estimate, and only output the requested JSON.',
        },
        { role: 'user', content: prompt },
      ],
    })
  }

  public async recognizeFoodItems(params: {
    imageBuffer: Buffer
    athleteId: string
    acceptLanguage?: string | null
  }): Promise<FoodItemRecognition[]> {
    const language = this.getLanguageFromHeader(params.acceptLanguage)
    const prompt = this.getFoodRecognitionPrompt(language)
    const jpeg = await this.maybeResizeJpeg(params.imageBuffer)
    const base64Jpeg = jpeg.toString('base64')

    const runners: Array<() => Promise<string>> = []
    if (env.get('GEMINI_API_KEY')?.length) {
      runners.push(() => this.geminiVision(prompt, base64Jpeg, params.athleteId))
    }
    runners.push(() => this.groqVision(prompt, base64Jpeg))

    let lastError: unknown = null
    for (const run of runners) {
      try {
        const raw = await run()
        const parsed = this.parseJsonArray<FoodItemRecognition>(raw)
        if (parsed && parsed.length > 0) return parsed
      } catch (e) {
        lastError = e
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Food recognition failed')
  }

  public async analyzeNutritionFromFoodItems(params: {
    foodItems: FoodItemRecognition[]
    acceptLanguage?: string | null
  }): Promise<FoodItemNutrition[]> {
    const language = this.getLanguageFromHeader(params.acceptLanguage)
    const prompt = this.getNutritionAnalysisPrompt(params.foodItems, language)

    const runners: Array<() => Promise<string>> = []
    if (env.get('GEMINI_API_KEY')?.length) {
      runners.push(() => this.geminiText(prompt))
    }
    runners.push(() => this.groqText(prompt))

    let lastError: unknown = null
    for (const run of runners) {
      try {
        const raw = await run()
        const parsed = this.parseJsonArray<FoodItemNutrition>(raw)
        if (parsed && parsed.length > 0) {
          return parsed
        }
      } catch (e) {
        lastError = e
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Nutrition analysis failed')
  }
}
