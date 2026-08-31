/**
 * Alta y edicion de metas.
 *
 * El formulario cambia con el tipo: es donde se nota que la app no fuerza todo
 * a un checkbox. El tipo no se puede cambiar despues, porque define que
 * significan los registros ya guardados.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCargar, Aviso, Cargando, useEnvio } from '../componentes/basicos';
import type { DetalleMeta, Direccion, TipoMeta, Visibilidad } from '../tipos';

const TIPOS: { id: TipoMeta; nombre: string; que: string; ejemplos: string }[] = [
  {
    id: 'habito',
    nombre: 'Hábito',
    que: 'Solo importa cumplir o no cumplir. No hay nada que medir.',
    ejemplos: 'meditar, dormir 7 horas, no tomar alcohol',
  },
  {
    id: 'acumulativo',
    nombre: 'Acumulativo',
    que: 'Se suman unidades hasta llegar a un total.',
    ejemplos: 'leer un libro de 220 páginas, correr 100 km',
  },
  {
    id: 'medicion',
    nombre: 'Medición',
    que: 'Un número que sube o baja hacia un objetivo.',
    ejemplos: 'bajar de 210 a 190 lb, reducir cintura de 95 a 85 cm',
  },
  {
    id: 'hito',
    nombre: 'Hito',
    que: 'No se puede medir con una cifra. Importa qué produjiste cada semana.',
    ejemplos: 'armar una metodología de trabajo, aprender una canción',
  },
];

const VISIBILIDADES: { id: Visibilidad; nombre: string; que: string }[] = [
  {
    id: 'privada',
    nombre: 'Privada',
    que: 'Nadie ve nada, ni el título. Igual cuenta para tu constancia.',
  },
  {
    id: 'titulo',
    nombre: 'Solo el título',
    que: 'Ven el título y si la cumpliste cada día, pero no los valores.',
  },
  {
    id: 'completa',
    nombre: 'Completa',
    que: 'Ven título, cumplimiento y los valores o logros de cada semana.',
  },
];

export function MetaFormulario() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const { datos: detalle, cargando } = useCargar<DetalleMeta>(id ? `/metas/${id}` : null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoMeta>('habito');
  const [visibilidad, setVisibilidad] = useState<Visibilidad>('titulo');
  const [unidad, setUnidad] = useState('');
  const [valorInicial, setValorInicial] = useState('');
  const [valorObjetivo, setValorObjetivo] = useState('');
  const [direccion, setDireccion] = useState<Direccion>('bajar');

  const { ocupado, error, enviar } = useEnvio();

  useEffect(() => {
    if (!detalle) return;
    const m = detalle.meta;
    setTitulo(m.titulo);
    setDescripcion(m.descripcion ?? '');
    setTipo(m.tipo);
    setVisibilidad(m.visibilidad);
    setUnidad(m.unidad ?? '');
    setValorInicial(m.valor_inicial === null ? '' : String(m.valor_inicial));
    setValorObjetivo(m.valor_objetivo === null ? '' : String(m.valor_objetivo));
    setDireccion(m.direccion ?? 'bajar');
  }, [detalle]);

  if (editando && cargando) return <Cargando />;

  const cuerpo = () => {
    const base: Record<string, unknown> = { titulo, descripcion, visibilidad };
    if (tipo === 'acumulativo') {
      base.unidad = unidad;
      base.valor_objetivo = Number(valorObjetivo);
    }
    if (tipo === 'medicion') {
      base.unidad = unidad;
      base.valor_inicial = Number(valorInicial);
      base.valor_objetivo = Number(valorObjetivo);
      base.direccion = direccion;
    }
    if (!editando) base.tipo = tipo;
    return base;
  };

  return (
    <div className="contenido">
      <header>
        <h1>{editando ? 'Editar meta' : 'Nueva meta'}</h1>
      </header>

      <form
        className="pila"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await enviar(async () => {
            if (editando) await api.actualizar(`/metas/${id}`, cuerpo());
            else await api.crear('/metas', cuerpo());
          });
          if (ok) navegar('/metas', { replace: true });
        }}
      >
        {error && <Aviso>{error}</Aviso>}

        <div className="campo">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            required
            maxLength={120}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>

        {/* --- tipo: solo al crear --- */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="pila">
          <legend className="campo" style={{ padding: 0 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--texto-suave)' }}>
              Cómo se mide
            </span>
          </legend>

          {editando && (
            <p className="pista">
              El tipo no se puede cambiar: define que significan los registros que ya guardaste.
            </p>
          )}

          {TIPOS.map((t) => (
            <label
              key={t.id}
              className="tarjeta"
              style={{
                display: 'flex',
                gap: 12,
                cursor: editando ? 'default' : 'pointer',
                opacity: editando && tipo !== t.id ? 0.4 : 1,
                borderColor: tipo === t.id ? 'var(--acento)' : 'var(--borde)',
              }}
            >
              <input
                type="radio"
                name="tipo"
                value={t.id}
                checked={tipo === t.id}
                disabled={editando}
                onChange={() => setTipo(t.id)}
                style={{ width: 20, height: 20, marginTop: 2, flex: 'none' }}
              />
              <span>
                <strong>{t.nombre}</strong>
                <br />
                <span className="mini">{t.que}</span>
                <br />
                <span className="mini" style={{ fontStyle: 'italic' }}>
                  {t.ejemplos}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {/* --- configuracion segun el tipo --- */}
        {tipo === 'acumulativo' && (
          <div className="tarjeta pila">
            <div className="campo">
              <label htmlFor="unidad">Unidad</label>
              <input
                id="unidad"
                required
                maxLength={24}
                placeholder="paginas, km, entrenos"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="objetivo">Objetivo total</label>
              <input
                id="objetivo"
                type="number"
                inputMode="decimal"
                required
                min={0.01}
                step="any"
                value={valorObjetivo}
                onChange={(e) => setValorObjetivo(e.target.value)}
              />
            </div>
          </div>
        )}

        {tipo === 'medicion' && (
          <div className="tarjeta pila">
            <div className="campo">
              <label htmlFor="unidad">Unidad</label>
              <input
                id="unidad"
                required
                maxLength={24}
                placeholder="lb, cm, %"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
              />
            </div>
            <div className="fila">
              <div className="campo crece">
                <label htmlFor="inicial">Valor de hoy</label>
                <input
                  id="inicial"
                  type="number"
                  inputMode="decimal"
                  required
                  step="any"
                  value={valorInicial}
                  onChange={(e) => setValorInicial(e.target.value)}
                />
              </div>
              <div className="campo crece">
                <label htmlFor="objetivo">Objetivo</label>
                <input
                  id="objetivo"
                  type="number"
                  inputMode="decimal"
                  required
                  step="any"
                  value={valorObjetivo}
                  onChange={(e) => setValorObjetivo(e.target.value)}
                />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="direccion">Dirección</label>
              <select
                id="direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value as Direccion)}
              >
                <option value="bajar">Bajar (el objetivo es menor)</option>
                <option value="subir">Subir (el objetivo es mayor)</option>
              </select>
            </div>
          </div>
        )}

        {/* --- visibilidad --- */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="pila">
          <legend style={{ padding: 0 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--texto-suave)' }}>
              Quién puede ver esta meta
            </span>
          </legend>
          <p className="pista">
            Tu constancia siempre es visible para el grupo, elijas lo que elijas. Lo que se reserva
            es el contenido, no el esfuerzo.
          </p>

          {VISIBILIDADES.map((v) => (
            <label
              key={v.id}
              className="tarjeta-plana"
              style={{
                display: 'flex',
                gap: 12,
                cursor: 'pointer',
                outline: visibilidad === v.id ? '2px solid var(--acento)' : 'none',
              }}
            >
              <input
                type="radio"
                name="visibilidad"
                value={v.id}
                checked={visibilidad === v.id}
                onChange={() => setVisibilidad(v.id)}
                style={{ width: 20, height: 20, marginTop: 2, flex: 'none' }}
              />
              <span>
                <strong>{v.nombre}</strong>
                <br />
                <span className="mini">{v.que}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="campo">
          <label htmlFor="descripcion">Descripción (opcional)</label>
          <textarea
            id="descripcion"
            maxLength={1000}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <button className="boton boton-ancho" type="submit" disabled={ocupado}>
          {ocupado ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear meta'}
        </button>
        <button
          type="button"
          className="boton boton-secundario boton-ancho"
          onClick={() => navegar(-1)}
        >
          Cancelar
        </button>
      </form>
    </div>
  );
}
