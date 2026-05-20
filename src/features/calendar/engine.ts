import { addDays, isWeekend, format, parseISO } from 'date-fns';

export interface ScheduleConfig {
  startDate: string; // YYYY-MM-DD
  totalHours: number;
  hoursPerDay: number;
  classDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  holidays: string[]; // Array of YYYY-MM-DD strings
}

export interface CalculationResult {
  endDate: string; // YYYY-MM-DD
  totalClassDays: number;
  history: { date: string; type: 'class' | 'holiday' | 'weekend' | 'off-day'; note?: string }[];
}

/**
 * Motor Logístico (Sentry Logistics Engine)
 * Calcula a data exata de término do curso pulando feriados, finais de semana e dias em que não há aula.
 */
export function calculateEndDate(
  config: ScheduleConfig,
  overrides?: Record<string, { type?: 'class' | 'holiday' | 'off-day' | 'weekend'; note?: string }>
): CalculationResult {
  let currentDate = parseISO(config.startDate);
  let remainingHours = config.totalHours;
  let classDaysCount = 0;
  const history: CalculationResult['history'] = [];

  // Proteção contra loops infinitos caso a configuração seja impossível (ex: 0 classDays ou 0 hoursPerDay)
  if (config.hoursPerDay <= 0 || config.classDays.length === 0) {
    throw new Error("Configuração inválida: Defina horas por dia e os dias da semana com aula.");
  }

  // Set para lookup O(1) dos feriados
  const holidaySet = new Set(config.holidays);

  let iterations = 0;
  const MAX_ITERATIONS = 3650; // Limite de segurança (10 anos letivos)

  while (remainingHours > 0 && iterations < MAX_ITERATIONS) {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 1 = Segunda...

    const override = overrides?.[dateString];
    const isHoliday = override ? (override.type === 'holiday') : holidaySet.has(dateString);
    const isClass = override ? (override.type === 'class') : (!isHoliday && config.classDays.includes(dayOfWeek));
    const isWeekendDay = isWeekend(currentDate);

    let finalType: 'class' | 'holiday' | 'weekend' | 'off-day';
    if (isHoliday) {
      finalType = 'holiday';
    } else if (isClass) {
      finalType = 'class';
      remainingHours -= config.hoursPerDay;
      classDaysCount++;
    } else if (isWeekendDay) {
      finalType = 'weekend';
    } else {
      finalType = 'off-day';
    }

    history.push({ date: dateString, type: finalType, note: override?.note });

    // Avança para o próximo dia se ainda restarem horas
    if (remainingHours > 0) {
      currentDate = addDays(currentDate, 1);
    }
    iterations++;
  }

  if (iterations >= MAX_ITERATIONS) {
    throw new Error("Erro no cálculo logístico: O período letivo excede 10 anos.");
  }

  return {
    endDate: format(currentDate, 'yyyy-MM-dd'),
    totalClassDays: classDaysCount,
    history
  };
}

export interface ModuleScheduleResult {
  moduleName: string;
  startDate: string;
  endDate: string;
  classDates: string[];
}

export interface DetailedScheduleResult {
  modules: ModuleScheduleResult[];
  fullHistory: CalculationResult['history'];
}

/**
 * Motor Logístico Avançado
 * Calcula o cronograma sequencial para múltiplos módulos.
 */
export function calculateDetailedSchedule(
  config: Omit<ScheduleConfig, 'totalHours'>,
  modules: { name: string; hours: number }[],
  overrides?: Record<string, { type?: 'class' | 'holiday' | 'off-day' | 'weekend'; note?: string }>
): DetailedScheduleResult {
  const holidaySet = new Set(config.holidays);
  const results: ModuleScheduleResult[] = [];
  const fullHistory: CalculationResult['history'] = [];
  
  let currentStartDate = parseISO(config.startDate);

  for (const module of modules) {
    let remainingHours = module.hours;
    let currentDate = currentStartDate;
    const classDates: string[] = [];
    
    // Se o módulo tem 0 horas, pula
    if (remainingHours <= 0) continue;

    let iterations = 0;
    while (remainingHours > 0 && iterations < 3650) {
      const dateString = format(currentDate, 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay();

      const override = overrides?.[dateString];
      const isHoliday = override ? (override.type === 'holiday') : holidaySet.has(dateString);
      const isClass = override ? (override.type === 'class') : (!isHoliday && config.classDays.includes(dayOfWeek));
      const isWeekendDay = isWeekend(currentDate);

      let finalType: 'class' | 'holiday' | 'weekend' | 'off-day';
      if (isHoliday) {
        finalType = 'holiday';
      } else if (isClass) {
        finalType = 'class';
        classDates.push(dateString);
        remainingHours -= config.hoursPerDay;
      } else if (isWeekendDay) {
        finalType = 'weekend';
      } else {
        finalType = 'off-day';
      }

      fullHistory.push({ date: dateString, type: finalType, note: override?.note });

      if (remainingHours > 0) {
        currentDate = addDays(currentDate, 1);
      }
      iterations++;
    }

    results.push({
      moduleName: module.name,
      startDate: classDates.length > 0 ? classDates[0] : format(currentDate, 'yyyy-MM-dd'),
      endDate: format(currentDate, 'yyyy-MM-dd'),
      classDates
    });

    // O próximo módulo começa no dia útil seguinte
    currentStartDate = addDays(currentDate, 1);
  }

  return {
    modules: results,
    fullHistory
  };
}
