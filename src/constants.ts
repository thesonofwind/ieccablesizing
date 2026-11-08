import { CableData, GroupingFactor, TempFactor, SoilResistivityFactor, DuctSpacingFactor, SingleCoreGroupingFactor } from './types';

// IEC 60364-5-52 Table B.52.3 (Copper, XLPE 90C)
export const CABLE_CAPACITIES: CableData[] = [
  { size: 1.5, capacityD1: 18, capacityD2: 22, capacitySingleD1: 20, capacitySingleD2: 24 },
  { size: 2.5, capacityD1: 24, capacityD2: 29, capacitySingleD1: 27, capacitySingleD2: 33 },
  { size: 4, capacityD1: 31, capacityD2: 38, capacitySingleD1: 35, capacitySingleD2: 43 },
  { size: 6, capacityD1: 39, capacityD2: 47, capacitySingleD1: 44, capacitySingleD2: 53 },
  { size: 10, capacityD1: 52, capacityD2: 63, capacitySingleD1: 58, capacitySingleD2: 71 },
  { size: 16, capacityD1: 67, capacityD2: 81, capacitySingleD1: 75, capacitySingleD2: 91 },
  { size: 25, capacityD1: 86, capacityD2: 104, capacitySingleD1: 96, capacitySingleD2: 119 },
  { size: 35, capacityD1: 103, capacityD2: 125, capacitySingleD1: 115, capacitySingleD2: 144 },
  { size: 50, capacityD1: 122, capacityD2: 148, capacitySingleD1: 138, capacitySingleD2: 175 },
  { size: 70, capacityD1: 151, capacityD2: 183, capacitySingleD1: 170, capacitySingleD2: 215 },
  { size: 95, capacityD1: 179, capacityD2: 216, capacitySingleD1: 205, capacitySingleD2: 260 },
  { size: 120, capacityD1: 203, capacityD2: 246, capacitySingleD1: 235, capacitySingleD2: 299 },
  { size: 150, capacityD1: 230, capacityD2: 278, capacitySingleD1: 265, capacitySingleD2: 341 },
  { size: 185, capacityD1: 258, capacityD2: 312, capacitySingleD1: 300, capacitySingleD2: 389 },
  { size: 240, capacityD1: 297, capacityD2: 358, capacitySingleD1: 345, capacitySingleD2: 453 },
  { size: 300, capacityD1: 336, capacityD2: 405, capacitySingleD1: 390, capacitySingleD2: 515 },
  { size: 400, capacityD1: 380, capacityD2: 460, capacitySingleD1: 445, capacitySingleD2: 595 },
  { size: 500, capacityD1: 420, capacityD2: 510, capacitySingleD1: 500, capacitySingleD2: 675 },
  { size: 630, capacityD1: 470, capacityD2: 570, capacitySingleD1: 570, capacitySingleD2: 775 },
];

// Table B.52.17 (Multi-core cables direct in ground, touching)
export const GROUPING_FACTORS: GroupingFactor[] = [
  { circuits: 1, factor: 1.00 },
  { circuits: 2, factor: 0.80 },
  { circuits: 3, factor: 0.70 },
  { circuits: 4, factor: 0.65 },
  { circuits: 5, factor: 0.60 },
  { circuits: 6, factor: 0.57 },
  { circuits: 7, factor: 0.54 },
  { circuits: 8, factor: 0.52 },
  { circuits: 9, factor: 0.50 },
  { circuits: 10, factor: 0.48 },
  { circuits: 11, factor: 0.47 },
  { circuits: 12, factor: 0.46 },
  { circuits: 13, factor: 0.45 },
  { circuits: 14, factor: 0.44 },
  { circuits: 15, factor: 0.43 },
  { circuits: 16, factor: 0.42 },
];

// Table B.52.18 (Single-core cables in trefoil, direct in ground, touching)
export const SINGLE_CORE_GROUPING_FACTORS: SingleCoreGroupingFactor[] = [
  { circuits: 1, trefoil: 1.00, flat: 1.00 },
  { circuits: 2, trefoil: 0.75, flat: 0.80 },
  { circuits: 3, trefoil: 0.65, flat: 0.70 },
  { circuits: 4, trefoil: 0.60, flat: 0.65 },
  { circuits: 5, trefoil: 0.55, flat: 0.60 },
  { circuits: 6, trefoil: 0.50, flat: 0.55 },
  { circuits: 7, trefoil: 0.48, flat: 0.52 },
  { circuits: 8, trefoil: 0.45, flat: 0.50 },
  { circuits: 9, trefoil: 0.43, flat: 0.48 },
  { circuits: 10, trefoil: 0.41, flat: 0.46 },
  { circuits: 11, trefoil: 0.40, flat: 0.45 },
  { circuits: 12, trefoil: 0.39, flat: 0.44 },
  { circuits: 13, trefoil: 0.38, flat: 0.43 },
  { circuits: 14, trefoil: 0.37, flat: 0.42 },
  { circuits: 15, trefoil: 0.36, flat: 0.41 },
  { circuits: 16, trefoil: 0.35, flat: 0.40 },
];

// Table B.52.14 (Ground temp, XLPE 90C)
export const TEMP_FACTORS: TempFactor[] = [
  { temp: 10, factor: 1.07 },
  { temp: 15, factor: 1.04 },
  { temp: 20, factor: 1.00 },
  { temp: 25, factor: 0.96 },
  { temp: 30, factor: 0.93 },
  { temp: 35, factor: 0.89 },
  { temp: 40, factor: 0.85 },
  { temp: 45, factor: 0.80 },
  { temp: 50, factor: 0.76 },
];

// Table B.52.16 (Soil resistivity)
export const SOIL_RESISTIVITY_FACTORS: SoilResistivityFactor[] = [
  { resistivity: 1.0, factor: 1.18 },
  { resistivity: 1.5, factor: 1.10 },
  { resistivity: 2.0, factor: 1.05 },
  { resistivity: 2.5, factor: 1.00 },
  { resistivity: 3.0, factor: 0.96 },
];

// Table B.52.20 (Multi-core cables in ducts in ground)
export const DUCT_GROUPING_FACTORS: DuctSpacingFactor[] = [
  { circuits: 1, touching: 1.00, spacing025: 1.00, spacing05: 1.00, spacing10: 1.00 },
  { circuits: 2, touching: 0.85, spacing025: 0.90, spacing05: 0.95, spacing10: 1.00 },
  { circuits: 3, touching: 0.75, spacing025: 0.85, spacing05: 0.90, spacing10: 0.95 },
  { circuits: 4, touching: 0.70, spacing025: 0.80, spacing05: 0.85, spacing10: 0.90 },
  { circuits: 5, touching: 0.65, spacing025: 0.80, spacing05: 0.85, spacing10: 0.90 },
  { circuits: 6, touching: 0.60, spacing025: 0.75, spacing05: 0.80, spacing10: 0.90 },
  { circuits: 7, touching: 0.57, spacing025: 0.75, spacing05: 0.80, spacing10: 0.90 },
  { circuits: 8, touching: 0.54, spacing025: 0.70, spacing05: 0.80, spacing10: 0.90 },
  { circuits: 9, touching: 0.52, spacing025: 0.70, spacing05: 0.80, spacing10: 0.90 },
  { circuits: 10, touching: 0.50, spacing025: 0.70, spacing05: 0.80, spacing10: 0.90 },
  { circuits: 11, touching: 0.48, spacing025: 0.65, spacing05: 0.75, spacing10: 0.85 },
  { circuits: 12, touching: 0.45, spacing025: 0.65, spacing05: 0.75, spacing10: 0.85 },
  { circuits: 13, touching: 0.44, spacing025: 0.65, spacing05: 0.75, spacing10: 0.85 },
  { circuits: 14, touching: 0.43, spacing025: 0.65, spacing05: 0.75, spacing10: 0.85 },
  { circuits: 15, touching: 0.42, spacing025: 0.65, spacing05: 0.75, spacing10: 0.85 },
  { circuits: 16, touching: 0.41, spacing025: 0.65, spacing05: 0.75, spacing10: 0.85 },
];

export const STANDARD_VOLTAGES = [230, 400, 440, 480, 690, 1000];

// Approximate mV/A/m values for XLPE 3-core copper cables (approximate for calculation)
export const VOLTAGE_DROP_FACTORS: Record<number, number> = {
  1.5: 25,
  2.5: 15,
  4: 9.5,
  6: 6.4,
  10: 3.8,
  16: 2.4,
  25: 1.5,
  35: 1.1,
  50: 0.8,
  70: 0.55,
  95: 0.4,
  120: 0.32,
  150: 0.26,
  185: 0.21,
  240: 0.16,
  300: 0.13,
  400: 0.10,
  500: 0.08,
  630: 0.07,
};
