import type { Instrumentation } from "next";

// Log strutturati senza URL con parametri, header, cookie, body o messaggi DB.
export const onRequestError: Instrumentation.onRequestError = (error, _request, context) => {
  console.error(JSON.stringify({ event: "request_error", route: context.routePath, type: context.routeType,
    digest: error && typeof error === "object" && "digest" in error ? String(error.digest) : undefined }));
};
