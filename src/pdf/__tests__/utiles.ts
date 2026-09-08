// Utilidad de test: saca el TEXTO que de verdad se imprime en un PDF ya renderizado.
//
// @react-pdf/renderer comprime el contenido de cada página con Flate y escribe cada letra como un
// código hexadecimal dentro de un array `TJ` (con el kerning entre medias), así que buscar una
// frase sobre el búfer crudo no encuentra nunca nada y un "undefined" impreso en la página pasaba
// desapercibido en los tests. Aquí se descomprimen los flujos y se recomponen las letras.
//
// `DecompressionStream`, `Blob` y `Response` son estándar en Node 18+: no hace falta ninguna
// dependencia nueva ni los tipos de Node.

/** Bytes a texto latin1, sin `Buffer`: `tsconfig.app` no trae los tipos de Node. */
function aLatin1(bytes: Uint8Array): string {
  let salida = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    salida += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return salida
}

async function inflar(bytes: Uint8Array): Promise<string> {
  const flujo = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
  return aLatin1(new Uint8Array(await new Response(flujo).arrayBuffer()))
}

/** Concatena las letras (hexadecimales) de los arrays `TJ` de un flujo de contenido. */
function letras(contenido: string): string {
  let salida = ''
  for (const trozo of contenido.matchAll(/<([0-9a-fA-F]+)>/g)) {
    const hex = trozo[1]
    for (let i = 0; i + 1 < hex.length; i += 2) {
      salida += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16))
    }
  }
  return salida
}

/**
 * Texto imprimible del PDF, en el orden en que se escribió. Las palabras de una misma cadena salen
 * pegadas; entre cadenas distintas no hay separador, así que se busca por fragmentos
 * ("Favoritos:"), no por párrafos enteros.
 */
export async function textoDelPdf(buffer: {
  toString(codificacion: 'latin1'): string
}): Promise<string> {
  const crudo = buffer.toString('latin1')
  const re = /\/Length (\d+)[^]{0,200}?stream\r?\n/g
  let m: RegExpExecArray | null
  let texto = ''
  while ((m = re.exec(crudo)) !== null) {
    const inicio = m.index + m[0].length
    const bytes = Uint8Array.from(crudo.slice(inicio, inicio + Number(m[1])), (c: string) =>
      c.charCodeAt(0),
    )
    try {
      texto += letras(await inflar(bytes))
    } catch {
      // No era un flujo desinflable (fuentes, metadatos): no aporta texto de página.
    }
  }
  return texto
}
