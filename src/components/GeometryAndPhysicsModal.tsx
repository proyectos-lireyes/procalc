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
  ChevronRight,
  Info,
} from 'lucide-react';
import { formatNumber } from '../utils/currency';

export type CalculationCategory = 'areas' | 'perimeters' | 'volumes' | 'temperature';

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
  category: CalculationCategory;
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
    name: 'Triángulo (Fórmula de Herón - 3 Lados)',
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
          `s(s-a)(s-b)(s-c) = ${val > 0 ? formatNumber(val, 4) : '0 (Lados no forman triángulo)'}`,
          `A = √(${formatNumber(val, 4)}) = ${formatNumber(res, 4)}`,
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
    description: 'Área de un trapecio con bases paralelas B y b, y altura perpendicular h.',
    inputs: [
      { key: 'B', label: 'Base Mayor (B)', symbol: 'B', unit: 'cm/m', defaultValue: 10, min: 0 },
      { key: 'b', label: 'Base Menor (b)', symbol: 'b', unit: 'cm/m', defaultValue: 6, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 4, min: 0 },
    ],
    calculate: (v) => {
      const B = v.B || 0;
      const b = v.b || 0;
      const h = v.h || 0;
      const res = ((B + b) * h) / 2;
      return {
        result: res,
        formulaWithValues: `((${B} + ${b}) × ${h}) / 2`,
        steps: [`(B + b) = ${B + b}`, `(${B + b} × ${h}) / 2 = ${formatNumber(res, 4)}`],
        unitResult: 'u²',
      };
    },
  },
  {
    id: 'area_regular_polygon',
    name: 'Polígono Regular (n lados)',
    category: 'areas',
    formulaStr: 'A = (P · ap) / 2',
    description: 'Área de polígono regular de n lados con longitud de lado L o apotema ap.',
    inputs: [
      { key: 'n', label: 'Número de lados (n)', symbol: 'n', defaultValue: 6, min: 3, step: 1 },
      { key: 'L', label: 'Longitud de lado (L)', symbol: 'L', unit: 'cm/m', defaultValue: 4, min: 0 },
    ],
    calculate: (v) => {
      const n = Math.max(3, Math.round(v.n || 3));
      const L = v.L || 0;
      const perim = n * L;
      const ap = L / (2 * Math.tan(Math.PI / n));
      const res = (perim * ap) / 2;
      return {
        result: res,
        formulaWithValues: `(${perim} × ${formatNumber(ap, 3)}) / 2`,
        steps: [
          `Perímetro P = ${n} × ${L} = ${perim}`,
          `Apotema ap = ${L} / (2 × tan(180°/${n})) = ${formatNumber(ap, 4)}`,
          `A = (${perim} × ${formatNumber(ap, 4)}) / 2 = ${formatNumber(res, 4)}`,
        ],
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
      { key: 'b', label: 'Semieje menor (b)', symbol: 'b', unit: 'cm/m', defaultValue: 3, min: 0 },
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
  {
    id: 'area_rhombus',
    name: 'Rombo',
    category: 'areas',
    formulaStr: 'A = (D · d) / 2',
    description: 'Área calculada a partir de sus diagonales perpendicularmente cruzadas.',
    inputs: [
      { key: 'D', label: 'Diagonal Mayor (D)', symbol: 'D', unit: 'cm/m', defaultValue: 8, min: 0 },
      { key: 'd', label: 'Diagonal Menor (d)', symbol: 'd', unit: 'cm/m', defaultValue: 5, min: 0 },
    ],
    calculate: (v) => {
      const D = v.D || 0;
      const d = v.d || 0;
      const res = (D * d) / 2;
      return {
        result: res,
        formulaWithValues: `(${D} × ${d}) / 2`,
        steps: [`D × d = ${D * d}`, `A = ${D * d} / 2 = ${formatNumber(res, 4)}`],
        unitResult: 'u²',
      };
    },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 2. PERÍMETROS (Longitudes de contorno)
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'perim_circle',
    name: 'Circunferencia (Círculo)',
    category: 'perimeters',
    formulaStr: 'P = 2 · π · r',
    description: 'Longitud del borde perimetral de un círculo de radio r.',
    inputs: [{ key: 'r', label: 'Radio (r)', symbol: 'r', unit: 'cm/m', defaultValue: 5, min: 0 }],
    calculate: (v) => {
      const r = v.r || 0;
      const res = 2 * Math.PI * r;
      return {
        result: res,
        formulaWithValues: `2 × π × ${r}`,
        steps: [`Diámetro d = 2 × ${r} = ${2 * r}`, `P = π × ${2 * r} = ${formatNumber(res, 4)}`],
        unitResult: 'u',
      };
    },
  },
  {
    id: 'perim_rectangle',
    name: 'Rectángulo',
    category: 'perimeters',
    formulaStr: 'P = 2 · (b + h)',
    description: 'Suma de los 4 lados de un rectángulo de base b y altura h.',
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
        steps: [`(b + h) = ${b + h}`, `P = 2 × ${b + h} = ${formatNumber(res, 4)}`],
        unitResult: 'u',
      };
    },
  },
  {
    id: 'perim_triangle',
    name: 'Triángulo (3 lados)',
    category: 'perimeters',
    formulaStr: 'P = a + b + c',
    description: 'Suma de las longitudes de los 3 lados de un triángulo.',
    inputs: [
      { key: 'a', label: 'Lado a', symbol: 'a', unit: 'cm/m', defaultValue: 5, min: 0 },
      { key: 'b', label: 'Lado b', symbol: 'b', unit: 'cm/m', defaultValue: 6, min: 0 },
      { key: 'c', label: 'Lado c', symbol: 'c', unit: 'cm/m', defaultValue: 7, min: 0 },
    ],
    calculate: (v) => {
      const a = v.a || 0;
      const b = v.b || 0;
      const c = v.c || 0;
      const res = a + b + c;
      return {
        result: res,
        formulaWithValues: `${a} + ${b} + ${c}`,
        steps: [`P = ${a} + ${b} + ${c} = ${formatNumber(res, 4)}`],
        unitResult: 'u',
      };
    },
  },
  {
    id: 'perim_regular_polygon',
    name: 'Polígono Regular',
    category: 'perimeters',
    formulaStr: 'P = n · L',
    description: 'Perímetro de un polígono de n lados iguales de longitud L.',
    inputs: [
      { key: 'n', label: 'Número de lados (n)', symbol: 'n', defaultValue: 6, min: 3, step: 1 },
      { key: 'L', label: 'Longitud de lado (L)', symbol: 'L', unit: 'cm/m', defaultValue: 4, min: 0 },
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
    id: 'vol_cylinder',
    name: 'Cilindro',
    category: 'volumes',
    formulaStr: 'V = π · r² · h',
    description: 'Volumen de un cilindro recto con radio de base r y altura h.',
    inputs: [
      { key: 'r', label: 'Radio (r)', symbol: 'r', unit: 'cm/m', defaultValue: 3, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 8, min: 0 },
    ],
    calculate: (v) => {
      const r = v.r || 0;
      const h = v.h || 0;
      const res = Math.PI * r * r * h;
      return {
        result: res,
        formulaWithValues: `π × (${r})² × ${h}`,
        steps: [`Área de base = π × ${r * r} = ${formatNumber(Math.PI * r * r, 4)}`, `V = Base × Altura = ${formatNumber(res, 4)}`],
        unitResult: 'u³',
      };
    },
  },
  {
    id: 'vol_sphere',
    name: 'Esfera',
    category: 'volumes',
    formulaStr: 'V = (4/3) · π · r³',
    description: 'Volumen de una esfera tridimensional de radio r.',
    inputs: [{ key: 'r', label: 'Radio (r)', symbol: 'r', unit: 'cm/m', defaultValue: 4, min: 0 }],
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
    id: 'vol_cone',
    name: 'Cono',
    category: 'volumes',
    formulaStr: 'V = (1/3) · π · r² · h',
    description: 'Volumen de un cono circular recto con radio de base r y altura h.',
    inputs: [
      { key: 'r', label: 'Radio (r)', symbol: 'r', unit: 'cm/m', defaultValue: 3, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 6, min: 0 },
    ],
    calculate: (v) => {
      const r = v.r || 0;
      const h = v.h || 0;
      const res = (1 / 3) * Math.PI * r * r * h;
      return {
        result: res,
        formulaWithValues: `(1/3) × π × (${r})² × ${h}`,
        steps: [
          `Base = π × ${r * r} = ${formatNumber(Math.PI * r * r, 4)}`,
          `V = (1/3) × ${formatNumber(Math.PI * r * r, 4)} × ${h} = ${formatNumber(res, 4)}`,
        ],
        unitResult: 'u³',
      };
    },
  },
  {
    id: 'vol_cube_prism',
    name: 'Prisma Rectangular (Ortoedro)',
    category: 'volumes',
    formulaStr: 'V = largo · ancho · alto',
    description: 'Caja o prisma rectangular con 3 dimensiones perpendiculares a, b y c.',
    inputs: [
      { key: 'a', label: 'Largo (a)', symbol: 'a', unit: 'cm/m', defaultValue: 5, min: 0 },
      { key: 'b', label: 'Ancho (b)', symbol: 'b', unit: 'cm/m', defaultValue: 3, min: 0 },
      { key: 'c', label: 'Alto (c)', symbol: 'c', unit: 'cm/m', defaultValue: 4, min: 0 },
    ],
    calculate: (v) => {
      const a = v.a || 0;
      const b = v.b || 0;
      const c = v.c || 0;
      const res = a * b * c;
      return {
        result: res,
        formulaWithValues: `${a} × ${b} × ${c}`,
        steps: [`Área de base = ${a} × ${b} = ${a * b}`, `V = ${a * b} × ${c} = ${formatNumber(res, 4)}`],
        unitResult: 'u³',
      };
    },
  },
  {
    id: 'vol_pyramid',
    name: 'Pirámide de Base Cuadrada',
    category: 'volumes',
    formulaStr: 'V = (1/3) · L² · h',
    description: 'Volumen de una pirámide con base cuadrada de lado L y altura h.',
    inputs: [
      { key: 'L', label: 'Lado de base (L)', symbol: 'L', unit: 'cm/m', defaultValue: 4, min: 0 },
      { key: 'h', label: 'Altura (h)', symbol: 'h', unit: 'cm/m', defaultValue: 6, min: 0 },
    ],
    calculate: (v) => {
      const L = v.L || 0;
      const h = v.h || 0;
      const baseArea = L * L;
      const res = (1 / 3) * baseArea * h;
      return {
        result: res,
        formulaWithValues: `(1/3) × (${L})² × ${h}`,
        steps: [`Área de base = ${baseArea}`, `V = (1/3) × ${baseArea} × ${h} = ${formatNumber(res, 4)}`],
        unitResult: 'u³',
      };
    },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 4. TEMPERATURA
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: 'temp_celsius_to_all',
    name: 'Celsius (°C) a Fahrenheit, Kelvin y Rankine',
    category: 'temperature',
    formulaStr: '°F = (°C · 9/5) + 32  |  K = °C + 273.15',
    description: 'Conversión directa desde escala Celsius a todas las escalas de temperatura.',
    inputs: [{ key: 'c', label: 'Temperatura en Celsius (°C)', symbol: '°C', defaultValue: 25 }],
    calculate: (v) => {
      const c = v.c ?? 0;
      const f = c * (9 / 5) + 32;
      const k = c + 273.15;
      const r = (c + 273.15) * 1.8;
      return {
        result: f,
        formulaWithValues: `(${c} × 9/5) + 32 = ${formatNumber(f, 2)} °F`,
        steps: [
          `Fahrenheit: (${c} × 1.8) + 32 = ${formatNumber(f, 2)} °F`,
          `Kelvin: ${c} + 273.15 = ${formatNumber(k, 2)} K`,
          `Rankine: (${c} + 273.15) × 1.8 = ${formatNumber(r, 2)} °R`,
        ],
        unitResult: '°F (K: ' + formatNumber(k, 2) + ')',
      };
    },
  },
  {
    id: 'temp_fahrenheit_to_all',
    name: 'Fahrenheit (°F) a Celsius y Kelvin',
    category: 'temperature',
    formulaStr: '°C = (°F - 32) · 5/9  |  K = °C + 273.15',
    description: 'Conversión desde escala Fahrenheit a Celsius y escala absoluta Kelvin.',
    inputs: [{ key: 'f', label: 'Temperatura en Fahrenheit (°F)', symbol: '°F', defaultValue: 77 }],
    calculate: (v) => {
      const f = v.f ?? 32;
      const c = (f - 32) * (5 / 9);
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

  // Available shapes in current category
  const categoryShapes = useMemo(() => {
    return SHAPES_CONFIG.filter((s) => s.category === activeCategory);
  }, [activeCategory]);

  // Current selected shape
  const activeShape = useMemo(() => {
    return (
      categoryShapes.find((s) => s.id === selectedShapeId) ||
      categoryShapes[0] ||
      SHAPES_CONFIG[0]
    );
  }, [categoryShapes, selectedShapeId]);

  // Reset inputs when switching shape
  const currentValues = useMemo(() => {
    const vals: Record<string, number> = {};
    activeShape.inputs.forEach((inp) => {
      vals[inp.key] = inputValues[inp.key] !== undefined ? inputValues[inp.key] : inp.defaultValue;
    });
    return vals;
  }, [activeShape, inputValues]);

  // Compute live result
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

  const handleCopyResult = () => {
    navigator.clipboard.writeText(calculationResult.result.toString());
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  const handleInsertCalculation = () => {
    if (onInsertToCalc) {
      onInsertToCalc(calculationResult.result.toString(), `${activeShape.name}: ${calculationResult.formulaWithValues}`);
      onClose();
    }
  };

  const handleInsertSheet = () => {
    if (onInsertToSheet) {
      onInsertToSheet(
        `${activeShape.name} (${activeShape.category})`,
        calculationResult.result.toString()
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-scale-up">
        {/* HEADER: Clean SaaS/App Style */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Cálculos de Modo Científico
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Áreas, Perímetros, Volúmenes y Temperatura con fórmulas y pasos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Cerrar modal de cálculos"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CATEGORY TABS (ÁREAS, PERÍMETROS, VOLÚMENES, TEMPERATURA) */}
        <div className="px-3 sm:px-6 pt-3 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-2.5">
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

        {/* MAIN BODY: Shape Picker & Calculation Panel */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 bg-slate-50/50">
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
                onClick={handleCopyResult}
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
        </div>

        {/* FOOTER ACTIONS: Insert to calculator or sheet */}
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
                onClick={handleInsertSheet}
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
                onClick={handleInsertCalculation}
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
