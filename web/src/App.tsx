import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './lib/sesion';
import { Cargando } from './componentes/basicos';
import { Navegacion } from './componentes/Navegacion';

import { Entrar } from './paginas/Entrar';
import { Registro } from './paginas/Registro';
import { Recuperar } from './paginas/Recuperar';
import { Restablecer } from './paginas/Restablecer';
import { Instalacion } from './paginas/Instalacion';
import { Unirse } from './paginas/Unirse';
import { Hoy } from './paginas/Hoy';
import { MisMetas } from './paginas/MisMetas';
import { MetaFormulario } from './paginas/MetaFormulario';
import { MetaDetalle } from './paginas/MetaDetalle';
import { RegistroSemanal } from './paginas/RegistroSemanal';
import { Comunidad } from './paginas/Comunidad';
import { PerfilPublico } from './paginas/PerfilPublico';
import { Resumen } from './paginas/Resumen';
import { MiPerfil } from './paginas/MiPerfil';
import { Admin } from './paginas/Admin';

export function App() {
  const { cargando, perfil, inscrito } = useSesion();

  if (cargando) {
    return (
      <div className="centrado">
        <Cargando />
      </div>
    );
  }

  // Sin sesion: solo autenticacion e instalacion.
  if (!perfil) {
    return (
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="/instalar" element={<Instalacion />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    );
  }

  // Con cuenta pero fuera del reto activo: hace falta el codigo de invitacion.
  if (!inscrito) {
    return (
      <Routes>
        <Route path="/unirse" element={<Unirse />} />
        <Route path="*" element={<Navigate to="/unirse" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Hoy />} />
        <Route path="/metas" element={<MisMetas />} />
        <Route path="/metas/nueva" element={<MetaFormulario />} />
        <Route path="/metas/:id" element={<MetaDetalle />} />
        <Route path="/metas/:id/editar" element={<MetaFormulario />} />
        <Route path="/semanal" element={<RegistroSemanal />} />
        <Route path="/comunidad" element={<Comunidad />} />
        <Route path="/comunidad/:userId" element={<PerfilPublico />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/perfil" element={<MiPerfil />} />
        <Route path="/admin" element={perfil.es_admin ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Navegacion />
    </div>
  );
}
