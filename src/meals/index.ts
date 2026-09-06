// STUB TEMPORAL — será sustituido por el generador real (docs/SPEC-ux-comidas-pdf.md §3 + src/data/foods.json).
// Mantener EXACTAMENTE esta firma exportada.
import type { Ejemplos, EjemploDia, Inputs, Resultado } from '../engine/types'

/** Genera un día de ejemplo (entreno y descanso) que cuadra con el reparto por comidas del motor. */
export function generarEjemplos(_inputs: Inputs, resultado: Resultado): Ejemplos {
  const dia = (tipo: 'entreno' | 'descanso'): EjemploDia => ({
    tipo,
    comidas: (tipo === 'entreno' ? resultado.reparto_entreno : resultado.reparto_descanso).map((c) => ({
      comida: c.comida,
      hora: c.hora,
      peri: c.peri,
      objetivo: { kcal: c.kcal, prot: c.prot, carb: c.carb, fat: c.fat },
      alimentos: [
        { id: 'pollo_pechuga', nombre: 'Pechuga de pollo', gramos: 150, medida: '1 pechuga mediana', kcal: 165, prot: 34, carb: 0, fat: 3 },
        { id: 'arroz_blanco', nombre: 'Arroz blanco (crudo)', gramos: 60, medida: '4 cucharadas', kcal: 215, prot: 4, carb: 47, fat: 1 },
        { id: 'aove', nombre: 'Aceite de oliva virgen extra', gramos: 10, medida: '1 cucharada', kcal: 90, prot: 0, carb: 0, fat: 10 },
      ],
      totales: { kcal: 470, prot: 38, carb: 47, fat: 14 },
      alternativas: ['Cambia el pollo por 150 g de merluza', 'Cambia el arroz por 250 g de patata cocida'],
    })),
    totales: { kcal: resultado.kcal_objetivo, prot: resultado.proteina_g, carb: resultado.carbohidratos_g, fat: resultado.grasa_g },
    notas: ['Ejemplo de muestra: el generador real aún no está implementado.'],
  })
  return {
    entreno: dia('entreno'),
    descanso: dia('descanso'),
    consejos: ['Pesa los alimentos en crudo la primera semana para calibrar el ojo.', 'Repite desayunos: menos decisiones, más adherencia.'],
  }
}
