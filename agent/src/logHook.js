const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info?.bind(console) || console.log.bind(console),
  debug: console.debug?.bind(console) || console.log.bind(console)
};

let hooked = false;

const hookConsole = (onLog) => {
  if (hooked) return;
  hooked = true;

  const intercept = (level, originalFn) => {
    return (...args) => {
      originalFn(...args);
      try {
        const message = args.map(a => {
          if (typeof a === 'string') return a;
          if (a instanceof Error) return `${a.name}: ${a.message}`;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ');

        const meta = {};
        const lastArg = args[args.length - 1];
        if (typeof lastArg === 'object' && lastArg !== null && !(lastArg instanceof Error)) {
          Object.assign(meta, lastArg);
        }

        onLog(level, message, meta);
      } catch {
        // Never let monitoring break the app
      }
    };
  };

  console.log   = intercept('info',  originalConsole.log);
  console.info  = intercept('info',  originalConsole.info);
  console.warn  = intercept('warn',  originalConsole.warn);
  console.error = intercept('error', originalConsole.error);
  console.debug = intercept('debug', originalConsole.debug);
};

const unhookConsole = () => {
  if (!hooked) return;
  console.log   = originalConsole.log;
  console.info  = originalConsole.info;
  console.warn  = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
  hooked = false;
};

module.exports = { hookConsole, unhookConsole };
