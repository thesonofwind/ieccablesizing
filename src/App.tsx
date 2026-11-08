import { useState, useMemo, ReactNode } from 'react';
import { 
  Zap, 
  Settings2, 
  LayoutGrid, 
  Thermometer, 
  Waves,
  Calculator, 
  Table as TableIcon, 
  HelpCircle,
  ShieldCheck,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CABLE_CAPACITIES, 
  GROUPING_FACTORS, 
  TEMP_FACTORS, 
  SOIL_RESISTIVITY_FACTORS, 
  STANDARD_VOLTAGES,
  VOLTAGE_DROP_FACTORS,
  DUCT_GROUPING_FACTORS,
  SINGLE_CORE_GROUPING_FACTORS
} from './constants';
import { 
  LayingMethod, 
  CableType,
  CalculationResult, 
  ComparisonResult 
} from './types';

// --- Tooltip Component ---
interface TooltipProps {
  content: string;
  children: ReactNode;
}

function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 text-slate-100 text-[11px] leading-relaxed rounded-lg shadow-xl border border-slate-800 z-50 pointer-events-none"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'calculator' | 'standards'>('calculator');

  // Calculation parameters
  const [voltage, setVoltage] = useState(400);
  const [powerType, setPowerType] = useState<'kW' | 'A'>('kW');
  const [powerValue, setPowerValue] = useState(250);
  const [pf, setPf] = useState(0.85);
  const [length, setLength] = useState(75);
  const [layingMethod, setLayingMethod] = useState<LayingMethod>('D1');
  const [cableType, setCableType] = useState<CableType>('multi');
  const [ambientTemp, setAmbientTemp] = useState(25);
  const [soilResistivity, setSoilResistivity] = useState(2.5);
  const [ductSpacing, setDuctSpacing] = useState<0 | 0.25 | 0.5 | 1.0>(0.25);
  const [selectedBaseSize, setSelectedBaseSize] = useState(185);

  // Derived Calculations
  const results = useMemo(() => {
    // 1. Calculate Load Current (Ib)
    let loadCurrent = powerValue;
    const calculationSteps: { label: string; formula: string; result: string }[] = [];

    if (powerType === 'kW') {
      loadCurrent = (powerValue * 1000) / (Math.sqrt(3) * voltage * pf);
      calculationSteps.push({
        label: 'Design Current (Ib)',
        formula: `(${powerValue} kW × 1000) / (√3 × ${voltage} V × ${pf})`,
        result: `${loadCurrent.toFixed(2)} A`
      });
    } else {
      calculationSteps.push({
        label: 'Design Current (Ib)',
        formula: 'Specified Direct Load Current',
        result: `${powerValue.toFixed(2)} A`
      });
    }

    // 2. Correction factors
    const tempFactor = TEMP_FACTORS.find(t => t.temp === ambientTemp)?.factor || 1;
    const soilFactor = SOIL_RESISTIVITY_FACTORS.find(s => s.resistivity === soilResistivity)?.factor || 1;
    const baseDerating = tempFactor * soilFactor;

    calculationSteps.push({
      label: 'Thermal Correction (k1)',
      formula: `Ground Ambient @ ${ambientTemp}°C (Table B.52.14)`,
      result: tempFactor.toFixed(2)
    });
    calculationSteps.push({
      label: 'Soil Resistivity (k2)',
      formula: `Thermal Resistivity @ ${soilResistivity} K·m/W (Table B.52.16)`,
      result: soilFactor.toFixed(2)
    });

    // 3. Find required parallel runs for any cable size
    const findRequiredRuns = (size: number): ComparisonResult => {
      const cable = CABLE_CAPACITIES.find(c => c.size === size);
      if (!cable) return { size, parallelRuns: 0, capacityPerRun: 0, totalCapacity: 0, derating: 0 };

      let baseCapacity = 0;
      if (cableType === 'multi') {
        baseCapacity = layingMethod === 'D1' ? cable.capacityD1 : cable.capacityD2;
      } else {
        baseCapacity = layingMethod === 'D1' ? cable.capacitySingleD1 : cable.capacitySingleD2;
      }

      let n = 1;
      let totalCapacity = 0;
      let groupingFactor = 1;

      for (n = 1; n <= 16; n++) {
        if (layingMethod === 'D1') {
          const ductData = DUCT_GROUPING_FACTORS.find(g => g.circuits === n);
          if (ductSpacing === 0) groupingFactor = ductData?.touching || 0.4;
          else if (ductSpacing === 0.25) groupingFactor = ductData?.spacing025 || 0.4;
          else if (ductSpacing === 0.5) groupingFactor = ductData?.spacing05 || 0.4;
          else groupingFactor = ductData?.spacing10 || 0.4;
        } else {
          if (cableType === 'multi') {
            groupingFactor = GROUPING_FACTORS.find(g => g.circuits === n)?.factor || 0.4;
          } else {
            groupingFactor = SINGLE_CORE_GROUPING_FACTORS.find(g => g.circuits === n)?.trefoil || 0.35;
          }
        }

        const totalDerating = baseDerating * groupingFactor;
        const capacityPerRun = baseCapacity * totalDerating;
        totalCapacity = capacityPerRun * n;

        if (totalCapacity >= loadCurrent) {
          return {
            size,
            parallelRuns: n,
            capacityPerRun,
            totalCapacity,
            derating: totalDerating
          };
        }
      }

      return {
        size,
        parallelRuns: 17, // Beyond max allowed
        capacityPerRun: 0,
        totalCapacity: 0,
        derating: 0
      };
    };

    // 4. Comparison across all standard sizes
    const comparisons: ComparisonResult[] = CABLE_CAPACITIES.map(c => findRequiredRuns(c.size));

    // 5. Selected result for the active configuration
    const selectedComp = comparisons.find(c => c.size === selectedBaseSize) || comparisons[0];
    const n = selectedComp?.parallelRuns || 1;
    let groupingFactor = 1;

    if (layingMethod === 'D1') {
      const ductData = DUCT_GROUPING_FACTORS.find(g => g.circuits === n);
      if (ductSpacing === 0) groupingFactor = ductData?.touching || 0.4;
      else if (ductSpacing === 0.25) groupingFactor = ductData?.spacing025 || 0.4;
      else if (ductSpacing === 0.5) groupingFactor = ductData?.spacing05 || 0.4;
      else groupingFactor = ductData?.spacing10 || 0.4;
    } else {
      if (cableType === 'multi') {
        groupingFactor = GROUPING_FACTORS.find(g => g.circuits === n)?.factor || 0.4;
      } else {
        groupingFactor = SINGLE_CORE_GROUPING_FACTORS.find(g => g.circuits === n)?.trefoil || 0.35;
      }
    }

    const totalDerating = baseDerating * groupingFactor;

    calculationSteps.push({
      label: 'Grouping Factor (k3)',
      formula: `N=${n} in single trench (${layingMethod === 'D1' ? `Ducts @ ${ductSpacing}m` : 'Direct in Ground'})`,
      result: groupingFactor.toFixed(2)
    });
    calculationSteps.push({
      label: 'Total Derating (k)',
      formula: `k1 × k2 × k3 = ${tempFactor.toFixed(2)} × ${soilFactor.toFixed(2)} × ${groupingFactor.toFixed(2)}`,
      result: totalDerating.toFixed(3)
    });

    let baseCap = 0;
    const cableData = CABLE_CAPACITIES.find(c => c.size === selectedBaseSize);
    if (cableType === 'multi') {
      baseCap = layingMethod === 'D1' ? cableData?.capacityD1 || 0 : cableData?.capacityD2 || 0;
    } else {
      baseCap = layingMethod === 'D1' ? cableData?.capacitySingleD1 || 0 : cableData?.capacitySingleD2 || 0;
    }

    calculationSteps.push({
      label: 'Derated Capacity per Run (Iz)',
      formula: `Base (${baseCap} A) × k (${totalDerating.toFixed(3)})`,
      result: `${(selectedComp?.capacityPerRun || 0).toFixed(1)} A`
    });
    calculationSteps.push({
      label: 'Total Trench Capacity (Iz,total)',
      formula: `${(selectedComp?.capacityPerRun || 0).toFixed(1)} A × ${n} runs`,
      result: `${(selectedComp?.totalCapacity || 0).toFixed(1)} A`
    });

    // Voltage Drop calculations
    const vdFactor = VOLTAGE_DROP_FACTORS[selectedBaseSize] || 1.0;
    const voltageDrop = (vdFactor * loadCurrent * length) / (1000 * n);
    const voltageDropPercent = (voltageDrop / voltage) * 100;

    calculationSteps.push({
      label: 'Voltage Drop (ΔV)',
      formula: `(${vdFactor} mV/A/m × ${loadCurrent.toFixed(1)} A × ${length} m) / (1000 × ${n})`,
      result: `${voltageDrop.toFixed(2)} V (${voltageDropPercent.toFixed(2)}%)`
    });

    const mainResult: CalculationResult = {
      loadCurrent,
      selectedSize: selectedBaseSize,
      parallelRuns: n,
      totalDerating: selectedComp?.derating || totalDerating,
      voltageDrop,
      voltageDropPercent,
      totalCapacity: selectedComp?.totalCapacity || 0,
      cableType
    };

    return { mainResult, comparisons, calculationSteps, tempFactor, soilFactor, groupingFactor, baseCap };
  }, [voltage, powerType, powerValue, pf, length, layingMethod, ambientTemp, soilResistivity, selectedBaseSize, ductSpacing, cableType]);

  // Visual Trench Cross-section
  const renderTrenchVisualization = () => {
    const n = Math.min(results.mainResult.parallelRuns, 16);
    const isFeasible = results.mainResult.parallelRuns <= 16;
    
    // Trench estimated physical dimensions
    const trenchDepthMm = 800; // standard 800mm underground cover
    const conduitDiameterMm = 160;
    const spacingMm = layingMethod === 'D1' ? ductSpacing * 1000 : 70;
    const trenchWidthMm = Math.max(700, Math.round(n * conduitDiameterMm + (n - 1) * spacingMm + 200));

    return (
      <div className="w-full bg-white rounded-xl border border-slate-200/90 p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Single Trench Cross-Section</span>
              <span className="text-[11px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-medium">
                IEC 60364-5-52 {layingMethod === 'D1' ? 'Method D1 (Ducts)' : 'Method D2 (Direct)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Unified excavation plane containing all {n} parallel {cableType === 'multi' ? 'cables' : 'trefoil circuits'}.
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-mono text-slate-600">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Trench Width</span>
              <span className="text-slate-900 font-semibold">{trenchWidthMm} mm</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Depth to Center</span>
              <span className="text-slate-900 font-semibold">{trenchDepthMm} mm</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Duct Spacing</span>
              <span className="text-blue-600 font-semibold">{ductSpacing} m</span>
            </div>
          </div>
        </div>

        {/* CAD Trench Schematic Canvas */}
        <div className="relative rounded-lg bg-slate-50 border border-slate-200 p-6 overflow-hidden">
          {/* Subtle soil background grid with depth watermark */}
          <div 
            className="absolute inset-0 opacity-[0.06] pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', 
              backgroundSize: '16px 16px' 
            }} 
          />

          {/* Ground level reference line */}
          <div className="relative z-10 flex items-center justify-between border-b border-dashed border-amber-600/60 pb-2 mb-8">
            <span className="text-[10px] font-mono tracking-widest text-amber-700 uppercase font-semibold">
              ▼ Ground Surface Level (±0.00 m)
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Soil Thermal Resistivity: {soilResistivity} K·m/W · Temp: {ambientTemp}°C
            </span>
          </div>

          {/* Trench excavation envelope */}
          <div className="relative z-10 border-2 border-slate-300 border-t-0 bg-gradient-to-b from-white via-amber-50/20 to-amber-100/30 rounded-b-xl p-6 pt-10 min-h-[200px] flex flex-col justify-end shadow-inner">
            
            {/* Sand bed indicator */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-amber-100/60 border-t border-dashed border-amber-300 pointer-events-none">
              <span className="absolute bottom-1 right-3 text-[9px] font-mono text-amber-800/70 font-medium">
                100mm Sand Bedding Layer
              </span>
            </div>

            {/* Warning if runs overflow */}
            {!isFeasible && (
              <div className="my-auto py-8 text-center space-y-2">
                <p className="text-sm font-semibold text-rose-600">Exceeds 16 Parallel Runs</p>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  A larger base conductor size (e.g. 240, 300, or 400 mm²) is required to satisfy this load within IEC grouping limits.
                </p>
              </div>
            )}

            {/* Conduits / Cables array */}
            {isFeasible && (
              <div className="flex flex-wrap items-center justify-center gap-y-8 gap-x-6 relative z-10 py-4">
                {Array.from({ length: n }).map((_, idx) => (
                  <div key={idx} className="relative group flex flex-col items-center">
                    
                    {/* Conduit Duct Ring (D1 Method) */}
                    {layingMethod === 'D1' && (
                      <div className="absolute -inset-2.5 rounded-full border-2 border-slate-300 bg-white shadow-sm transition-colors group-hover:border-blue-400" />
                    )}

                    {/* Conductor cross-section */}
                    {cableType === 'multi' ? (
                      // Multi-core 4-core cable
                      <div className="relative w-14 h-14 rounded-full bg-slate-900 border-2 border-slate-600 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform">
                        <div className="grid grid-cols-2 gap-1 p-1">
                          <div className="w-4 h-4 rounded-full bg-amber-700 border border-amber-500/60 flex items-center justify-center text-[7px] font-mono text-amber-100 font-bold" title="Phase L1 (Brown)">
                            L1
                          </div>
                          <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-[7px] font-mono text-slate-300 font-bold" title="Phase L2 (Black)">
                            L2
                          </div>
                          <div className="w-4 h-4 rounded-full bg-slate-600 border border-slate-400 flex items-center justify-center text-[7px] font-mono text-slate-100 font-bold" title="Phase L3 (Grey)">
                            L3
                          </div>
                          <div className="w-4 h-4 rounded-full bg-blue-600 border border-blue-400 flex items-center justify-center text-[7px] font-mono text-blue-100 font-bold" title="Neutral (Blue)">
                            N
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Trefoil arrangement of 3 single-core cables
                      <div className="relative w-14 h-14 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-amber-700 border border-amber-500 flex items-center justify-center text-[8px] font-mono font-bold text-amber-100 shadow-sm" title="Phase L1">
                            L1
                          </div>
                          <div className="flex -mt-1 gap-0.5">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-[8px] font-mono font-bold text-slate-200 shadow-sm" title="Phase L2">
                              L2
                            </div>
                            <div className="w-6 h-6 rounded-full bg-slate-600 border border-slate-400 flex items-center justify-center text-[8px] font-mono font-bold text-slate-100 shadow-sm" title="Phase L3">
                              L3
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Circuit index marker */}
                    <div className="absolute -top-3 -right-2 bg-white border border-slate-300 text-blue-600 text-[10px] font-mono font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                      {idx + 1}
                    </div>

                    {/* Spacing dimension line between adjacent ducts */}
                    {idx < n - 1 && (
                      <div className="absolute top-1/2 -right-6 w-6 h-px bg-blue-300 flex items-center justify-center pointer-events-none">
                        <span className="bg-white border border-blue-200 px-1 rounded text-[8px] font-mono text-blue-700 -mt-4 shadow-xs font-semibold">
                          {ductSpacing}m
                        </span>
                      </div>
                    )}

                    <span className="text-[10px] font-mono text-slate-600 mt-2 font-medium">
                      Run #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagram legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-4 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 bg-white" />
                <span className="text-[11px]">HDPE Conduit Duct (D1)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-600" />
                <span className="text-[11px]">Cable Outer Sheath</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-1 bg-blue-500 rounded" />
                <span className="text-[11px]">Clear Edge-to-Edge Spacing ({ductSpacing} m)</span>
              </div>
            </div>

            <span className="text-[11px] font-mono text-slate-500 font-medium">
              Conductor: Copper / XLPE 90°C Insulation
            </span>
          </div>
        </div>

        {/* Engineering technical notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-600">
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              Mutual Thermal Coupling
            </span>
            All {n} circuits share a common heat dissipation field in the single trench. Applying IEC Table B.52.20 derating factor ({results.groupingFactor.toFixed(2)}) accounts for mutual heating and prevents thermal runaway under sustained load.
          </div>
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              Phase Transposition & Balance
            </span>
            For {results.mainResult.parallelRuns} parallel runs, cables must have identical physical routing length, matching cross-section ({selectedBaseSize} mm²), and symmetric phase transposition to avoid circulating neutral currents.
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600/10 selection:text-blue-700">
      
      {/* Top Bar Contract (3 zones: Brand - 4 Nav Links - 1 Action) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 shadow-xs">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-900 block leading-tight">
              IEC Cable Sizing Pro
            </span>
            <span className="text-[10px] font-mono text-slate-500 block">
              Underground Transmission & Distribution Sizing
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
          <button 
            onClick={() => setActiveTab('calculator')}
            className={`whitespace-nowrap shrink-0 transition-colors ${activeTab === 'calculator' ? 'text-blue-600' : 'hover:text-slate-900'}`}
          >
            Engineering Calculator
          </button>
          <button 
            onClick={() => setActiveTab('standards')}
            className={`whitespace-nowrap shrink-0 transition-colors ${activeTab === 'standards' ? 'text-blue-600' : 'hover:text-slate-900'}`}
          >
            IEC 60364-5-52 Standards
          </button>
          <a 
            href="#methodology" 
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Derating Formulas
          </a>
          <a 
            href="#compliance" 
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Compliance Notes
          </a>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${activeTab === 'calculator' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Calculator
            </button>
            <button 
              onClick={() => setActiveTab('standards')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${activeTab === 'standards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Standards Tables
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Telemetry Header Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl px-5 py-3 shadow-xs">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="font-mono text-blue-600 uppercase tracking-wider font-bold">Standard</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-medium text-slate-800">IEC 60364-5-52:2009 / IEC 60287</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Single Trench Configuration</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-600">
            <span>Soil: <strong className="text-slate-900">{soilResistivity} K·m/W</strong></span>
            <span aria-hidden="true" className="text-slate-300">|</span>
            <span>Ambient: <strong className="text-slate-900">{ambientTemp}°C</strong></span>
            <span aria-hidden="true" className="text-slate-300">|</span>
            <span>System: <strong className="text-slate-900">{voltage}V 3-Phase</strong></span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'calculator' ? (
            <motion.div 
              key="calc-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              
              {/* Left Column: Parameter Console (4 cols) */}
              <aside className="lg:col-span-4 space-y-6">
                
                {/* Circuit & Load Parameters Card */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-blue-600" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        1. Circuit Parameters
                      </h2>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 font-medium">Design Load</span>
                  </div>

                  <div className="space-y-4">
                    {/* Voltage selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                        <span>Nominal Operating Voltage</span>
                        <span className="font-mono text-slate-400 text-[10px]">3-Phase AC</span>
                      </label>
                      <select 
                        value={voltage}
                        onChange={(e) => setVoltage(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
                      >
                        {STANDARD_VOLTAGES.map(v => (
                          <option key={v} value={v}>{v} V (Line-to-Line)</option>
                        ))}
                      </select>
                    </div>

                    {/* Load input (Power or Current) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-700">Load Specification</label>
                        <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-md">
                          <button 
                            type="button"
                            onClick={() => setPowerType('kW')}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${powerType === 'kW' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Power (kW)
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPowerType('A')}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${powerType === 'A' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Current (A)
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <input 
                          type="number"
                          min={1}
                          max={50000}
                          value={powerValue}
                          onChange={(e) => setPowerValue(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all font-semibold"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400 font-semibold pointer-events-none">
                          {powerType}
                        </span>
                      </div>
                    </div>

                    {/* Power factor & Length */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                          <span>Power Factor</span>
                          <span className="font-mono text-slate-400 text-[10px]">cos φ</span>
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0.5"
                          max="1.0"
                          value={pf}
                          onChange={(e) => setPf(Math.min(1.0, Math.max(0.5, Number(e.target.value))))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all font-semibold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                          <span>Route Length</span>
                          <span className="font-mono text-slate-400 text-[10px]">Meters</span>
                        </label>
                        <input 
                          type="number"
                          min="1"
                          value={length}
                          onChange={(e) => setLength(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Installation & Laying Conditions Card */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-blue-600" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        2. Laying & Soil Factors
                      </h2>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">IEC 60364</span>
                  </div>

                  <div className="space-y-4">
                    {/* Cable Construction Type */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-700">Cable Construction</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          type="button"
                          onClick={() => setCableType('multi')}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-all ${cableType === 'multi' ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'}`}
                        >
                          <span className="block font-bold">Multi-Core</span>
                          <span className="text-[10px] text-slate-500 font-normal">3/4 Core Cable</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setCableType('single')}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-all ${cableType === 'single' ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'}`}
                        >
                          <span className="block font-bold">Single-Core</span>
                          <span className="text-[10px] text-slate-500 font-normal">Trefoil Formation</span>
                        </button>
                      </div>
                    </div>

                    {/* Laying Method */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-700">Laying Method in Trench</label>
                        <Tooltip content="Method D1 runs cables inside underground conduit ducts. Method D2 lays cables directly into the soil bed.">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                        </Tooltip>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          type="button"
                          onClick={() => setLayingMethod('D1')}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-all ${layingMethod === 'D1' ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'}`}
                        >
                          <span className="block font-bold">In Ducts (D1)</span>
                          <span className="text-[10px] text-slate-500 font-normal">Conduit pipes</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setLayingMethod('D2')}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-all ${layingMethod === 'D2' ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'}`}
                        >
                          <span className="block font-bold">Direct Ground (D2)</span>
                          <span className="text-[10px] text-slate-500 font-normal">Directly in soil</span>
                        </button>
                      </div>
                    </div>

                    {/* Duct Spacing within the single trench (If D1) */}
                    {layingMethod === 'D1' && (
                      <div className="space-y-1.5 bg-blue-50/60 rounded-lg p-3 border border-blue-200/80">
                        <label className="text-[11px] font-semibold text-slate-800 flex items-center justify-between">
                          <span>Duct Spacing (Inside Trench)</span>
                          <span className="font-mono text-blue-700 text-[10px] font-bold">Table B.52.20</span>
                        </label>
                        <select 
                          value={ductSpacing}
                          onChange={(e) => setDuctSpacing(Number(e.target.value) as any)}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none font-semibold shadow-xs"
                        >
                          <option value={0}>Touching Ducts (0 m)</option>
                          <option value={0.25}>0.25 m Center-to-Center Spacing</option>
                          <option value={0.5}>0.50 m Center-to-Center Spacing</option>
                          <option value={1.0}>1.00 m Center-to-Center Spacing</option>
                        </select>
                      </div>
                    )}

                    {/* Temperature and Soil Resistivity */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-blue-600" />
                          <span>Ground Temp</span>
                        </label>
                        <select 
                          value={ambientTemp}
                          onChange={(e) => setAmbientTemp(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-medium"
                        >
                          {TEMP_FACTORS.map(t => (
                            <option key={t.temp} value={t.temp}>{t.temp}°C (k1={t.factor})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <Waves className="w-3 h-3 text-blue-600" />
                          <span>Soil Resistivity</span>
                        </label>
                        <select 
                          value={soilResistivity}
                          onChange={(e) => setSoilResistivity(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-medium"
                        >
                          {SOIL_RESISTIVITY_FACTORS.map(s => (
                            <option key={s.resistivity} value={s.resistivity}>{s.resistivity} K·m/W (k2={s.factor})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Base Size Selector */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Target Conductor Cross-Section
                    </label>
                    <span className="text-[10px] font-mono text-blue-600 font-bold">Cu / XLPE</span>
                  </div>
                  <select 
                    value={selectedBaseSize}
                    onChange={(e) => setSelectedBaseSize(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
                  >
                    {CABLE_CAPACITIES.map(c => (
                      <option key={c.size} value={c.size}>
                        {c.size} mm² (Nominal Cu Conductor)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Select any cable gauge to evaluate the required parallel runs in the single trench.
                  </p>
                </div>

              </aside>

              {/* Right Column: Engineering Results, Visualization & Comparison (8 cols) */}
              <div className="lg:col-span-8 space-y-8">
                
                {/* Primary Engineering Result Panel */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-6 space-y-6 shadow-xs">
                  
                  {/* Top result metric display */}
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-6">
                    <div>
                      <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1 font-semibold">
                        Calculated Cable Sizing Solution
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl md:text-5xl font-mono font-bold tracking-tight text-slate-900 tabular-nums">
                          {results.mainResult.parallelRuns} × {results.mainResult.selectedSize}
                        </span>
                        <span className="text-lg font-mono text-slate-500 font-medium">mm² Cu</span>
                      </div>
                      <div className="text-xs text-blue-600 font-medium mt-1">
                        {cableType === 'multi' ? 'Multi-Core 4-Core' : 'Single-Core Trefoil'} · {layingMethod === 'D1' ? 'Conduit Ducts (D1)' : 'Direct in Ground (D2)'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-right">
                      <div className="border-l border-slate-200 pl-3">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Load Current (Ib)</span>
                        <span className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                          {results.mainResult.loadCurrent.toFixed(1)} <span className="text-xs text-slate-500 font-normal">A</span>
                        </span>
                      </div>
                      <div className="border-l border-slate-200 pl-3">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Trench Iz,total</span>
                        <span className="text-lg font-mono font-bold text-emerald-600 tabular-nums">
                          {results.mainResult.totalCapacity.toFixed(1)} <span className="text-xs text-slate-500 font-normal">A</span>
                        </span>
                      </div>
                      <div className="border-l border-slate-200 pl-3">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Net Derating (k)</span>
                        <span className="text-lg font-mono font-bold text-amber-600 tabular-nums">
                          {(results.mainResult.totalDerating * 100).toFixed(1)} <span className="text-xs text-slate-500 font-normal">%</span>
                        </span>
                      </div>
                      <div className="border-l border-slate-200 pl-3">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Voltage Drop (ΔV)</span>
                        <span className={`text-lg font-mono font-bold tabular-nums ${results.mainResult.voltageDropPercent > 3 ? 'text-amber-600' : 'text-slate-900'}`}>
                          {results.mainResult.voltageDropPercent.toFixed(2)} <span className="text-xs text-slate-500 font-normal">%</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mathematical Derivation Accordion / Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="flex items-center gap-2">
                        <Calculator className="w-3.5 h-3.5 text-blue-600" />
                        IEC 60364-5-52 Derivation Steps
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 font-medium">
                        Target Iz ≥ Ib ({results.mainResult.loadCurrent.toFixed(1)} A)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-xs">
                      {results.calculationSteps.map((step, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                            <span>{step.label}</span>
                            <span className="text-blue-700 font-bold">{step.result}</span>
                          </div>
                          <div className="text-[11px] text-slate-700 truncate" title={step.formula}>
                            {step.formula}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Single Trench Cross-Section Visualization */}
                {renderTrenchVisualization()}

                {/* Standard Sizes Comparison Matrix */}
                <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden space-y-0 shadow-xs">
                  <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <TableIcon className="w-4 h-4 text-blue-600" />
                        Parallel Run Comparison Across Conductor Gauges
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Click any cable size to update the active trench configuration and layout view.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-semibold">Max 16 Parallel Circuits</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-mono uppercase text-slate-600 border-b border-slate-200 font-bold">
                          <th className="px-5 py-3">Conductor Size</th>
                          <th className="px-5 py-3 text-center">Required Runs</th>
                          <th className="px-5 py-3 text-right">Derated Iz / Run</th>
                          <th className="px-5 py-3 text-right">Total Capacity</th>
                          <th className="px-5 py-3 text-center">Net Factor (k)</th>
                          <th className="px-5 py-3 text-right">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {results.comparisons.filter(c => c.size >= 10).map((comp) => {
                          const isSelected = comp.size === selectedBaseSize;
                          const isPass = comp.parallelRuns <= 16;
                          return (
                            <tr 
                              key={comp.size}
                              onClick={() => setSelectedBaseSize(comp.size)}
                              className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/80 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-slate-300'}`} />
                                  <span className="font-bold">{comp.size} mm²</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isPass ? (isSelected ? 'bg-blue-100 text-blue-800' : 'text-slate-800') : 'text-rose-600'}`}>
                                  {isPass ? `${comp.parallelRuns} ×` : '> 16'}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right tabular-nums">
                                {comp.capacityPerRun > 0 ? `${comp.capacityPerRun.toFixed(1)} A` : '—'}
                              </td>
                              <td className="px-5 py-3 text-right tabular-nums font-bold">
                                {comp.totalCapacity > 0 ? `${comp.totalCapacity.toFixed(1)} A` : '—'}
                              </td>
                              <td className="px-5 py-3 text-center tabular-nums text-slate-500">
                                {comp.derating > 0 ? `${(comp.derating * 100).toFixed(0)}%` : '—'}
                              </td>
                              <td className="px-5 py-3 text-right">
                                {isPass ? (
                                  <span className="text-[10px] text-emerald-700 font-bold inline-flex items-center gap-1">
                                    Compliant <ArrowUpRight className="w-3 h-3" />
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-semibold">
                                    Capacity Deficit
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </motion.div>
          ) : (
            /* Standards Tables Tab */
            <motion.div 
              key="standards-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Table B.52.3 */}
                <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden md:col-span-2 shadow-xs">
                  <div className="p-5 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Table B.52.3: Current-Carrying Capacities (Amperes) — Copper, XLPE 90°C
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Direct Comparison between Multi-Core and Single-Core Trefoil arrangements in ground/ducts.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <th className="px-4 py-3" rowSpan={2}>Conductor Size (mm²)</th>
                          <th className="px-4 py-3 text-center border-l border-slate-200" colSpan={2}>Multi-Core (3/4C)</th>
                          <th className="px-4 py-3 text-center border-l border-slate-200" colSpan={2}>Single-Core (Trefoil)</th>
                        </tr>
                        <tr className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <th className="px-4 py-2 border-l border-slate-200">Method D1 (Ducts)</th>
                          <th className="px-4 py-2">Method D2 (Ground)</th>
                          <th className="px-4 py-2 border-l border-slate-200">Method D1 (Ducts)</th>
                          <th className="px-4 py-2">Method D2 (Ground)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {CABLE_CAPACITIES.map(c => (
                          <tr key={c.size} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{c.size} mm²</td>
                            <td className="px-4 py-2.5 border-l border-slate-200 tabular-nums">{c.capacityD1} A</td>
                            <td className="px-4 py-2.5 tabular-nums">{c.capacityD2} A</td>
                            <td className="px-4 py-2.5 border-l border-slate-200 tabular-nums">{c.capacitySingleD1} A</td>
                            <td className="px-4 py-2.5 tabular-nums">{c.capacitySingleD2} A</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table B.52.20 */}
                <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden md:col-span-2 shadow-xs">
                  <div className="p-5 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Table B.52.20: Reduction Factors for Cables in Ducts in the Ground
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Grouping correction factors for conduits spaced within a single continuous trench.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <th className="px-4 py-3">Number of Circuits (N)</th>
                          <th className="px-4 py-3 text-right">Touching (0m)</th>
                          <th className="px-4 py-3 text-right">0.25m Spacing</th>
                          <th className="px-4 py-3 text-right">0.50m Spacing</th>
                          <th className="px-4 py-3 text-right">1.00m Spacing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {DUCT_GROUPING_FACTORS.map(g => (
                          <tr key={g.circuits} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{g.circuits} Circuits</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{g.touching.toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{g.spacing025.toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{g.spacing05.toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{g.spacing10.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table B.52.14 Ambient Ground Temperature */}
                <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-xs">
                  <div className="p-5 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Table B.52.14: Ambient Temperature (k1)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">Ground Reference 20°C for XLPE 90°C</p>
                  </div>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] text-slate-600 uppercase border-b border-slate-200 font-bold">
                        <th className="px-4 py-2.5">Temperature</th>
                        <th className="px-4 py-2.5 text-right">Factor k1</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {TEMP_FACTORS.map(t => (
                        <tr key={t.temp} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">{t.temp}°C</td>
                          <td className="px-4 py-2 text-right tabular-nums font-bold text-blue-600">{t.factor.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table B.52.16 Soil Thermal Resistivity */}
                <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-xs">
                  <div className="p-5 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Table B.52.16: Soil Resistivity (k2)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">Reference Soil: 2.5 K·m/W</p>
                  </div>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] text-slate-600 uppercase border-b border-slate-200 font-bold">
                        <th className="px-4 py-2.5">Resistivity (K·m/W)</th>
                        <th className="px-4 py-2.5 text-right">Factor k2</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {SOIL_RESISTIVITY_FACTORS.map(s => (
                        <tr key={s.resistivity} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">{s.resistivity} K·m/W</td>
                          <td className="px-4 py-2 text-right tabular-nums font-bold text-blue-600">{s.factor.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Engineering Methodology & Compliance Section */}
        <section id="methodology" className="bg-white rounded-xl border border-slate-200/90 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Calculation Methodology & IEC Invariants
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 leading-relaxed">
            <div className="space-y-1.5">
              <span className="font-bold text-slate-900 block">Current Capacity Condition</span>
              The combined derated ampacity of all parallel cables in the single trench must satisfy:
              <code className="block my-1.5 p-2 bg-slate-50 rounded border border-slate-200 font-mono text-blue-800 text-[11px] font-semibold">
                Iz,total = N × [I_base × k1 × k2 × k3] ≥ Ib
              </code>
              Where k1 is temperature correction, k2 is soil thermal resistivity, and k3 is grouping in the single excavation trench.
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-slate-900 block">Single Trench Spatial Coupling</span>
              All cables share an overlapping heat envelope. Unlike separated trenches, a single trench concentrates thermal flux in the center. Increasing duct spacing from touching (0m) to 0.25m or 0.5m significantly restores current carrying capacity.
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-slate-900 block">Verification & Compliance</span>
              Calculations assume standard copper conductors with XLPE insulation rated at 90°C. For industrial compliance, verified site soil tests (IEEE 442) and local electrical utility interconnection standards must accompany detailed engineering submittals.
            </div>
          </div>
        </section>

        {/* Quiet Professional Footer */}
        <footer id="compliance" className="border-t border-slate-200 pt-6 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">IEC Cable Sizing Pro</span>
            <span aria-hidden="true">·</span>
            <span>Based on IEC 60364-5-52 & IEC 60287</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Cu / XLPE 90°C</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Single Trench Model</span>
          </div>
        </footer>

      </main>
    </div>
  );
}
