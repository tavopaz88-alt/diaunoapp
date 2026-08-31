/**
 * Recorte cuadrado de la foto de perfil, en el cliente.
 *
 * Se recorta y se reescala antes de subir: la API solo acepta 600 KB, y una
 * foto de camara moderna pasa varios megas. Hacerlo aqui evita subir de mas
 * por un dato de conexion movil.
 */

const LADO = 512;
const CALIDAD = 0.85;

export async function recortarCuadrado(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen');
  }

  const imagen = await cargarImagen(archivo);
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;

  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no soporta canvas');

  // Recorte centrado: se toma el cuadrado mas grande que cabe en la imagen.
  const lado = Math.min(imagen.width, imagen.height);
  const x = (imagen.width - lado) / 2;
  const y = (imagen.height - lado) / 2;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagen, x, y, lado, lado, 0, 0, LADO, LADO);

  if ('close' in imagen && typeof imagen.close === 'function') imagen.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', CALIDAD),
  );
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return blob;
}

async function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap respeta la orientacion EXIF: sin esto, las fotos
  // tomadas en vertical con el telefono salen giradas.
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch {
      // Algunos navegadores no aceptan las opciones; se sigue con <img>.
    }
  }

  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}
