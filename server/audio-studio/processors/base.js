/**
 * Processor interface helpers.
 * Heavy DSP processors refuse to run unless capability registry says enabled.
 */

/**
 * @typedef {{
 *   name: string,
 *   canRun(context: object): boolean|Promise<boolean>,
 *   validate(input: object): { ok: boolean, errorCode?: string },
 *   execute(input: object, options?: object): Promise<object>,
 *   getResult(): object|null,
 *   getDiagnostics(): object,
 *   rollback(): Promise<void>|void,
 *   cleanup(): Promise<void>|void,
 * }} AudioProcessor
 */

/**
 * @param {string} name
 * @param {{
 *   capabilityKey: string,
 *   operation: string,
 * }} cfg
 * @returns {AudioProcessor}
 */
export function createGatedProcessor(name, cfg) {
  let result = null;
  let diagnostics = { name, ran: false, skipped: false, errorCode: null };

  return {
    name,
    canRun(context) {
      const reg = context.registry || {};
      const entry = reg[cfg.capabilityKey];
      return Boolean(entry?.enabled && entry?.state === 'enabled');
    },
    validate(input) {
      if (!input?.localPath) {
        return { ok: false, errorCode: 'INVALID_INPUT' };
      }
      return { ok: true };
    },
    async execute(_input, _options) {
      diagnostics = {
        name,
        ran: false,
        skipped: false,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        operation: cfg.operation,
        note: 'Processor scaffold only — no simulated audio output',
      };
      result = {
        ok: false,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        operation: cfg.operation,
      };
      return result;
    },
    getResult() {
      return result;
    },
    getDiagnostics() {
      return { ...diagnostics };
    },
    async rollback() {},
    async cleanup() {
      result = null;
    },
  };
}

export function buildDefaultProcessorChain() {
  return [
    createGatedProcessor('normalize_format', {
      capabilityKey: 'metadataInspection',
      operation: 'normalize_format',
    }),
    createGatedProcessor('remove_noise', {
      capabilityKey: 'noiseReduction',
      operation: 'remove_noise',
    }),
    createGatedProcessor('isolate_vocal', {
      capabilityKey: 'stemSeparation',
      operation: 'isolate_vocal',
    }),
    createGatedProcessor('tune_vocal', {
      capabilityKey: 'vocalTuning',
      operation: 'tune_vocal',
    }),
    createGatedProcessor('mix', {
      capabilityKey: 'mixing',
      operation: 'mix',
    }),
    createGatedProcessor('master', {
      capabilityKey: 'mastering',
      operation: 'master',
    }),
    createGatedProcessor('add_instrumentation', {
      capabilityKey: 'instrumentGeneration',
      operation: 'add_instrumentation',
    }),
  ];
}
