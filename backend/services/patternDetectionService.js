// Deterministic, regex-based attack detection — zero external dependency, runs
// synchronously in-process. This is the layer that keeps working even if BOTH the
// ML service AND Groq are unreachable, so detection never goes fully dark. It also
// runs alongside the ML/Groq layer (see watcherService.js), not only when they fail —
// it catches known, unambiguous attack signatures the moment a request arrives, before
// any network round-trip, and its remediation text is baked in rather than AI-generated,
// so it's present immediately regardless of AI service availability.

const ATTACK_SIGNATURES = [
  {
    id: 'sql_injection',
    label: 'SQL Injection',
    severity: 'critical',
    patterns: [
      /union\s+select/i, /or\s+1\s*=\s*1/i, /'\s*or\s*'1'\s*=\s*'1/i,
      /;\s*drop\s+table/i, /'\s*--/, /;\s*--/, /waitfor\s+delay/i,
      /sleep\s*\(\s*\d+\s*\)/i, /information_schema/i, /xp_cmdshell/i,
      /'\s*or\s*1\s*=\s*1/i, /select\s+.+\s+from\s+.+\s+where/i
    ],
    remediation: 'Use parameterized queries / prepared statements everywhere — never build SQL by string-concatenating user input. Apply least-privilege DB permissions to the app account, and audit the affected endpoint for how it builds queries.'
  },
  {
    id: 'xss',
    label: 'Cross-Site Scripting (XSS)',
    severity: 'high',
    patterns: [
      /<script/i, /javascript:/i, /onerror\s*=/i, /onload\s*=/i,
      /<img[^>]+onerror/i, /document\.cookie/i, /<iframe/i, /<svg[^>]+onload/i
    ],
    remediation: 'Escape/encode all user-supplied output before rendering it in HTML, set a Content-Security-Policy header, and avoid innerHTML/dangerouslySetInnerHTML with raw user input — use a templating layer that auto-escapes by default.'
  },
  {
    id: 'path_traversal',
    label: 'Path Traversal',
    severity: 'critical',
    patterns: [
      /\.\.\//, /\.\.\\/, /etc\/passwd/i, /boot\.ini/i, /win\.ini/i,
      /%2e%2e%2f/i, /%2e%2e\//i, /\.\.%2f/i
    ],
    remediation: 'Never build file paths directly from user input. Resolve to an absolute path and verify it stays inside an allow-listed base directory before any file read/write.'
  },
  {
    id: 'command_injection',
    label: 'Command Injection',
    severity: 'critical',
    patterns: [
      /;\s*(rm|cat|wget|curl|nc|bash|sh)\s/i, /\|\s*(nc|bash|sh)\b/i,
      /\$\([^)]+\)/, /`[^`]+`/, /&&\s*(rm|wget|curl)/i
    ],
    remediation: 'Never pass user input to a shell (exec/system/eval). If a subprocess is unavoidable, use an argv-array API — never string concatenation — and validate input against a strict allow-list.'
  },
  {
    id: 'file_inclusion',
    label: 'Local/Remote File Inclusion',
    severity: 'critical',
    patterns: [/=\s*https?:\/\//i, /=\s*php:\/\//i, /=\s*data:\/\//i, /=\s*file:\/\//i],
    remediation: "Never use user input directly as a file/URL to include or fetch server-side. Allow-list expected values instead of trying to sanitize arbitrary URLs/paths."
  },
  {
    id: 'ssrf',
    label: 'Server-Side Request Forgery (SSRF)',
    severity: 'critical',
    patterns: [/169\.254\.169\.254/, /\b127\.0\.0\.1\b/, /\blocalhost\b/i, /metadata\.google/i],
    remediation: 'Never let user input control an outbound request\'s destination without an allow-list. Block requests to internal/link-local IP ranges (169.254.x.x, 127.x.x.x, 10.x.x.x, etc.) at the network layer too.'
  },
  {
    id: 'known_attack_tool',
    label: 'Known Attack Tool Detected',
    severity: 'high',
    userAgentPatterns: [
      /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /dirbuster/i, /gobuster/i,
      /wpscan/i, /acunetix/i, /nessus/i, /\bzap\b/i, /havij/i, /metasploit/i
    ],
    remediation: 'This User-Agent identifies a known security scanning tool. If this wasn\'t authorized penetration testing, block the source IP and review what it accessed.'
  }
];

const requestText = (requestFields) => [
  requestFields.getQuery, requestFields.postData, requestFields.hostHeader,
  requestFields.accept, requestFields.acceptCharset, requestFields.acceptLanguage,
  requestFields.cacheControl, requestFields.pragma, requestFields.contentType
].filter(Boolean).join(' ');

// Returns every matching signature (a single request can trip more than one), or [].
const detectAttackPatterns = (requestFields) => {
  const text = requestText(requestFields);
  const userAgent = requestFields.userAgent || '';

  return ATTACK_SIGNATURES.filter(sig => {
    if (sig.patterns) return sig.patterns.some(re => re.test(text));
    if (sig.userAgentPatterns) return sig.userAgentPatterns.some(re => re.test(userAgent));
    return false;
  });
};

module.exports = { detectAttackPatterns, ATTACK_SIGNATURES };
