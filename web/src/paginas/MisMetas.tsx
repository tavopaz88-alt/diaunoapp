import { Link } from 'react-router-dom';
import { useCargar, Aviso, Cargando, Etiqueta, Vacio } from '../componentes/basicos';
import { ResumenCorto, NOMBRE_TIPO, NOMBRE_VISIBILIDAD } from '../componentes/visualizaciones';
import type { Meta } from '../tipos';

interface Datos {
  limite_activas: number;
  metas: Meta[];
}

export function MisMetas() {
  const { datos, cargando, error } = useCargar<Datos>('/metas');

  if (cargando) return <Cargando />;
  if (error || !datos) return <div className="contenido"><Aviso>{error ?? 'No se pudo cargar'}</Aviso></div>;

  const activas = datos.metas.filter((m) => !m.archivada);
  const archivadas = datos.metas.filter((m) => m.archivada);
  const puedeCrear = activas.length < datos.limite_activas;

  return (
    <div className="contenido">
      <header className="fila-entre">
        <h1>Mis metas</h1>
        <span className="mini">
          {activas.length} de {datos.limite_activas}
        </span>
      </header>

      {activas.length === 0 && (
        <Vacio>
          Todavía no tenés metas. Empezá con una: es más fácil sostener una que tres.
        </Vacio>
      )}

      <div className="pila">
        {activas.map((meta) => (
          <Link key={meta.id} to={`/metas/${meta.id}`} className="tarjeta pila" style={{ color: 'inherit' }}>
            <div className="fila-entre">
              <h2 className="crece">{meta.titulo}</h2>
              {meta.completada_en && <Etiqueta variante="acento">completada</Etiqueta>}
            </div>
            <ResumenCorto resultado={meta.resultado} />
            <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Etiqueta>{NOMBRE_TIPO[meta.tipo]}</Etiqueta>
              <Etiqueta>{NOMBRE_VISIBILIDAD[meta.visibilidad]}</Etiqueta>
            </div>
          </Link>
        ))}
      </div>

      {puedeCrear ? (
        <Link className="boton boton-ancho" to="/metas/nueva">
          Nueva meta
        </Link>
      ) : (
        <p className="mini">
          Llegaste al limite de {datos.limite_activas} metas activas. Archiva una si queres cambiar
          de rumbo: el limite existe para sostener el foco, no por capacidad.
        </p>
      )}

      {archivadas.length > 0 && (
        <section className="pila">
          <h2 className="tenue">Archivadas</h2>
          {archivadas.map((meta) => (
            <Link
              key={meta.id}
              to={`/metas/${meta.id}`}
              className="tarjeta-plana fila-entre"
              style={{ color: 'inherit' }}
            >
              <span className="crece">{meta.titulo}</span>
              <ResumenCorto resultado={meta.resultado} />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
