/**
 * Safe Mathematical & Scientific Expression Evaluator
 * Supports arithmetic, precedence, scientific functions, constants, and user variables.
 */

export interface EvalResult {
  value: number;
  isValid: boolean;
  error?: string;
}

/**
 * Preprocesses calculus operations: definite integrals ∫(f, a, b), derivatives diff(f, x0), summations Σ(f, a, b)
 */
function preprocessCalculus(rawExpr: string, vars: Record<string, number>): string {
  let result = rawExpr;

  // Replace Ran# or ran# with ran()
  result = result.replace(/Ran#|ran#/gi, 'ran()');

  // Replace infix nPr e.g. 5 nPr 2 or 5P2 -> npr(5, 2)
  result = result.replace(/(\d+(?:\.\d+)?)\s*(?:nPr|P)\s*(\d+(?:\.\d+)?)/g, 'npr($1,$2)');

  // Replace infix nCr e.g. 5 nCr 2 or 5C2 -> ncr(5, 2)
  result = result.replace(/(\d+(?:\.\d+)?)\s*(?:nCr|C)\s*(\d+(?:\.\d+)?)/g, 'ncr($1,$2)');

  const patterns = ['integral', 'integrate', '∫', 'diff', 'derivative', 'd/dx', 'sumseq', 'sumatoria', 'Σ'];

  for (const prefix of patterns) {
    let searchIdx = 0;
    while (searchIdx < result.length) {
      const idx = result.indexOf(prefix + '(', searchIdx);
      if (idx === -1) break;

      const startParen = idx + prefix.length;
      let depth = 1;
      let endParen = -1;
      const commaIndices: number[] = [];

      for (let i = startParen + 1; i < result.length; i++) {
        if (result[i] === '(') depth++;
        else if (result[i] === ')') {
          depth--;
          if (depth === 0) {
            endParen = i;
            break;
          }
        } else if (result[i] === ',' && depth === 1) {
          commaIndices.push(i);
        }
      }

      if (endParen === -1) {
        searchIdx = idx + 1;
        continue;
      }

      const inside = result.substring(startParen + 1, endParen);

      if (prefix === 'integral' || prefix === 'integrate' || prefix === '∫') {
        if (commaIndices.length >= 2) {
          const firstComma = commaIndices[0] - (startParen + 1);
          const secondComma = commaIndices[1] - (startParen + 1);
          const fExpr = inside.substring(0, firstComma).trim();
          const aExpr = inside.substring(firstComma + 1, secondComma).trim();
          const bExpr = inside.substring(secondComma + 1).trim();

          const aVal = evaluateExpression(aExpr, vars).value;
          const bVal = evaluateExpression(bExpr, vars).value;

          // Simpson's 1/3 numerical quadrature
          const n = 64;
          const h = (bVal - aVal) / n;
          let sumVal =
            evaluateExpression(fExpr, { ...vars, x: aVal, X: aVal }).value +
            evaluateExpression(fExpr, { ...vars, x: bVal, X: bVal }).value;

          for (let step = 1; step < n; step++) {
            const xi = aVal + step * h;
            const factor = step % 2 === 0 ? 2 : 4;
            const evalStep = evaluateExpression(fExpr, { ...vars, x: xi, X: xi });
            if (!evalStep.isValid) throw new Error(evalStep.error || 'Error en integral');
            sumVal += factor * evalStep.value;
          }

          const numResult = (h / 3) * sumVal;
          result = result.substring(0, idx) + `(${numResult})` + result.substring(endParen + 1);
          searchIdx = idx;
          continue;
        }
      } else if (prefix === 'diff' || prefix === 'derivative' || prefix === 'd/dx') {
        if (commaIndices.length >= 1) {
          const firstComma = commaIndices[0] - (startParen + 1);
          const fExpr = inside.substring(0, firstComma).trim();
          const x0Expr = inside.substring(firstComma + 1).trim();
          const x0 = evaluateExpression(x0Expr, vars).value;
          const h = 1e-5;
          const f1 = evaluateExpression(fExpr, { ...vars, x: x0 + h, X: x0 + h }).value;
          const f0 = evaluateExpression(fExpr, { ...vars, x: x0 - h, X: x0 - h }).value;
          const numResult = (f1 - f0) / (2 * h);
          result = result.substring(0, idx) + `(${numResult})` + result.substring(endParen + 1);
          searchIdx = idx;
          continue;
        }
      } else if (prefix === 'sumseq' || prefix === 'Σ') {
        if (commaIndices.length >= 2) {
          const firstComma = commaIndices[0] - (startParen + 1);
          const secondComma = commaIndices[1] - (startParen + 1);
          const fExpr = inside.substring(0, firstComma).trim();
          const aExpr = inside.substring(firstComma + 1, secondComma).trim();
          const bExpr = inside.substring(secondComma + 1).trim();

          const startVal = Math.round(evaluateExpression(aExpr, vars).value);
          const endVal = Math.round(evaluateExpression(bExpr, vars).value);

          let totalSum = 0;
          for (let k = startVal; k <= endVal; k++) {
            totalSum += evaluateExpression(fExpr, { ...vars, x: k, X: k }).value;
          }
          result = result.substring(0, idx) + `(${totalSum})` + result.substring(endParen + 1);
          searchIdx = idx;
          continue;
        }
      }

      searchIdx = idx + 1;
    }
  }

  return result;
}

export function evaluateExpression(
  expr: string,
  variables: Record<string, number> = {}
): EvalResult {
  const trimmed = expr.trim();
  if (!trimmed) {
    return { value: 0, isValid: true };
  }

  try {
    const preprocessed = preprocessCalculus(trimmed, variables);
    const tokens = tokenize(preprocessed);
    const rpn = toRPN(tokens, variables);
    const value = evaluateRPN(rpn);
    
    if (typeof value !== 'number' || isNaN(value)) {
      return { value: 0, isValid: false, error: 'Resultado no numérico' };
    }
    if (!isFinite(value)) {
      return { value: 0, isValid: false, error: 'División por cero o infinito' };
    }

    return { value, isValid: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error de sintaxis';
    return { value: 0, isValid: false, error: message };
  }
}

type TokenType = 'NUMBER' | 'IDENT' | 'OP' | 'LPAREN' | 'RPAREN' | 'COMMA';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers (e.g., 12, 3.14, .5)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < n && /\d/.test(input[i + 1]))) {
      let numStr = '';
      while (i < n && (/\d/.test(input[i]) || input[i] === '.')) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Identifiers (functions, constants, @variable names e.g., @tasa, @iva, tasa, sin)
    if (ch === '@' || /[a-zA-Z_áéíóúÁÉÍÓÚñÑ]/.test(ch)) {
      let ident = '';
      while (i < n && (/[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]/.test(input[i]) || input[i] === '@')) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    // Operators and Parentheses
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Postfix Factorial !
    if (ch === '!') {
      tokens.push({ type: 'OP', value: '!' });
      i++;
      continue;
    }

    if (['+', '-', '*', '/', '^', '%'].includes(ch)) {
      // Check for unary + or -
      const prev = tokens[tokens.length - 1];
      const isUnary =
        (ch === '+' || ch === '-') &&
        (!prev || prev.type === 'OP' || prev.type === 'LPAREN' || prev.type === 'COMMA');

      if (isUnary) {
        tokens.push({ type: 'OP', value: ch === '-' ? 'u-' : 'u+' });
      } else {
        tokens.push({ type: 'OP', value: ch });
      }
      i++;
      continue;
    }

    throw new Error(`Carácter no reconocido: "${ch}"`);
  }

  return tokens;
}

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  '^': 3,
  'u+': 4,
  'u-': 4,
  '!': 5,
};

const RIGHT_ASSOCIATIVE = new Set(['^', 'u+', 'u-']);

const SCIENTIFIC_FUNCS: Record<string, (args: number[]) => number> = {
  sqrt: (args) => {
    if (args[0] < 0) throw new Error('Raíz cuadrada de número negativo');
    return Math.sqrt(args[0]);
  },
  cbrt: (args) => Math.cbrt(args[0]),
  root: (args) => {
    const n = args[0];
    const x = args[1];
    if (n === 0) throw new Error('Índice de raíz no puede ser 0');
    if (x < 0 && n % 2 === 0) throw new Error('Raíz par de número negativo');
    return Math.sign(x) * Math.pow(Math.abs(x), 1 / n);
  },
  sin: (args) => Math.sin(args[0]),
  cos: (args) => Math.cos(args[0]),
  tan: (args) => Math.tan(args[0]),
  asin: (args) => Math.asin(args[0]),
  acos: (args) => Math.acos(args[0]),
  atan: (args) => Math.atan(args[0]),
  sind: (args) => Math.sin((args[0] * Math.PI) / 180),
  cosd: (args) => Math.cos((args[0] * Math.PI) / 180),
  tand: (args) => Math.tan((args[0] * Math.PI) / 180),
  asind: (args) => (Math.asin(args[0]) * 180) / Math.PI,
  acosd: (args) => (Math.acos(args[0]) * 180) / Math.PI,
  atand: (args) => (Math.atan(args[0]) * 180) / Math.PI,
  sinh: (args) => Math.sinh(args[0]),
  cosh: (args) => Math.cosh(args[0]),
  tanh: (args) => Math.tanh(args[0]),
  asinh: (args) => Math.asinh(args[0]),
  acosh: (args) => Math.acosh(args[0]),
  atanh: (args) => Math.atanh(args[0]),
  abs: (args) => Math.abs(args[0]),
  round: (args) => Math.round(args[0]),
  floor: (args) => Math.floor(args[0]),
  ceil: (args) => Math.ceil(args[0]),
  exp: (args) => Math.exp(args[0]),
  ln: (args) => {
    if (args[0] <= 0) throw new Error('ln de número no positivo');
    return Math.log(args[0]);
  },
  log: (args) => {
    if (args[0] <= 0) throw new Error('log de número no positivo');
    return Math.log10(args[0]);
  },
  log10: (args) => {
    if (args[0] <= 0) throw new Error('log10 de número no positivo');
    return Math.log10(args[0]);
  },
  log2: (args) => {
    if (args[0] <= 0) throw new Error('log2 de número no positivo');
    return Math.log2(args[0]);
  },
  pow: (args) => Math.pow(args[0], args[1]),
  inv: (args) => {
    if (args[0] === 0) throw new Error('División por 0 en 1/x');
    return 1 / args[0];
  },
  fact: (args) => {
    const n = Math.round(args[0]);
    if (n < 0) throw new Error('Factorial de número negativo');
    if (n > 170) throw new Error('Desbordamiento en factorial');
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  },
  sum: (args) => args.reduce((a, b) => a + b, 0),
  sumatoria: (args) => args.reduce((a, b) => a + b, 0),
  npr: (args) => {
    const n = Math.round(args[0]);
    const r = Math.round(args[1]);
    if (n < 0 || r < 0 || r > n) throw new Error('nPr inválido');
    let res = 1;
    for (let i = n - r + 1; i <= n; i++) res *= i;
    return res;
  },
  ncr: (args) => {
    const n = Math.round(args[0]);
    const r = Math.round(args[1]);
    if (n < 0 || r < 0 || r > n) throw new Error('nCr inválido');
    let res = 1;
    for (let i = 1; i <= r; i++) {
      res = (res * (n - i + 1)) / i;
    }
    return res;
  },
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
  logbase: (args) => {
    if (args[0] <= 0 || args[0] === 1 || args[1] <= 0) throw new Error('Argumentos inválidos para logbase');
    return Math.log(args[1]) / Math.log(args[0]);
  },
  pol: (args) => Math.hypot(args[0], args[1]),
  rec: (args) => {
    const r = args[0];
    const theta = args[1] !== undefined ? args[1] : 0;
    // Defaults to degree conversion if theta > 2*PI, or standard degree
    return r * Math.cos((theta * Math.PI) / 180);
  },
  recd: (args) => args[0] * Math.cos((args[1] * Math.PI) / 180),
  recr: (args) => args[0] * Math.cos(args[1]),
  rnd: (args) => {
    const digits = args[1] !== undefined ? Math.round(args[1]) : 4;
    const factor = Math.pow(10, digits);
    return Math.round(args[0] * factor) / factor;
  },
  ran: () => Math.random(),
  ranint: (args) => {
    const a = Math.round(args[0]);
    const b = Math.round(args[1]);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  },
  dms: (args) => {
    const deg = args[0] || 0;
    const min = args[1] || 0;
    const sec = args[2] || 0;
    return deg + min / 60 + sec / 3600;
  },
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  c: 299792458, // Speed of light in m/s
  h: 6.62607015e-34, // Planck constant in J·s
  g: 9.80665, // Standard gravity in m/s²
  G: 6.6743e-11, // Gravitational constant in N·m²/kg²
  na: 6.02214076e23, // Avogadro constant
  Na: 6.02214076e23,
  kb: 1.380649e-23, // Boltzmann constant in J/K
  R: 8.314462618, // Gas constant in J/(mol·K)
  me: 9.1093837e-31, // Electron mass in kg
  mp: 1.6726219e-27, // Proton mass in kg
  eps0: 8.8541878e-12, // Vacuum permittivity
  mu0: 1.256637e-6, // Vacuum permeability
  atm: 101325, // Standard atmospheric pressure in Pa
};

function toRPN(tokens: Token[], variables: Record<string, number>): Token[] {
  const output: Token[] = [];
  const opStack: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'NUMBER') {
      output.push(token);
    } else if (token.type === 'IDENT') {
      const lower = token.value.toLowerCase();
      const stripped = lower.replace(/^@/, '');
      // Check function
      if (SCIENTIFIC_FUNCS[lower] || SCIENTIFIC_FUNCS[stripped]) {
        opStack.push({ type: 'IDENT', value: SCIENTIFIC_FUNCS[lower] ? lower : stripped });
      } else if (
        CONSTANTS[token.value] !== undefined ||
        CONSTANTS[lower] !== undefined ||
        CONSTANTS[stripped] !== undefined
      ) {
        const val = CONSTANTS[token.value] ?? CONSTANTS[lower] ?? CONSTANTS[stripped];
        output.push({ type: 'NUMBER', value: String(val) });
      } else {
        // Variable lookup: check exact, stripped @, added @, and case-insensitive
        let resolved: number | undefined =
          variables[token.value] ??
          variables[lower] ??
          variables[stripped] ??
          variables['@' + stripped];

        if (resolved === undefined) {
          const matchKey = Object.keys(variables).find(
            (k) =>
              k.toLowerCase() === lower ||
              k.toLowerCase() === stripped ||
              k.toLowerCase() === '@' + stripped ||
              k.replace(/^@/, '').toLowerCase() === stripped
          );
          if (matchKey !== undefined) {
            resolved = variables[matchKey];
          }
        }

        if (resolved !== undefined) {
          output.push({ type: 'NUMBER', value: String(resolved) });
        } else {
          throw new Error(`Variable o función desconocida: "${token.value}"`);
        }
      }
    } else if (token.type === 'OP') {
      const p1 = PRECEDENCE[token.value] || 0;
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1];
        if (top.type === 'OP') {
          const p2 = PRECEDENCE[top.value] || 0;
          if (
            (RIGHT_ASSOCIATIVE.has(token.value) && p1 < p2) ||
            (!RIGHT_ASSOCIATIVE.has(token.value) && p1 <= p2)
          ) {
            output.push(opStack.pop()!);
          } else {
            break;
          }
        } else if (top.type === 'IDENT' && SCIENTIFIC_FUNCS[top.value]) {
          output.push(opStack.pop()!);
        } else {
          break;
        }
      }
      opStack.push(token);
    } else if (token.type === 'LPAREN') {
      opStack.push(token);
    } else if (token.type === 'RPAREN') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push(opStack.pop()!);
      }
      if (opStack.length === 0) {
        throw new Error('Paréntesis desbalanceados');
      }
      opStack.pop(); // discard LPAREN

      // If function is on top of stack, pop it to output
      if (opStack.length > 0 && opStack[opStack.length - 1].type === 'IDENT') {
        output.push(opStack.pop()!);
      }
    } else if (token.type === 'COMMA') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push(opStack.pop()!);
      }
      if (opStack.length === 0) {
        throw new Error('Coma en posición inválida');
      }
    }
  }

  while (opStack.length > 0) {
    const top = opStack.pop()!;
    if (top.type === 'LPAREN' || top.type === 'RPAREN') {
      throw new Error('Paréntesis desbalanceados');
    }
    output.push(top);
  }

  return output;
}

function evaluateRPN(rpn: Token[]): number {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.type === 'NUMBER') {
      stack.push(parseFloat(token.value));
    } else if (token.type === 'OP') {
      if (token.value === '!') {
        if (stack.length < 1) throw new Error('Operando faltante para !');
        const a = stack.pop()!;
        stack.push(SCIENTIFIC_FUNCS.fact([a]));
      } else if (token.value === 'u-') {
        if (stack.length < 1) throw new Error('Operando faltante para -');
        const a = stack.pop()!;
        stack.push(-a);
      } else if (token.value === 'u+') {
        if (stack.length < 1) throw new Error('Operando faltante para +');
        // Unary plus is a no-op
      } else {
        if (stack.length < 2) throw new Error(`Operandos insuficientes para ${token.value}`);
        const b = stack.pop()!;
        const a = stack.pop()!;
        switch (token.value) {
          case '+':
            stack.push(a + b);
            break;
          case '-':
            stack.push(a - b);
            break;
          case '*':
            stack.push(a * b);
            break;
          case '/':
            if (b === 0) throw new Error('División entre 0');
            stack.push(a / b);
            break;
          case '%':
            stack.push(a % b);
            break;
          case '^':
            stack.push(Math.pow(a, b));
            break;
          default:
            throw new Error(`Operador desconocido: ${token.value}`);
        }
      }
    } else if (token.type === 'IDENT') {
      const func = SCIENTIFIC_FUNCS[token.value];
      if (!func) {
        throw new Error(`Función desconocida: ${token.value}`);
      }
      // Check arity
      if (token.value === 'ran') {
        stack.push(func([]));
      } else if (
        token.value === 'pow' ||
        token.value === 'root' ||
        token.value === 'npr' ||
        token.value === 'ncr' ||
        token.value === 'logbase' ||
        token.value === 'pol' ||
        token.value === 'rec' ||
        token.value === 'ranint'
      ) {
        if (stack.length < 2) throw new Error(`${token.value} requiere 2 argumentos`);
        const b = stack.pop()!;
        const a = stack.pop()!;
        stack.push(func([a, b]));
      } else if (token.value === 'dms') {
        if (stack.length >= 3) {
          const sec = stack.pop()!;
          const min = stack.pop()!;
          const deg = stack.pop()!;
          stack.push(func([deg, min, sec]));
        } else if (stack.length >= 2) {
          const min = stack.pop()!;
          const deg = stack.pop()!;
          stack.push(func([deg, min, 0]));
        } else if (stack.length >= 1) {
          const deg = stack.pop()!;
          stack.push(func([deg, 0, 0]));
        }
      } else if (token.value === 'min' || token.value === 'max' || token.value === 'sum' || token.value === 'sumatoria') {
        if (stack.length < 1) throw new Error(`${token.value} requiere argumentos`);
        const args: number[] = [];
        while (stack.length > 0) {
          args.unshift(stack.pop()!);
        }
        stack.push(func(args));
      } else {
        if (stack.length < 1) throw new Error(`${token.value} requiere 1 argumento`);
        const a = stack.pop()!;
        stack.push(func([a]));
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error('Expresión matemática incompleta');
  }

  return stack[0];
}
