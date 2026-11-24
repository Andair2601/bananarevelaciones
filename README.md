# Banana Deco Party · Página de revelaciones

Página estática con los paquetes de efectos de revelación de género, efectos animados (humo, confeti, chispas frías y disparos), botón de WhatsApp por paquete y Pixel de Meta.

```
banana-revelaciones/
├── site/                  ← la página (lo que se sube a S3)
│   ├── index.html
│   ├── app.js             ← efectos, WhatsApp y Pixel (configuración arriba del archivo)
│   └── assets/            ← logo, videos, pósters e imagen para compartir
└── infra/                 ← AWS CDK: S3 privado + CloudFront
```

## 1. Configurar antes de desplegar

En `site/app.js`, al inicio:

```js
var CONFIG = {
  whatsapp: '51961323186',
  metaPixelId: ''   // ← pega aquí el ID de tu Pixel
};
```

**Pixel de Meta**: Administrador de eventos de Meta → Conectar orígenes de datos → Web → crea el Pixel y copia su ID (solo números). Con el ID puesto, la página envía:

| Evento | Cuándo |
|---|---|
| `PageView` | Al abrir la página |
| `ViewContent` | Cuando el cliente ve un paquete (con nombre y precio) |
| `Contact` | Cuando toca un botón de WhatsApp (con el paquete) |

Con `Contact` puedes optimizar tus anuncios hacia conversaciones de WhatsApp y ver qué paquete genera más interés.

## 2. Desplegar en AWS

Requisitos: Node 18+, AWS CLI con tu perfil configurado y la cuenta con bootstrap de CDK.

```bash
cd infra
npm install
npx cdk bootstrap                         # solo la primera vez por cuenta/región
npx cdk deploy -c env=prod --profile TU_PERFIL
```

Al terminar, la salida `UrlPagina` es el link para compartir:

- **prod**: `https://bananadecoparty.com/revelaciones/`, con certificado HTTPS y registros DNS en Route 53. `www` redirige al dominio sin `www`.
- **dev**: `https://<id>.cloudfront.net/revelaciones/`, sin dominio propio.

La raíz del dominio redirige a `/revelaciones/`. Cada catálogo vive en su propia carpeta del bucket, así otros eventos pueden ir al lado (por ejemplo `/bodas/`).

Se crea con la convención `deco-eventos-{env}-*`:

- Stack: `deco-eventos-prod-revelaciones`
- Bucket privado: `deco-eventos-prod-revelaciones-<cuenta>` (sin acceso público, solo CloudFront vía OAC)
- Distribución CloudFront con HTTPS, HTTP/2 y 3, y todas las ubicaciones (incluye Sudamérica)

**Permisos**: si despliegas con la política `deco-eventos-deployer`, verifica que permita asumir los roles de bootstrap de CDK (`cdk-*`). El despliegue crea S3, CloudFront (distribución, OAC, política de cabeceras) y una Lambda que copia los archivos al bucket.

Las etiquetas para compartir (la vista previa del link en WhatsApp/Facebook) se completan solas con la URL de CloudFront en cada despliegue.

## 3. Actualizar la página

Cambia los archivos en `site/` y vuelve a ejecutar `npx cdk deploy -c env=prod`. El despliegue limpia la caché de CloudFront.

- **Precios**: solo en el objeto `PRECIOS` al inicio de `site/app.js`. Paquetes, combos, adicionales, movilidad, textos "Desde", botones de WhatsApp y Pixel leen de ahí. Si cambias uno, actualiza también el número de respaldo que tiene el HTML (se ve un instante antes de que cargue el script). Los combos valen decoración + efecto, sin descuento.
- **Textos**: `site/index.html`.
- **Videos**: `humo-color` y `confeti` tienen dos versiones en `site/assets/`: `nombre.mp4` (1080×1920, hasta ~7 MB, para pantallas grandes) y `nombre-720.mp4` (720×1280, 2–4 MB, para celulares), más su póster `nombre.jpg` (720×1280). El video de muros de humo es uno solo, `muro.mp4` (720×1280, el original es de menor resolución) con su póster `muro.jpg`. En MP4 H.264 sin audio, y despliega con `cdk deploy`, no a mano en S3. Mantén clips cortos (8–15 s). Si reemplazas un video, usa un nombre nuevo y actualízalo en `index.html`: con el mismo nombre, quien ya visitó la página puede ver el anterior hasta un día.
- **Sello SUCAMEC**: cuando tengas el permiso, se puede agregar en la portada junto a los otros sellos.

## Probar en tu computadora

```bash
cd site
python3 -m http.server 8080
# abre http://localhost:8080
```
