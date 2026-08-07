import { Component, type ErrorInfo, type ReactNode } from "react";

import { formatDiagnosticCode } from "../utils/errorCodes";

export interface ErrorBoundaryFallbackState {
  readonly diagnosticCode: string;
}

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: (state: ErrorBoundaryFallbackState) => ReactNode;
  readonly onError?: (error: unknown, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly diagnosticCode: string | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    diagnosticCode: null,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {
      diagnosticCode: formatDiagnosticCode("FS_UNEXPECTED_RENDER_ERROR"),
    };
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  override render() {
    const { diagnosticCode } = this.state;

    if (diagnosticCode) {
      return this.props.fallback({ diagnosticCode });
    }

    return this.props.children;
  }
}
