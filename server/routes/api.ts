import { Router, type Request, type Response, type NextFunction } from 'express';
import type {
  ActionPlanResponse,
  AskAssistantResponse,
  RecommendationCardData,
} from '../../src/types/airQuality';
import {
  generateContentWithRetryAndFallback,
  getLastAiDiagnostic,
  isGeminiConfigured,
  sanitizeGeminiError,
} from '../config/gemini';
import {
  ACTION_PLAN_RESPONSE_SCHEMA,
  ASK_ASSISTANT_RESPONSE_SCHEMA,
  ASK_SYSTEM_INSTRUCTION,
  buildAskPrompt,
  buildPlanPrompt,
  PLAN_SYSTEM_INSTRUCTION,
} from '../prompts/airQualityPrompt';
import { hashNormalizedPayload, planResponseCache } from '../services/cacheService';
import {
  generateFallbackAssistantAnswer,
  generateParametricFallbackPlan,
} from '../services/fallbackPlanService';
import { verifyAndGroundRecommendations } from '../services/groundingService';
import { searchGeocodingLocations } from '../services/geocodingService';
import {
  sanitizeProfile,
  sanitizeQuestion,
  sanitizeScaleOverride,
  stripControlChars,
  truncateText,
  ValidationError,
} from '../services/sanitizationService';
import { fetchAirAndWeatherTelemetry } from '../services/weatherAirService';
import { logger } from '../utils/logger';

export const apiRouter = Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'vayuguard-api',
    geminiConfigured: isGeminiConfigured(),
    lastAiDiagnostic: getLastAiDiagnostic(),
    cache: planResponseCache.getStats(),
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/geocode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawQuery = typeof req.query.q === 'string' ? stripControlChars(req.query.q) : '';
    const cleanQuery = truncateText(rawQuery, 80);
    if (cleanQuery.length < 2) {
      res.json({ results: [] });
      return;
    }
    const results = await searchGeocodingLocations(cleanQuery);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

apiRouter.get('/air-quality', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawCity = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    if (rawCity.length < 2) {
      throw new ValidationError('Query parameter "city" must be at least 2 characters.');
    }
    const scaleOverride = sanitizeScaleOverride(req.query.scale);
    const telemetry = await fetchAirAndWeatherTelemetry(rawCity.slice(0, 80), scaleOverride);
    res.json({ telemetry });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = sanitizeProfile(req.body);
    const telemetry = await fetchAirAndWeatherTelemetry(profile.city, profile.scaleOverride);

    // Include city, profile, regional scale, and telemetry bucket in cache key
    const cacheKey = hashNormalizedPayload({
      profile,
      scaleCode: telemetry.scaleCode,
      aqiBucket:
        telemetry.scaleMax === 500 ? Math.round(telemetry.aqiValue / 10) * 10 : telemetry.aqiValue,
      categoryLabel: telemetry.categoryLabel,
      inversion: telemetry.thermalInversionRisk,
      source: telemetry.source,
    });

    const cached = planResponseCache.get(cacheKey) as ActionPlanResponse | undefined;
    if (cached) {
      res.json({
        ...cached,
        telemetry,
        metadata: {
          ...cached.metadata,
          cached: true,
        },
      });
      return;
    }

    let dailyBriefing = '';
    let ventilationGuidance = telemetry.recommendedVentilationWindow;
    let rawRecommendations: RecommendationCardData[] = [];
    let modelUsed = 'parametric-meteorological-fallback';
    let fallbackTriggered = false;

    if (isGeminiConfigured()) {
      try {
        const prompt = buildPlanPrompt(profile, telemetry);
        const aiResult = await generateContentWithRetryAndFallback({
          contents: prompt,
          systemInstruction: PLAN_SYSTEM_INSTRUCTION,
          responseSchema: ACTION_PLAN_RESPONSE_SCHEMA,
        });

        const parsed = JSON.parse(aiResult.text) as {
          dailyBriefing?: string;
          ventilationGuidance?: string;
          recommendations?: RecommendationCardData[];
        };

        if (
          parsed &&
          typeof parsed.dailyBriefing === 'string' &&
          Array.isArray(parsed.recommendations) &&
          parsed.recommendations.length > 0
        ) {
          dailyBriefing = parsed.dailyBriefing;
          ventilationGuidance =
            typeof parsed.ventilationGuidance === 'string' && parsed.ventilationGuidance.trim()
              ? parsed.ventilationGuidance
              : telemetry.recommendedVentilationWindow;
          rawRecommendations = parsed.recommendations;
          modelUsed = aiResult.modelUsed;
        } else {
          throw new Error('Malformed structured JSON plan from Gemini');
        }
      } catch (aiErr) {
        logger.warn('Gemini plan generation fell back to parametric engine', {
          reason: sanitizeGeminiError(aiErr),
        });
        const fallback = generateParametricFallbackPlan(profile, telemetry);
        dailyBriefing = fallback.dailyBriefing;
        ventilationGuidance = fallback.ventilationGuidance;
        rawRecommendations = fallback.recommendations;
        fallbackTriggered = true;
      }
    } else {
      const fallback = generateParametricFallbackPlan(profile, telemetry);
      dailyBriefing = fallback.dailyBriefing;
      ventilationGuidance = fallback.ventilationGuidance;
      rawRecommendations = fallback.recommendations;
      fallbackTriggered = true;
    }

    const { recommendations, adjustmentsCount } = verifyAndGroundRecommendations(
      rawRecommendations,
      telemetry,
    );

    const responsePayload: ActionPlanResponse = {
      telemetry,
      dailyBriefing,
      ventilationGuidance,
      recommendations,
      metadata: {
        modelUsed,
        cached: false,
        fallbackTriggered,
        generatedAt: new Date().toISOString(),
        groundingAdjustmentsCount: adjustmentsCount,
      },
    };

    planResponseCache.set(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/ask', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const question = sanitizeQuestion(body.question);
    const profile = sanitizeProfile(body.profile);
    const telemetry = await fetchAirAndWeatherTelemetry(profile.city, profile.scaleOverride);

    if (isGeminiConfigured()) {
      try {
        const prompt = buildAskPrompt(question, profile, telemetry);
        const aiResult = await generateContentWithRetryAndFallback({
          contents: prompt,
          systemInstruction: ASK_SYSTEM_INSTRUCTION,
          responseSchema: ASK_ASSISTANT_RESPONSE_SCHEMA,
        });

        const parsed = JSON.parse(aiResult.text) as Partial<AskAssistantResponse>;
        if (typeof parsed.answer === 'string' && parsed.answer.trim().length > 0) {
          res.json({
            answer: parsed.answer.trim(),
            groundedMetricsUsed: Array.isArray(parsed.groundedMetricsUsed)
              ? parsed.groundedMetricsUsed.slice(0, 6)
              : [`${telemetry.scaleName} AQI ${telemetry.aqiValue}`, `PM2.5 ${telemetry.pm25} µg/m³`],
            cautionNote:
              typeof parsed.cautionNote === 'string' && parsed.cautionNote.trim().length > 0
                ? parsed.cautionNote.trim()
                : 'Environmental guidance is informational; seek medical advice for acute respiratory symptoms.',
            modelUsed: aiResult.modelUsed,
            fallbackTriggered: false,
          } satisfies AskAssistantResponse);
          return;
        }
      } catch (aiErr) {
        logger.warn('Gemini Q&A fell back to parametric engine', {
          reason: sanitizeGeminiError(aiErr),
        });
      }
    }

    res.json(generateFallbackAssistantAnswer(question, profile, telemetry));
  } catch (err) {
    next(err);
  }
});
