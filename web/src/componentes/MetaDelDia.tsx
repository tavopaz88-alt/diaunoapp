/**
 * Una meta en la pantalla de Hoy.
 *
 * La interacción principal no cambió: un toque en la fila marca o desmarca el
 * día, y sigue siendo la mayor parte del área tocable. El criterio de los diez
 * segundos manda.
 *
 * El detalle —cuánto hiciste, qué hiciste— vive detrás del botón "+" y es
 * siempre opcional. No entra en la constancia: esa se calcula solo con la marca,
 * para que siga siendo comparable entre personas sin importar quién anota más.
 */

import { useState } from 'react';
import { Palomita } from './basicos';
import { ResumenCorto } from './visualizaciones';
import type { DetalleDia, MetaDeHoy } from '../tipos';

const LARGO_NOTA = 300;

interface Props {
  meta: MetaDeHoy;
  fecha: string;
  cumplida: boolean;
  detalle: DetalleDia | undefined;
  onAlternar: () => void;
  onGuardarDetalle: (datos: { cantidad?: number; nota?: string }) => Promise<void>;
  onBorrarDetalle: () => Promise<void>;
}

function numero(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

export function MetaDelDia({
  meta,
  cumplida,
  detalle,
  onAlternar,
  onGuardarDetalle,
  onBorrarDetalle,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const esAcumulativa = meta.tipo === 'acumulativo';
  const hayDetalle = detalle?.cantidad != null || Boolean(detalle?.nota);

  function abrir() {
    if (!abierto) {
      setCantidad(detalle?.cantidad != null ? String(detalle.cantidad) : '');
      setNota(detalle?.nota ?? '');
    }
    setAbierto(!abierto);
  }

  async function guardar() {
    setGuardando(true);
    try {
      const datos: { cantidad?: number; nota?: string } = {};
      if (esAcumulativa && cantidad.trim() !== '') datos.cantidad = Number(cantidad);
      if (nota.trim() !== '') datos.nota = nota.trim();
      await onGuardarDetalle(datos);
      setAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className={cumplida ? 'marca cumplida' : 'marca'}>
        {/* El área grande sigue siendo marcar/desmarcar. */}
        <button className="marca-principal" onClick={onAlternar} aria-pressed={cumplida}>
          <span className="marca-caja" aria-hidden="true">
            <Palomita />
          </span>
          <span className="crece">
            <span className="marca-titulo">{meta.titulo}</span>
            <ResumenCorto resultado={meta.resultado} />

            {/* Lo anotado ese día, si hay algo. */}
            {hayDetalle && (
              <span className="mini" style={{ display: 'block', marginTop: 2 }}>
                {detalle?.cantidad != null && (
                  <strong>
                    {numero(detalle.cantidad)} {meta.unidad}
                    {meta.objetivo_diario ? ` de ${numero(meta.objetivo_diario)}` : ''}
                  </strong>
                )}
                {detalle?.cantidad != null && detalle?.nota ? ' · ' : ''}
                {detalle?.nota}
              </span>
            )}
          </span>
        </button>

        <button
          className={hayDetalle ? 'marca-mas con-detalle' : 'marca-mas'}
          onClick={abrir}
          aria-expanded={abierto}
          aria-label={hayDetalle ? 'Editar el detalle del día' : 'Anotar detalle del día'}
        >
          {abierto ? '×' : hayDetalle ? '✎' : '+'}
        </button>
      </div>

      {abierto && (
        <div className="tarjeta-plana pila" style={{ marginTop: 6 }}>
          {esAcumulativa && (
            <div className="campo">
              <label htmlFor={`cantidad-${meta.id}`}>¿Cuánto hiciste hoy?</label>
              <div className="fila">
                <input
                  id={`cantidad-${meta.id}`}
                  className="crece"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
                <span className="tenue" style={{ flex: 'none' }}>
                  {meta.unidad}
                </span>
              </div>
              {meta.objetivo_diario ? (
                <span className="pista">
                  Te propusiste {numero(meta.objetivo_diario)} {meta.unidad} por día. Anotá lo que
                  hiciste de verdad, aunque sea menos: el avance se suma igual.
                </span>
              ) : (
                <span className="pista">Se suma al total de tu meta.</span>
              )}
            </div>
          )}

          <div className="campo">
            <label htmlFor={`nota-${meta.id}`}>¿Qué hiciste?</label>
            <textarea
              id={`nota-${meta.id}`}
              maxLength={LARGO_NOTA}
              style={{ minHeight: 64 }}
              placeholder="Un apunte corto para acordarte"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>

          <div className="fila">
            <button
              className="boton crece"
              disabled={guardando || (cantidad.trim() === '' && nota.trim() === '')}
              onClick={() => void guardar()}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            {hayDetalle && (
              <button
                className="boton boton-fantasma"
                disabled={guardando}
                onClick={async () => {
                  setGuardando(true);
                  try {
                    await onBorrarDetalle();
                    setCantidad('');
                    setNota('');
                    setAbierto(false);
                  } finally {
                    setGuardando(false);
                  }
                }}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
