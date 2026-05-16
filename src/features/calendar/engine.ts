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
  history: { date: string; type: 'class' | 'holiday' | 'weekend' | 'off-day' }[];
}

/**
 * Motor Logístico (Sentry Logistics Engine)
 * Calcula a data exata de término do curso pulando feriados, finais de semana e dias em que não há aula.
 */
export function calculateEndDate(config: ScheduleConfig): CalculationResult {
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

    // 1. Verifica se é feriado (Recesso)
    if (holidaySet.has(dateString)) {
      history.push({ date: dateString, type: 'holiday' });
    } 
    // 2. Verifica se o dia da semana está na grade da turma
    else if (config.classDays.includes(dayOfWeek)) {
      history.push({ date: dateString, type: 'class' });
      remainingHours -= config.hoursPerDay;
      classDaysCount++;
    } 
    // 3. É fim de semana sem aula
    else if (isWeekend(currentDate)) {
      history.push({ date: dateString, type: 'weekend' });
    } 
    // 4. É dia útil, mas a turma não tem aula (ex: Turma de Seg/Qua/Sex, e hoje é Terça)
    else {
      history.push({ date: dateString, type: 'off-day' });
    }

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
