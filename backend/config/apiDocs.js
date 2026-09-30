// Monta la documentación OpenAPI (Swagger UI en /api-docs + spec crudo en /api-docs.json) SOLO fuera
// de producción. En producción NO se monta: se ahorra el escaneo swagger-jsdoc al boot + la memoria de
// la UI (importa en instancias micro) y no se expone la superficie completa de la API. Los require de
// swagger-ui-express y del spec son LAZY → en prod ni se cargan. Devuelve true si montó, false si no.
function mountApiDocs(app) {
  if (process.env.NODE_ENV === 'production') return false;

  const swaggerUi = require('swagger-ui-express');
  const openapiSpec = require('./swagger');

  // El CSP por defecto de helmet (script-src/style-src 'self') bloquea los estilos/scripts inline de
  // Swagger UI → la UI se vería rota en un browser real. El helmet global ya seteó el header, así que hay
  // que REMOVERLO acá (setear contentSecurityPolicy:false no lo borra). Se quita SOLO en esta página
  // (contenido first-party de confianza); el CSP estricto del resto de la API queda.
  app.use('/api-docs',
    (req, res, next) => { res.removeHeader('Content-Security-Policy'); next(); },
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, { customSiteTitle: 'Crypto Exchange API' }));
  app.get('/api-docs.json', (req, res) => res.json(openapiSpec));
  return true;
}

module.exports = { mountApiDocs };
