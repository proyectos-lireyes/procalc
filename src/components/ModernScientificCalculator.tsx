import React from 'react';
import { CasioScientificCalculator, CasioScientificCalculatorProps, AngleUnit } from './CasioScientificCalculator';

export type { AngleUnit, CasioScientificCalculatorProps };

export const ModernScientificCalculator: React.FC<CasioScientificCalculatorProps> = (props) => {
  return <CasioScientificCalculator {...props} />;
};
