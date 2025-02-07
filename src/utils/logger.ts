import { LogObject } from "../types/common";

class Logger {
  private log(message: LogObject): void {
    const timestamp = new Date().toISOString();
    const logOutput = this.formatLogMessage(message, timestamp);

    switch (message.level) {
      case "Error":
        console.error(logOutput);
        break;
      case "Warning":
        console.warn(logOutput);
        break;
      case "Info":
      default:
        console.info(logOutput);
        break;
    }
  }

  private formatLogMessage(logObject: LogObject, timestamp: string): string {
    const { type = "Unknown", context, logMessage, level } = logObject;
    const { code, statusCode, correlationId, details, data, stack, message } =
      logMessage;

    const outputLines: string[] = [`${type} ${level} at ${timestamp}`];

    if (context) outputLines.push(`Context: ${context}`);
    if (message && !stack) outputLines.push(`Message: ${message}`);
    if (stack) outputLines.push(`Stack: ${stack}`);
    if (code) outputLines.push(`Code: ${code}`);
    if (statusCode) outputLines.push(`StatusCode: ${statusCode}`);
    if (correlationId) outputLines.push(`Correlation ID: ${correlationId}`);
    if (details && details.length > 0)
      outputLines.push(`Details: ${JSON.stringify(details, null, 2)}`);
    if (data) outputLines.push(`Data: ${JSON.stringify(data, null, 2)}`);

    return outputLines.join("\n");
  }

  public info(message: LogObject): void {
    message.level = "Info";
    this.log(message);
  }

  public warn(message: LogObject): void {
    message.level = "Warning";
    this.log(message);
  }

  public error(message: LogObject): void {
    message.level = "Error";
    this.log(message);
  }
}

export const logger = new Logger();
