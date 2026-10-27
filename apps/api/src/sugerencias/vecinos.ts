/** Utilidades comunes de las sugerencias por vecinos cercanos (MO min y troquelada). */

export interface Vecino {
  valor: number;
  distancia: number;
}

export interface Resumen {
  /** Mediana ponderada: los más parecidos pesan más. */
  valor: number;
  /** Percentiles 25 y 75 de los vecinos. */
  rango: [number, number];
  distanciaMedia: number;
}

export function resumirVecinos(vecinos: Vecino[]): Resumen {
  const pares = vecinos.map((v) => ({ valor: v.valor, peso: 1 / (v.distancia + 0.25) })).sort((a, b) => a.valor - b.valor);
  const total = pares.reduce((t, p) => t + p.peso, 0);
  let acumulado = 0;
  let valor = pares[pares.length - 1]!.valor;
  for (const p of pares) {
    acumulado += p.peso;
    if (acumulado >= total / 2) {
      valor = p.valor;
      break;
    }
  }
  const valores = pares.map((p) => p.valor);
  const percentil = (q: number) => valores[Math.min(valores.length - 1, Math.floor(q * valores.length))]!;
  return {
    valor,
    rango: [percentil(0.25), percentil(0.75)],
    distanciaMedia: vecinos.reduce((t, v) => t + v.distancia, 0) / vecinos.length,
  };
}

/** |log(a / b)|, o `faltante` si alguno de los dos no está. */
export function distanciaLog(a: number | null | undefined, b: number | null | undefined, faltante = 0.5): number {
  return a && b ? Math.abs(Math.log(a / b)) : faltante;
}

/** 0 si son iguales, 1 si son distintas, 0,5 si falta alguna. */
export function distanciaCategoria(a: string | null | undefined, b: string | null | undefined): number {
  return a && b ? (a === b ? 0 : 1) : 0.5;
}
