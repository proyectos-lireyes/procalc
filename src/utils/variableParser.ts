/**
 * Variable Parser and Extraction Utility
 * Supports inline variable declarations in descriptions:
 * Syntax: @var = "valor" or @var = 120 or @iva = 0.16
 * Supports referencing: @var displays with its evaluated value, e.g. @var (120)
 */

import { evaluateExpression } from './mathEvaluator';

export interface ParsedVariableDecl {
  name: string;
  rawValue: string;
  evaluatedValue: number;
}

/**
 * Checks if a description contains a variable declaration:
 * e.g., `@tasa = "120"`, `@iva = 0.16`, `@descuento = 10`
 */
export function parseVariableDeclaration(
  text: string,
  existingVariables: Record<string, number> = {}
): ParsedVariableDecl | null {
  if (!text) return null;

  // Regex matching: @name = "value" or @name = 'value' or @name = value
  const match = text.match(/@([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s,;]+))/i);
  if (!match) return null;

  const name = match[1].toLowerCase();
  const rawValue = (match[2] ?? match[3] ?? match[4] ?? '').trim();

  // Evaluate rawValue (can be a number or math expression like "100 * 0.16")
  const evalRes = evaluateExpression(rawValue, existingVariables);
  const evaluatedValue = evalRes.isValid ? evalRes.value : parseFloat(rawValue) || 0;

  return {
    name,
    rawValue,
    evaluatedValue,
  };
}

/**
 * Formats a description text replacing @var occurrences with @var (value)
 * If the row itself is a declaration (@var = "val"), it displays cleanly.
 */
export function formatDescriptionWithVariables(
  text: string,
  variables: Record<string, number> = {}
): string {
  if (!text) return '';

  // If it's a declaration `@var = "val"`, return as is without repeating
  if (/@([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)\s*=/i.test(text)) {
    return text;
  }

  // Replace standalone @var with @var (value) if known
  return text.replace(/@([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)(?!\s*\()/gi, (match, varName) => {
    const key = varName.toLowerCase();
    const val = variables[key] ?? variables['@' + key] ?? variables[varName];
    if (val !== undefined) {
      // Format cleanly: integer or up to 4 decimals
      const formattedVal = Number.isInteger(val) ? val.toString() : parseFloat(val.toFixed(4)).toString();
      return `@${varName} (${formattedVal})`;
    }
    return match;
  });
}
