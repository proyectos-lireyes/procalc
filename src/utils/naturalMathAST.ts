/**
 * Natural Math Display Abstract Syntax Tree (AST) for Casio Natural-V.P.A.M.
 * Allows rendering and editing 2-story fractions, radicals, powers, and calculus
 * exactly as handwritten/printed in textbooks ("como en escrito").
 */

export type MathNode =
  | { type: 'char'; id: string; value: string }
  | { type: 'fraction'; id: string; num: MathNode[]; den: MathNode[] }
  | { type: 'mixed_fraction'; id: string; whole: MathNode[]; num: MathNode[]; den: MathNode[] }
  | { type: 'sqrt'; id: string; inner: MathNode[] }
  | { type: 'nth_root'; id: string; root: MathNode[]; inner: MathNode[] }
  | { type: 'power'; id: string; exp: MathNode[] }
  | { type: 'subscript'; id: string; sub: MathNode[] }
  | { type: 'integral'; id: string; expr: MathNode[]; lower: MathNode[]; upper: MathNode[] }
  | { type: 'derivative'; id: string; expr: MathNode[]; at: MathNode[] }
  | { type: 'summation'; id: string; expr: MathNode[]; start: MathNode[]; end: MathNode[] }
  | { type: 'log_base'; id: string; base: MathNode[]; arg: MathNode[] }
  | { type: 'abs'; id: string; inner: MathNode[] };

export interface CursorPosition {
  slotId: string; // e.g. 'root' or 'node_123:num'
  index: number;  // cursor index within that slot's MathNode list
}

export function generateId(): string {
  return 'm_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Finds a slot's list of nodes inside the AST
 */
export function findSlotList(
  nodes: MathNode[],
  slotId: string
): { list: MathNode[]; parentNode?: MathNode; slotKey?: string; parentSlotId?: string; parentIndex?: number } | null {
  if (slotId === 'root') {
    return { list: nodes };
  }

  const [targetNodeId, targetKey] = slotId.split(':');

  function search(
    currentList: MathNode[],
    currentParentSlotId: string
  ): { list: MathNode[]; parentNode?: MathNode; slotKey?: string; parentSlotId?: string; parentIndex?: number } | null {
    for (let i = 0; i < currentList.length; i++) {
      const node = currentList[i];
      if (node.id === targetNodeId) {
        if (node.type === 'fraction') {
          if (targetKey === 'num') return { list: node.num, parentNode: node, slotKey: 'num', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'den') return { list: node.den, parentNode: node, slotKey: 'den', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'mixed_fraction') {
          if (targetKey === 'whole') return { list: node.whole, parentNode: node, slotKey: 'whole', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'num') return { list: node.num, parentNode: node, slotKey: 'num', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'den') return { list: node.den, parentNode: node, slotKey: 'den', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'sqrt') {
          if (targetKey === 'inner') return { list: node.inner, parentNode: node, slotKey: 'inner', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'nth_root') {
          if (targetKey === 'root') return { list: node.root, parentNode: node, slotKey: 'root', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'inner') return { list: node.inner, parentNode: node, slotKey: 'inner', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'power') {
          if (targetKey === 'exp') return { list: node.exp, parentNode: node, slotKey: 'exp', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'subscript') {
          if (targetKey === 'sub') return { list: node.sub, parentNode: node, slotKey: 'sub', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'integral') {
          if (targetKey === 'expr') return { list: node.expr, parentNode: node, slotKey: 'expr', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'lower') return { list: node.lower, parentNode: node, slotKey: 'lower', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'upper') return { list: node.upper, parentNode: node, slotKey: 'upper', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'derivative') {
          if (targetKey === 'expr') return { list: node.expr, parentNode: node, slotKey: 'expr', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'at') return { list: node.at, parentNode: node, slotKey: 'at', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'summation') {
          if (targetKey === 'expr') return { list: node.expr, parentNode: node, slotKey: 'expr', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'start') return { list: node.start, parentNode: node, slotKey: 'start', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'end') return { list: node.end, parentNode: node, slotKey: 'end', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'log_base') {
          if (targetKey === 'base') return { list: node.base, parentNode: node, slotKey: 'base', parentSlotId: currentParentSlotId, parentIndex: i };
          if (targetKey === 'arg') return { list: node.arg, parentNode: node, slotKey: 'arg', parentSlotId: currentParentSlotId, parentIndex: i };
        } else if (node.type === 'abs') {
          if (targetKey === 'inner') return { list: node.inner, parentNode: node, slotKey: 'inner', parentSlotId: currentParentSlotId, parentIndex: i };
        }
      }

      // Recurse into children
      if (node.type === 'fraction') {
        const foundNum = search(node.num, `${node.id}:num`);
        if (foundNum) return foundNum;
        const foundDen = search(node.den, `${node.id}:den`);
        if (foundDen) return foundDen;
      } else if (node.type === 'mixed_fraction') {
        const foundW = search(node.whole, `${node.id}:whole`);
        if (foundW) return foundW;
        const foundNum = search(node.num, `${node.id}:num`);
        if (foundNum) return foundNum;
        const foundDen = search(node.den, `${node.id}:den`);
        if (foundDen) return foundDen;
      } else if (node.type === 'sqrt') {
        const found = search(node.inner, `${node.id}:inner`);
        if (found) return found;
      } else if (node.type === 'nth_root') {
        const foundR = search(node.root, `${node.id}:root`);
        if (foundR) return foundR;
        const foundI = search(node.inner, `${node.id}:inner`);
        if (foundI) return foundI;
      } else if (node.type === 'power') {
        const found = search(node.exp, `${node.id}:exp`);
        if (found) return found;
      } else if (node.type === 'subscript') {
        const found = search(node.sub, `${node.id}:sub`);
        if (found) return found;
      } else if (node.type === 'integral') {
        const foundE = search(node.expr, `${node.id}:expr`);
        if (foundE) return foundE;
        const foundL = search(node.lower, `${node.id}:lower`);
        if (foundL) return foundL;
        const foundU = search(node.upper, `${node.id}:upper`);
        if (foundU) return foundU;
      } else if (node.type === 'derivative') {
        const foundE = search(node.expr, `${node.id}:expr`);
        if (foundE) return foundE;
        const foundAt = search(node.at, `${node.id}:at`);
        if (foundAt) return foundAt;
      } else if (node.type === 'summation') {
        const foundE = search(node.expr, `${node.id}:expr`);
        if (foundE) return foundE;
        const foundS = search(node.start, `${node.id}:start`);
        if (foundS) return foundS;
        const foundEn = search(node.end, `${node.id}:end`);
        if (foundEn) return foundEn;
      } else if (node.type === 'log_base') {
        const foundB = search(node.base, `${node.id}:base`);
        if (foundB) return foundB;
        const foundA = search(node.arg, `${node.id}:arg`);
        if (foundA) return foundA;
      } else if (node.type === 'abs') {
        const found = search(node.inner, `${node.id}:inner`);
        if (found) return found;
      }
    }
    return null;
  }

  return search(nodes, 'root');
}

/**
 * Deep clones AST to preserve immutability
 */
export function cloneAST(nodes: MathNode[]): MathNode[] {
  return JSON.parse(JSON.stringify(nodes));
}

/**
 * Inserts one or more nodes at the specified slot & cursor index
 */
export function insertNode(
  root: MathNode[],
  cursor: CursorPosition,
  nodeOrNodes: MathNode | MathNode[],
  nextCursor?: Partial<CursorPosition>
): { newRoot: MathNode[]; newCursor: CursorPosition } {
  const newRoot = cloneAST(root);
  const slot = findSlotList(newRoot, cursor.slotId);

  const nodesToInsert = Array.isArray(nodeOrNodes) ? nodeOrNodes : [nodeOrNodes];

  if (!slot) {
    // Fallback: append to root
    newRoot.push(...nodesToInsert);
    return {
      newRoot,
      newCursor: { slotId: 'root', index: newRoot.length },
    };
  }

  const clampedIndex = Math.max(0, Math.min(cursor.index, slot.list.length));
  slot.list.splice(clampedIndex, 0, ...nodesToInsert);

  const defaultCursor: CursorPosition = {
    slotId: cursor.slotId,
    index: clampedIndex + nodesToInsert.length,
  };

  return {
    newRoot,
    newCursor: {
      slotId: nextCursor?.slotId ?? defaultCursor.slotId,
      index: nextCursor?.index ?? defaultCursor.index,
    },
  };
}

/**
 * Backspace / DEL handler
 */
export function deleteNode(
  root: MathNode[],
  cursor: CursorPosition
): { newRoot: MathNode[]; newCursor: CursorPosition } {
  const newRoot = cloneAST(root);
  const slot = findSlotList(newRoot, cursor.slotId);

  if (!slot) return { newRoot, newCursor: cursor };

  if (cursor.index > 0) {
    // Delete item to the left of the cursor
    slot.list.splice(cursor.index - 1, 1);
    return {
      newRoot,
      newCursor: { slotId: cursor.slotId, index: cursor.index - 1 },
    };
  }

  // If index is 0 and we are inside a template slot, step out to parent or sibling slot
  if (cursor.slotId !== 'root' && slot.parentSlotId && slot.parentIndex !== undefined) {
    return {
      newRoot,
      newCursor: {
        slotId: slot.parentSlotId,
        index: slot.parentIndex,
      },
    };
  }

  return { newRoot, newCursor: cursor };
}

/**
 * Navigate cursor Left / Right / Up / Down across slots
 */
export function navigateCursor(
  root: MathNode[],
  cursor: CursorPosition,
  direction: 'left' | 'right' | 'up' | 'down'
): CursorPosition {
  const slot = findSlotList(root, cursor.slotId);
  if (!slot) return cursor;

  const currentList = slot.list;

  if (direction === 'left') {
    if (cursor.index > 0) {
      const prevNode = currentList[cursor.index - 1];
      // If previous node has slots, enter its rightmost slot
      if (prevNode.type === 'fraction') {
        return { slotId: `${prevNode.id}:den`, index: prevNode.den.length };
      }
      if (prevNode.type === 'mixed_fraction') {
        return { slotId: `${prevNode.id}:den`, index: prevNode.den.length };
      }
      if (prevNode.type === 'sqrt') {
        return { slotId: `${prevNode.id}:inner`, index: prevNode.inner.length };
      }
      if (prevNode.type === 'nth_root') {
        return { slotId: `${prevNode.id}:inner`, index: prevNode.inner.length };
      }
      if (prevNode.type === 'power') {
        return { slotId: `${prevNode.id}:exp`, index: prevNode.exp.length };
      }
      if (prevNode.type === 'integral') {
        return { slotId: `${prevNode.id}:expr`, index: prevNode.expr.length };
      }
      if (prevNode.type === 'derivative') {
        return { slotId: `${prevNode.id}:at`, index: prevNode.at.length };
      }
      if (prevNode.type === 'abs') {
        return { slotId: `${prevNode.id}:inner`, index: prevNode.inner.length };
      }
      return { slotId: cursor.slotId, index: cursor.index - 1 };
    }
    // Step out of current slot to the left
    if (cursor.slotId !== 'root') {
      const [parentId, key] = cursor.slotId.split(':');
      if (key === 'den') {
        // Move from denominator to numerator
        const parent = slot.parentNode;
        if (parent?.type === 'fraction') {
          return { slotId: `${parentId}:num`, index: parent.num.length };
        }
      }
      if (key === 'at') {
        return { slotId: `${parentId}:expr`, index: (slot.parentNode as any)?.expr?.length || 0 };
      }
      if (slot.parentSlotId && slot.parentIndex !== undefined) {
        return { slotId: slot.parentSlotId, index: slot.parentIndex };
      }
    }
    return cursor;
  }

  if (direction === 'right') {
    if (cursor.index < currentList.length) {
      const nextNode = currentList[cursor.index];
      // If next node has slots, enter its leftmost slot
      if (nextNode.type === 'fraction') {
        return { slotId: `${nextNode.id}:num`, index: 0 };
      }
      if (nextNode.type === 'mixed_fraction') {
        return { slotId: `${nextNode.id}:whole`, index: 0 };
      }
      if (nextNode.type === 'sqrt') {
        return { slotId: `${nextNode.id}:inner`, index: 0 };
      }
      if (nextNode.type === 'nth_root') {
        return { slotId: `${nextNode.id}:root`, index: 0 };
      }
      if (nextNode.type === 'power') {
        return { slotId: `${nextNode.id}:exp`, index: 0 };
      }
      if (nextNode.type === 'integral') {
        return { slotId: `${nextNode.id}:expr`, index: 0 };
      }
      if (nextNode.type === 'derivative') {
        return { slotId: `${nextNode.id}:expr`, index: 0 };
      }
      if (nextNode.type === 'abs') {
        return { slotId: `${nextNode.id}:inner`, index: 0 };
      }
      return { slotId: cursor.slotId, index: cursor.index + 1 };
    }
    // Step out of current slot to the right
    if (cursor.slotId !== 'root') {
      const [parentId, key] = cursor.slotId.split(':');
      if (key === 'num') {
        // Move to denominator or step out
        const parent = slot.parentNode;
        if (parent?.type === 'fraction') {
          return { slotId: `${parentId}:den`, index: 0 };
        }
      }
      if (key === 'expr') {
        const parent = slot.parentNode;
        if (parent?.type === 'derivative') {
          return { slotId: `${parentId}:at`, index: 0 };
        }
      }
      if (slot.parentSlotId && slot.parentIndex !== undefined) {
        return { slotId: slot.parentSlotId, index: slot.parentIndex + 1 };
      }
    }
    return cursor;
  }

  if (direction === 'up') {
    if (cursor.slotId !== 'root') {
      const [parentId, key] = cursor.slotId.split(':');
      if (key === 'den') {
        // Denominator -> Numerator
        return { slotId: `${parentId}:num`, index: 0 };
      }
      if (key === 'lower') {
        // Integral lower -> Upper
        return { slotId: `${parentId}:upper`, index: 0 };
      }
      if (key === 'expr') {
        const parent = slot.parentNode;
        if (parent?.type === 'integral') {
          return { slotId: `${parentId}:upper`, index: 0 };
        }
      }
    }
    return cursor;
  }

  if (direction === 'down') {
    if (cursor.slotId !== 'root') {
      const [parentId, key] = cursor.slotId.split(':');
      if (key === 'num') {
        // Numerator -> Denominator
        return { slotId: `${parentId}:den`, index: 0 };
      }
      if (key === 'upper') {
        // Integral upper -> lower
        return { slotId: `${parentId}:lower`, index: 0 };
      }
      if (key === 'expr') {
        const parent = slot.parentNode;
        if (parent?.type === 'integral') {
          return { slotId: `${parentId}:lower`, index: 0 };
        }
      }
    }
    return cursor;
  }

  return cursor;
}

/**
 * Serializes the AST to a valid mathematical expression for evaluateExpression()
 */
export function serializeASTToMathString(nodes: MathNode[]): string {
  if (!nodes || nodes.length === 0) return '';

  return nodes
    .map((node) => {
      switch (node.type) {
        case 'char':
          return node.value;
        case 'fraction': {
          const numStr = serializeASTToMathString(node.num) || '0';
          const denStr = serializeASTToMathString(node.den) || '1';
          return `((${numStr})/(${denStr}))`;
        }
        case 'mixed_fraction': {
          const wholeStr = serializeASTToMathString(node.whole) || '0';
          const numStr = serializeASTToMathString(node.num) || '0';
          const denStr = serializeASTToMathString(node.den) || '1';
          return `((${wholeStr})+((${numStr})/(${denStr})))`;
        }
        case 'sqrt': {
          const innerStr = serializeASTToMathString(node.inner) || '0';
          return `sqrt(${innerStr})`;
        }
        case 'nth_root': {
          const rootStr = serializeASTToMathString(node.root) || '2';
          const innerStr = serializeASTToMathString(node.inner) || '0';
          return `((${innerStr})^(1/(${rootStr})))`;
        }
        case 'power': {
          const expStr = serializeASTToMathString(node.exp) || '1';
          return `^(${expStr})`;
        }
        case 'subscript': {
          const subStr = serializeASTToMathString(node.sub) || '';
          return `_${subStr}`;
        }
        case 'integral': {
          const exprStr = serializeASTToMathString(node.expr) || '0';
          const lowStr = serializeASTToMathString(node.lower);
          const upStr = serializeASTToMathString(node.upper);
          const a = lowStr.trim() ? lowStr : '0';
          const b = upStr.trim() ? upStr : '1';
          return `∫(${exprStr},${a},${b})`;
        }
        case 'derivative': {
          const exprStr = serializeASTToMathString(node.expr) || '0';
          const atStr = serializeASTToMathString(node.at);
          const x0 = atStr.trim() ? atStr : '1';
          return `diff(${exprStr},${x0})`;
        }
        case 'summation': {
          const exprStr = serializeASTToMathString(node.expr) || '0';
          const startStr = serializeASTToMathString(node.start) || '1';
          const endStr = serializeASTToMathString(node.end) || '5';
          return `Σ(${exprStr},${startStr},${endStr})`;
        }
        case 'log_base': {
          const baseStr = serializeASTToMathString(node.base) || '10';
          const argStr = serializeASTToMathString(node.arg) || '1';
          return `(log(${argStr})/log(${baseStr}))`;
        }
        case 'abs': {
          const innerStr = serializeASTToMathString(node.inner) || '0';
          return `abs(${innerStr})`;
        }
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Creates char nodes from a string
 */
export function createChars(str: string): MathNode[] {
  return str.split('').map((char) => ({
    type: 'char',
    id: generateId(),
    value: char,
  }));
}

/**
 * Decomposes a decimal into exact fraction (numerator, denominator)
 */
export function getExactFraction(num: number): { n: number; d: number } | null {
  if (isNaN(num) || !isFinite(num)) return null;
  if (Number.isInteger(num)) return { n: num, d: 1 };

  const tolerance = 1.0e-7;
  let h1 = 1,
    h2 = 0,
    k1 = 0,
    k2 = 1;
  let b = Math.abs(num);

  for (let iter = 0; iter < 16; iter++) {
    const a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;
    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;
    if (Math.abs(b - a) < tolerance) break;
    b = 1 / (b - a);
  }

  if (k1 > 100000 || k1 === 0) return null;
  return {
    n: (num < 0 ? -1 : 1) * h1,
    d: k1,
  };
}
