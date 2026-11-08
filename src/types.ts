export interface CableData {
  size: number;
  capacityD1: number; // Multi-core in ducts
  capacityD2: number; // Multi-core direct in ground
  capacitySingleD1: number; // Single-core in ducts (Trefoil)
  capacitySingleD2: number; // Single-core direct in ground (Trefoil)
}

export interface GroupingFactor {
  circuits: number;
  factor: number;
}

export interface SingleCoreGroupingFactor {
  circuits: number;
  trefoil: number;
  flat: number;
}

export interface TempFactor {
  temp: number;
  factor: number;
}

export interface SoilResistivityFactor {
  resistivity: number;
  factor: number;
}

export interface DuctSpacingFactor {
  circuits: number;
  touching: number;
  spacing025: number;
  spacing05: number;
  spacing10: number;
}

export type LayingMethod = 'D1' | 'D2';
export type CableType = 'multi' | 'single';

export interface CalculationResult {
  loadCurrent: number;
  selectedSize: number;
  parallelRuns: number;
  totalDerating: number;
  voltageDrop: number;
  voltageDropPercent: number;
  totalCapacity: number;
  cableType: CableType;
}

export interface ComparisonResult {
  size: number;
  parallelRuns: number;
  capacityPerRun: number;
  totalCapacity: number;
  derating: number;
}
