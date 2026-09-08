// Lista de la compra semanal (SPEC-ux §2.5b). Va justo debajo de los menús y sus equivalencias.
// La pantalla pinta `ejemplos.compra` tal cual: no recalcula gramos, envases ni duraciones.

import { useState } from 'react'
import type { Ejemplos } from '../../engine/types'
import { Plegable } from '../ui/Controles'
import { IconoMarca } from '../ui/Iconos'
import { entero } from '../utiles/formato'
import {
  agruparPorSeccion,
  textoCantidadCiclo,
  textoCantidadDia,
  textoCantidadSemana,
  textoComprar,
  textoDura,
  textoModoSencillo,
} from './compra'
import { Seccion } from './comun'

/** [SPEC] SPEC-ux §2.5b, subtítulo literal del bloque. */
const SUBTITULO =
  'Para 7 días, con el formato en el que se vende cada cosa en Mercadona. Sin precios: cambian de una tienda a otra y de una semana a otra.'

/** En móvil la lista es larga y va plegada por defecto (§2.5b); en pantalla grande, abierta. */
function abiertaPorDefecto(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return !window.matchMedia('(max-width: 39.99rem)').matches
}

export function BloqueCompra({ ejemplos }: { ejemplos: Ejemplos }) {
  const compra = ejemplos.compra
  const [abierta] = useState(abiertaPorDefecto)
  if (!compra || compra.items.length === 0) return null

  const grupos = agruparPorSeccion(compra.items)
  const distintos = compra.alimentos_distintos

  return (
    <Seccion titulo={`Tu lista de la compra (${compra.supermercado})`} descripcion={SUBTITULO}>
      {/* La cabecera lleva el nº de alimentos distintos y los días; en modo sencillo, además, el
          distintivo literal de §2.5b. No se repiten los dos: dirían el mismo número dos veces. */}
      {ejemplos.modo_sencillo ? (
        <p className="distintivo-sencillo distintivo-ancho">
          <IconoMarca tam={14} />
          {textoModoSencillo(distintos)} para toda la semana.
        </p>
      ) : (
        <p className="compra-resumen">
          <span className="cifra compra-resumen-cifra">{entero(distintos)}</span>
          <span>
            {distintos === 1 ? 'alimento distinto' : 'alimentos distintos'} para {compra.dias} días
          </span>
        </p>
      )}

      <Plegable titulo="La lista, sección por sección" abiertoInicial={abierta}>
        <div className="compra-secciones">
          {grupos.map((grupo) => (
            <div className="compra-seccion" key={grupo.seccion}>
              <h3 className="compra-seccion-titulo">{grupo.nombre}</h3>
              <div className="tabla-envoltorio">
                <table className="tabla-compra">
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">Cantidad</th>
                      <th scope="col">Comprar</th>
                      <th scope="col">Dura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.items.map((item) => (
                      <tr key={item.alimento_id}>
                        <th scope="row">
                          <span className="compra-producto">{item.producto}</span>
                          <span className="compra-alimento">{item.nombre}</span>
                          {item.consejo ? (
                            <span className="compra-consejo">{item.consejo}</span>
                          ) : null}
                        </th>
                        <td data-etiqueta="Cantidad">
                          <span className="cifra compra-dato">{textoCantidadSemana(item)}</span>
                          <span className="compra-secundario">{textoCantidadDia(item)}</span>
                        </td>
                        <td data-etiqueta="Comprar">
                          <span className="compra-dato">{textoComprar(item)}</span>
                        </td>
                        <td data-etiqueta="Dura">
                          <span className="compra-dato">{textoDura(item)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Sección opcional "Para los días de regla" (§2.5b, v1.2): va al final, separada, y no
            entra en el recuento de alimentos distintos porque no es parte del plan. */}
        {compra.opcional_ciclo && compra.opcional_ciclo.items.length > 0 ? (
          <div className="compra-seccion compra-opcional">
            <h3 className="compra-seccion-titulo">{compra.opcional_ciclo.titulo}</h3>
            <p className="nota">{compra.opcional_ciclo.nota}</p>
            <div className="tabla-envoltorio">
              <table className="tabla-compra">
                {/* Tres columnas y no cuatro: esto no es compra de la semana, son dos raciones
                    para dos o tres días al mes, así que ni "al día" ni "te dura N días". */}
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Comprar</th>
                  </tr>
                </thead>
                <tbody>
                  {compra.opcional_ciclo.items.map((item) => (
                    <tr key={item.alimento_id}>
                      <th scope="row">
                        <span className="compra-producto">{item.producto}</span>
                        <span className="compra-alimento">{item.nombre}</span>
                        {item.consejo ? <span className="compra-consejo">{item.consejo}</span> : null}
                      </th>
                      <td data-etiqueta="Cantidad">
                        <span className="cifra compra-dato">{textoCantidadCiclo(item)}</span>
                      </td>
                      <td data-etiqueta="Comprar">
                        <span className="compra-dato">{textoComprar(item)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {compra.notas.length > 0 ? (
          <ul className="compra-notas">
            {compra.notas.map((nota) => (
              <li key={nota}>{nota}</li>
            ))}
          </ul>
        ) : null}
      </Plegable>
    </Seccion>
  )
}
