import { EXTERNAL_API_PREFIX } from '#constants/external_api.constants';
import { EXTERNAL_OPENAPI_SPEC } from '#constants/external_openapi';
const SCALAR_HTML = `<!doctype html>
<html>
  <head>
    <title>Mauna API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '${EXTERNAL_API_PREFIX}/openapi.json',
        layout: 'classic',
        theme: 'kepler',
        agent: { disabled: true },
        hideModels: true,
        hideClientButton: true,
        hideSearch: true,
        documentDownloadType: 'none',
        defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
      })
    </script>
  </body>
</html>
`;
export default class ExternalDocsController {
    spec({ response }) {
        return response.json(EXTERNAL_OPENAPI_SPEC);
    }
    ui({ response }) {
        return response.header('Content-Type', 'text/html; charset=utf-8').send(SCALAR_HTML);
    }
}
//# sourceMappingURL=docs_controller.js.map