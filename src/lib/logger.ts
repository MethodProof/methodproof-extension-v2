/** Structured logger for MethodProof extension */

interface LogFields {
  [key: string]: unknown;
}

const SERVICE = "methodproof-extension";

function emit(level: string, event: string, fields: LogFields = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: SERVICE,
    ...fields,
  };
  if (level === "error" || level === "critical") {
    console.error(JSON.stringify(entry));
  } else if (level === "warning") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (event: string, fields?: LogFields): void => emit("debug", event, fields),
  info: (event: string, fields?: LogFields): void => emit("info", event, fields),
  warning: (event: string, fields?: LogFields): void => emit("warning", event, fields),
  error: (event: string, fields?: LogFields): void => emit("error", event, fields),
  critical: (event: string, fields?: LogFields): void => emit("critical", event, fields),
};
