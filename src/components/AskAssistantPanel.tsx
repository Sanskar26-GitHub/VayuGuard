import React, { useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { ACCESSIBLE_SURFACES } from '../styles/accessibleTheme';
import type {
  AirTelemetry,
  AskAssistantResponse,
  HouseholdProfile,
} from '../types/airQuality';
import { ErrorAlertBanner } from './ErrorBoundary';

interface AskAssistantPanelProps {
  profile: HouseholdProfile;
  telemetry: AirTelemetry | null;
}

const SUGGESTED_QUESTIONS = [
  'Is it safe to open windows for 20 minutes right now?',
  'When is the safest time for children or seniors to step outside today?',
  'How should we vent kitchen cooking smoke without letting smog in?',
] as const;

export function AskAssistantPanel({ profile, telemetry }: AskAssistantPanelProps) {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerData, setAnswerData] = useState<AskAssistantResponse | null>(null);

  const submitQuestion = async (textToAsk: string) => {
    const trimmed = textToAsk.trim();
    if (trimmed.length < 3) {
      setError('Please enter a question of at least 3 characters.');
      return;
    }

    setError(null);
    setIsAsking(true);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          profile,
          telemetry,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to get an assistant response.');
      }

      setAnswerData(data as AskAssistantResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach the assistant.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitQuestion(question);
  };

  return (
    <section
      id="ask-assistant-section"
      aria-labelledby="ask-assistant-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-start gap-2.5 border-b border-slate-200 pb-4">
        <MessageSquare className="mt-0.5 h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
        <div>
          <h2 id="ask-assistant-heading" className="text-xl font-bold text-slate-900">
            Ask the Air Assistant
          </h2>
          <p className="text-sm text-slate-600">
            Get situational advice grounded in{' '}
            {telemetry
              ? `${telemetry.resolvedLocation}'s ${telemetry.scaleName} (${telemetry.aqiValue}/${telemetry.scaleMax} · ${telemetry.categoryLabel})`
              : 'your city telemetry'}{' '}
            and household profile.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Suggested situational questions">
        {SUGGESTED_QUESTIONS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={isAsking}
            onClick={() => {
              setQuestion(prompt);
              void submitQuestion(prompt);
            }}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="assistant-question-input" className="sr-only">
          Ask a situational air quality question
        </label>
        <input
          id="assistant-question-input"
          type="text"
          maxLength={400}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about outdoor exercise, window timing, masks, or kitchen ventilation..."
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={isAsking}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-65"
          style={{
            backgroundColor: ACCESSIBLE_SURFACES.primaryAction.background,
            color: ACCESSIBLE_SURFACES.primaryAction.foreground,
          }}
        >
          {isAsking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Ask Assistant</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4">
          <ErrorAlertBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {answerData && (
        <div
          aria-live="polite"
          className="mt-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-sm leading-relaxed text-slate-900">{answerData.answer}</p>

          <div className="border-t border-slate-200 pt-2.5 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">Metrics Grounded: </span>
            <span className="font-mono">
              {answerData.groundedMetricsUsed.join(' · ')}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">Caution: </span>
            {answerData.cautionNote}
          </p>
        </div>
      )}
    </section>
  );
}
