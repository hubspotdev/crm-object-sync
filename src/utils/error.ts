import { logger } from "./logger";
import shutdown from "./shutdown";
import { LogObject } from "../types/common";

function isHubSpotApiError(error: any): boolean {
  // Check for presence of typical HubSpot headers
  const hasHubspotHeaders =
    error.headers &&
    ("x-hubspot-correlation-id" in error.headers ||
      "x-hubspot-ratelimit-max" in error.headers);

  // Check for presence of HubSpot-specific fields in the error body
  const hasHubspotFields =
    error.body &&
    error.body.status === "error" &&
    typeof error.body.correlationId === "string" &&
    typeof error.body.groupsErrorCode === "string";

  return (
    hasHubspotHeaders ||
    hasHubspotFields ||
    Boolean(
      error?.message?.includes("hubapi") ||
        error?.logMessage?.message?.body.includes("hubspot-correlation-id"),
    )
  );
}

function isGeneralPrismaError(error: any): boolean {
  return (
    error?.stack?.includes("@prisma/client") ||
    error?.message?.includes("prisma")
  );
}

function formatError(logMessage: any, context: string = ""): any {
  const error: LogObject = { logMessage, context };
  if (!error.type) {
    if (isGeneralPrismaError(logMessage)) {
      error.type = "Prisma";
    } else if (isHubSpotApiError(logMessage)) {
      error.type = "Hubspot API";
    } else if (logMessage instanceof Error) {
      error.type = "General";
    } else {
      error.type = "Non-error object was thrown";
    }
  }
  return error;
}

function handleError(
  error: any,
  context: string = "",
  critical: boolean = false,
): void {
  const formattedError = formatError(error, context);
  logger.error(formattedError);

  if (critical) shutdown();
}

export default handleError;
