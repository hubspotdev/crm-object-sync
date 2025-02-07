export interface LogMessage {
  message: string;
  object?: any;
  context?:string;
  data?: any;
  stack?: string;
  code?: string;
  statusCode?: number;
  correlationId?: string;
  details?: any[];
  error?: Error
}

type LogLevel = 'Info' | 'Warning' | 'Error';

export interface LogObject {
  logMessage : LogMessage,
  critical? : boolean,
  context? : string,
  type? : string
  level?: LogLevel
}
