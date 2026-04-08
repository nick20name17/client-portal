const ts = () => new Date().toISOString();

export const logger = {
  log: (...a: unknown[]) => console.log(ts(), "[info]", ...a),
  warn: (...a: unknown[]) => console.warn(ts(), "[warn]", ...a),
  error: (...a: unknown[]) => console.error(ts(), "[error]", ...a),
};
