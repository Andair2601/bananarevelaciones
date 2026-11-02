import * as fs from 'fs';
import * as path from 'path';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';

/** Carpeta del catálogo dentro del bucket y del dominio: otros catálogos pueden ir al lado. */
const CATALOGO = 'revelaciones';

export interface RevelacionesStackProps extends StackProps {
  /** dev | prod — sigue la convención deco-eventos-{env}-* */
  envName: string;
  /** Dominio propio en Route 53. Sin él, la página queda en la URL de CloudFront. */
  dominio?: string;
}

/**
 * Página estática de revelaciones de Banana Deco Party, servida en /revelaciones/.
 * Bucket S3 privado + CloudFront con OAC; con dominio propio, certificado ACM y registros en Route 53.
 */
export class RevelacionesStack extends Stack {
  constructor(scope: Construct, id: string, props: RevelacionesStackProps) {
    super(scope, id, props);

    const prefix = `deco-eventos-${props.envName}`;
    const sitioDir = path.join(__dirname, '..', '..', 'site');
    const { dominio } = props;
    const www = dominio && `www.${dominio}`;

    const zona = dominio ? route53.HostedZone.fromLookup(this, 'Zona', { domainName: dominio }) : undefined;
    const certificado = dominio && zona
      ? new acm.Certificate(this, 'Certificado', {
          domainName: dominio,
          subjectAlternativeNames: [www!],
          validation: acm.CertificateValidation.fromDns(zona),
        })
      : undefined;

    const bucket = new s3.Bucket(this, 'SitioBucket', {
      bucketName: `${prefix}-revelaciones-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const cabeceras = new cloudfront.ResponseHeadersPolicy(this, 'Cabeceras', {
      responseHeadersPolicyName: `${prefix}-revelaciones-headers`,
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
      },
    });

    // Las rutas de la página son relativas: /revelaciones debe llevar la barra final.
    // Las redirecciones conservan la query (fbclid, utm_*) para no perder la atribución de anuncios.
    const rutas = new cloudfront.Function(this, 'Rutas', {
      functionName: `${prefix}-revelaciones-rutas`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function query(q) {
  var partes = [];
  Object.keys(q).forEach(function (k) {
    (q[k].multiValue || [q[k]]).forEach(function (v) {
      partes.push(k + (v.value ? '=' + v.value : ''));
    });
  });
  return partes.length ? '?' + partes.join('&') : '';
}
function redirigir(status, destino) {
  return { statusCode: status, statusDescription: 'Redirect', headers: { location: { value: destino } } };
}
function handler(event) {
  var r = event.request, uri = r.uri, host = r.headers.host ? r.headers.host.value : '';
  ${www ? `if (host === '${www}') return redirigir(301, 'https://${dominio}' + uri + query(r.querystring));` : ''}
  if (uri === '/') return redirigir(302, '/${CATALOGO}/' + query(r.querystring));
  if (uri === '/${CATALOGO}') return redirigir(301, '/${CATALOGO}/' + query(r.querystring));
  if (uri === '/${CATALOGO}/') r.uri = '/${CATALOGO}/index.html';
  return r;
}
`),
    });

    const distribucion = new cloudfront.Distribution(this, 'Distribucion', {
      comment: `${prefix} revelaciones`,
      domainNames: dominio ? [dominio, www!] : undefined,
      certificate: certificado,
      // Incluye ubicaciones de Sudamérica: carga más rápida en Perú
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cabeceras,
        compress: true,
        functionAssociations: [{ function: rutas, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: `/${CATALOGO}/index.html`, ttl: Duration.minutes(5) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: `/${CATALOGO}/index.html`, ttl: Duration.minutes(5) },
      ],
    });

    if (zona) {
      const destino = route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribucion));
      for (const [id, nombre] of [['Raiz', dominio!], ['Www', www!]]) {
        new route53.ARecord(this, `A${id}`, { zone: zona, recordName: nombre, target: destino });
        new route53.AaaaRecord(this, `Aaaa${id}`, { zone: zona, recordName: nombre, target: destino });
      }
    }

    const urlSitio = `https://${dominio ?? distribucion.distributionDomainName}/${CATALOGO}`;

    // Videos, imágenes y JS
    new s3deploy.BucketDeployment(this, 'Archivos', {
      sources: [s3deploy.Source.asset(sitioDir, { exclude: ['index.html'] })],
      destinationBucket: bucket,
      destinationKeyPrefix: CATALOGO,
      cacheControl: [s3deploy.CacheControl.setPublic(), s3deploy.CacheControl.maxAge(Duration.days(1))],
      prune: false,
      memoryLimit: 512,
      distribution: distribucion,
      distributionPaths: [`/${CATALOGO}/*`],
    });

    // index.html con la URL real de CloudFront en las etiquetas para compartir (og:image)
    const html = fs.readFileSync(path.join(sitioDir, 'index.html'), 'utf8').split('__SITE_URL__').join(urlSitio);
    new s3deploy.BucketDeployment(this, 'Pagina', {
      sources: [s3deploy.Source.data('index.html', html)],
      destinationBucket: bucket,
      destinationKeyPrefix: CATALOGO,
      contentType: 'text/html; charset=utf-8',
      cacheControl: [s3deploy.CacheControl.noCache()],
      prune: false,
      distribution: distribucion,
      distributionPaths: [`/${CATALOGO}/`, `/${CATALOGO}/index.html`],
    });

    new CfnOutput(this, 'UrlPagina', { value: `${urlSitio}/`, description: 'Link para compartir con los clientes' });
    new CfnOutput(this, 'Bucket', { value: bucket.bucketName });
  }
}
