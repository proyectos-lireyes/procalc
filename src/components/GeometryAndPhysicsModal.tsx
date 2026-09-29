import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  Copy,
  CornerDownLeft,
  Maximize2,
  Compass,
  Box,
  Thermometer,
  RotateCcw,
  Sparkles,
  Binary,
  Calendar,
  Clock,
  ArrowRightLeft,
  Plus,
  Minus,
  Hash,
} from 'lucide-react';
import { formatNumber } from '../utils/currency';

export type CalculationCategory =
  | 'areas'
  | 'perimeters'
  | 'volumes'
  | 'temperature'
  | 'baseN'
  | 'dates'
  | 'duration';

interface GeometryAndPhysicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: CalculationCategory;
  onInsertToCalc?: (valueStr: string, formulaDesc?: string) => void;
  onInsertToSheet?: (concept: string, expression: string) => void;
}

interface ShapeConfig {
  id: string;
  name: string;
  category: 'areas' | 'perimeters' | 'volumes' | 'temperature';
  formulaStr: string;
  description: string;
  inputs: {
    key: string;
    label: string;
    symbol: string;
    unit?: string;
    defaultValue: number;
    step?: number;
    min?: number;
  }[];
  calculate: (values: Record<string, number>) => {
    result: number;
    formulaWithValues: string;
    steps: string[];
    unitResult: string;
  };
}

export const SHAPES_CONFIG: ShapeConfig[] = [
  // ═════════════════════════════════════════════════════════════════════════
  // 1. ÁREAS (2D)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'area_circle',
    name: 'Círculo',
    category: 'areas',
    formulaStr: 'A = π · r²',
    description: 'Área superficial delimitada por una circunferencia de radio r.',
    inputs: [{ key: 'r', label: 'Radio (r)', symbol: 'r', unit: 'cm/m', defaultValue: 5, min: 0.0001 }],
    calculate: (v) => {
      const r = v.r || 0;
      const res = Math.PI * r * r;
      return {
        result: res,
        formulaWithValues: `π × (${r})²`,
        steps: [`r² = ${r * r}`, `A = 3.14159... × ${r * r} = ${formatNumber(res, 4)}`],
        unitResult: 'u²',
      };
    },
  },
  {
    id: 'area_rectangle',
    name: 'Rectángulo',
    category: 'areas',
    formulaStr: 'A = b · h',
    description: 'Área de un cuadrilátero con cuatro ángulos rectos de base b y altura h.',
    inputs: [
      { key: 'b', label: 'Base (b)', symbol: 'b', unit: 'cm/m', defaultValue: 8, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 4, min: 0 },
    ],
    calculate: (v) => {
      const b = v.b || 0;
      const h = v.h || 0;
      const res = b * h;
      return {
        result: res,
        formulaWithValues: `${b} × ${h}`,
        steps: [`A = ${b} × ${h} = ${formatNumber(res, 4)}`],
        unitResult: 'u²',
      };
    },
  },
  {
    id: 'area_triangle',
    name: 'Triángulo (Base y Altura)',
    category: 'areas',
    formulaStr: 'A = (b · h) / 2',
    description: 'Área clásica de un triángulo dada su base y su altura perpendicular.',
    inputs: [
      { key: 'b', label: 'Base (b)', symbol: 'b', unit: 'cm/m', defaultValue: 6, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 4, min: 0 },
    ],
    calculate: (v) => {
      const b = v.b || 0;
      const h = v.h || 0;
      const res = (b * h) / 2;
      return {
        result: res,
        formulaWithValues: `(${b} × ${h}) / 2`,
        steps: [`b × h = ${b * h}`, `A = (${b * h}) / 2 = ${formatNumber(res, 4)}`],
        unitResult: 'u²',
      };
    },
  },
  {
    id: 'area_triangle_heron',
    name: 'Triángulo (Herón - 3 Lados)',
    category: 'areas',
    formulaStr: 'A = √(s(s-a)(s-b)(s-c))',
    description: 'Calcula el área conociendo la longitud de sus tres lados a, b y c.',
    inputs: [
      { key: 'a', label: 'Lado a', symbol: 'a', unit: 'cm/m', defaultValue: 5, min: 0 },
      { key: 'b', label: 'Lado b', symbol: 'b', unit: 'cm/m', defaultValue: 6, min: 0 },
      { key: 'c', label: 'Lado c', symbol: 'c', unit: 'cm/m', defaultValue: 7, min: 0 },
    ],
    calculate: (v) => {
      const a = v.a || 0;
      const b = v.b || 0;
      const c = v.c || 0;
      const s = (a + b + c) / 2;
      const val = s * (s - a) * (s - b) * (s - c);
      const res = val > 0 ? Math.sqrt(val) : 0;
      return {
        result: res,
        formulaWithValues: `√(${s} × (${s}-${a}) × (${s}-${b}) × (${s}-${c}))`,
        steps: [
          `Semiperímetro s = (${a} + ${b} + ${c}) / 2 = ${s}`,
          `s(s-a)(s-b)(s-c) = ${val > 0 ? formatNumber(val, 4) : '0 (No forma triángulo)'}`,
          `A = ${formatNumber(res, 4)}`,
        ],
        unitResult: 'u²',
      };
    },
  },
  {
    id: 'area_trapezoid',
    name: 'Trapecio',
    category: 'areas',
    formulaStr: 'A = ((B + b) · h) / 2',
    description: 'Área de un trapecio dadas su base mayor B, base menor b y altura h.',
    inputs: [
      { key: 'B', label: 'Base Mayor (B)', symbol: 'B', unit: 'cm/m', defaultValue: 10, min: 0 },
      { key: 'b', label: 'Base Menor (b)', symbol: 'b', unit: 'cm/m', defaultValue: 6, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 5, min: 0 },
    ],
    calculate: (v) => {
      const B = v.B || 0;
      const b = v.b || 0;
      const h = v.h || 0;
      const res = ((B + b) * h) / 2;
      return {
        result: res,
        formulaWithValues: `((${B} + ${b}) × ${h}) / 2`,
        steps: [`B + b = ${B + b}`, `(${B + b} × ${h}) / 2 = ${formatNumber(res, 4)}`],
        unitResult: 'u²',
      };
    },
  },
  {
    id: 'area_ellipse',
    name: 'Elipse',
    category: 'areas',
    formulaStr: 'A = π · a · b',
    description: 'Área de una elipse con semieje mayor a y semieje menor b.',
    inputs: [
      { key: 'a', label: 'Semieje mayor (a)', symbol: 'a', unit: 'cm/m', defaultValue: 6, min: 0 },
      { key: 'b', label: 'Semieje menor (b)', symbol: 'b', unit: 'cm/m', defaultValue: 4, min: 0 },
    ],
    calculate: (v) => {
      const a = v.a || 0;
      const b = v.b || 0;
      const res = Math.PI * a * b;
      return {
        result: res,
        formulaWithValues: `π × ${a} × ${b}`,
        steps: [`a × b = ${a * b}`, `A = π × ${a * b} = ${formatNumber(res, 4)}`],
        unitResult: 'u²',
      };
    },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 2. PERÍMETROS
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'perim_circle',
    name: 'Circunferencia (Círculo)',
    category: 'perimeters',
    formulaStr: 'P = 2 · π · r',
    description: 'Longitud del contorno de una circunferencia de radio r.',
    inputs: [{ key: 'r', label: 'Radio (r)', symbol: 'r', unit: 'cm/m', defaultValue: 5, min: 0 }],
    calculate: (v) => {
      const r = v.r || 0;
      const res = 2 * Math.PI * r;
      return {
        result: res,
        formulaWithValues: `2 × π × ${r}`,
        steps: [`2 × 3.14159... × ${r} = ${formatNumber(res, 4)}`],
        unitResult: 'u',
      };
    },
  },
  {
    id: 'perim_rectangle',
    name: 'Rectángulo',
    category: 'perimeters',
    formulaStr: 'P = 2 · (b + h)',
    description: 'Perímetro o suma de los 4 lados de un rectángulo.',
    inputs: [
      { key: 'b', label: 'Base (b)', symbol: 'b', unit: 'cm/m', defaultValue: 8, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 4, min: 0 },
    ],
    calculate: (v) => {
      const b = v.b || 0;
      const h = v.h || 0;
      const res = 2 * (b + h);
      return {
        result: res,
        formulaWithValues: `2 × (${b} + ${h})`,
        steps: [`b + h = ${b + h}`, `2 × ${b + h} = ${formatNumber(res, 4)}`],
        unitResult: 'u',
      };
    },
  },
  {
    id: 'perim_polygon',
    name: 'Polígono Regular (n Lados)',
    category: 'perimeters',
    formulaStr: 'P = n · L',
    description: 'Perímetro de un polígono regular de n lados iguales con longitud L.',
    inputs: [
      { key: 'n', label: 'Número de lados (n)', symbol: 'n', defaultValue: 6, min: 3, step: 1 },
      { key: 'L', label: 'Longitud de lado (L)', symbol: 'L', unit: 'cm/m', defaultValue: 5, min: 0 },
    ],
    calculate: (v) => {
      const n = Math.max(3, Math.round(v.n || 3));
      const L = v.L || 0;
      const res = n * L;
      return {
        result: res,
        formulaWithValues: `${n} × ${L}`,
        steps: [`P = ${n} × ${L} = ${formatNumber(res, 4)}`],
        unitResult: 'u',
      };
    },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 3. VOLÚMENES (3D)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'vol_sphere',
    name: 'Esfera',
    category: 'volumes',
    formulaStr: 'V = (4/3) · π · r³',
    description: 'Volumen espacial contenido en una esfera de radio r.',
    inputs: [{ key: 'r', label: 'Radio (r)', symbol: 'r', unit: 'cm/m', defaultValue: 3, min: 0 }],
    calculate: (v) => {
      const r = v.r || 0;
      const res = (4 / 3) * Math.PI * Math.pow(r, 3);
      return {
        result: res,
        formulaWithValues: `(4/3) × π × (${r})³`,
        steps: [`r³ = ${Math.pow(r, 3)}`, `V = (4/3) × π × ${Math.pow(r, 3)} = ${formatNumber(res, 4)}`],
        unitResult: 'u³',
      };
    },
  },
  {
    id: 'vol_cylinder',
    name: 'Cilindro',
    category: 'volumes',
    formulaStr: 'V = π · r² · h',
    description: 'Volumen de un cilindro circular recto de radio r y altura h.',
    inputs: [
      { key: 'r', label: 'Radio de la base (r)', symbol: 'r', unit: 'cm/m', defaultValue: 3, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 10, min: 0 },
    ],
    calculate: (v) => {
      const r = v.r || 0;
      const h = v.h || 0;
      const res = Math.PI * r * r * h;
      return {
        result: res,
        formulaWithValues: `π × (${r})² × ${h}`,
        steps: [`Área base = π × ${r * r} = ${formatNumber(Math.PI * r * r, 4)}`, `V = ${formatNumber(Math.PI * r * r, 4)} × ${h} = ${formatNumber(res, 4)}`],
        unitResult: 'u³',
      };
    },
  },
  {
    id: 'vol_cone',
    name: 'Cono',
    category: 'volumes',
    formulaStr: 'V = (1/3) · π · r² · h',
    description: 'Volumen de un cono circular de radio de base r y altura h.',
    inputs: [
      { key: 'r', label: 'Radio de la base (r)', symbol: 'r', unit: 'cm/m', defaultValue: 3, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 9, min: 0 },
    ],
    calculate: (v) => {
      const r = v.r || 0;
      const h = v.h || 0;
      const res = (1 / 3) * Math.PI * r * r * h;
      return {
        result: res,
        formulaWithValues: `(1/3) × π × (${r})² × ${h}`,
        steps: [`r² = ${r * r}`, `V = (1/3) × π × ${r * r} × ${h} = ${formatNumber(res, 4)}`],
        unitResult: 'u³',
      };
    },
  },
  {
    id: 'vol_box',
    name: 'Cubo / Prisma Rectangular',
    category: 'volumes',
    formulaStr: 'V = largo · ancho · alto',
    description: 'Volumen de un prisma rectangular o caja de dimensiones a, b y c.',
    inputs: [
      { key: 'l', label: 'Largo (l)', symbol: 'l', unit: 'cm/m', defaultValue: 5, min: 0 },
      { key: 'w', label: 'Ancho (w)', symbol: 'w', unit: 'cm/m', defaultValue: 4, min: 0 },
      { key: 'h', label: 'Alto (h)', symbol: 'h', unit: 'cm/m', defaultValue: 3, min: 0 },
    ],
    calculate: (v) => {
      const l = v.l || 0;
      const w = v.w || 0;
      const h = v.h || 0;
      const res = l * w * h;
      return {
        result: res,
        formulaWithValues: `${l} × ${w} × ${h}`,
        steps: [`V = ${l} × ${w} × ${h} = ${formatNumber(res, 4)}`],
        unitResult: 'u³',
      };
    },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 4. TEMPERATURA
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'temp_celsius_to_all',
    name: 'Celsius (°C) a Fahrenheit y Kelvin',
    category: 'temperature',
    formulaStr: '°F = (°C · 9/5) + 32  |  K = °C + 273.15',
    description: 'Conversión simultánea desde escala Celsius a Fahrenheit y escala absoluta Kelvin.',
    inputs: [{ key: 'c', label: 'Temperatura en Celsius (°C)', symbol: '°C', defaultValue: 25 }],
    calculate: (v) => {
      const c = v.c ?? 0;
      const f = (c * 9) / 5 + 32;
      const k = c + 273.15;
      return {
        result: f,
        formulaWithValues: `(${c} × 1.8) + 32 = ${formatNumber(f, 2)} °F`,
        steps: [
          `Fahrenheit: (${c} × 9/5) + 32 = ${formatNumber(f, 2)} °F`,
          `Kelvin: ${c} + 273.15 = ${formatNumber(k, 2)} K`,
        ],
        unitResult: '°F',
      };
    },
  },
  {
    id: 'temp_fahrenheit_to_all',
    name: 'Fahrenheit (°F) a Celsius y Kelvin',
    category: 'temperature',
    formulaStr: '°C = (°F - 32) · 5/9  |  K = °C + 273.15',
    description: 'Conversión desde escala Fahrenheit a Celsius y Kelvin.',
    inputs: [{ key: 'f', label: 'Temperatura en Fahrenheit (°F)', symbol: '°F', defaultValue: 77 }],
    calculate: (v) => {
      const f = v.f ?? 0;
      const c = ((f - 32) * 5) / 9;
      const k = c + 273.15;
      return {
        result: c,
        formulaWithValues: `(${f} - 32) × 5/9 = ${formatNumber(c, 2)} °C`,
        steps: [
          `Celsius: (${f} - 32) × 5/9 = ${formatNumber(c, 2)} °C`,
          `Kelvin: ${formatNumber(c, 2)} + 273.15 = ${formatNumber(k, 2)} K`,
        ],
        unitResult: '°C',
      };
    },
  },
  {
    id: 'temp_kelvin_to_all',
    name: 'Kelvin (K) a Celsius y Fahrenheit',
    category: 'temperature',
    formulaStr: '°C = K - 273.15  |  °F = (°C · 9/5) + 32',
    description: 'Conversión desde escala absoluta Kelvin a Celsius y Fahrenheit.',
    inputs: [{ key: 'k', label: 'Temperatura en Kelvin (K)', symbol: 'K', defaultValue: 298.15, min: 0 }],
    calculate: (v) => {
      const k = Math.max(0, v.k ?? 0);
      const c = k - 273.15;
      const f = c * (9 / 5) + 32;
      return {
        result: c,
        formulaWithValues: `${k} - 273.15 = ${formatNumber(c, 2)} °C`,
        steps: [
          `Celsius: ${k} - 273.15 = ${formatNumber(c, 2)} °C`,
          `Fahrenheit: (${formatNumber(c, 2)} × 1.8) + 32 = ${formatNumber(f, 2)} °F`,
        ],
        unitResult: '°C',
      };
    },
  },
];

export const GeometryAndPhysicsModal: React.FC<GeometryAndPhysicsModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'areas',
  onInsertToCalc,
  onInsertToSheet,
}) => {
  const [activeCategory, setActiveCategory] = useState<CalculationCategory>(defaultCategory);
  const [selectedShapeId, setSelectedShapeId] = useState<string>('area_circle');
  const [inputValues, setInputValues] = useState<Record<string, number>>({});
  const [copiedStatus, setCopiedStatus] = useState<boolean>(false);

  // ═════════════════════════════════════════════════════════════════════════
  // BASE-N STATE (BIN, OCT, HEX, DEC)
  // ═════════════════════════════════════════════════════════════════════════
  const [baseNDec, setBaseNDec] = useState<string>('255');
  const [baseNHex, setBaseNHex] = useState<string>('FF');
  const [baseNBin, setBaseNBin] = useState<string>('11111111');
  const [baseNOct, setBaseNOct] = useState<string>('377');
  const [baseNOpA, setBaseNOpA] = useState<string>('15');
  const [baseNOpB, setBaseNOpB] = useState<string>('3');
  const [baseNOpChoice, setBaseNOpChoice] = useState<string>('AND');
  const [baseNWordSize, setBaseNWordSize] = useState<number>(32); // 8, 16, 32, 64

  // Handle Base-N conversions
  const handleDecChange = (valStr: string) => {
    setBaseNDec(valStr);
    const num = parseInt(valStr.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      setBaseNHex(num.toString(16).toUpperCase());
      setBaseNBin(num.toString(2));
      setBaseNOct(num.toString(8));
    }
  };

  const handleHexChange = (valStr: string) => {
    const clean = valStr.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    setBaseNHex(clean);
    const num = parseInt(clean, 16);
    if (!isNaN(num)) {
      setBaseNDec(num.toString(10));
      setBaseNBin(num.toString(2));
      setBaseNOct(num.toString(8));
    }
  };

  const handleBinChange = (valStr: string) => {
    const clean = valStr.replace(/[^01]/g, '');
    setBaseNBin(clean);
    const num = parseInt(clean, 2);
    if (!isNaN(num)) {
      setBaseNDec(num.toString(10));
      setBaseNHex(num.toString(16).toUpperCase());
      setBaseNOct(num.toString(8));
    }
  };

  const handleOctChange = (valStr: string) => {
    const clean = valStr.replace(/[^0-7]/g, '');
    setBaseNOct(clean);
    const num = parseInt(clean, 8);
    if (!isNaN(num)) {
      setBaseNDec(num.toString(10));
      setBaseNHex(num.toString(16).toUpperCase());
      setBaseNBin(num.toString(2));
    }
  };

  // Base-N arithmetic / logic calculation
  const baseNResult = useMemo(() => {
    const a = parseInt(baseNOpA, 10) || 0;
    const b = parseInt(baseNOpB, 10) || 0;
    let res = 0;
    let desc = '';

    switch (baseNOpChoice) {
      case '+':
        res = a + b;
        desc = `${a} + ${b} = ${res}`;
        break;
      case '-':
        res = a - b;
        desc = `${a} - ${b} = ${res}`;
        break;
      case '*':
        res = a * b;
        desc = `${a} × ${b} = ${res}`;
        break;
      case '/':
        res = b !== 0 ? Math.floor(a / b) : 0;
        desc = `${a} ÷ ${b} = ${res} (resto: ${b !== 0 ? a % b : 0})`;
        break;
      case '%':
        res = b !== 0 ? a % b : 0;
        desc = `${a} Mod ${b} = ${res}`;
        break;
      case 'AND':
        res = (a & b) >>> 0;
        desc = `${a} AND ${b} = ${res}`;
        break;
      case 'OR':
        res = (a | b) >>> 0;
        desc = `${a} OR ${b} = ${res}`;
        break;
      case 'XOR':
        res = (a ^ b) >>> 0;
        desc = `${a} XOR ${b} = ${res}`;
        break;
      case 'NOT':
        res = (~a) >>> 0;
        desc = `NOT ${a} = ${res}`;
        break;
      case 'SHL':
        res = (a << b) >>> 0;
        desc = `${a} << ${b} = ${res}`;
        break;
      case 'SHR':
        res = (a >>> b) >>> 0;
        desc = `${a} >> ${b} = ${res}`;
        break;
      default:
        res = a + b;
        desc = `${a} + ${b} = ${res}`;
    }

    const mask = baseNWordSize === 8 ? 0xFF : baseNWordSize === 16 ? 0xFFFF : 0xFFFFFFFF;
    const finalRes = (res & mask) >>> 0;

    return {
      dec: finalRes.toString(10),
      hex: finalRes.toString(16).toUpperCase(),
      bin: finalRes.toString(2).padStart(baseNWordSize <= 8 ? 8 : baseNWordSize <= 16 ? 16 : 32, '0').replace(/(.{4})/g, '$1 ').trim(),
      oct: finalRes.toString(8),
      desc,
      rawNum: finalRes,
    };
  }, [baseNOpA, baseNOpB, baseNOpChoice, baseNWordSize]);

  // ═════════════════════════════════════════════════════════════════════════
  // DATE CALCULATION STATE
  // ═════════════════════════════════════════════════════════════════════════
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const nextMonthStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  }, []);

  const [date1, setDate1] = useState<string>(todayStr);
  const [date2, setDate2] = useState<string>(nextMonthStr);
  const [dateAddBase, setDateAddBase] = useState<string>(todayStr);
  const [dateAddAmount, setDateAddAmount] = useState<number>(45);
  const [dateAddUnit, setDateAddUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('days');
  const [dateAddOp, setDateAddOp] = useState<'+' | '-'>('+');

  // Compute date difference
  const dateDiffResult = useMemo(() => {
    try {
      const d1 = new Date(date1 + 'T00:00:00');
      const d2 = new Date(date2 + 'T00:00:00');
      const diffMs = Math.abs(d2.getTime() - d1.getTime());
      const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(totalDays / 7);
      const remDays = totalDays % 7;

      // Count business days (Mon-Fri)
      let businessDays = 0;
      const start = new Date(Math.min(d1.getTime(), d2.getTime()));
      const end = new Date(Math.max(d1.getTime(), d2.getTime()));
      const cur = new Date(start);

      while (cur < end) {
        cur.setDate(cur.getDate() + 1);
        const dayOfWeek = cur.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          businessDays++;
        }
      }

      return {
        totalDays,
        businessDays,
        weeks,
        remDays,
        formatted: `${totalDays} días (${weeks} sem. y ${remDays} d)`,
      };
    } catch {
      return { totalDays: 0, businessDays: 0, weeks: 0, remDays: 0, formatted: '0 días' };
    }
  }, [date1, date2]);

  // Compute date addition/subtraction
  const dateAddResult = useMemo(() => {
    try {
      const d = new Date(dateAddBase + 'T00:00:00');
      const amt = (dateAddOp === '+' ? 1 : -1) * dateAddAmount;

      if (dateAddUnit === 'days') {
        d.setDate(d.getDate() + amt);
      } else if (dateAddUnit === 'weeks') {
        d.setDate(d.getDate() + amt * 7);
      } else if (dateAddUnit === 'months') {
        d.setMonth(d.getMonth() + amt);
      } else if (dateAddUnit === 'years') {
        d.setFullYear(d.getFullYear() + amt);
      }

      const formatted = d.toLocaleDateString('es-VE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const iso = d.toISOString().split('T')[0];
      return { iso, formatted };
    } catch {
      return { iso: dateAddBase, formatted: '' };
    }
  }, [dateAddBase, dateAddAmount, dateAddUnit, dateAddOp]);

  // ═════════════════════════════════════════════════════════════════════════
  // DURATION CALCULATION STATE (HH:MM:SS)
  // ═════════════════════════════════════════════════════════════════════════
  const [durH1, setDurH1] = useState<number>(2);
  const [durM1, setDurM1] = useState<number>(30);
  const [durS1, setDurS1] = useState<number>(0);
  const [durOp, setDurOp] = useState<'+' | '-'>('+');
  const [durH2, setDurH2] = useState<number>(1);
  const [durM2, setDurM2] = useState<number>(45);
  const [durS2, setDurS2] = useState<number>(30);

  const durationOpResult = useMemo(() => {
    const totalSec1 = durH1 * 3600 + durM1 * 60 + durS1;
    const totalSec2 = durH2 * 3600 + durM2 * 60 + durS2;
    const finalSec =
      durOp === '+' ? totalSec1 + totalSec2 : Math.max(0, totalSec1 - totalSec2);

    const h = Math.floor(finalSec / 3600);
    const m = Math.floor((finalSec % 3600) / 60);
    const s = Math.floor(finalSec % 60);
    const decimalHours = finalSec / 3600;
    const totalMinutes = finalSec / 60;

    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    return {
      timeStr,
      h,
      m,
      s,
      decimalHours,
      totalMinutes,
      finalSec,
    };
  }, [durH1, durM1, durS1, durOp, durH2, durM2, durS2]);

  // Standard geometry shapes in current category
  const categoryShapes = useMemo(() => {
    return SHAPES_CONFIG.filter((s) => s.category === activeCategory);
  }, [activeCategory]);

  const activeShape = useMemo(() => {
    return (
      categoryShapes.find((s) => s.id === selectedShapeId) ||
      categoryShapes[0] ||
      SHAPES_CONFIG[0]
    );
  }, [categoryShapes, selectedShapeId]);

  const currentValues = useMemo(() => {
    const vals: Record<string, number> = {};
    activeShape.inputs.forEach((inp) => {
      vals[inp.key] = inputValues[inp.key] !== undefined ? inputValues[inp.key] : inp.defaultValue;
    });
    return vals;
  }, [activeShape, inputValues]);

  const calculationResult = useMemo(() => {
    try {
      return activeShape.calculate(currentValues);
    } catch {
      return {
        result: 0,
        formulaWithValues: '0',
        steps: ['Error en el cálculo'],
        unitResult: '',
      };
    }
  }, [activeShape, currentValues]);

  if (!isOpen) return null;

  const handleInputChange = (key: string, valStr: string) => {
    const num = parseFloat(valStr);
    setInputValues((prev) => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }));
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  const handleInsertCalculation = (val: string, desc?: string) => {
    if (onInsertToCalc) {
      onInsertToCalc(val, desc);
      onClose();
    }
  };

  const handleInsertSheet = (concept: string, val: string) => {
    if (onInsertToSheet) {
      onInsertToSheet(concept, val);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-scale-up">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Conversiones y Cálculos Científicos
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Bases (BIN/OCT/HEX), Fechas, Duración, Áreas, Perímetros y Volúmenes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CATEGORY TABS */}
        <div className="px-3 sm:px-6 pt-3 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-2.5">
            {/* 1. Bases Numéricas */}
            <button
              type="button"
              onClick={() => setActiveCategory('baseN')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'baseN'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/70'
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              <span>Bases (BIN / OCT / HEX)</span>
            </button>

            {/* 2. Fechas */}
            <button
              type="button"
              onClick={() => setActiveCategory('dates')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'dates'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/70'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Cálculo de Fechas</span>
            </button>

            {/* 3. Duración */}
            <button
              type="button"
              onClick={() => setActiveCategory('duration')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'duration'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/70'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Duración / Tiempo</span>
            </button>

            {/* 4. Áreas */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('areas');
                setSelectedShapeId('area_circle');
                setInputValues({});
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'areas'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/70'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Áreas</span>
            </button>

            {/* 5. Perímetros */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('perimeters');
                setSelectedShapeId('perim_circle');
                setInputValues({});
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'perimeters'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/70'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Perímetros</span>
            </button>

            {/* 6. Volúmenes */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('volumes');
                setSelectedShapeId('vol_cylinder');
                setInputValues({});
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'volumes'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/70'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Volúmenes</span>
            </button>

            {/* 7. Temperatura */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory('temperature');
                setSelectedShapeId('temp_celsius_to_all');
                setInputValues({});
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                activeCategory === 'temperature'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/70'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" />
              <span>Temperatura</span>
            </button>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 bg-slate-50/50">
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* CATEGORY: BASE-N (BIN, OCT, HEX, DEC)                             */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'baseN' && (
            <div className="space-y-4">
              {/* Live Synchronized 4-Base Converter */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4" /> Conversor Simultáneo entre 4 Bases
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Modo Programador</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* DEC */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center justify-between">
                      <span>DEC (Decimal, Base 10):</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(baseNDec)}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold cursor-pointer"
                      >
                        Copiar
                      </button>
                    </label>
                    <input
                      type="text"
                      value={baseNDec}
                      onChange={(e) => handleDecChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* HEX */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center justify-between">
                      <span>HEX (Hexadecimal, Base 16):</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(baseNHex)}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold cursor-pointer"
                      >
                        Copiar
                      </button>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-400 pointer-events-none">0x</span>
                      <input
                        type="text"
                        value={baseNHex}
                        onChange={(e) => handleHexChange(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-indigo-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                      />
                    </div>
                  </div>

                  {/* BIN */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center justify-between">
                      <span>BIN (Binario, Base 2):</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(baseNBin)}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold cursor-pointer"
                      >
                        Copiar
                      </button>
                    </label>
                    <input
                      type="text"
                      value={baseNBin}
                      onChange={(e) => handleBinChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-wider"
                    />
                  </div>

                  {/* OCT */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center justify-between">
                      <span>OCT (Octal, Base 8):</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(baseNOct)}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold cursor-pointer"
                      >
                        Copiar
                      </button>
                    </label>
                    <input
                      type="text"
                      value={baseNOct}
                      onChange={(e) => handleOctChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-amber-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleInsertCalculation(baseNDec, `Decimal: ${baseNDec}`)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold cursor-pointer transition-colors"
                  >
                    Insertar DEC ({baseNDec})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertCalculation(baseNHex, `Hex: 0x${baseNHex}`)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer transition-colors"
                  >
                    Insertar HEX (0x{baseNHex})
                  </button>
                </div>
              </div>

              {/* Base-N Arithmetic and Bitwise Operations */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Binary className="w-4 h-4 text-indigo-600" /> Operaciones Aritméticas y Lógicas (Bits)
                  </span>
                  {/* Bit size selector */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                    {[8, 16, 32].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setBaseNWordSize(size)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                          baseNWordSize === size
                            ? 'bg-white text-indigo-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {size}-bit
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formula Bar */}
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 items-center">
                  <input
                    type="number"
                    value={baseNOpA}
                    onChange={(e) => setBaseNOpA(e.target.value)}
                    placeholder="Valor A"
                    className="col-span-1 sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm text-center"
                  />

                  <select
                    value={baseNOpChoice}
                    onChange={(e) => setBaseNOpChoice(e.target.value)}
                    className="col-span-1 sm:col-span-3 px-2 py-2 bg-indigo-50 border border-indigo-200 rounded-xl font-mono font-bold text-xs text-indigo-900 cursor-pointer text-center"
                  >
                    <option value="+">+ (Suma)</option>
                    <option value="-">- (Resta)</option>
                    <option value="*">× (Multiplicación)</option>
                    <option value="/">÷ (División)</option>
                    <option value="%">% (Módulo)</option>
                    <option value="AND">AND (Y Lógico)</option>
                    <option value="OR">OR (O Lógico)</option>
                    <option value="XOR">XOR (O Exclusivo)</option>
                    <option value="NOT">NOT (Negación A)</option>
                    <option value="SHL">&lt;&lt; (Shift Izq)</option>
                    <option value="SHR">&gt;&gt; (Shift Der)</option>
                  </select>

                  <input
                    type="number"
                    value={baseNOpB}
                    disabled={baseNOpChoice === 'NOT'}
                    onChange={(e) => setBaseNOpB(e.target.value)}
                    placeholder="Valor B"
                    className={`col-span-1 sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm text-center ${
                      baseNOpChoice === 'NOT' ? 'opacity-40 bg-slate-100' : ''
                    }`}
                  />
                </div>

                {/* Result Card */}
                <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                    <span>Resultado de la Operación:</span>
                    <span className="font-mono text-indigo-700">{baseNResult.desc}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">DEC</span>
                      <span className="font-mono font-black text-sm text-slate-900">{baseNResult.dec}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">HEX</span>
                      <span className="font-mono font-black text-sm text-indigo-900">0x{baseNResult.hex}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-indigo-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">BIN ({baseNWordSize}-bit)</span>
                      <span className="font-mono font-black text-xs text-emerald-800 tracking-wider break-all">{baseNResult.bin}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleInsertCalculation(baseNResult.dec, baseNResult.desc)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    Insertar Resultado ({baseNResult.dec})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* CATEGORY: DATES (CÁLCULO DE FECHAS)                              */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'dates' && (
            <div className="space-y-4">
              {/* 1. Difference between 2 dates */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> 1. Diferencia entre dos Fechas
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Días, Semanas y Hábiles</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Fecha Inicial:</label>
                    <input
                      type="date"
                      value={date1}
                      onChange={(e) => setDate1(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Fecha Final:</label>
                    <input
                      type="date"
                      value={date2}
                      onChange={(e) => setDate2(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Output Diff Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="bg-indigo-50/70 rounded-xl p-3 border border-indigo-100 text-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Días Totales</span>
                    <span className="font-mono font-black text-2xl text-indigo-950">
                      {dateDiffResult.totalDays}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-bold block">días corridos</span>
                  </div>

                  <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-100 text-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Días Hábiles (L-V)</span>
                    <span className="font-mono font-black text-2xl text-emerald-950">
                      {dateDiffResult.businessDays}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold block">sin fines de semana</span>
                  </div>

                  <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Semanas</span>
                    <span className="font-mono font-black text-lg text-slate-900">
                      {dateDiffResult.weeks} sem. + {dateDiffResult.remDays} d
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleInsertCalculation(dateDiffResult.totalDays.toString(), `Diferencia de fechas: ${dateDiffResult.totalDays} días`)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    Insertar {dateDiffResult.totalDays} Días
                  </button>
                </div>
              </div>

              {/* 2. Add or Subtract from a Date */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> 2. Sumar / Restar a una Fecha
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Proyección de Vencimientos</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Fecha Inicial:</label>
                    <input
                      type="date"
                      value={dateAddBase}
                      onChange={(e) => setDateAddBase(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDateAddOp('+')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer ${
                        dateAddOp === '+'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Sumar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateAddOp('-')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer ${
                        dateAddOp === '-'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5" /> Restar
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={dateAddAmount}
                      min={0}
                      onChange={(e) => setDateAddAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-16 px-2 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm text-center"
                    />
                    <select
                      value={dateAddUnit}
                      onChange={(e) => setDateAddUnit(e.target.value as any)}
                      className="flex-1 py-2 px-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <option value="days">Días</option>
                      <option value="weeks">Semanas</option>
                      <option value="months">Meses</option>
                      <option value="years">Años</option>
                    </select>
                  </div>
                </div>

                {/* Resulting Date */}
                <div className="bg-indigo-50/80 rounded-xl p-3 border border-indigo-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-indigo-700 font-bold uppercase block">Fecha Resultante:</span>
                    <span className="font-extrabold text-sm sm:text-base text-indigo-950 capitalize">
                      {dateAddResult.formatted}
                    </span>
                  </div>
                  <span className="font-mono font-black text-sm bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-900">
                    {dateAddResult.iso}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* CATEGORY: DURATION (DURACIÓN / TIEMPO HH:MM:SS)                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeCategory === 'duration' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Suma y Resta de Horas, Minutos y Segundos (HH:MM:SS)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Cálculo de Tiempos</span>
                </div>

                {/* Time 1 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Tiempo 1 (Horas : Minutos : Segundos):</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={durH1}
                        min={0}
                        onChange={(e) => setDurH1(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-center"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">hrs</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={durM1}
                        min={0}
                        max={59}
                        onChange={(e) => setDurM1(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-center"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">min</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={durS1}
                        min={0}
                        max={59}
                        onChange={(e) => setDurS1(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-center"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">seg</span>
                    </div>
                  </div>
                </div>

                {/* Operator Switch */}
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDurOp('+')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border cursor-pointer ${
                      durOp === '+'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Sumar Intervalo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurOp('-')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border cursor-pointer ${
                      durOp === '-'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" /> Restar Intervalo
                  </button>
                </div>

                {/* Time 2 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Tiempo 2 (Horas : Minutos : Segundos):</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={durH2}
                        min={0}
                        onChange={(e) => setDurH2(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-center"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">hrs</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={durM2}
                        min={0}
                        max={59}
                        onChange={(e) => setDurM2(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-center"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">min</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={durS2}
                        min={0}
                        max={59}
                        onChange={(e) => setDurS2(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-center"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">seg</span>
                    </div>
                  </div>
                </div>

                {/* Duration Result Summary */}
                <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 rounded-2xl p-4 border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Duración Resultante
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(durationOpResult.timeStr)}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded-md border border-indigo-200"
                    >
                      <Copy className="w-3 h-3" /> Copiar HH:MM:SS
                    </button>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-indigo-200 text-center">
                    <span className="font-mono font-black text-3xl text-indigo-950 tracking-wider">
                      {durationOpResult.timeStr}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Horas Decimales</span>
                      <span className="font-mono font-black text-slate-900">
                        {formatNumber(durationOpResult.decimalHours, 4)} h
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Minutos Totales</span>
                      <span className="font-mono font-black text-slate-900">
                        {formatNumber(durationOpResult.totalMinutes, 2)} min
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Segundos Totales</span>
                      <span className="font-mono font-black text-slate-900">
                        {durationOpResult.finalSec} s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleInsertCalculation(durationOpResult.decimalHours.toFixed(4), `Horas: ${durationOpResult.decimalHours.toFixed(4)}h (${durationOpResult.timeStr})`)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    Insertar Horas Decimales ({durationOpResult.decimalHours.toFixed(2)}h)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* CATEGORIES: GEOMETRY & PHYSICS (AREAS, PERÍMETROS, VOLÚMENES, TEMP) */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {(activeCategory === 'areas' ||
            activeCategory === 'perimeters' ||
            activeCategory === 'volumes' ||
            activeCategory === 'temperature') && (
            <>
              {/* 1. Shape Selection Bar */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Seleccionar Figura / Cálculo:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {categoryShapes.map((shape) => {
                    const isSelected = shape.id === activeShape.id;
                    return (
                      <button
                        key={shape.id}
                        type="button"
                        onClick={() => {
                          setSelectedShapeId(shape.id);
                          setInputValues({});
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold text-left transition-all border cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-white border-indigo-500 shadow-xs ring-2 ring-indigo-500/20 text-indigo-950'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="truncate">{shape.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 mt-1 truncate">
                          {shape.formulaStr}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Shape Info & Formula Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wide">
                    {activeShape.name}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">{activeShape.description}</p>
                </div>
                {/* Visual Formula Badge */}
                <div className="px-3.5 py-1.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-indigo-700">Fórmula:</span>
                  <span className="font-mono font-extrabold text-sm text-indigo-950">
                    {activeShape.formulaStr}
                  </span>
                </div>
              </div>

              {/* 3. Parameter Inputs Grid */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col gap-4">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Parámetros de entrada</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {activeShape.inputs.map((inp) => {
                    const val = currentValues[inp.key];
                    return (
                      <div key={inp.key} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>{inp.label}</span>
                          {inp.unit && <span className="text-[11px] text-slate-400 font-normal">[{inp.unit}]</span>}
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={val}
                            step={inp.step || 'any'}
                            min={inp.min}
                            onChange={(e) => handleInputChange(inp.key, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm bg-white"
                          />
                          <span className="absolute right-3 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                            {inp.symbol}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Live Calculation Output & Steps */}
              <div className="bg-gradient-to-br from-indigo-50/60 to-blue-50/60 rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Resultado Calculado
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(calculationResult.result.toString())}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors cursor-pointer"
                    title="Copiar resultado numérico"
                  >
                    {copiedStatus ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-baseline justify-between bg-white rounded-xl px-4 py-3 border border-indigo-200/80 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500">Valor exacto:</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-indigo-950">
                      {formatNumber(calculationResult.result, 4)}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-600">
                      {calculationResult.unitResult}
                    </span>
                  </div>
                </div>

                {/* Step by step */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Desglose y sustitución de fórmula:
                  </span>
                  <div className="bg-white/80 rounded-xl p-2.5 border border-slate-200 text-xs font-mono text-slate-700 space-y-1">
                    {calculationResult.steps.map((st, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-indigo-500 font-bold shrink-0">•</span>
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer transition-colors"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            {onInsertToSheet && (
              <button
                type="button"
                onClick={() => {
                  if (activeCategory === 'baseN') {
                    handleInsertSheet(`Base-N (${baseNOpChoice})`, baseNResult.dec);
                  } else if (activeCategory === 'dates') {
                    handleInsertSheet('Diferencia Fechas', dateDiffResult.totalDays.toString());
                  } else if (activeCategory === 'duration') {
                    handleInsertSheet('Duración', durationOpResult.decimalHours.toFixed(4));
                  } else {
                    handleInsertSheet(`${activeShape.name} (${activeShape.category})`, calculationResult.result.toString());
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                title="Insertar como nueva fila en la hoja de cálculo activa"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                <span>Insertar en Hoja</span>
              </button>
            )}

            {onInsertToCalc && (
              <button
                type="button"
                onClick={() => {
                  if (activeCategory === 'baseN') {
                    handleInsertCalculation(baseNResult.dec, baseNResult.desc);
                  } else if (activeCategory === 'dates') {
                    handleInsertCalculation(dateDiffResult.totalDays.toString(), `Diferencia de fechas: ${dateDiffResult.totalDays} días`);
                  } else if (activeCategory === 'duration') {
                    handleInsertCalculation(durationOpResult.decimalHours.toFixed(4), `Horas: ${durationOpResult.decimalHours.toFixed(4)}h`);
                  } else {
                    handleInsertCalculation(calculationResult.result.toString(), `${activeShape.name}: ${calculationResult.formulaWithValues}`);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-all shadow-xs active:scale-95"
                title="Insertar valor en la pantalla de la calculadora científica"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                <span>Insertar en Calculadora</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
