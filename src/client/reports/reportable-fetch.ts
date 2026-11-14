/**
 * Reporting-aware fetch wrapper for same-origin API requests.
 * Detects 5xx and network dropouts on /api/* routes (excluding /api/reports/*)
 * and dispatches them to the issue reporter.
 */

import { captureClientCrash } from './collectors';

function parseSameOriginApiPath(urlStr: string): { isSameOriginApi: boolean; safePath: string } {
  if (urlStr.startsWith('/') && !urlStr.startsWith('//')) {
    const safePath = urlStr.split(/[?#]/)[0];
    return {
      isSameOriginApi: safePath.startsWith('/api/'),
      safePath,
    };
  }

  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
    const parsed = new URL(urlStr, origin);
    const safePath = parsed.pathname;
    return {
      isSameOriginApi: parsed.origin === origin && safePath.startsWith('/api/'),
      safePath,
    };
  } catch {
    return { isSameOriginApi: false, safePath: '' };
  }
}

export async function reportableFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr = typeof input === 'string'
    ? input
    : input instanceof URL
    ? input.toString()
    : input.url;

  const { isSameOriginApi, safePath } = parseSameOriginApiPath(urlStr);
  const isReportsEndpoint = safePath === '/api/reports' || safePath.startsWith('/api/reports/');

  try {
    const response = await fetch(input, init);

    // Only report 5xx server errors on non-report API endpoints (never 4xx validation)
    if (isSameOriginApi && !isReportsEndpoint && response.status >= 500) {
      let errorDetails = `HTTP ${response.status} ${response.statusText}`;
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        if (json?.crashReport) {
          // Server returned a sealed crash draft offer; the caller handles queueServerCrash without duplicating an API_FAILURE.
          return response;
        }
        if (json.error) {
          errorDetails = `${errorDetails}: ${json.error}`;
        }
      } catch {
        // Non-JSON response
      }

      captureClientCrash(
        'API_FAILURE',
        'ApiServerError',
        `Server failure on ${safePath}: ${errorDetails}`,
        `Status: ${response.status}\nEndpoint: ${safePath}`
      );
    }

    return response;
  } catch (netErr) {
    if (isSameOriginApi && !isReportsEndpoint) {
      const message = netErr instanceof Error ? netErr.message : String(netErr);
      const stack = netErr instanceof Error ? netErr.stack : undefined;
      captureClientCrash(
        'API_FAILURE',
        'ApiNetworkError',
        `Network failure connecting to ${safePath}: ${message}`,
        stack
      );
    }
    throw netErr;
  }
}
