import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { STATUS_ACCESSIBLE_TOKENS } from '../styles/accessibleTheme';

interface ErrorAlertBannerProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
}

export function ErrorAlertBanner({
  title = 'Unable to complete request',
  message,
  onDismiss,
}: ErrorAlertBannerProps) {
  const token = STATUS_ACCESSIBLE_TOKENS.errorAlert;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        backgroundColor: token.background,
        borderColor: token.border,
        color: token.foreground,
      }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="self-start rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors hover:opacity-90 sm:self-center"
          style={{
            borderColor: token.border,
            backgroundColor: '#FFFFFF',
            color: token.foreground,
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[VayuGuard UI ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-12">
          <ErrorAlertBanner
            title="Application interface recovered from an error"
            message={this.state.errorMessage}
          />
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0B3A63]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reload Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
